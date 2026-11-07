/**
 * Finance & accounts — payments, verification, receipts, invoices, milestones, refunds,
 * reconciliation and partner commissions.
 *
 * The rule that matters most: money is only "paid" once a finance user has VERIFIED it.
 *   recordPayment   → PENDING (nothing counts as collected yet)
 *   verifyPayment   → VERIFIED, receipt number issued, milestone / invoice updated
 *   rejectPayment   → REJECTED (bounced cheque, wrong amount …)
 * The person who recorded a payment can't verify it (a second pair of eyes).
 * Milestone status, receipts, collections and outstanding figures all count VERIFIED payments only.
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const { createApproval } = require('./approvalService');
const { notifyUsers, notifyRoles, usersWithRoles } = require('./notificationService');
const { logActivity, notifyPartner, fullName } = require('./salesWorkspace');

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const MODES = ['CHEQUE', 'BANK_TRANSFER', 'ONLINE', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CASH', 'DEMAND_DRAFT', 'CARD'];
const LIVE_DEALS = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const REFUND_APPROVERS = ['BUSINESS_OWNER', 'FINANCE:HEAD'];

function yymm() {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function uniqueNumber(prefix, table, column) {
  for (let i = 0; i < 6; i++) {
    const n = `${prefix}-${yymm()}-${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
    const [rows] = await pool.query(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [n]);
    if (!rows.length) return n;
  }
  return `${prefix}-${Date.now()}`;
}

async function dealSummary(dealId) {
  const [[deal]] = await pool.query(
    `SELECT d.*, u.unit_number, p.id AS project_id, p.name AS project_name,
            c.first_name, c.last_name, c.relationship_manager_id, l.assigned_agent_id
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id
       LEFT JOIN leads l ON l.id = d.lead_id
      WHERE d.id = ?`,
    [dealId]
  );
  if (!deal) throw httpError(404, 'Booking not found.');
  deal.client_name = fullName(deal.first_name, deal.last_name);
  return deal;
}

// ---------------------------------------------------------------------------- milestones & invoices

/** Recomputes a milestone from VERIFIED payments only. */
async function recomputeMilestone(milestoneId, conn = pool) {
  if (!milestoneId) return null;
  const [[m]] = await conn.query('SELECT id, due_amount, due_date, status FROM payment_milestones WHERE id = ?', [milestoneId]);
  if (!m) return null;
  const [[{ paid }]] = await conn.query(
    "SELECT COALESCE(SUM(amount_received), 0) AS paid FROM payments WHERE milestone_id = ? AND verification_status = 'VERIFIED'",
    [milestoneId]
  );
  const [[{ refunded }]] = await conn.query(
    "SELECT COALESCE(SUM(r.amount), 0) AS refunded FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.milestone_id = ? AND r.status = 'PROCESSED'",
    [milestoneId]
  );
  const net = Number(paid) - Number(refunded);
  const due = Number(m.due_amount);
  const overdue = m.due_date && new Date(m.due_date) < new Date(new Date().toDateString());
  const status = net >= due - 0.5 ? 'PAID' : overdue ? 'OVERDUE' : net > 0 ? 'PARTIAL' : 'PENDING';
  if (status !== m.status) await conn.query('UPDATE payment_milestones SET status = ? WHERE id = ?', [status, m.id]);
  await conn.query(
    `UPDATE invoices SET status = CASE WHEN ? = 'PAID' THEN 'PAID' WHEN ? > 0 THEN 'PARTIALLY_PAID' ELSE 'ISSUED' END
      WHERE milestone_id = ? AND status <> 'CANCELLED'`,
    [status, net, m.id]
  );
  return { status, paid: net, due };
}

async function listMilestones(dealId) {
  const [rows] = await pool.query(
    `SELECT pm.*,
            (SELECT COALESCE(SUM(amount_received), 0) FROM payments p WHERE p.milestone_id = pm.id AND p.verification_status = 'VERIFIED') AS verified_paid,
            (SELECT COALESCE(SUM(amount_received), 0) FROM payments p WHERE p.milestone_id = pm.id AND p.verification_status = 'PENDING') AS pending_verification
       FROM payment_milestones pm WHERE pm.deal_id = ? ORDER BY pm.due_date ASC`,
    [dealId]
  );
  return rows;
}

