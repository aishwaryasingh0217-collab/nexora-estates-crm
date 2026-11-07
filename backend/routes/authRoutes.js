const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isDemoMode } = require('../services/demoMode');

// GET /api/auth/config — public flags the sign-in page needs.
// Demo logins are on in development and off in production unless DEMO_MODE=true.
router.get('/config', (req, res) => {
  res.json({ status: 'success', data: { demoLogins: isDemoMode() } });
});

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (Protected Route)
router.get('/me', authenticateToken, getMe);

module.exports = router;
