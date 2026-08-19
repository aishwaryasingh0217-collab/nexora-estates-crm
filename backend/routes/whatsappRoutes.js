const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  handleWebhook,
  getConversations,
  getConversationMessages,
  sendManualReply,
  updateConversationState
} = require('../controllers/whatsappController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public Webhook Endpoints for Meta WhatsApp Business Platform
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// Protected CRM Endpoints for Staff & Admin Chat Management
router.get('/conversations', authenticateToken, getConversations);
router.get('/conversations/:id/messages', authenticateToken, getConversationMessages);
router.post('/conversations/:id/reply', authenticateToken, sendManualReply);
router.patch('/conversations/:id/state', authenticateToken, updateConversationState);

module.exports = router;
