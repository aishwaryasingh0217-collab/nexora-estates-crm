const express = require('express');
const router = express.Router();
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  bookLead,
  convertLeadToCustomer,
  handleLeadWebhook
} = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { enquirySpamGuard } = require('../middleware/spamGuard');

// Public intake: website forms + Meta Ads, 99acres, MagicBricks, Google Ads, Zapier
router.post('/webhook', enquirySpamGuard, handleLeadWebhook);

// Protected CRM routes
router.use(authenticateToken);

router.get('/', getLeads);
router.get('/:id', getLeadById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createLead);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateLead);
router.post('/:id/book', authorizeRoles('SUPER_ADMIN'), bookLead);
router.post('/:id/convert', authorizeRoles('SUPER_ADMIN'), convertLeadToCustomer);

module.exports = router;

