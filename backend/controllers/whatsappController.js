/**
 * Real Estate CRM - WhatsApp Controller
 * Handles webhook verification, incoming WhatsApp payloads, and CRM admin chat management.
 */

const crypto = require('crypto');
const pool = require('../config/db');
const {
  verifyWebhookChallenge,
  processInboundMessage,
  sendWhatsAppMessage
} = require('../services/whatsappService');

/**
 * GET /api/whatsapp/webhook
 * Meta Webhook verification handshake
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifiedChallenge = verifyWebhookChallenge(mode, token, challenge);

  if (verifiedChallenge) {
    console.log('[WhatsApp Webhook] Handshake verified successfully.');
    return res.status(200).send(verifiedChallenge);
  }

  console.warn('[WhatsApp Webhook] Verification token mismatch.');
  return res.status(403).json({ status: 'error', message: 'Verification failed.' });
};

/**
 * POST /api/whatsapp/webhook
 * Inbound event receiver - Fast 200 response to prevent Meta timeout, asynchronous processing
 */
const handleWebhook = async (req, res) => {
  // Acknowledge Meta immediately
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          const fromPhone = message.from;
          const whatsappMessageId = message.id;
          const messageType = message.type || 'text';
          let messageContent = '';

          if (messageType === 'text') {
            messageContent = message.text?.body || '';
          } else if (messageType === 'button') {
            messageContent = message.button?.text || message.button?.payload || '';
          } else if (messageType === 'interactive') {
            messageContent = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
          } else {
            messageContent = `[${messageType} media received]`;
          }

          const contact = contacts.find(c => c.wa_id === fromPhone);
          const profileName = contact?.profile?.name || '';

          // Process asynchronously without blocking webhook thread
          setImmediate(async () => {
            try {
              await processInboundMessage({
                fromPhone,
                whatsappMessageId,
                messageContent,
                messageType,
                profileName,
                rawPayload: message
              });
            } catch (err) {
              console.error('[WhatsApp Inbound Processing Error]:', err.message);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error.message);
  }
};

/**
 * GET /api/whatsapp/conversations
 * List active WhatsApp conversations for CRM staff
 */
const getConversations = async (req, res, next) => {
  try {
    const { state, search } = req.query;

    let query = `
      SELECT wc.*,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.email AS customer_email,
             l.first_name AS lead_first_name, l.last_name AS lead_last_name, l.email AS lead_email, l.stage AS lead_stage,
             u.first_name AS agent_first_name, u.last_name AS agent_last_name,
             (SELECT message_content FROM whatsapp_messages WHERE conversation_id = wc.id ORDER BY created_at DESC LIMIT 1) AS last_message,
             (SELECT sender_type FROM whatsapp_messages WHERE conversation_id = wc.id ORDER BY created_at DESC LIMIT 1) AS last_sender,
             (SELECT COUNT(*) FROM whatsapp_messages WHERE conversation_id = wc.id) AS total_messages
      FROM whatsapp_conversations wc
      LEFT JOIN customers c ON wc.customer_id = c.id
      LEFT JOIN leads l ON wc.lead_id = l.id
      LEFT JOIN users u ON wc.assigned_agent_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (state) {
      query += ` AND wc.state = ?`;
      params.push(state.toUpperCase());
    }

    if (search) {
      query += ` AND (wc.phone_number LIKE ? OR c.first_name LIKE ? OR l.first_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY wc.last_message_at DESC`;

    const [conversations] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: conversations.length,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/whatsapp/conversations/:id/messages
 * Get message history for a conversation
 */
const getConversationMessages = async (req, res, next) => {
  try {
    const [conversation] = await pool.query(
      `SELECT wc.*,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              l.first_name AS lead_first_name, l.last_name AS lead_last_name
       FROM whatsapp_conversations wc
       LEFT JOIN customers c ON wc.customer_id = c.id
       LEFT JOIN leads l ON wc.lead_id = l.id
       WHERE wc.id = ?`,
      [req.params.id]
    );

    if (conversation.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found.'
      });
    }

    const [messages] = await pool.query(
      `SELECT * FROM whatsapp_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        conversation: conversation[0],
        messages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/whatsapp/conversations/:id/reply
 * Send manual agent reply from CRM to WhatsApp conversation
 */
const sendManualReply = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Reply message text is required.'
      });
    }

    const [conversations] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [req.params.id]);
    if (conversations.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found.'
      });
    }

    const conv = conversations[0];
    const sendResult = await sendWhatsAppMessage(conv.phone_number, message.trim());

    const messageId = crypto.randomUUID();
    const waMsgId = sendResult.messageId || `wamid.agent_${Date.now()}`;

    await pool.query(
      `INSERT INTO whatsapp_messages (
        id, conversation_id, whatsapp_message_id, sender_type, sender_phone,
        direction, message_type, message_content, delivery_status, processing_status
      ) VALUES (?, ?, ?, 'AGENT', ?, 'OUTBOUND', 'text', ?, 'SENT', 'PROCESSED')`,
      [
        messageId,
        conv.id,
        waMsgId,
        req.user ? req.user.username : 'AGENT',
        message.trim()
      ]
    );

    // Switch to HUMAN_ACTIVE if not already
    await pool.query(
      `UPDATE whatsapp_conversations 
       SET state = 'HUMAN_ACTIVE', 
           assigned_agent_id = COALESCE(assigned_agent_id, ?),
           last_message_at = NOW() 
       WHERE id = ?`,
      [req.user ? req.user.id : null, conv.id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Reply dispatched successfully.',
      data: {
        id: messageId,
        conversationId: conv.id,
        messageContent: message.trim()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/whatsapp/conversations/:id/state
 * Change conversation state (e.g. handover from AI to Human or resolve/close)
 */
const updateConversationState = async (req, res, next) => {
  try {
    const { state, assigned_agent_id } = req.body;
    const validStates = ['AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED'];

    if (!state || !validStates.includes(state.toUpperCase())) {
      return res.status(400).json({
        status: 'error',
        message: `State must be one of: ${validStates.join(', ')}`
      });
    }

    const [result] = await pool.query(
      `UPDATE whatsapp_conversations 
       SET state = ?, 
           assigned_agent_id = COALESCE(?, assigned_agent_id),
           updated_at = NOW()
       WHERE id = ?`,
      [state.toUpperCase(), assigned_agent_id || null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Conversation state updated to ${state.toUpperCase()}.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  getConversations,
  getConversationMessages,
  sendManualReply,
  updateConversationState
};
