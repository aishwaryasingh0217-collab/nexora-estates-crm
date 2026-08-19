/**
 * Real Estate CRM - WhatsApp Business Platform Service
 * Scalable webhook processing, identity resolution, deduplication, and AI auto-response.
 */

const crypto = require('crypto');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('../config/db');
const { processWhatsAppMessage } = require('./aiService');

/**
 * Clean & normalize phone numbers for consistent CRM matching
 * e.g., '+91 98765-43210' -> '919876543210' or '9876543210'
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

/**
 * Verify Webhook Challenge from Meta/WhatsApp
 */
function verifyWebhookChallenge(mode, token, challenge) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexora_whatsapp_verify_token_2026';
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

/**
 * Resolve Customer or Lead identity by phone number
 * Avoids duplicate lead creation and strictly isolates records.
 */
async function resolveCustomerIdentity(rawPhone, profileName = '') {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  const searchPatterns = [
    cleanPhone,
    `+${cleanPhone}`,
    cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone // match last 10 digits
  ];

  // 1. Search in existing Customers table
  const [customers] = await pool.query(
    `SELECT id, first_name, last_name, email, phone 
     FROM customers 
     WHERE phone LIKE ? OR phone LIKE ? OR phone LIKE ? 
     LIMIT 1`,
    [`%${searchPatterns[0]}%`, `%${searchPatterns[1]}%`, `%${searchPatterns[2]}%`]
  );

  if (customers.length > 0) {
    const c = customers[0];
    return {
      customerId: c.id,
      leadId: null,
      name: `${c.first_name} ${c.last_name || ''}`.trim(),
      email: c.email,
      phone: c.phone || rawPhone,
      isCustomer: true,
      isLead: false,
      isNew: false
    };
  }

  // 2. Search in existing Leads table
  const [leads] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, stage 
     FROM leads 
     WHERE phone LIKE ? OR phone LIKE ? OR phone LIKE ? 
     LIMIT 1`,
    [`%${searchPatterns[0]}%`, `%${searchPatterns[1]}%`, `%${searchPatterns[2]}%`]
  );

  if (leads.length > 0) {
    const l = leads[0];
    return {
      customerId: null,
      leadId: l.id,
      name: `${l.first_name} ${l.last_name || ''}`.trim(),
      email: l.email,
      phone: l.phone || rawPhone,
      isCustomer: false,
      isLead: true,
      isNew: false
    };
  }

  // 3. Completely new sender -> Auto-create a CRM Lead with source 'WHATSAPP'
  const newLeadId = crypto.randomUUID();
  const firstName = profileName && profileName.trim().length > 0 ? profileName.trim() : `WhatsApp Contact (${cleanPhone.slice(-4)})`;
  
  // Assign to super admin by default if available
  const [admins] = await pool.query(`SELECT id FROM users WHERE role_id = 1 LIMIT 1`);
  const assignedAgentId = admins.length > 0 ? admins[0].id : null;

  await pool.query(
    `INSERT INTO leads (id, first_name, phone, source, stage, assigned_agent_id, notes)
     VALUES (?, ?, ?, 'WHATSAPP', 'INCOMING', ?, ?)`,
    [newLeadId, firstName, rawPhone, assignedAgentId, 'Captured automatically from inbound WhatsApp conversation.']
  );

  return {
    customerId: null,
    leadId: newLeadId,
    name: firstName,
    email: null,
    phone: rawPhone,
    isCustomer: false,
    isLead: true,
    isNew: true
  };
}

/**
 * Get or create WhatsApp conversation record
 */
async function getOrCreateConversation(phone, identity) {
  const cleanPhone = normalizePhoneNumber(phone);

  const [existing] = await pool.query(
    `SELECT * FROM whatsapp_conversations WHERE phone_number = ? OR phone_number LIKE ? LIMIT 1`,
    [phone, `%${cleanPhone.slice(-10)}%`]
  );

  if (existing.length > 0) {
    const conv = existing[0];
    // Update linked customer/lead if newly identified
    if ((identity.customerId && !conv.customer_id) || (identity.leadId && !conv.lead_id)) {
      await pool.query(
        `UPDATE whatsapp_conversations 
         SET customer_id = COALESCE(?, customer_id),
             lead_id = COALESCE(?, lead_id),
             last_message_at = NOW() 
         WHERE id = ?`,
        [identity.customerId || null, identity.leadId || null, conv.id]
      );
    }
    return conv;
  }

  // Create new conversation
  const convId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO whatsapp_conversations (id, phone_number, customer_id, lead_id, state, last_message_at)
     VALUES (?, ?, ?, ?, 'AI_ACTIVE', NOW())`,
    [convId, phone, identity.customerId || null, identity.leadId || null]
  );

  const [newConv] = await pool.query(`SELECT * FROM whatsapp_conversations WHERE id = ?`, [convId]);
  return newConv[0];
}

/**
 * Send outbound WhatsApp message via Meta Cloud API (with mock/log fallback in dev)
 */