async function createInvoice(user, { dealId, milestoneId = null, amount, taxAmount = 0, dueDate = null, description = null }, req = null) {
  const deal = await dealSummary(dealId);
  if (!['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON'].includes(deal.status)) throw httpError(400, 'Invoices can only be raised on confirmed bookings.');
  let base = Number(amount);
  if (milestoneId) {
    const [[m]] = await pool.query('SELECT * FROM payment_milestones WHERE id = ? AND deal_id = ?', [milestoneId, dealId]);
    if (!m) throw httpError(400, 'That milestone does not belong to this booking.');
    if (!base) base = Number(m.due_amount);
    if (!dueDate) dueDate = m.due_date;
    if (!description) description = m.milestone_name;
    const [[open]] = await pool.query("SELECT invoice_number FROM invoices WHERE milestone_id = ? AND status <> 'CANCELLED'", [milestoneId]);
    if (open) throw httpError(409, `Invoice ${open.invoice_number} already exists for this milestone.`);
  }
  if (!(base > 0)) throw httpError(400, 'Enter the invoice amount.');
  const tax = Math.max(0, Number(taxAmount) || 0);
  const id = crypto.randomUUID();
  const number = await uniqueNumber('INV', 'invoices', 'invoice_number');
  await pool.query(
    `INSERT INTO invoices (id, invoice_number, deal_id, milestone_id, customer_id, description, amount, tax_amount, total_amount, issue_date, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
    [id, number, dealId, milestoneId, deal.customer_id, description ? String(description).slice(0, 255) : null, base, tax, base + tax, dueDate || null, user.id]
  );
  if (milestoneId) await recomputeMilestone(milestoneId);
  await audit.record({ req, action: 'INVOICE_ISSUED', entityType: 'INVOICE', entityId: id, summary: `${number} for ${deal.deal_number} (${deal.client_name}) — ${money(base + tax)}`, after: { deal_id: dealId, milestone_id: milestoneId, amount: base, tax_amount: tax } });
  return { id, invoiceNumber: number, total: base + tax };
}

async function cancelInvoice(user, invoiceId, reason, req = null) {
  const [[inv]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv) throw httpError(404, 'Invoice not found.');
  if (inv.status === 'PAID') throw httpError(409, 'A paid invoice cannot be cancelled.');
  if (inv.status === 'CANCELLED') return { id: inv.id, status: 'CANCELLED' };
  await pool.query("UPDATE invoices SET status = 'CANCELLED' WHERE id = ?", [inv.id]);
  await audit.record({ req, action: 'INVOICE_CANCELLED', entityType: 'INVOICE', entityId: inv.id, summary: `${inv.invoice_number} cancelled${reason ? `: ${reason}` : ''}`, before: { status: inv.status }, after: { status: 'CANCELLED', reason } });
  return { id: inv.id, status: 'CANCELLED' };
}

// ---------------------------------------------------------------------------- payments

async function recordPayment(user, b, req = null) {
  const dealId = b.deal_id || b.dealId;
  const amount = Number(b.amount_received ?? b.amount);
  const mode = String(b.payment_mode || b.mode || '').toUpperCase();
  const reference = b.reference_number || b.reference ? String(b.reference_number || b.reference).trim().slice(0, 100) : null;
  if (!dealId) throw httpError(400, 'Choose the booking this payment is for.');
  if (!(amount > 0)) throw httpError(400, 'Enter the amount received.');
  if (!MODES.includes(mode)) throw httpError(400, `Payment mode must be one of: ${MODES.join(', ')}.`);
  if (mode !== 'CASH' && !reference) throw httpError(400, 'Enter the cheque / UTR / transaction reference so finance can verify it.');

  const deal = await dealSummary(dealId);
  if (!['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON'].includes(deal.status)) {
    throw httpError(400, `Payments can only be recorded against confirmed bookings (this one is ${deal.status.toLowerCase().replace('_', ' ')}).`);
  }
  let milestone = null;
  if (b.milestone_id) {
    [[milestone]] = await pool.query('SELECT * FROM payment_milestones WHERE id = ? AND deal_id = ?', [b.milestone_id, dealId]);
    if (!milestone) throw httpError(400, 'That milestone does not belong to this booking.');
  }
  if (reference) {
    const [[dup]] = await pool.query(
      "SELECT payment_number FROM payments WHERE deal_id = ? AND reference_number = ? AND verification_status <> 'REJECTED'",
      [dealId, reference]
    );
    if (dup) throw httpError(409, `A payment with reference ${reference} is already recorded (${dup.payment_number}).`);
  }
  const date = b.payment_date ? new Date(b.payment_date) : new Date();
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000) throw httpError(400, 'Payment date cannot be in the future.');

  const id = crypto.randomUUID();
  const number = await uniqueNumber('PAY', 'payments', 'payment_number');
  await pool.query(
    `INSERT INTO payments (id, payment_number, deal_id, milestone_id, amount_received, payment_date, payment_mode, reference_number,
                           received_by, notes, verification_status, payer_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [id, number, dealId, milestone ? milestone.id : null, amount, date, mode, reference, user.id,
      b.notes ? String(b.notes).slice(0, 1000) : null, b.payer_name ? String(b.payer_name).slice(0, 150) : deal.client_name || null]
  );
  if (deal.lead_id) await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'PAYMENT', outcome: 'RECORDED', note: `${money(amount)} recorded by ${user.name} (${mode}${reference ? ` ${reference}` : ''}) — awaiting verification` });
  await notifyRoles(['FINANCE'], {
    type: 'INFO', title: `Verify payment ${number}`, message: `${money(amount)} from ${deal.client_name} (${deal.deal_number}) via ${mode}${reference ? `, ref ${reference}` : ''}. Recorded by ${user.name}.`,
    relatedEntityType: 'PAYMENT', relatedEntityId: id, category: 'PAYMENT_RECEIVED'
  }, user.id);
  await audit.record({
    req, action: 'PAYMENT_RECORDED', entityType: 'PAYMENT', entityId: id, result: 'PENDING',
    summary: `${number}: ${money(amount)} from ${deal.client_name} (${deal.deal_number}) via ${mode} — awaiting verification`,
    after: { deal_id: dealId, milestone_id: milestone ? milestone.id : null, amount, mode, reference, verification_status: 'PENDING' }
  });
  return { id, paymentNumber: number, status: 'PENDING', message: `Payment ${number} recorded. It counts as received only after finance verifies it.` };
}

