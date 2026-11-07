const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Audit Logging Helper Function
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
    console.error('[Audit Log Error]: Failed to write user audit log:', error.message);
  }
};

/**
 * POST /api/auth/login
 * Validates credentials (username or email), checks active status, records audit log,
 * updates last_login timestamp, and issues a JWT token containing user id and role.
 */
const login = async (req, res, next) => {
  try {
    // Support identifier / username / email in request body
    const identifier = req.body.identifier || req.body.username || req.body.email || req.body.login;
    const password = req.body.password;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!identifier || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username or email and password are required.'
      });
    }

    // 1. Fetch user by username OR email along with role name
    let users = [];
    try {
      const [dbUsers] = await pool.query(
        `SELECT u.id, u.role_id, u.username, u.email, u.password_hash, u.first_name, u.last_name, u.phone, u.status, u.job_level, r.name AS role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.username = ? OR u.email = ?`,
        [identifier.trim(), identifier.trim().toLowerCase()]
      );
      users = dbUsers;
    } catch (dbErr) {
      console.warn('[Auth DB Fallback]:', dbErr.message);
    }

    if (!users || users.length === 0) {
      // Record failed audit log for unauthenticated non-existent user attempt
      await recordAuditLog(null, null, 'LOGIN_FAILED', ipAddress, {
        reason: 'User not found',
        identifier
      });

      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials.'
      });
    }

    const user = users[0];

    // 2. Check user status (ACTIVE vs INACTIVE)
    if (user.status !== 'ACTIVE') {
      await recordAuditLog(user.id, user.id, 'LOGIN_FAILED', ipAddress, {
        reason: 'Account inactive',
        identifier
      });

      return res.status(403).json({
        status: 'error',
        message: 'Account is inactive. Access revoked.'
      });
    }

    // 3. Password Verification
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await recordAuditLog(user.id, user.id, 'LOGIN_FAILED', ipAddress, {
        reason: 'Incorrect password',
        identifier
      });

      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials.'
      });
    }

    // 4. Selected Access Level Role Validation
    const selectedRole = req.body.selectedRole || req.body.accessLevel || req.body.role;
    const ROLE_LABEL_ALIASES = { SALES_MANAGER: 'ADMIN', SALES_AGENT: 'INSIDE_SALES', FIELD_AGENT: 'OUTSIDE_SALES', SITE_AGENT: 'OUTSIDE_SALES' };
    const normalizedSelected = selectedRole ? selectedRole.toUpperCase().trim().replace(/\s+/g, '_') : null;
    if (normalizedSelected && user.role.toUpperCase() !== (ROLE_LABEL_ALIASES[normalizedSelected] || normalizedSelected)) {
      await recordAuditLog(user.id, user.id, 'LOGIN_FAILED', ipAddress, {
        reason: 'Access level role mismatch',
        identifier,
        selectedRole,
        actualRole: user.role
      });

      return res.status(403).json({
        status: 'error',
        message: `Access Level Mismatch: Selected role '${selectedRole}' does not match authenticated account privileges.`
      });
    }

    // 4. Update last_login timestamp
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]).catch(() => {});

    // 5. Record successful login audit log
    await recordAuditLog(user.id, user.id, 'LOGIN_SUCCESS', ipAddress, {
      role: user.role
    }).catch(() => {});

    // 6. Generate JWT Token containing user ID and role
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_realestate_crm_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // Each sign-in is a session the user (or an administrator) can end from another device
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        sid: sessionId
      },
      secret,
      { expiresIn }
    );
    const { exp } = jwt.decode(token);
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [sessionId, user.id, String(ipAddress).slice(0, 64), String(req.headers['user-agent'] || '').slice(0, 255), new Date(exp * 1000)]
    );

    // 7. Return response with token and user profile
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        jobLevel: user.job_level || 'EXECUTIVE',
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      user: users[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout — ends this device's session (the token stops working immediately)
 */
const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.sessionId) {
      await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE id = ? AND revoked_at IS NULL', [req.user.id, req.user.sessionId]);
    }
    await recordAuditLog(req.user.id, req.user.id, 'LOGOUT', req.ip, {}).catch(() => {});
    res.json({ status: 'success', message: 'Signed out.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  logout,
  login,
  getMe
};
