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

    // Lightweight database check: verify user exists and status is ACTIVE
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.status, u.role_id, r.name AS role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [decoded.id]
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

    // Attach verified user payload to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      role_id: user.role_id
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
