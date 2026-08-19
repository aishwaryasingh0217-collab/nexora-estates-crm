/**
 * Role-Based Access Control (RBAC) Middleware
 * @param {...string} allowedRoles Roles allowed to access the route ('SUPER_ADMIN', 'ADMIN')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required prior to role verification.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation.`
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
