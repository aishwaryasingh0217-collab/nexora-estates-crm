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

// 1. Marketplace Listings (Public Discovery)
router.get('/listings', getMarketplaceListings);
router.get('/summary', getMarketplaceSummary);

// 2. Priority Passes (Pre-Launch FOMO EOI)
router.get('/priority-passes', getPriorityPasses);
router.post('/priority-passes', createPriorityPass);

// 3. Group Buying Pools ("Pool & Save")
router.get('/group-pools', getGroupPools);
router.post('/group-pools', createGroupPool);
router.post('/group-pools/:id/join', joinGroupPool);

// 4. 7-Day Resale Deal Rooms (Transparent Offers)
router.get(['/deal-rooms', '/resale-deal-rooms'], getResaleDealRooms);
router.post(['/deal-rooms/:id/bid', '/resale-deal-rooms/:id/bid'], placeResaleBid);

// 5. Channel Partner 60-Day Client Lead Locks
router.get('/cp-lead-locks', getCPLeadLocks);
router.post('/cp-lead-locks', createCPLeadLock);

module.exports = router;
