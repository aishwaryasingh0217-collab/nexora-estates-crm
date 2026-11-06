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
      `SELECT u.id, u.role_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at, u.channel_partner_id, u.is_available, r.name AS role
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
      `SELECT u.id, u.role_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at, u.channel_partner_id, u.is_available, r.name AS role
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
 * Resolves a role from the admin UI. Accepts real role names plus friendly aliases;
 * "AGENT" was what the old Add User modal sent and should never silently become ADMIN.
 */
const ROLE_ALIASES = {
  AGENT: 'INSIDE_SALES',
  SALES_AGENT: 'INSIDE_SALES',
  TELECALLER: 'INSIDE_SALES',
  FIELD_AGENT: 'OUTSIDE_SALES',
  SITE_AGENT: 'OUTSIDE_SALES',
  SALES_MANAGER: 'ADMIN',
  MANAGER: 'ADMIN',
  PARTNER: 'CHANNEL_PARTNER',
  BROKER: 'CHANNEL_PARTNER'
};

async function resolveRole(input) {
  if (!input) return null;
  const key = String(input).trim().toUpperCase().replace(/[\s-]+/g, '_');
  const name = ROLE_ALIASES[key] || key;
  const [rows] = await pool.query('SELECT id, name FROM roles WHERE name = ?', [name]);
  return rows[0] || null;
}

async function validatePartnerLink(roleName, channelPartnerId) {
  if (roleName !== 'CHANNEL_PARTNER') return { ok: true, value: null };
  if (!channelPartnerId) return { ok: false, message: 'Choose the partner firm this login belongs to.' };
  const [rows] = await pool.query('SELECT id FROM channel_partners WHERE id = ?', [channelPartnerId]);
  return rows[0] ? { ok: true, value: rows[0].id } : { ok: false, message: 'Partner firm not found.' };
}

/**
 * POST /api/users
 * SUPER_ADMIN only: provision any team member — manager, agent, or channel-partner login
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name, phone } = req.body;
    const roleInput = req.body.role_name || req.body.role;

    if (!username || !email || !password || !first_name) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, password and first name are required.'
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters.' });
    }

    const role = (await resolveRole(roleInput)) || (await resolveRole('INSIDE_SALES'));
    if (!role) {
      return res.status(400).json({ status: 'error', message: 'Unknown role. Run database migrations first.' });
    }
    const partnerLink = await validatePartnerLink(role.name, req.body.channel_partner_id);
    if (!partnerLink.ok) {
      return res.status(400).json({ status: 'error', message: partnerLink.message });
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
      `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status, created_by, channel_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [userId, role.id, username.trim(), email.trim().toLowerCase(), passwordHash, first_name.trim(), (last_name || '').trim(), phone || null, req.user.id, partnerLink.value]
    );

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(req.user.id, userId, 'USER_CREATED', ipAddress, {
      username,
      email,
      role: role.name
    });

    res.status(201).json({
      status: 'success',
      message: 'User account created successfully.',
      data: {
        id: userId,
        username,
        email,
        firstName: first_name,
        lastName: last_name,
        role: role.name,
        channelPartnerId: partnerLink.value,
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
    const { first_name, last_name, phone } = req.body;
    const roleInput = req.body.role_name || req.body.role;

    const [users] = await pool.query(
      'SELECT u.id, u.role_id, u.channel_partner_id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
      [req.params.id]
    );
    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.'
      });
    }

    let roleId = users[0].role_id;
    let roleName = users[0].role;
    if (roleInput) {
      const role = await resolveRole(roleInput);
      if (!role) return res.status(400).json({ status: 'error', message: 'Unknown role.' });
      roleId = role.id;
      roleName = role.name;
    }
    const partnerLink = await validatePartnerLink(roleName, req.body.channel_partner_id || users[0].channel_partner_id);
    if (!partnerLink.ok) {
      return res.status(400).json({ status: 'error', message: partnerLink.message });
    }

    await pool.query(
      `UPDATE users 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           role_id = ?,
           channel_partner_id = ?
       WHERE id = ?`,
      [first_name, last_name, phone, roleId, partnerLink.value, req.params.id]
    );

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await recordAuditLog(req.user.id, req.params.id, 'USER_UPDATED', ipAddress, {
      first_name,
      last_name,
      phone,
      role: roleName
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
