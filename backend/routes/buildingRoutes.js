const express = require('express');
const router = express.Router();
const { getBuildings, getBuildingById, createBuilding, updateBuilding } = require('../controllers/buildingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getBuildings);
router.get('/:id', getBuildingById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createBuilding);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateBuilding);

module.exports = router;
