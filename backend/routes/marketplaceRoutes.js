const express = require('express');
const router = express.Router();
const {
  getMarketplaceListings,
  getMarketplaceSummary,
  getPriorityPasses,
  createPriorityPass,
  getGroupPools,
  createGroupPool,
  joinGroupPool,
  getResaleDealRooms,
  placeResaleBid,
  getCPLeadLocks,
  createCPLeadLock
} = require('../controllers/marketplaceController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { enquirySpamGuard } = require('../middleware/spamGuard');

// 1. Marketplace Listings (Public Discovery)
router.get('/listings', getMarketplaceListings);
router.get('/summary', getMarketplaceSummary);

// 2. Priority Passes (Pre-Launch FOMO EOI)
router.get('/priority-passes', getPriorityPasses);
router.post('/priority-passes', enquirySpamGuard, createPriorityPass);

// 3. Group Buying Pools ("Pool & Save")
router.get('/group-pools', getGroupPools);
router.post('/group-pools', createGroupPool);
router.post('/group-pools/:id/join', enquirySpamGuard, joinGroupPool);

// 4. 7-Day Resale Deal Rooms (Transparent Offers)
router.get(['/deal-rooms', '/resale-deal-rooms'], getResaleDealRooms);
router.post(['/deal-rooms/:id/bid', '/resale-deal-rooms/:id/bid'], enquirySpamGuard, placeResaleBid);

// 5. Channel Partner 60-Day Client Lead Locks
// Partner lead locks contain client names & phone numbers — managers only
router.get('/cp-lead-locks', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN'), getCPLeadLocks);
router.post('/cp-lead-locks', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN'), createCPLeadLock);

module.exports = router;