async function verifyPayment(user, paymentId, { note = null } = {}, req = null) {
  const [[p]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!p) throw httpError(404, 'Payment not found.');
  if (p.verification_status !== 'PENDING') throw httpError(409, `Payment ${p.payment_number} is already ${p.verification_status.toLowerCase()}.`);
  if (p.received_by === user.id) throw httpError(403, 'Another finance team member must verify a payment you recorded.');
  const receipt = await uniqueNumber('RCPT', 'payments', 'receipt_number');
  const [r] = await pool.query(
    `UPDATE payments SET verification_status = 'VERIFIED', verified_by = ?, verified_at = NOW(), verification_note = ?, receipt_number = ?
      WHERE id = ? AND verification_status = 'PENDING'`,
    [user.id, note ? String(note).slice(0, 255) : null, receipt, p.id]
  );
  if (!r.affectedRows) throw httpError(409, 'Someone else just updated this payment.');
  const milestone = await recomputeMilestone(p.milestone_id);
  const deal = await dealSummary(p.deal_id);
  if (deal.lead_id) await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'PAYMENT', outcome: 'VERIFIED', note: `${money(p.amount_received)} verified — receipt ${receipt}` });
  await notifyUsers([deal.assigned_agent_id, deal.relationship_manager_id, p.received_by], {
    type: 'SUCCESS', title: `Payment confirmed: ${deal.client_name}`,
    message: `${money(p.amount_received)} for ${deal.deal_number} verified by finance. Receipt ${receipt}.`,
    relatedEntityType: 'PAYMENT', relatedEntityId: p.id, category: 'PAYMENT_CONFIRMED'
  }, user.id);
  await audit.record({
    req, action: 'PAYMENT_VERIFIED', entityType: 'PAYMENT', entityId: p.id,
    summary: `${p.payment_number}: ${money(p.amount_received)} verified — receipt ${receipt}${milestone ? `; milestone now ${milestone.status.toLowerCase()}` : ''}`,
    before: { verification_status: 'PENDING' }, after: { verification_status: 'VERIFIED', receipt_number: receipt, note }
  });
  return { id: p.id, receiptNumber: receipt, milestone };
}

async function rejectPayment(user, paymentId, reason, req = null) {
  if (!reason || String(reason).trim().length < 3) throw httpError(400, 'Say why the payment is rejected (e.g. cheque bounced).');
  const [[p]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!p) throw httpError(404, 'Payment not found.');
  if (p.verification_status !== 'PENDING') throw httpError(409, `Payment ${p.payment_number} is already ${p.verification_status.toLowerCase()}.`);
  await pool.query(
    "UPDATE payments SET verification_status = 'REJECTED', verified_by = ?, verified_at = NOW(), verification_note = ? WHERE id = ?",
    [user.id, String(reason).slice(0, 255), p.id]
  );
  await recomputeMilestone(p.milestone_id);
  const deal = await dealSummary(p.deal_id);
  if (deal.lead_id) await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'PAYMENT', outcome: 'REJECTED', note: `${money(p.amount_received)} (${p.payment_number}) rejected by finance: ${reason}` });
  await notifyUsers([p.received_by, deal.assigned_agent_id, deal.relationship_manager_id], {
    type: 'ERROR', title: `Payment rejected: ${deal.client_name}`, message: `${p.payment_number} (${money(p.amount_received)}) — ${reason}. Please follow up with the customer.`,
    relatedEntityType: 'PAYMENT', relatedEntityId: p.id, category: 'PAYMENT_OVERDUE'
  }, user.id);
  await audit.record({ req, action: 'PAYMENT_REJECTED', entityType: 'PAYMENT', entityId: p.id, summary: `${p.payment_number}: ${money(p.amount_received)} rejected — ${reason}`, before: { verification_status: 'PENDING' }, after: { verification_status: 'REJECTED', reason } });
  return { id: p.id, status: 'REJECTED' };
}

