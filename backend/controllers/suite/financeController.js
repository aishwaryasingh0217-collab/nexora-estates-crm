/**
 * Finance & accounts portal. All money rules live in services/financeService.js.
 */
const { wrap, ok, httpError, num, fullName, pool } = require('./common');
const finance = require('../../services/financeService');

const overview = wrap(async (req, res) => {
  ok(res, {
    totals: await finance.overview(),
    collectionsByMonth: await finance.collectionsByMonth(12),
    projects: await finance.projectPerformance()
  });
});

const payments = wrap(async (req, res) => ok(res, await finance.listPayments({ status: req.query.status || null, dealId: req.query.deal_id || null, q: req.query.q || null })));
const recordPayment = wrap(async (req, res) => { const r = await finance.recordPayment(req.user, req.body || {}, req); ok(res, r, r.message, 201); });
const verifyPayment = wrap(async (req, res) => {
  const r = await finance.verifyPayment(req.user, req.params.id, { note: req.body && req.body.note }, req);
  ok(res, r, `Verified. Receipt ${r.receiptNumber} issued.`);
});
const rejectPayment = wrap(async (req, res) => ok(res, await finance.rejectPayment(req.user, req.params.id, req.body && req.body.reason, req), 'Payment rejected.'));
const receipt = wrap(async (req, res) => ok(res, await finance.receipt(req.params.id)));

/** Confirmed bookings to pick from when recording a payment or raising an invoice. */
const deals = wrap(async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const [rows] = await pool.query(
    `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.booking_token_amount, d.created_at, u.unit_number, p.name AS project_name,
            c.first_name, c.last_name, c.phone,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'VERIFIED') AS collected,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'PENDING') AS pending
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')
        ${q ? 'AND (d.deal_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR u.unit_number LIKE ?)' : ''}
      ORDER BY d.created_at DESC LIMIT 300`,
    q ? [q, q, q, q, q] : []
  );
  ok(res, rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), collected: num(r.collected), pending: num(r.pending), outstanding: Math.max(num(r.agreed_total_amount) - num(r.collected), 0) })));
});

const dealDetail = wrap(async (req, res) => {
  const deal = await finance.dealSummary(req.params.id);
  const [invoices] = await pool.query('SELECT * FROM invoices WHERE deal_id = ? ORDER BY issue_date DESC', [deal.id]);
  const [refunds] = await pool.query('SELECT * FROM refunds WHERE deal_id = ? ORDER BY created_at DESC', [deal.id]);
  ok(res, {
    deal,
    milestones: await finance.listMilestones(deal.id),
    payments: await finance.listPayments({ dealId: deal.id }),
    invoices,
    refunds
  });
});

const milestones = wrap(async (req, res) => ok(res, await finance.listMilestones(req.params.dealId)));

const invoices = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT i.*, d.deal_number, c.first_name, c.last_name, pm.milestone_name
       FROM invoices i JOIN deals d ON d.id = i.deal_id LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN payment_milestones pm ON pm.id = i.milestone_id
      ${req.query.status ? 'WHERE i.status = ?' : ''} ORDER BY i.issue_date DESC, i.created_at DESC LIMIT 500`,
    req.query.status ? [req.query.status] : []
  );
  ok(res, rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name) })));
});
const createInvoice = wrap(async (req, res) => {
  const b = req.body || {};
  const r = await finance.createInvoice(req.user, { dealId: b.deal_id, milestoneId: b.milestone_id || null, amount: b.amount, taxAmount: b.tax_amount, dueDate: b.due_date || null, description: b.description || null }, req);
  ok(res, r, `Invoice ${r.invoiceNumber} issued.`, 201);
});
const cancelInvoice = wrap(async (req, res) => ok(res, await finance.cancelInvoice(req.user, req.params.id, req.body && req.body.reason, req), 'Invoice cancelled.'));

const outstanding = wrap(async (req, res) => ok(res, await finance.outstandingByDeal({ overdueOnly: req.query.overdue === '1' || req.query.overdue === 'true' })));

const overdueMilestones = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT pm.*, d.deal_number, u.unit_number, p.name AS project_name, c.first_name, c.last_name, c.phone,
            DATEDIFF(CURDATE(), pm.due_date) AS days_overdue,
            pm.due_amount - (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.milestone_id = pm.id AND py.verification_status = 'VERIFIED') AS balance
       FROM payment_milestones pm JOIN deals d ON d.id = pm.deal_id JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id
      WHERE d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') AND pm.status <> 'PAID' AND pm.due_date < CURDATE()
      ORDER BY pm.due_date ASC LIMIT 500`
  );
  const bucket = (d) => (d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+');
  const ageing = {};
  rows.forEach((r) => { const k = bucket(num(r.days_overdue)); ageing[k] = (ageing[k] || 0) + num(r.balance); });
  ok(res, { ageing, rows: rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), balance: num(r.balance), days_overdue: num(r.days_overdue) })) });
});

const refunds = wrap(async (req, res) => ok(res, await finance.listRefunds({ status: req.query.status || null })));
const requestRefund = wrap(async (req, res) => {
  const b = req.body || {};
  // Customer-care executives may request refunds only for customers assigned to them
  if (req.user.role === 'CUSTOMER_RELATIONS' && req.user.jobLevel !== 'HEAD') {
    const [[own]] = await pool.query(
      'SELECT 1 FROM deals d JOIN customers c ON c.id = d.customer_id WHERE d.id = ? AND c.relationship_manager_id = ?',
      [b.deal_id, req.user.id]
    );
    if (!own) throw httpError(404, 'Booking not found.');
  }
  const r = await finance.requestRefund(req.user, { dealId: b.deal_id, paymentId: b.payment_id || null, amount: b.amount, reason: b.reason }, req);
  ok(res, r, `Refund ${r.refundNumber} sent for approval.`, 201);
});
const processRefund = wrap(async (req, res) => ok(res, await finance.processRefund(req.user, req.params.id, { transactionReference: req.body && req.body.transaction_reference }, req), 'Refund marked as paid.'));

const bankLines = wrap(async (req, res) => ok(res, await finance.listBankLines({ status: req.query.status || null })));
const importBank = wrap(async (req, res) => {
  const r = await finance.importBankLines(req.user, req.body && req.body.rows, req);
  ok(res, r, `${r.imported} lines imported, ${r.matched} matched automatically.`, 201);
});
const matchBank = wrap(async (req, res) => ok(res, await finance.matchBankLine(req.user, req.params.id, req.body && req.body.payment_id, req), 'Matched.'));
const ignoreBank = wrap(async (req, res) => ok(res, await finance.ignoreBankLine(req.user, req.params.id, req), 'Marked as not a customer payment.'));

const commissions = wrap(async (req, res) => ok(res, await finance.listCommissions({ status: req.query.status || null })));
const payCommission = wrap(async (req, res) => ok(res, await finance.payCommission(req.user, req.params.id, req.body || {}, req), 'Payout recorded.'));

const reports = wrap(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 1), 36);
  ok(res, {
    totals: await finance.overview(),
    collectionsByMonth: await finance.collectionsByMonth(months),
    projects: await finance.projectPerformance(),
    outstanding: await finance.outstandingByDeal()
  });
});

const modes = wrap(async (req, res) => ok(res, finance.MODES));

module.exports = {
  overview, payments, recordPayment, verifyPayment, rejectPayment, receipt, deals, dealDetail, milestones,
  invoices, createInvoice, cancelInvoice, outstanding, overdueMilestones, refunds, requestRefund, processRefund,
  bankLines, importBank, matchBank, ignoreBank, commissions, payCommission, reports, modes, httpError
};
