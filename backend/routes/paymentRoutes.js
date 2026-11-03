const express = require('express');
const router = express.Router();
const {
  getPayments,
  getDealMilestones,
  recordPayment,
  createMilestone,
  getDemandNoticesSummary,
  getEligibleDemandNotices
} = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getPayments);
router.get('/milestones/:deal_id', getDealMilestones);
router.get('/demand-notices/summary', getDemandNoticesSummary);
router.get('/demand-notices/eligible', getEligibleDemandNotices);

router.post('/', authorizeRoles('SUPER_ADMIN'), recordPayment);
router.post('/milestones', authorizeRoles('SUPER_ADMIN'), createMilestone);

module.exports = router;

