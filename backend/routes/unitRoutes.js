const express = require('express');
const router = express.Router();
const { getUnits, getUnitById, createUnit, updateUnit, holdUnit, generateUnitCostSheet } = require('../controllers/unitController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getUnits);
router.get('/:id', getUnitById);
router.all('/:id/cost-sheet', generateUnitCostSheet);

router.post('/', authorizeRoles('SUPER_ADMIN'), createUnit);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateUnit);
router.post('/:id/hold', authorizeRoles('SUPER_ADMIN'), holdUnit);

module.exports = router;
