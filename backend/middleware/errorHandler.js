/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  if (!err.statusCode || err.statusCode >= 500) console.error('[Unhandled Error]:', err);

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  // Services attach a machine-readable code (e.g. UNIT_TAKEN) in err.extra for the screens to react to
  const extra = err.extra && typeof err.extra === 'object' ? err.extra : {};
  const serverFault = statusCode >= 500;
  res.status(statusCode).json({
    status: 'error',
    ...extra,
    message: serverFault && process.env.NODE_ENV === 'production' ? 'Something went wrong on our side. Please try again.' : (err.message || 'Internal Server Error'),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler;
