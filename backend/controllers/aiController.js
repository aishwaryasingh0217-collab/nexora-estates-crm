const { processChatMessage } = require('../services/aiService');

/**
 * POST /api/ai/chat
 * Handles incoming chat query, checks role permissions, and returns AI response payload
 */
const chat = async (req, res, next) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Chat prompt message is required.'
      });
    }

    const userRole = req.user ? req.user.role : 'ADMIN';
    const aiResponse = await processChatMessage(message, userRole, conversationHistory || []);

    res.status(200).json({
      status: 'success',
      data: {
        prompt: message,
        reply: aiResponse.reply,
        source: aiResponse.source,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat
};
