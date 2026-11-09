const express = require('express');
const router = express.Router();
const { chat, getLeadCopilotAnalysis, matchInventory } = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// POST /api/ai/chat
// The older assistant answers from company-wide figures, so it stays with managers
const { denyFieldRoles } = require('../services/recordScope');
router.post('/chat', denyFieldRoles('Use the assistant in your workspace — it only uses your own records.'), chat);

// GET /api/ai/lead-copilot/:id
router.get('/lead-copilot/:id', denyFieldRoles(), getLeadCopilotAnalysis);

// POST /api/ai/property-matcher
router.post('/property-matcher', matchInventory);

module.exports = router;
