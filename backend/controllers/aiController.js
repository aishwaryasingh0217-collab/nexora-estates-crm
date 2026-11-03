const { processChatMessage, analyzeLeadCopilot, matchPropertyInventory } = require('../services/aiService');

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

/**
 * GET /api/ai/lead-copilot/:id
 * Fetches AI lead intent analysis, heat score, recommended action, and customized follow-up pitches
 */
const getLeadCopilotAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Lead ID is required.'
      });
    }

    const analysis = await analyzeLeadCopilot(id);

    res.status(200).json({
      status: 'success',
      data: analysis
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/property-matcher
 * Natural language AI inventory matcher & comparison matrix
 */
const matchInventory = async (req, res, next) => {
  try {
    const { query = '', filters = {} } = req.body || {};
    const matchResults = await matchPropertyInventory(query, filters);

    res.status(200).json({
      status: 'success',
      data: matchResults
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  getLeadCopilotAnalysis,
  matchInventory
};