async function sendWhatsAppMessage(toPhone, messageText) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';

  if (!accessToken || !phoneNumberId || accessToken === 'placeholder_access_token') {
    console.log(`[WhatsApp Service] (Dev Mode / No Token) Simulating outbound message to ${toPhone}:`);
    console.log(`[WhatsApp Service] Message Content:\n${messageText}`);
    return {
      success: true,
      mode: 'MOCK_DISPATCH',
      messageId: `wamid.mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };
  }

  const postData = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone.replace(/\D/g, ''),
    type: 'text',
    text: { body: messageText }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${apiVersion}/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              mode: 'GRAPH_API',
              messageId: parsed.messages?.[0]?.id || `wamid.${Date.now()}`
            });
          } else {
            console.error('[WhatsApp Cloud API Error]:', parsed);
            resolve({ success: false, error: parsed.error?.message || 'API request failed' });
          }
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp Network Error]:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Inbound message processor with deduplication & AI auto-response
 */
async function processInboundMessage(messageEvent) {
  const {
    fromPhone,
    whatsappMessageId,
    messageContent,
    messageType = 'text',
    profileName = '',
    rawPayload = null
  } = messageEvent;

  if (!fromPhone || !whatsappMessageId || !messageContent) {
    return { status: 'skipped', reason: 'Missing required message parameters' };
  }

  // 1. Deduplication check using unique whatsapp_message_id
  const [existingMsg] = await pool.query(
    'SELECT id FROM whatsapp_messages WHERE whatsapp_message_id = ? LIMIT 1',
    [whatsappMessageId]
  );
  if (existingMsg.length > 0) {
    return { status: 'duplicate', messageId: whatsappMessageId };
  }

  // 2. Identify customer / lead
  const identity = await resolveCustomerIdentity(fromPhone, profileName);

  // 3. Resolve conversation
  const conversation = await getOrCreateConversation(fromPhone, identity);

  // 4. Save Inbound Message
  const inboundId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO whatsapp_messages (
      id, conversation_id, whatsapp_message_id, sender_type, sender_phone,
      direction, message_type, message_content, raw_payload, delivery_status, processing_status
    ) VALUES (?, ?, ?, 'CUSTOMER', ?, 'INBOUND', ?, ?, ?, 'DELIVERED', 'PROCESSED')`,
    [
      inboundId,
      conversation.id,
      whatsappMessageId,
      fromPhone,
      messageType,
      messageContent,
      rawPayload ? JSON.stringify(rawPayload) : null
    ]
  );

  await pool.query(
    `UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = ?`,
    [conversation.id]
  );

  // 5. Handle AI Response if conversation is in AI_ACTIVE state
  if (conversation.state === 'AI_ACTIVE' || conversation.state === 'HUMAN_REQUIRED') {
    // Retrieve recent conversation context (last 5 messages)
    const [recentMessages] = await pool.query(
      `SELECT sender_type, message_content, created_at 
       FROM whatsapp_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [conversation.id]
    );

    const history = recentMessages.reverse().map(m => ({
      sender: m.sender_type === 'CUSTOMER' ? 'user' : 'assistant',
      text: m.message_content
    }));

    // Process through existing AI Assistant (with customer privacy isolation)
    const aiResponse = await processWhatsAppMessage(
      messageContent,
      {
        customerId: identity.customerId,
        leadId: identity.leadId,
        name: identity.name,
        phone: fromPhone
      },
      history
    );

    // If human escalation triggered, update conversation state
    if (aiResponse.requiresEscalation) {
      await pool.query(
        `UPDATE whatsapp_conversations SET state = 'HUMAN_REQUIRED' WHERE id = ?`,
        [conversation.id]
      );
    }

    // Send AI reply back via WhatsApp
    const sendResult = await sendWhatsAppMessage(fromPhone, aiResponse.reply);

    // Save outbound AI message to database
    const outboundId = crypto.randomUUID();
    const outWaMsgId = sendResult.messageId || `wamid.out_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await pool.query(
      `INSERT INTO whatsapp_messages (
        id, conversation_id, whatsapp_message_id, sender_type, sender_phone,
        direction, message_type, message_content, delivery_status, processing_status
      ) VALUES (?, ?, ?, 'AI', ?, 'OUTBOUND', 'text', ?, 'SENT', 'PROCESSED')`,
      [
        outboundId,
        conversation.id,
        outWaMsgId,
        process.env.WHATSAPP_BUSINESS_PHONE || 'SYSTEM',
        aiResponse.reply
      ]
    );

    return {
      status: 'success',
      conversationId: conversation.id,
      identity,
      aiReply: aiResponse.reply,
      escalated: aiResponse.requiresEscalation
    };
  }

  return {
    status: 'received_human_active',
    conversationId: conversation.id,
    identity
  };
}

module.exports = {
  verifyWebhookChallenge,
  resolveCustomerIdentity,
  getOrCreateConversation,
  sendWhatsAppMessage,
  processInboundMessage
};
