const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET /api/auth/config — public flags the sign-in page needs.
// Demo logins are on in development and off in production unless DEMO_MODE=true.
router.get('/config', (req, res) => {
  const flag = String(process.env.DEMO_MODE || '').toLowerCase();
  const demoLogins = flag ? flag === 'true' : process.env.NODE_ENV !== 'production';
  res.json({ status: 'success', data: { demoLogins } });
});

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (Protected Route)
router.get('/me', authenticateToken, getMe);

module.exports = router;
