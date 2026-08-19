const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// POST /api/ai/chat
router.post('/chat', chat);

module.exports = router;