async function listPayments({ status = null, dealId = null, q = null, limit = 200 } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('p.verification_status = ?'); params.push(status); }
  if (dealId) { where.push('p.deal_id = ?'); params.push(dealId); }
  if (q) { where.push('(p.payment_number LIKE ? OR p.reference_number LIKE ? OR p.receipt_number LIKE ? OR d.deal_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)'); params.push(...Array(6).fill(`%${q}%`)); }
  const [rows] = await pool.query(
    `SELECT p.*, d.deal_number, d.agreed_total_amount, u.unit_number, pr.name AS project_name, pm.milestone_name,
            c.first_name, c.last_name, rb.first_name AS rec_first, rb.last_name AS rec_last, vb.first_name AS ver_first, vb.last_name AS ver_last
       FROM payments p
       JOIN deals d ON d.id = p.deal_id
       JOIN units u ON u.id = d.unit_id
       JOIN projects pr ON pr.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id
       LEFT JOIN payment_milestones pm ON pm.id = p.milestone_id
       LEFT JOIN users rb ON rb.id = p.received_by
       LEFT JOIN users vb ON vb.id = p.verified_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.verification_status = 'PENDING' DESC, p.created_at DESC LIMIT ?`,
    [...params, Math.min(Number(limit) || 200, 1000)]
  );
  return rows.map((r) => ({
    ...r,
    client_name: fullName(r.first_name, r.last_name),
    recorded_by_name: fullName(r.rec_first, r.rec_last) || null,
    verified_by_name: fullName(r.ver_first, r.ver_last) || null
  }));
}

/** Receipt data (only for VERIFIED payments). */
async function receipt(paymentId) {
  const [[p]] = await pool.query(
    `SELECT p.*, d.deal_number, d.agreed_total_amount, u.unit_number, pr.name AS project_name, pm.milestone_name,
            c.first_name, c.last_name, c.phone, c.email, c.address_line1, c.city
       FROM payments p JOIN deals d ON d.id = p.deal_id JOIN units u ON u.id = d.unit_id JOIN projects pr ON pr.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id LEFT JOIN payment_milestones pm ON pm.id = p.milestone_id
      WHERE p.id = ?`,
    [paymentId]
  );
  if (!p) throw httpError(404, 'Payment not found.');
  if (p.verification_status !== 'VERIFIED') throw httpError(409, 'A receipt is issued only after the payment is verified.');
  const [[{ total }]] = await pool.query("SELECT COALESCE(SUM(amount_received), 0) AS total FROM payments WHERE deal_id = ? AND verification_status = 'VERIFIED'", [p.deal_id]);
  return { ...p, client_name: fullName(p.first_name, p.last_name), total_verified: Number(total), balance: Number(p.agreed_total_amount) - Number(total) };
}

// ---------------------------------------------------------------------------- refunds

async function requestRefund(user, { dealId, paymentId = null, amount, reason }, req = null) {
  if (!reason || String(reason).trim().length < 5) throw httpError(400, 'Explain why the refund is due.');
  const amt = Number(amount);
  if (!(amt > 0)) throw httpError(400, 'Enter the refund amount.');
  const deal = await dealSummary(dealId);
  const [[{ verified }]] = await pool.query("SELECT COALESCE(SUM(amount_received), 0) AS verified FROM payments WHERE deal_id = ? AND verification_status = 'VERIFIED'", [dealId]);
  const [[{ committed }]] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS committed FROM refunds WHERE deal_id = ? AND status IN ('REQUESTED', 'APPROVED', 'PROCESSED')", [dealId]);
  const refundable = Number(verified) - Number(committed);
  if (amt > refundable + 0.5) throw httpError(400, `Only ${money(Math.max(refundable, 0))} of verified payments is left to refund on this booking.`);
  if (paymentId) {
    const [[p]] = await pool.query("SELECT id FROM payments WHERE id = ? AND deal_id = ? AND verification_status = 'VERIFIED'", [paymentId, dealId]);
    if (!p) throw httpError(400, 'Refunds can only be made against a verified payment on this booking.');
  }
  const id = crypto.randomUUID();
  const number = await uniqueNumber('RFD', 'refunds', 'refund_number');
  await pool.query(
    'INSERT INTO refunds (id, refund_number, deal_id, payment_id, amount, reason, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, number, dealId, paymentId, amt, String(reason).slice(0, 500), user.id]
  );
  await createApproval({
    type: 'REFUND', entityType: 'REFUND', entityId: id,
    title: `Refund ${number} — ${deal.client_name} (${deal.deal_number})`,
    details: `${money(amt)}: ${reason}. Requested by ${user.name}.`, amount: amt, requestedBy: user.id, approverRoles: REFUND_APPROVERS
  });
  await audit.record({ req, action: 'REFUND_REQUESTED', entityType: 'REFUND', entityId: id, result: 'PENDING', summary: `${number}: ${money(amt)} for ${deal.deal_number} — ${reason}`, after: { deal_id: dealId, payment_id: paymentId, amount: amt } });
  return { id, refundNumber: number, status: 'REQUESTED' };
}

