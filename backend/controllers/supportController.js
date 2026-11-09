/**
 * Real Estate CRM - Support Controller
 * Handles customer support ticket submissions, CRM ticket queue, status updates, and email dispatch.
 */

const crypto = require('crypto');
const pool = require('../config/db');
const { leadIdScope, isField } = require('../services/recordScope');
/** Agents see tickets assigned to them or about their clients; partners see their clients' tickets. */
const ticketScope = (user) => {
  const s = leadIdScope(user, 't.lead_id');
  if (!s) return null;
  return user.role === 'CHANNEL_PARTNER' ? s : { sql: `(t.assigned_to = ? OR ${s.sql})`, params: [user.id, ...s.params] };
};
const { resolveCustomerIdentity } = require('../services/whatsappService');
const {
  sendSupportTicketNotification,
  sendCustomerTicketConfirmation
} = require('../services/emailService');

/**
 * Helper: Generate unique human-readable ticket number (e.g. TCK-8492)
 */
async function generateTicketNumber() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ticketNumber = `TCK-${Date.now().toString().slice(-4)}${randomSuffix}`;
  return ticketNumber;
}

/**
 * POST /api/support/tickets
 * Public endpoint: Submit support request from customer portal / WhatsApp escalation
 */
const createPublicTicket = async (req, res, next) => {
  try {
    const {
      full_name,
      phone,
      email,
      subject,
      description,
      priority,
      whatsapp_conversation_id
    } = req.body;

    if (!full_name || !phone || !email || !subject || !description) {
      return res.status(400).json({
        status: 'error',
        message: 'full_name, phone, email, subject, and description are required fields.'
      });
    }

    // Auto-resolve or associate with customer/lead identity
    const identity = await resolveCustomerIdentity(phone, full_name);

    const ticketId = crypto.randomUUID();
    const ticketNumber = await generateTicketNumber();
    const ticketPriority = (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority.toUpperCase()))
      ? priority.toUpperCase()
      : 'MEDIUM';

    await pool.query(
      `INSERT INTO support_tickets (
        id, ticket_number, customer_id, lead_id, whatsapp_conversation_id,
        full_name, phone, email, subject, description, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [
        ticketId,
        ticketNumber,
        identity.customerId || null,
        identity.leadId || null,
        whatsapp_conversation_id || null,
        full_name.trim(),
        phone.trim(),
        email.trim().toLowerCase(),
        subject.trim(),
        description.trim(),
        ticketPriority
      ]
    );

    const ticketPayload = {
      id: ticketId,
      ticket_number: ticketNumber,
      customer_id: identity.customerId,
      lead_id: identity.leadId,
      whatsapp_conversation_id,
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      description: description.trim(),
      status: 'OPEN',
      priority: ticketPriority
    };

    // Asynchronously dispatch email alerts without blocking client response
    setImmediate(async () => {
      try {
        await sendSupportTicketNotification(ticketPayload);
        await sendCustomerTicketConfirmation(ticketPayload);
      } catch (emailErr) {
        console.error('[Support Email Alert Error]:', emailErr.message);
      }
    });

    res.status(201).json({
      status: 'success',
      message: `Your support request has been received. Your ticket number is #${ticketNumber}. Our support team will review your request and contact you using the details provided.`,
      data: {
        ticketNumber,
        ticketId,
        status: 'OPEN'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/support/tickets
 * Protected CRM staff endpoint: List and filter tickets
 */
const getTickets = async (req, res, next) => {
  try {
    const { status, priority, search } = req.query;

    let query = `
      SELECT t.*,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name,
             l.first_name AS lead_first_name, l.last_name AS lead_last_name,
             u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
      FROM support_tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN leads l ON t.lead_id = l.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status.toUpperCase());
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority.toUpperCase());
    }

    if (search) {
      query += ` AND (t.ticket_number LIKE ? OR t.full_name LIKE ? OR t.phone LIKE ? OR t.email LIKE ? OR t.subject LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const scope = ticketScope(req.user);
    if (scope) {
      query += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [tickets] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: tickets
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/support/tickets/:id
 * Get ticket detail
 */
const getTicketById = async (req, res, next) => {
  try {
    const [tickets] = await pool.query(
      `SELECT t.*,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              l.first_name AS lead_first_name, l.last_name AS lead_last_name,
              u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
       FROM support_tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN leads l ON t.lead_id = l.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = ?${ticketScope(req.user) ? ` AND ${ticketScope(req.user).sql}` : ''}`,
      [req.params.id, ...(ticketScope(req.user) ? ticketScope(req.user).params : [])]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Support ticket not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: tickets[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/support/tickets/:id
 * Update status, priority, assignee, or resolution notes
 */
const updateTicket = async (req, res, next) => {
  try {
    const { status, priority, assigned_to, resolution_notes } = req.body;

    const [existing] = await pool.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
    if (existing.length && isField(req.user) && existing[0].assigned_to !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Only the person the request is assigned to can update it.' });
    }
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Support ticket not found.'
      });
    }

    let query = 'UPDATE support_tickets SET ';
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status.toUpperCase());
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority.toUpperCase());
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to || null);
    }
    if (resolution_notes !== undefined) {
      updates.push('resolution_notes = ?');
      params.push(resolution_notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No update parameters provided.'
      });
    }

    query += updates.join(', ') + ', updated_at = NOW() WHERE id = ?';
    params.push(req.params.id);

    await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      message: 'Support ticket updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPublicTicket,
  getTickets,
  getTicketById,
  updateTicket
};
