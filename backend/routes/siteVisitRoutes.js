const express = require('express');
const router = express.Router();
const { getSiteVisits, getSiteVisitById, createSiteVisit, updateSiteVisit } = require('../controllers/siteVisitController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getSiteVisits);
router.get('/:id', getSiteVisitById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createSiteVisit);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateSiteVisit);

module.exports = router;