async function decideRefund(refundId, user, approve, note, req = null) {
  const [[r]] = await pool.query('SELECT * FROM refunds WHERE id = ?', [refundId]);
  if (!r) throw httpError(404, 'Refund not found.');
  if (r.status !== 'REQUESTED') throw httpError(409, `Refund ${r.refund_number} is already ${r.status.toLowerCase()}.`);
  await pool.query(
    'UPDATE refunds SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?',
    [approve ? 'APPROVED' : 'REJECTED', user.id, note ? String(note).slice(0, 500) : null, r.id]
  );
  if (approve) {
    await notifyRoles(['FINANCE'], { type: 'INFO', title: `Refund approved: ${r.refund_number}`, message: `${money(r.amount)} approved by ${user.name}. Process the transfer and record the reference.`, relatedEntityType: 'REFUND', relatedEntityId: r.id, category: 'REFUND' }, user.id);
  }
  await audit.record({ req, action: approve ? 'REFUND_APPROVED' : 'REFUND_REJECTED', entityType: 'REFUND', entityId: r.id, summary: `${r.refund_number}: ${money(r.amount)} ${approve ? 'approved' : 'rejected'}${note ? ` — ${note}` : ''}`, before: { status: 'REQUESTED' }, after: { status: approve ? 'APPROVED' : 'REJECTED' } });
  return { id: r.id, status: approve ? 'APPROVED' : 'REJECTED' };
}

async function processRefund(user, refundId, { transactionReference }, req = null) {
  if (!transactionReference || String(transactionReference).trim().length < 3) throw httpError(400, 'Enter the bank transaction reference for the refund.');
  const [[r]] = await pool.query('SELECT * FROM refunds WHERE id = ?', [refundId]);
  if (!r) throw httpError(404, 'Refund not found.');
  if (r.status !== 'APPROVED') throw httpError(409, r.status === 'REQUESTED' ? 'This refund still needs approval.' : `Refund ${r.refund_number} is ${r.status.toLowerCase()}.`);
  await pool.query(
    "UPDATE refunds SET status = 'PROCESSED', processed_by = ?, processed_at = NOW(), transaction_reference = ? WHERE id = ? AND status = 'APPROVED'",
    [user.id, String(transactionReference).slice(0, 100), r.id]
  );
  if (r.payment_id) {
    const [[p]] = await pool.query('SELECT milestone_id FROM payments WHERE id = ?', [r.payment_id]);
    if (p) await recomputeMilestone(p.milestone_id);
  }
  const deal = await dealSummary(r.deal_id);
  await notifyUsers([r.requested_by, deal.relationship_manager_id], {
    type: 'SUCCESS', title: `Refund paid: ${r.refund_number}`, message: `${money(r.amount)} to ${deal.client_name} — ref ${transactionReference}.`,
    relatedEntityType: 'REFUND', relatedEntityId: r.id, category: 'REFUND'
  }, user.id);
  await audit.record({ req, action: 'REFUND_PROCESSED', entityType: 'REFUND', entityId: r.id, summary: `${r.refund_number}: ${money(r.amount)} paid out (ref ${transactionReference})`, before: { status: 'APPROVED' }, after: { status: 'PROCESSED', transaction_reference: transactionReference } });
  return { id: r.id, status: 'PROCESSED' };
}

async function listRefunds({ status = null } = {}) {
  const [rows] = await pool.query(
    `SELECT r.*, d.deal_number, c.first_name, c.last_name, rq.first_name AS req_first, rq.last_name AS req_last
       FROM refunds r JOIN deals d ON d.id = r.deal_id LEFT JOIN customers c ON c.id = d.customer_id
       LEFT JOIN users rq ON rq.id = r.requested_by
      ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.created_at DESC LIMIT 300`,
    status ? [status] : []
  );
  return rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), requested_by_name: fullName(r.req_first, r.req_last) }));
}

// ---------------------------------------------------------------------------- reconciliation

