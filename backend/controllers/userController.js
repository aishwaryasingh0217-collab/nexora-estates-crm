const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Audit Logging Helper
 */
const recordAuditLog = async (performedBy, targetUserId, action, ipAddress, metadata) => {
  try {
    const auditId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO user_audit_logs (id, performed_by, target_user_id, action, ip_address, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [auditId, performedBy, targetUserId, action, ipAddress, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
  }
};

/**
 * GET /api/users
 * Returns list of users (SUPER_ADMIN and ADMIN view)
 */
const getUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.role_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Get details for a specific user
 */
const getUserById = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.role_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: users[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users
 * SUPER_ADMIN only: Provision new Admin / Super Admin user
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name, phone, role_name } = req.body;

    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, password, first_name, and last_name are required.'
      });
    }

    // Determine role_id (default to ADMIN = 2 if not specified)
    let roleId = 2; // ADMIN
    if (role_name && role_name.toUpperCase() === 'SUPER_ADMIN') {
      roleId = 1;
    }

    // Check existing username or email
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username.trim(), email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'A user with this username or email already exists.'
      });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [userId, roleId, username.trim(), email.trim().toLowerCase(), passwordHash, first_name.trim(), last_name.trim(), phone || null, req.user.id]
    );

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(req.user.id, userId, 'USER_CREATED', ipAddress, {
      username,
      email,
      role: roleId === 1 ? 'SUPER_ADMIN' : 'ADMIN'
    });

    res.status(210 || 201).json({
      status: 'success',
      message: 'User account created successfully.',
      data: {
        id: userId,
        username,
        email,
        firstName: first_name,
        lastName: last_name,
        role: roleId === 1 ? 'SUPER_ADMIN' : 'ADMIN',
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id
 * SUPER_ADMIN only: Update user profile
 */
const updateUser = async (req, res, next) => {
  try {
    const { first_name, last_name, phone, role_name } = req.body;

    const [users] = await pool.query('SELECT id, role_id FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.'
      });
    }

    let roleId = users[0].role_id;
    if (role_name) {
      roleId = role_name.toUpperCase() === 'SUPER_ADMIN' ? 1 : 2;
    }

    await pool.query(
      `UPDATE users 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           role_id = ?
       WHERE id = ?`,
      [first_name, last_name, phone, roleId, req.params.id]
    );

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(req.user.id, req.params.id, 'USER_UPDATED', ipAddress, {
      first_name,
      last_name,
      phone,
      roleId
    });

    res.status(200).json({
      status: 'success',
      message: 'User account updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/:id/access
 * SUPER_ADMIN only: Activate, Deactivate, or Revoke user access (status = 'ACTIVE' / 'INACTIVE')
 */
const updateUserAccess = async (req, res, next) => {
  try {
    const { action } = req.body; // 'activate', 'deactivate', 'revoke'

    if (!action || !['activate', 'deactivate', 'revoke'].includes(action.toLowerCase())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid access action. Must be one of: activate, deactivate, revoke.'
      });
    }

    const newStatus = action.toLowerCase() === 'activate' ? 'ACTIVE' : 'INACTIVE';
    const auditAction = action.toLowerCase() === 'activate' ? 'USER_ACTIVATED' : (action.toLowerCase() === 'revoke' ? 'ACCESS_REVOKED' : 'USER_DEACTIVATED');

    const [result] = await pool.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [newStatus, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.'
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(req.user.id, req.params.id, auditAction, ipAddress, {
      newStatus
    });

    res.status(200).json({
      status: 'success',
      message: `User account status updated to ${newStatus}.`,
      data: {
        userId: req.params.id,
        status: newStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserAccess
};
