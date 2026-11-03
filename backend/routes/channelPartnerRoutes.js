const express = require('express');
const router = express.Router();
const {
  getChannelPartners,
  getBrokerSummary,
  getChannelPartnerById,
  createChannelPartner,
  updateChannelPartner,
  recordCommissionPayout
} = require('../controllers/channelPartnerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/summary', getBrokerSummary);
router.get('/', getChannelPartners);
router.get('/:id', getChannelPartnerById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createChannelPartner);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateChannelPartner);
router.post('/payouts', authorizeRoles('SUPER_ADMIN'), recordCommissionPayout);

module.exports = router;