/** Imports bank statement lines and matches credits to payments by reference + amount. */
async function importBankLines(user, rows, req = null) {
  if (!Array.isArray(rows) || !rows.length) throw httpError(400, 'The statement has no rows.');
  if (rows.length > 3000) throw httpError(400, 'Import up to 3,000 lines at a time.');
  const batch = crypto.randomUUID();
  const out = { imported: 0, matched: 0, skipped: 0, problems: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const amount = Number(String(r.amount || r.credit || '').replace(/[,₹\s]/g, ''));
    const date = r.date || r.txn_date ? new Date(r.date || r.txn_date) : null;
    if (!(amount > 0) || !date || Number.isNaN(date.getTime())) { out.skipped++; if (out.problems.length < 30) out.problems.push({ row: i + 2, reason: 'Needs a date and a positive amount' }); continue; }
    const reference = r.reference ? String(r.reference).trim().slice(0, 120) : null;
    const direction = String(r.direction || 'CREDIT').toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT';
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO bank_statement_lines (id, import_batch, txn_date, amount, direction, reference, description, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, batch, date, amount, direction, reference, r.description ? String(r.description).slice(0, 255) : null, user.id]
    );
    out.imported++;
    if (direction === 'CREDIT' && reference) {
      const [[p]] = await pool.query(
        `SELECT id FROM payments WHERE UPPER(TRIM(reference_number)) = UPPER(?) AND ABS(amount_received - ?) < 1
            AND bank_line_id IS NULL AND verification_status <> 'REJECTED' LIMIT 1`,
        [reference, amount]
      );
      if (p) {
        await pool.query("UPDATE bank_statement_lines SET match_status = 'MATCHED', matched_payment_id = ?, matched_by = ?, matched_at = NOW() WHERE id = ?", [p.id, user.id, id]);
        await pool.query('UPDATE payments SET bank_line_id = ? WHERE id = ?', [id, p.id]);
        out.matched++;
      }
    }
  }
  await audit.record({ req, action: 'BANK_STATEMENT_IMPORTED', entityType: 'BANK_STATEMENT', entityId: batch, summary: `${out.imported} lines imported, ${out.matched} matched to payments automatically`, after: out });
  return { batch, ...out };
}

async function matchBankLine(user, lineId, paymentId, req = null) {
  const [[line]] = await pool.query('SELECT * FROM bank_statement_lines WHERE id = ?', [lineId]);
  if (!line) throw httpError(404, 'Statement line not found.');
  if (line.match_status === 'MATCHED') throw httpError(409, 'This line is already matched.');
  const [[p]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!p) throw httpError(404, 'Payment not found.');
  if (p.bank_line_id) throw httpError(409, `${p.payment_number} is already matched to another statement line.`);
  if (Math.abs(Number(p.amount_received) - Number(line.amount)) >= 1) throw httpError(400, `Amounts differ: statement ${money(line.amount)}, payment ${money(p.amount_received)}.`);
  await pool.query("UPDATE bank_statement_lines SET match_status = 'MATCHED', matched_payment_id = ?, matched_by = ?, matched_at = NOW() WHERE id = ?", [p.id, user.id, line.id]);
  await pool.query('UPDATE payments SET bank_line_id = ? WHERE id = ?', [line.id, p.id]);
  await audit.record({ req, action: 'BANK_LINE_MATCHED', entityType: 'PAYMENT', entityId: p.id, summary: `${p.payment_number} matched to bank credit ${money(line.amount)} (${line.reference || 'no ref'})`, after: { bank_line_id: line.id } });
  return { lineId: line.id, paymentId: p.id };
}

async function ignoreBankLine(user, lineId, req = null) {
  const [r] = await pool.query("UPDATE bank_statement_lines SET match_status = 'IGNORED', matched_by = ?, matched_at = NOW() WHERE id = ? AND match_status = 'UNMATCHED'", [user.id, lineId]);
  if (!r.affectedRows) throw httpError(409, 'Only unmatched lines can be ignored.');
  await audit.record({ req, action: 'BANK_LINE_IGNORED', entityType: 'BANK_STATEMENT', entityId: lineId, summary: 'Statement line marked as not a customer payment' });
  return { lineId };
}

async function listBankLines({ status = null } = {}) {
  const [rows] = await pool.query(
    `SELECT b.*, p.payment_number, p.verification_status FROM bank_statement_lines b LEFT JOIN payments p ON p.id = b.matched_payment_id
      ${status ? 'WHERE b.match_status = ?' : ''} ORDER BY b.txn_date DESC, b.created_at DESC LIMIT 500`,
    status ? [status] : []
  );
  return rows;
}

// ---------------------------------------------------------------------------- partner commissions

async function listCommissions({ status = null } = {}) {
  const [rows] = await pool.query(
    `SELECT bc.*, cp.firm_name, d.deal_number, d.status AS deal_status, u.unit_number, pr.name AS project_name,
            c.first_name, c.last_name
       FROM broker_commissions bc
       JOIN channel_partners cp ON cp.id = bc.partner_id
       JOIN deals d ON d.id = bc.deal_id
       JOIN units u ON u.id = d.unit_id JOIN projects pr ON pr.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id
      ${status ? 'WHERE bc.status = ?' : ''}
      ORDER BY bc.status = 'FULLY_PAID', bc.created_at DESC LIMIT 500`,
    status ? [status] : []
  );
  return rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), balance: Number(r.total_commission) - Number(r.paid_amount) }));
}

