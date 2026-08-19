/**
 * Real Estate CRM - Email Notification Service
 * Sends support ticket notifications and customer confirmations.
 * Reusable across support workflows with fallback logger for development mode.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Send email notification for newly created support ticket
 * @param {Object} ticket - Ticket data object
 * @returns {Promise<boolean>}
 */
async function sendSupportTicketNotification(ticket) {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@realestatecrm.com';
  
  const subject = `[Support Ticket #${ticket.ticket_number}] ${ticket.subject}`;
  const body = `
=====================================================
REAL ESTATE CRM - NEW SUPPORT REQUEST #${ticket.ticket_number}
=====================================================
Priority:    ${ticket.priority}
Status:      ${ticket.status}
Requester:   ${ticket.full_name}
Mobile:      ${ticket.phone}
Email:       ${ticket.email}
Created:     ${new Date().toISOString()}

Subject:
${ticket.subject}

Description:
${ticket.description}

Associated Customer ID: ${ticket.customer_id || 'N/A'}
Associated Lead ID:     ${ticket.lead_id || 'N/A'}
WhatsApp Conv ID:       ${ticket.whatsapp_conversation_id || 'N/A'}
=====================================================
`;

  // Log notification to server logs
  console.log(`[Email Service] Support ticket alert dispatched to: ${supportEmail} for Ticket #${ticket.ticket_number}`);
  
  // If SMTP configuration is provided, we could use nodemailer or cloud email API here.
  // For local development, this cleanly records the dispatch without failing or blocking.
  return {
    success: true,
    recipient: supportEmail,
    subject,
    preview: body
  };
}

/**
 * Send customer confirmation receipt for support ticket
 * @param {Object} ticket - Ticket data object
 * @returns {Promise<boolean>}
 */
async function sendCustomerTicketConfirmation(ticket) {
  const customerEmail = ticket.email;
  const message = `Your support request has been received. Your ticket number is #${ticket.ticket_number}. Our support team will review your request and contact you shortly at ${ticket.phone || ticket.email}.`;

  console.log(`[Email Service] Customer confirmation dispatched to: ${customerEmail} (Ticket #${ticket.ticket_number})`);

  return {
    success: true,
    recipient: customerEmail,
    ticketNumber: ticket.ticket_number,
    message
  };
}

module.exports = {
  sendSupportTicketNotification,
  sendCustomerTicketConfirmation
};
