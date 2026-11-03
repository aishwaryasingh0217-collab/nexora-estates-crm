const express = require('express');
const router = express.Router();
const {
  getExecutiveAnalytics,
  getSalesFunnelReport,
  getInventoryReport,
  getSiteVisitsReport,
  getDealsReport,
  getPaymentsReport,
  getStaffPerformanceReport
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Executive BI Dashboard
router.get('/executive-analytics', getExecutiveAnalytics);
router.get('/analytics', getExecutiveAnalytics);

// Granular Reports
router.get('/sales-funnel', getSalesFunnelReport);
router.get('/inventory-status', getInventoryReport);
router.get('/site-visits', getSiteVisitsReport);
router.get('/deals-bookings', getDealsReport);
router.get('/payments-collections', getPaymentsReport);
router.get(['/staff-performance', '/agent-performance'], getStaffPerformanceReport);

// Legacy aliases for backward compatibility
router.get('/leads-stage', getSalesFunnelReport);
router.get('/leads-source', getSalesFunnelReport);
router.get('/revenue', getPaymentsReport);

module.exports = router;