async function payCommission(user, commissionId, b, req = null) {
  const amount = Number(b.amount);
  const mode = String(b.payment_mode || 'NEFT').toUpperCase();
  if (!(amount > 0)) throw httpError(400, 'Enter the payout amount.');
  if (!['NEFT', 'RTGS', 'CHEQUE', 'UPI'].includes(mode)) throw httpError(400, 'Payout mode must be NEFT, RTGS, CHEQUE or UPI.');
  if (!b.transaction_reference) throw httpError(400, 'Enter the transfer reference.');
  const conn = await pool.getConnection();
  let bc;
  try {
    await conn.beginTransaction();
    [[bc]] = await conn.query(
      `SELECT bc.*, d.status AS deal_status, d.deal_number, cp.firm_name FROM broker_commissions bc
         JOIN deals d ON d.id = bc.deal_id JOIN channel_partners cp ON cp.id = bc.partner_id WHERE bc.id = ? FOR UPDATE`,
      [commissionId]
    );
    if (!bc) throw httpError(404, 'Commission not found.');
    if (!['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON'].includes(bc.deal_status)) throw httpError(409, `Booking ${bc.deal_number} is ${bc.deal_status.toLowerCase()} — no commission is payable.`);
    const balance = Number(bc.total_commission) - Number(bc.paid_amount);
    if (amount > balance + 0.5) throw httpError(400, `Only ${money(balance)} is still due on this commission.`);
    await conn.query(
      `INSERT INTO broker_payout_records (id, commission_id, partner_id, payout_amount, payment_mode, transaction_reference, payout_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), bc.id, bc.partner_id, amount, mode, String(b.transaction_reference).slice(0, 100), b.payout_date ? new Date(b.payout_date) : new Date(), b.notes || null]
    );
    const paid = Number(bc.paid_amount) + amount;
    await conn.query('UPDATE broker_commissions SET paid_amount = ?, status = ? WHERE id = ?', [paid, paid >= Number(bc.total_commission) - 0.5 ? 'FULLY_PAID' : 'PARTIALLY_PAID', bc.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await notifyPartner(bc.partner_id, { type: 'SUCCESS', title: `💸 Commission paid: ${money(amount)}`, message: `For ${bc.deal_number} via ${mode}, ref ${b.transaction_reference}.`, category: 'COMMISSION' });
  await audit.record({ req, action: 'COMMISSION_PAID', entityType: 'COMMISSION', entityId: bc.id, summary: `${money(amount)} paid to ${bc.firm_name} for ${bc.deal_number} (${mode} ${b.transaction_reference})`, before: { paid_amount: Number(bc.paid_amount) }, after: { paid_amount: Number(bc.paid_amount) + amount } });
  return { id: bc.id, paid: amount };
}

// ---------------------------------------------------------------------------- overview & reports

async function overview() {
  const [[t]] = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(agreed_total_amount), 0) FROM deals WHERE status IN ${LIVE_DEALS}) AS booked_value,
       (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p JOIN deals d ON d.id = p.deal_id WHERE p.verification_status = 'VERIFIED' AND d.status IN ${LIVE_DEALS}) AS collected,
       (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE status = 'PROCESSED') AS refunded,
       (SELECT COALESCE(SUM(amount_received), 0) FROM payments WHERE verification_status = 'PENDING') AS pending_verification_amount,
       (SELECT COUNT(*) FROM payments WHERE verification_status = 'PENDING') AS pending_verification,
       (SELECT COUNT(*) FROM refunds WHERE status IN ('REQUESTED', 'APPROVED')) AS open_refunds,
       (SELECT COALESCE(SUM(total_commission - paid_amount), 0) FROM broker_commissions bc JOIN deals d ON d.id = bc.deal_id WHERE d.status IN ${LIVE_DEALS}) AS commission_due,
       (SELECT COUNT(*) FROM bank_statement_lines WHERE match_status = 'UNMATCHED' AND direction = 'CREDIT') AS unmatched_bank_lines`
  );
  const [[o]] = await pool.query(
    `SELECT COUNT(*) AS overdue_count, COALESCE(SUM(pm.due_amount - (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p WHERE p.milestone_id = pm.id AND p.verification_status = 'VERIFIED')), 0) AS overdue_amount
       FROM payment_milestones pm JOIN deals d ON d.id = pm.deal_id
      WHERE d.status IN ${LIVE_DEALS} AND pm.status <> 'PAID' AND pm.due_date < CURDATE()`
  );
  const collectedNet = Number(t.collected) - Number(t.refunded);
  return {
    bookedValue: Number(t.booked_value),
    collected: collectedNet,
    outstanding: Math.max(Number(t.booked_value) - Number(t.collected), 0),
    refunded: Number(t.refunded),
    pendingVerification: Number(t.pending_verification),
    pendingVerificationAmount: Number(t.pending_verification_amount),
    openRefunds: Number(t.open_refunds),
    commissionDue: Number(t.commission_due),
    unmatchedBankLines: Number(t.unmatched_bank_lines),
    overdueCount: Number(o.overdue_count),
    overdueAmount: Number(o.overdue_amount)
  };
}

async function outstandingByDeal({ overdueOnly = false } = {}) {
  const [rows] = await pool.query(
    `SELECT d.id, d.deal_number, d.agreed_total_amount, d.status, u.unit_number, pr.name AS project_name, c.first_name, c.last_name, c.phone,
            (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p WHERE p.deal_id = d.id AND p.verification_status = 'VERIFIED') AS collected,
            (SELECT COALESCE(SUM(pm.due_amount), 0) FROM payment_milestones pm WHERE pm.deal_id = d.id AND pm.due_date < CURDATE()) AS due_till_date,
            (SELECT MIN(pm.due_date) FROM payment_milestones pm WHERE pm.deal_id = d.id AND pm.status <> 'PAID') AS next_due_date
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects pr ON pr.id = u.project_id LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.status IN ${LIVE_DEALS}
      ORDER BY next_due_date IS NULL, next_due_date ASC LIMIT 500`
  );
  return rows
    .map((r) => ({
      ...r, client_name: fullName(r.first_name, r.last_name),
      outstanding: Math.max(Number(r.agreed_total_amount) - Number(r.collected), 0),
      overdue: Math.max(Number(r.due_till_date) - Number(r.collected), 0)
    }))
    .filter((r) => (overdueOnly ? r.overdue > 0 : r.outstanding > 0));
}

async function projectPerformance() {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.name,
            COUNT(DISTINCT d.id) AS bookings,
            COALESCE(SUM(d.agreed_total_amount), 0) AS booked_value,
            (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p JOIN deals d2 ON d2.id = p.deal_id JOIN units u2 ON u2.id = d2.unit_id
              WHERE u2.project_id = pr.id AND p.verification_status = 'VERIFIED' AND d2.status IN ${LIVE_DEALS}) AS collected,
            (SELECT COALESCE(SUM(bc.total_commission), 0) FROM broker_commissions bc JOIN deals d3 ON d3.id = bc.deal_id JOIN units u3 ON u3.id = d3.unit_id
              WHERE u3.project_id = pr.id AND d3.status IN ${LIVE_DEALS}) AS commission
       FROM projects pr
       LEFT JOIN units u ON u.project_id = pr.id
       LEFT JOIN deals d ON d.unit_id = u.id AND d.status IN ${LIVE_DEALS}
      GROUP BY pr.id, pr.name
      HAVING bookings > 0
      ORDER BY booked_value DESC`
  );
  return rows.map((r) => ({ ...r, bookings: Number(r.bookings), booked_value: Number(r.booked_value), collected: Number(r.collected), commission: Number(r.commission), outstanding: Math.max(Number(r.booked_value) - Number(r.collected), 0) }));
}

async function collectionsByMonth(months = 12) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month, COALESCE(SUM(p.amount_received), 0) AS collected, COUNT(*) AS payments
       FROM payments p WHERE p.verification_status = 'VERIFIED' AND p.payment_date >= DATE_FORMAT(CURDATE() - INTERVAL ? MONTH, '%Y-%m-01')
      GROUP BY month ORDER BY month`,
    [months - 1]
  );
  return rows.map((r) => ({ month: r.month, collected: Number(r.collected), payments: Number(r.payments) }));
}

