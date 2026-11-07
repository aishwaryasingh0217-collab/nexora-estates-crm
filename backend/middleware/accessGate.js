const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { FIELD_ROLES } = require('../services/salesWorkspace');

/**
 * Agents and channel partners get their own scoped APIs under /workspace. The legacy CRM
 * endpoints return company-wide data (all leads, payments, partner bank details, reports),
 * so field roles are kept out of them here, in one place, instead of in every route file.
 *
 * Requests without a token pass straight through — public website endpoints keep working
 * and protected routes still reject them via authenticateToken.
 */
const FIELD_ALLOWED = [
  { path: /^\/workspace(\/|$)/ },
  { path: /^\/notifications(\/|$)/ },
  { path: /^\/auth(\/|$)/ },
  { path: /^\/health$/ },
  { path: /^\/projects(\/[^/]+)?$/, methods: ['GET'] },
  { path: /^\/rental-news(\/|$)/, methods: ['GET'] },
  { path: /^\/marketplace(\/|$)/ },
  { path: /^\/leads(\/|$)/ },
  { path: /^\/site-visits(\/|$)/ },
  { path: /^\/calendar(\/|$)/ },
  { path: /^\/deals(\/|$)/ },
  { path: /^\/channel-partners(\/|$)/ },
  { path: /^\/dashboard(\/|$)/ },
  { path: /^\/ai(\/|$)/ },
  { path: /^\/support(\/|$)/ }
];

const isAllowedForField = (method, path) =>
  FIELD_ALLOWED.some((rule) => rule.path.test(path) && (!rule.methods || rule.methods.includes(method)));

const fieldRoleGate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'super_secret_jwt_key_realestate_crm_2026');
  } catch {
    return next(); // invalid/expired token: let the route's own auth produce the proper 401
  }

  try {
    const [rows] = await pool.query(
      'SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
      [decoded.id]
    );
    const role = rows[0] && rows[0].role;
    if (role && FIELD_ROLES.includes(role) && !isAllowedForField(req.method, req.path)) {
      return res.status(403).json({
        status: 'error',
        message: 'This section is available to managers only. Use your workspace instead.'
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { fieldRoleGate, isAllowedForField };
