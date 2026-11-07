const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Authentication Middleware: Verifies JWT token and checks active user status
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No authentication token provided.'
      });
    }

    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_realestate_crm_2026';
    const decoded = jwt.verify(token, secret);

    // Lightweight database check: verify user exists and status is ACTIVE, and (for tokens issued with a
    // session id) that the session hasn't been signed out from another device or by an administrator.
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.status, u.role_id, u.job_level, u.first_name, u.last_name,
              u.channel_partner_id, r.name AS role,
              s.id AS session_id, s.revoked_at AS session_revoked_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_sessions s ON s.id = ? AND s.user_id = u.id
       WHERE u.id = ?`,
      [decoded.sid || null, decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication failed. User profile no longer exists.'
      });
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        status: 'error',
        message: 'Access revoked. Account status is INACTIVE.'
      });
    }

    if (decoded.sid && (!user.session_id || user.session_revoked_at)) {
      return res.status(401).json({
        status: 'error',
        code: 'SESSION_ENDED',
        message: 'You were signed out of this device. Please sign in again.'
      });
    }
    if (decoded.sid) {
      pool.query(
        `UPDATE user_sessions SET last_seen_at = NOW()
          WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL 5 MINUTE)`,
        [decoded.sid]
      ).catch(() => {});
    }

    // Attach verified user payload to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      jobLevel: user.job_level || 'EXECUTIVE',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      channelPartnerId: user.channel_partner_id || null,
      sessionId: decoded.sid || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token has expired. Please log in again.'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token.'
      });
    }
    return next(error);
  }
};

module.exports = { authenticateToken };
