const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);
// Company-wide revenue and pipeline figures: managers only (agents have their own Today view)
router.use(require('../services/recordScope').denyFieldRoles('The company dashboard is for managers. Your own figures are on your Today view.'));

router.get(['/', '/stats', '/summary'], getDashboardStats);

module.exports = router;