/** Daily job: milestones that slipped past their due date become OVERDUE; finance and the customer's RM hear once. */
async function markOverdueMilestones() {
  const [rows] = await pool.query(
    `SELECT pm.id, pm.milestone_name, pm.due_amount, pm.due_date, d.id AS deal_id, d.deal_number, c.first_name, c.last_name, c.relationship_manager_id
       FROM payment_milestones pm JOIN deals d ON d.id = pm.deal_id LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.status IN ${LIVE_DEALS} AND pm.status IN ('PENDING', 'PARTIAL') AND pm.due_date < CURDATE()`
  );
  for (const m of rows) {
    const r = await recomputeMilestone(m.id);
    if (r && r.status === 'OVERDUE') {
      const recipients = [...(await usersWithRoles(['FINANCE'])), m.relationship_manager_id];
      await notifyUsers(recipients, {
        type: 'WARNING', title: `Payment overdue: ${fullName(m.first_name, m.last_name)}`,
        message: `${m.milestone_name} for ${m.deal_number} — ${money(r.due - r.paid)} was due on ${new Date(m.due_date).toLocaleDateString('en-IN')}.`,
        relatedEntityType: 'DEAL', relatedEntityId: m.deal_id, category: 'PAYMENT_OVERDUE'
      });
      await audit.record({ actor: { id: null, name: 'System' }, source: 'SYSTEM', action: 'MILESTONE_OVERDUE', entityType: 'MILESTONE', entityId: m.id, summary: `${m.deal_number}: ${m.milestone_name} overdue (${money(r.due - r.paid)})` });
    }
  }
  return rows.length;
}

module.exports = {
  MODES,
  recordPayment, verifyPayment, rejectPayment, listPayments, receipt,
  recomputeMilestone, listMilestones, createInvoice, cancelInvoice,
  requestRefund, decideRefund, processRefund, listRefunds,
  importBankLines, matchBankLine, ignoreBankLine, listBankLines,
  listCommissions, payCommission,
  overview, outstandingByDeal, projectPerformance, collectionsByMonth, markOverdueMilestones,
  dealSummary
};
