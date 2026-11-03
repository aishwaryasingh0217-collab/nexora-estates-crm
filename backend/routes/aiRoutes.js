const express = require('express');
const router = express.Router();
const { chat, getLeadCopilotAnalysis, matchInventory } = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// POST /api/ai/chat
router.post('/chat', chat);

// GET /api/ai/lead-copilot/:id
router.get('/lead-copilot/:id', getLeadCopilotAnalysis);

// POST /api/ai/property-matcher
router.post('/property-matcher', matchInventory);

module.exports = router;
