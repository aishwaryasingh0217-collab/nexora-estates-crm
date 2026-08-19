const express = require('express');
const router = express.Router();
const { getDeals, getDealById, createDeal, updateDeal, cancelDeal } = require('../controllers/dealController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getDeals);
router.get('/:id', getDealById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createDeal);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateDeal);
router.post('/:id/cancel', authorizeRoles('SUPER_ADMIN'), cancelDeal);

module.exports = router;
