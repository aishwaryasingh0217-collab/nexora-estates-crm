/**
 * Customer relationship portal — life after the booking: onboarding, documents, complaints and
 * service requests, possession updates and the full communication history with each customer.
 *
 * Executives see the customers they manage (relationship_manager_id); the CRM head, the owner,
 * the sales head and finance (read-only) see all customers.
 */
const crypto = require('crypto');
const { wrap, ok, httpError, num, fullName, pool } = require('./common');
const audit = require('../../services/audit');
const { notifyUsers, usersWithRoles, createNotification } = require('../../services/notificationService');
const { removeStored } = require('../../middleware/fileUpload');
const { can } = require('../../services/permissions');

const LIVE = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const CATEGORIES = ['COMPLAINT', 'SERVICE_REQUEST', 'DOCUMENTATION', 'POSSESSION', 'PAYMENT_QUERY', 'GENERAL'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CHANNELS = ['PHONE', 'EMAIL', 'WHATSAPP', 'WALK_IN', 'PORTAL', 'OTHER'];
const SLA_HOURS = { URGENT: 4, HIGH: 24, MEDIUM: 72, LOW: 120 };
const COMM_CHANNELS = ['CALL', 'EMAIL', 'WHATSAPP', 'SMS', 'MEETING', 'LETTER', 'NOTE'];
const STAGES = ['CONSTRUCTION', 'FINISHING', 'OC_RECEIVED', 'HANDOVER_SCHEDULED', 'HANDED_OVER', 'OTHER'];

/** Executives without HEAD level only see their own customers. */
function ownOnly(user) {
  return user.role === 'CUSTOMER_RELATIONS' && user.jobLevel !== 'HEAD';
}

async function loadCustomer(user, id) {
  const [[c]] = await pool.query(
    `SELECT c.*, rm.first_name AS rm_first, rm.last_name AS rm_last, rep.first_name AS rep_first, rep.last_name AS rep_last
       FROM customers c LEFT JOIN users rm ON rm.id = c.relationship_manager_id LEFT JOIN users rep ON rep.id = c.assigned_rep_id WHERE c.id = ?`,
    [id]
  );
  if (!c || (ownOnly(user) && c.relationship_manager_id !== user.id)) throw httpError(404, 'Customer not found.');
  return c;
}

const assertManage = (user) => { if (!can(user, 'crm.manage')) throw httpError(403, 'Your role can view customers but not change them.'); };

// ------------------------------------------------------------------------------------------- overview
const summary = wrap(async (req, res) => {
  const own = ownOnly(req.user);
  const cf = own ? 'AND c.relationship_manager_id = ?' : '';
  const p = own ? [req.user.id] : [];
  const [[s]] = await pool.query(
    `SELECT
       (SELECT COUNT(DISTINCT c.id) FROM customers c JOIN deals d ON d.customer_id = c.id AND d.status IN ${LIVE} WHERE 1 = 1 ${cf}) AS customers,
       (SELECT COUNT(*) FROM customers c WHERE c.onboarding_status = 'IN_PROGRESS' ${cf}) AS onboarding,
       (SELECT COUNT(*) FROM customer_documents cd JOIN customers c ON c.id = cd.customer_id WHERE cd.status IN ('PENDING', 'SUBMITTED') ${cf}) AS documents_pending,
       (SELECT COUNT(*) FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.category = 'COMPLAINT' ${own ? 'AND (c.relationship_manager_id = ? OR t.assigned_to = ?)' : ''}) AS open_complaints,
       (SELECT COUNT(*) FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE t.status IN ('OPEN', 'IN_PROGRESS') ${own ? 'AND (c.relationship_manager_id = ? OR t.assigned_to = ?)' : ''}) AS open_tickets,
       (SELECT COUNT(*) FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.due_at < NOW() ${own ? 'AND (c.relationship_manager_id = ? OR t.assigned_to = ?)' : ''}) AS sla_breached,
       (SELECT AVG(t.feedback_rating) FROM support_tickets t WHERE t.feedback_rating IS NOT NULL) AS avg_rating,
       (SELECT AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.resolved_at)) FROM support_tickets t WHERE t.resolved_at IS NOT NULL AND t.created_at > NOW() - INTERVAL 90 DAY) AS avg_resolution_hours`,
    own ? [...p, ...p, ...p, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id] : []
  );
  const [byCategory] = await pool.query("SELECT category, COUNT(*) AS n FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS') GROUP BY category");
  ok(res, {
    customers: num(s.customers), onboarding: num(s.onboarding), documentsPending: num(s.documents_pending), openComplaints: num(s.open_complaints),
    openTickets: num(s.open_tickets), slaBreached: num(s.sla_breached), avgRating: s.avg_rating == null ? null : Math.round(Number(s.avg_rating) * 10) / 10,
    avgResolutionHours: s.avg_resolution_hours == null ? null : Math.round(Number(s.avg_resolution_hours)),
    openByCategory: Object.fromEntries(byCategory.map((c) => [c.category, num(c.n)])),
    scope: own ? 'mine' : 'all'
  });
});

// ------------------------------------------------------------------------------------------- customers
const listCustomers = wrap(async (req, res) => {
  const q = req.query;
  const where = [`EXISTS (SELECT 1 FROM deals d WHERE d.customer_id = c.id AND d.status IN ${LIVE})`];
  const params = [];
  if (ownOnly(req.user)) { where.push('c.relationship_manager_id = ?'); params.push(req.user.id); }
  if (q.onboarding) { where.push('c.onboarding_status = ?'); params.push(q.onboarding); }
  if (q.rm_id) { where.push('c.relationship_manager_id = ?'); params.push(q.rm_id); }
  if (q.q) { where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)'); params.push(...Array(4).fill(`%${q.q}%`)); }
  const [rows] = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.kyc_status, c.onboarding_status, c.onboarded_at, c.is_test_data,
            c.relationship_manager_id, rm.first_name AS rm_first, rm.last_name AS rm_last,
            (SELECT GROUP_CONCAT(CONCAT(p.name, ' · ', u.unit_number) SEPARATOR ', ') FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id
              WHERE d.customer_id = c.id AND d.status IN ${LIVE}) AS units,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.customer_id = c.id AND d.status IN ${LIVE}) AS booked_value,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py JOIN deals d ON d.id = py.deal_id WHERE d.customer_id = c.id AND py.verification_status = 'VERIFIED') AS paid,
            (SELECT COUNT(*) FROM customer_documents cd WHERE cd.customer_id = c.id AND cd.status IN ('PENDING', 'SUBMITTED', 'REJECTED')) AS documents_open,
            (SELECT COUNT(*) FROM support_tickets t WHERE t.customer_id = c.id AND t.status IN ('OPEN', 'IN_PROGRESS')) AS tickets_open,
            (SELECT MAX(cc.created_at) FROM customer_communications cc WHERE cc.customer_id = c.id) AS last_contact_at
       FROM customers c LEFT JOIN users rm ON rm.id = c.relationship_manager_id
      WHERE ${where.join(' AND ')} ORDER BY c.onboarding_status = 'IN_PROGRESS' DESC, c.created_at DESC LIMIT 500`,
    params
  );
  // Roles that only log requests get a picker list — no payment or document details
  if (!can(req.user, 'crm.view')) return ok(res, rows.map((r) => ({ id: r.id, name: fullName(r.first_name, r.last_name), units: r.units, is_test_data: r.is_test_data })));
  ok(res, rows.map((r) => ({ ...r, name: fullName(r.first_name, r.last_name), rm_name: fullName(r.rm_first, r.rm_last) || null, booked_value: num(r.booked_value), paid: num(r.paid), documents_open: num(r.documents_open), tickets_open: num(r.tickets_open) })));
});

const getCustomer = wrap(async (req, res) => {
  const c = await loadCustomer(req.user, req.params.id);
  const [deals] = await pool.query(
    `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.created_at, u.unit_number, p.id AS project_id, p.name AS project_name, p.possession_date,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'VERIFIED') AS paid,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'PENDING') AS pending_verification,
            (SELECT MIN(pm.due_date) FROM payment_milestones pm WHERE pm.deal_id = d.id AND pm.status <> 'PAID') AS next_due
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id WHERE d.customer_id = ? ORDER BY d.created_at DESC`,
    [c.id]
  );
  const [docs] = await pool.query('SELECT * FROM customer_documents WHERE customer_id = ? ORDER BY created_at', [c.id]);
  const [tickets] = await pool.query(
    `SELECT t.*, a.first_name AS a_first, a.last_name AS a_last FROM support_tickets t LEFT JOIN users a ON a.id = t.assigned_to
      WHERE t.customer_id = ? ORDER BY t.created_at DESC`,
    [c.id]
  );
  const [comms] = await pool.query(
    `SELECT cc.*, u.first_name, u.last_name FROM customer_communications cc LEFT JOIN users u ON u.id = cc.user_id WHERE cc.customer_id = ? ORDER BY cc.created_at DESC LIMIT 300`,
    [c.id]
  );
  const projectIds = [...new Set(deals.map((d) => d.project_id))];
  const dealIds = deals.map((d) => d.id);
  const [possession] = projectIds.length || dealIds.length
    ? await pool.query(
      `SELECT pu.*, p.name AS project_name FROM possession_updates pu LEFT JOIN projects p ON p.id = pu.project_id
        WHERE ${[projectIds.length ? '(pu.project_id IN (?) AND pu.deal_id IS NULL)' : null, dealIds.length ? 'pu.deal_id IN (?)' : null].filter(Boolean).join(' OR ')}
        ORDER BY pu.created_at DESC`,
      [...(projectIds.length ? [projectIds] : []), ...(dealIds.length ? [dealIds] : [])]
    )
    : [[]];
  const [calls] = await pool.query(
    `SELECT cl.id, cl.direction, cl.status, cl.initiated_at, cl.duration_sec, cl.outcome, cl.remarks FROM call_logs cl WHERE cl.customer_id = ? OR cl.lead_id = ? ORDER BY cl.initiated_at DESC LIMIT 50`,
    [c.id, c.lead_id || '']
  );
  ok(res, {
    customer: { ...c, name: fullName(c.first_name, c.last_name), rm_name: fullName(c.rm_first, c.rm_last) || null, sales_rep_name: fullName(c.rep_first, c.rep_last) || null },
    bookings: deals.map((d) => ({ ...d, paid: num(d.paid), pending_verification: num(d.pending_verification), balance: Math.max(num(d.agreed_total_amount) - num(d.paid), 0) })),
    documents: docs,
    tickets: tickets.map((t) => ({ ...t, assigned_name: fullName(t.a_first, t.a_last) || null })),
    communications: comms.map((m) => ({ ...m, by: fullName(m.first_name, m.last_name) || 'System' })),
    possession,
    calls
  });
});

const updateCustomer = wrap(async (req, res) => {
  assertManage(req.user);
  const c = await loadCustomer(req.user, req.params.id);
  const b = req.body || {};
  const sets = {};
  for (const k of ['email', 'address_line1', 'city', 'state', 'pincode', 'pan_tax_id']) if (b[k] !== undefined) sets[k] = b[k] ? String(b[k]).trim().slice(0, 255) : null;
  if (b.kyc_status !== undefined) { if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(b.kyc_status)) throw httpError(400, 'Unknown KYC status.'); sets.kyc_status = b.kyc_status; }
  if (b.relationship_manager_id !== undefined) {
    if (ownOnly(req.user)) throw httpError(403, 'Only the CRM head can reassign customers.');
    if (b.relationship_manager_id) {
      const [[rm]] = await pool.query("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name = 'CUSTOMER_RELATIONS'", [b.relationship_manager_id]);
      if (!rm) throw httpError(400, 'Choose an active customer relationship team member.');
    }
    sets.relationship_manager_id = b.relationship_manager_id || null;
  }
  if (b.onboarding_status !== undefined) {
    if (!['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(b.onboarding_status)) throw httpError(400, 'Unknown onboarding status.');
    if (b.onboarding_status === 'COMPLETED') {
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM customer_documents WHERE customer_id = ? AND status <> 'VERIFIED' AND doc_type NOT IN ('LOAN_SANCTION')", [c.id]);
      if (num(n)) throw httpError(409, `${n} required document(s) are not verified yet.`);
      sets.onboarded_at = new Date();
    }
    sets.onboarding_status = b.onboarding_status;
  }
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE customers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), c.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, c[k]])), sets);
  await audit.record({ req, action: 'CUSTOMER_UPDATED', entityType: 'CUSTOMER', entityId: c.id, summary: `${fullName(c.first_name, c.last_name)} updated`, before: d.before, after: d.after });
  if (sets.relationship_manager_id && sets.relationship_manager_id !== c.relationship_manager_id) {
    await createNotification({ recipientUserId: sets.relationship_manager_id, type: 'INFO', title: `Customer assigned: ${fullName(c.first_name, c.last_name)}`, message: `${req.user.name} assigned this customer to you.`, relatedEntityType: 'CUSTOMER', relatedEntityId: c.id, category: 'SERVICE_REQUEST' });
  }
  ok(res, null, 'Customer saved.');
});

const addCommunication = wrap(async (req, res) => {
  assertManage(req.user);
  const c = await loadCustomer(req.user, req.params.id);
  const b = req.body || {};
  if (!b.summary || String(b.summary).trim().length < 3) throw httpError(400, 'Write what was discussed.');
  const channel = COMM_CHANNELS.includes(b.channel) ? b.channel : 'NOTE';
  const direction = ['INBOUND', 'OUTBOUND', 'INTERNAL'].includes(b.direction) ? b.direction : 'OUTBOUND';
  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO customer_communications (id, customer_id, deal_id, channel, direction, subject, summary, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, c.id, b.deal_id || null, channel, direction, b.subject ? String(b.subject).slice(0, 200) : null, String(b.summary).slice(0, 5000), req.user.id]
  );
  await audit.record({ req, action: 'CUSTOMER_COMMUNICATION_LOGGED', entityType: 'CUSTOMER', entityId: c.id, summary: `${channel.toLowerCase()} (${direction.toLowerCase()}) with ${fullName(c.first_name, c.last_name)}${b.subject ? `: ${b.subject}` : ''}` });
  ok(res, { id }, 'Logged.', 201);
});

// ------------------------------------------------------------------------------------------- documents
async function loadDocument(user, id) {
  const [[d]] = await pool.query('SELECT cd.*, c.relationship_manager_id, c.first_name, c.last_name FROM customer_documents cd JOIN customers c ON c.id = cd.customer_id WHERE cd.id = ?', [id]);
  if (!d || (ownOnly(user) && d.relationship_manager_id !== user.id)) throw httpError(404, 'Document not found.');
  return d;
}

const updateDocument = wrap(async (req, res) => {
  assertManage(req.user);
  const d = await loadDocument(req.user, req.params.id);
  const b = req.body || {};
  const status = String(b.status || '').toUpperCase();
  if (!['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'].includes(status)) throw httpError(400, 'Unknown document status.');
  if (status === 'VERIFIED' && !d.file_url && !b.notes) throw httpError(400, 'Attach the document (or note where the original is kept) before verifying it.');
  if (status === 'REJECTED' && !b.notes) throw httpError(400, 'Say why the document was rejected.');
  await pool.query('UPDATE customer_documents SET status = ?, notes = COALESCE(?, notes), updated_by = ? WHERE id = ?', [status, b.notes ? String(b.notes).slice(0, 255) : null, req.user.id, d.id]);
  await audit.record({ req, action: 'CUSTOMER_DOCUMENT_UPDATED', entityType: 'CUSTOMER', entityId: d.customer_id, summary: `${d.title} for ${fullName(d.first_name, d.last_name)}: ${d.status} → ${status}${b.notes ? ` (${b.notes})` : ''}`, before: { status: d.status }, after: { status, notes: b.notes || null } });
  ok(res, null, 'Document updated.');
});

const uploadDocumentFile = wrap(async (req, res) => {
  assertManage(req.user);
  let d;
  try {
    d = await loadDocument(req.user, req.params.id);
  } catch (err) {
    removeStored(req.savedFile && req.savedFile.url);
    throw err;
  }
  if (d.file_url) removeStored(d.file_url);
  await pool.query("UPDATE customer_documents SET file_url = ?, status = IF(status = 'PENDING', 'SUBMITTED', status), updated_by = ? WHERE id = ?", [req.savedFile.url, req.user.id, d.id]);
  await audit.record({ req, action: 'CUSTOMER_DOCUMENT_UPLOADED', entityType: 'CUSTOMER', entityId: d.customer_id, summary: `${d.title} uploaded for ${fullName(d.first_name, d.last_name)}`, after: { file: req.savedFile.originalName, size: req.savedFile.size } });
  ok(res, { url: req.savedFile.url }, 'File attached.', 201);
});

// ------------------------------------------------------------------------------------------- tickets
const listTickets = wrap(async (req, res) => {
  const q = req.query;
  const where = ['1 = 1'];
  const params = [];
  if (ownOnly(req.user)) { where.push('(c.relationship_manager_id = ? OR t.assigned_to = ? OR t.created_by = ?)'); params.push(req.user.id, req.user.id, req.user.id); }
  // Roles that may only log requests (sales, finance executives…) see the ones they logged
  else if (!can(req.user, 'crm.view')) { where.push('t.created_by = ?'); params.push(req.user.id); }
  if (q.id) { where.push('t.id = ?'); params.push(q.id); }
  if (q.status) { where.push('t.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.category) { where.push('t.category = ?'); params.push(q.category); }
  if (q.assigned_to) { where.push('t.assigned_to = ?'); params.push(q.assigned_to); }
  if (q.customer_id) { where.push('t.customer_id = ?'); params.push(q.customer_id); }
  const [rows] = await pool.query(
    `SELECT t.*, c.first_name AS c_first, c.last_name AS c_last, a.first_name AS a_first, a.last_name AS a_last, d.deal_number,
            (t.due_at < NOW() AND t.status IN ('OPEN', 'IN_PROGRESS')) AS sla_breached
       FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assigned_to LEFT JOIN deals d ON d.id = t.deal_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.status IN ('OPEN', 'IN_PROGRESS') DESC, FIELD(t.priority, 'URGENT', 'HIGH', 'MEDIUM', 'LOW'), t.created_at DESC LIMIT 500`,
    params
  );
  ok(res, rows.map((t) => ({ ...t, customer_name: fullName(t.c_first, t.c_last) || t.full_name, assigned_name: fullName(t.a_first, t.a_last) || null, sla_breached: Boolean(t.sla_breached) })));
});

async function nextTicketNumber() {
  for (let i = 0; i < 5; i++) {
    const n = `TKT-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const [rows] = await pool.query('SELECT 1 FROM support_tickets WHERE ticket_number = ?', [n]);
    if (!rows.length) return n;
  }
  return `TKT-${Date.now()}`;
}

const createTicket = wrap(async (req, res) => {
  const b = req.body || {};
  const c = await loadCustomer(req.user, b.customer_id);
  const category = CATEGORIES.includes(b.category) ? b.category : 'GENERAL';
  const priority = PRIORITIES.includes(b.priority) ? b.priority : category === 'COMPLAINT' ? 'HIGH' : 'MEDIUM';
  if (!b.subject || String(b.subject).trim().length < 3) throw httpError(400, 'Give the request a short subject.');
  if (b.deal_id) {
    const [[d]] = await pool.query('SELECT id FROM deals WHERE id = ? AND customer_id = ?', [b.deal_id, c.id]);
    if (!d) throw httpError(400, 'That booking does not belong to this customer.');
  }
  const assignee = b.assigned_to || c.relationship_manager_id || null;
  const id = crypto.randomUUID();
  const number = await nextTicketNumber();
  const due = new Date(Date.now() + SLA_HOURS[priority] * 3600000);
  await pool.query(
    `INSERT INTO support_tickets (id, ticket_number, customer_id, lead_id, full_name, phone, email, subject, description, status, priority, assigned_to,
                                  category, channel, deal_id, created_by, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?)`,
    [id, number, c.id, c.lead_id, fullName(c.first_name, c.last_name), c.phone || '', c.email || '', String(b.subject).slice(0, 255), b.description ? String(b.description).slice(0, 5000) : '',
      priority, assignee, category, CHANNELS.includes(b.channel) ? b.channel : 'PHONE', b.deal_id || null, req.user.id, due]
  );
  await pool.query(
    'INSERT INTO customer_communications (id, customer_id, deal_id, channel, direction, subject, summary, user_id) VALUES (?, ?, ?, ?, \'INBOUND\', ?, ?, ?)',
    [crypto.randomUUID(), c.id, b.deal_id || null, { PHONE: 'CALL', EMAIL: 'EMAIL', WHATSAPP: 'WHATSAPP', WALK_IN: 'MEETING' }[b.channel] || 'NOTE', `${category === 'COMPLAINT' ? 'Complaint' : 'Request'} ${number}`, String(b.subject).slice(0, 2000), req.user.id]
  );
  const recipients = assignee ? [assignee] : await usersWithRoles(['CUSTOMER_RELATIONS']);
  const heads = category === 'COMPLAINT' ? await usersWithRoles(['CUSTOMER_RELATIONS'], { headsOnly: true }) : [];
  await notifyUsers([...recipients, ...heads], {
    type: category === 'COMPLAINT' ? 'WARNING' : 'INFO', title: `${category === 'COMPLAINT' ? 'Complaint' : 'Service request'} ${number}: ${fullName(c.first_name, c.last_name)}`,
    message: `${b.subject} — ${priority.toLowerCase()} priority, due ${due.toLocaleString('en-IN')}.`, relatedEntityType: 'TICKET', relatedEntityId: id,
    category: category === 'COMPLAINT' ? 'COMPLAINT' : 'SERVICE_REQUEST'
  }, req.user.id);
  await audit.record({ req, action: category === 'COMPLAINT' ? 'COMPLAINT_LOGGED' : 'SERVICE_REQUEST_LOGGED', entityType: 'TICKET', entityId: id, summary: `${number}: ${b.subject} (${fullName(c.first_name, c.last_name)}, ${priority})`, after: { customer_id: c.id, category, priority, assigned_to: assignee, due_at: due } });
  ok(res, { id, ticketNumber: number, dueAt: due }, `${number} logged.`, 201);
});

const updateTicket = wrap(async (req, res) => {
  const [[t]] = await pool.query('SELECT t.*, c.relationship_manager_id FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE t.id = ?', [req.params.id]);
  if (!t || (ownOnly(req.user) && ![t.relationship_manager_id, t.assigned_to, t.created_by].includes(req.user.id))) throw httpError(404, 'Request not found.');
  if (!can(req.user, 'crm.manage') && t.created_by !== req.user.id) throw httpError(403, 'Your role can’t update requests.');
  const b = req.body || {};
  const sets = {};
  if (b.status !== undefined) {
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(b.status)) throw httpError(400, 'Unknown status.');
    if (['RESOLVED', 'CLOSED'].includes(b.status) && !b.resolution_notes && !t.resolution_notes) throw httpError(400, 'Describe the resolution.');
    sets.status = b.status;
    if (['RESOLVED', 'CLOSED'].includes(b.status) && !t.resolved_at) sets.resolved_at = new Date();
    if (['OPEN', 'IN_PROGRESS'].includes(b.status)) sets.resolved_at = null;
  }
  if (b.resolution_notes !== undefined) sets.resolution_notes = String(b.resolution_notes).slice(0, 5000);
  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority)) throw httpError(400, 'Unknown priority.');
    sets.priority = b.priority;
    sets.due_at = new Date(new Date(t.created_at).getTime() + SLA_HOURS[b.priority] * 3600000);
  }
  if (b.assigned_to !== undefined) {
    if (b.assigned_to) {
      const [[u]] = await pool.query("SELECT id FROM users WHERE id = ? AND status = 'ACTIVE'", [b.assigned_to]);
      if (!u) throw httpError(400, 'Choose an active team member.');
    }
    sets.assigned_to = b.assigned_to || null;
  }
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE support_tickets SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), t.id]);
  if (sets.assigned_to && sets.assigned_to !== t.assigned_to) {
    await createNotification({ recipientUserId: sets.assigned_to, type: 'INFO', title: `Request assigned: ${t.ticket_number}`, message: `${t.subject} (${t.full_name}).`, relatedEntityType: 'TICKET', relatedEntityId: t.id, category: t.category === 'COMPLAINT' ? 'COMPLAINT' : 'SERVICE_REQUEST' });
  }
  if (sets.status && ['RESOLVED', 'CLOSED'].includes(sets.status) && t.created_by && t.created_by !== req.user.id) {
    await createNotification({ recipientUserId: t.created_by, type: 'SUCCESS', title: `Resolved: ${t.ticket_number}`, message: sets.resolution_notes || t.resolution_notes || 'Marked resolved.', relatedEntityType: 'TICKET', relatedEntityId: t.id, category: t.category === 'COMPLAINT' ? 'COMPLAINT' : 'SERVICE_REQUEST' });
  }
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, t[k]])), sets);
  await audit.record({ req, action: sets.status && ['RESOLVED', 'CLOSED'].includes(sets.status) ? 'TICKET_RESOLVED' : 'TICKET_UPDATED', entityType: 'TICKET', entityId: t.id, summary: `${t.ticket_number}: ${t.subject}`, before: d.before, after: d.after });
  ok(res, null, 'Request updated.');
});

const ticketFeedback = wrap(async (req, res) => {
  assertManage(req.user);
  const [[t]] = await pool.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!t) throw httpError(404, 'Request not found.');
  if (!['RESOLVED', 'CLOSED'].includes(t.status)) throw httpError(409, 'Collect feedback after the request is resolved.');
  const rating = parseInt(req.body && req.body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) throw httpError(400, 'Rating must be 1 to 5.');
  await pool.query('UPDATE support_tickets SET feedback_rating = ?, feedback_comment = ? WHERE id = ?', [rating, req.body.comment ? String(req.body.comment).slice(0, 500) : null, t.id]);
  await audit.record({ req, action: 'CUSTOMER_FEEDBACK_RECORDED', entityType: 'TICKET', entityId: t.id, summary: `${t.ticket_number}: ${rating}/5${req.body.comment ? ` — ${req.body.comment}` : ''}`, after: { rating, comment: req.body.comment || null } });
  ok(res, null, 'Feedback saved.');
});

// ------------------------------------------------------------------------------------------- possession
const listPossession = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT pu.*, p.name AS project_name, d.deal_number, u.first_name, u.last_name
       FROM possession_updates pu LEFT JOIN projects p ON p.id = pu.project_id LEFT JOIN deals d ON d.id = pu.deal_id LEFT JOIN users u ON u.id = pu.created_by
      ${req.query.project_id ? 'WHERE pu.project_id = ?' : ''} ORDER BY pu.created_at DESC LIMIT 300`,
    req.query.project_id ? [req.query.project_id] : []
  );
  ok(res, rows.map((r) => ({ ...r, by: fullName(r.first_name, r.last_name) || null })));
});

const addPossession = wrap(async (req, res) => {
  assertManage(req.user);
  const b = req.body || {};
  if (!b.project_id && !b.deal_id) throw httpError(400, 'Choose a project (all its buyers) or a single booking.');
  if (!b.title || String(b.title).trim().length < 3) throw httpError(400, 'Give the update a title.');
  const stage = STAGES.includes(b.stage) ? b.stage : 'OTHER';
  let projectId = b.project_id || null;
  if (b.deal_id) {
    const [[d]] = await pool.query('SELECT d.id, u.project_id FROM deals d JOIN units u ON u.id = d.unit_id WHERE d.id = ?', [b.deal_id]);
    if (!d) throw httpError(400, 'Booking not found.');
    projectId = d.project_id;
  }
  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO possession_updates (id, project_id, deal_id, stage, title, message, expected_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, b.deal_id || null, stage, String(b.title).slice(0, 200), b.message ? String(b.message).slice(0, 5000) : null, b.expected_date ? new Date(b.expected_date) : null, req.user.id]
  );
  // Every affected buyer's history shows the update
  const [buyers] = await pool.query(
    `SELECT DISTINCT d.customer_id, d.id AS deal_id FROM deals d JOIN units u ON u.id = d.unit_id
      WHERE d.status IN ${LIVE} AND ${b.deal_id ? 'd.id = ?' : 'u.project_id = ?'}`,
    [b.deal_id || projectId]
  );
  for (const x of buyers) {
    await pool.query(
      "INSERT INTO customer_communications (id, customer_id, deal_id, channel, direction, subject, summary, user_id) VALUES (?, ?, ?, 'LETTER', 'OUTBOUND', ?, ?, ?)",
      [crypto.randomUUID(), x.customer_id, x.deal_id, `Possession update: ${String(b.title).slice(0, 150)}`, b.message || b.title, req.user.id]
    );
  }
  await audit.record({ req, action: 'POSSESSION_UPDATE_POSTED', entityType: 'PROJECT', entityId: projectId, summary: `${stage.replace(/_/g, ' ').toLowerCase()}: ${b.title} — ${buyers.length} buyer(s)`, after: { stage, deal_id: b.deal_id || null, expected_date: b.expected_date || null } });
  ok(res, { id, buyers: buyers.length }, `Update posted to ${buyers.length} buyer${buyers.length === 1 ? '' : 's'}.`, 201);
});

const team = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.job_level,
            (SELECT COUNT(*) FROM customers c WHERE c.relationship_manager_id = u.id) AS customers,
            (SELECT COUNT(*) FROM support_tickets t WHERE t.assigned_to = u.id AND t.status IN ('OPEN', 'IN_PROGRESS')) AS open_tickets
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.status = 'ACTIVE' AND r.name = 'CUSTOMER_RELATIONS' ORDER BY u.first_name`
  );
  ok(res, rows.map((r) => ({ ...r, name: fullName(r.first_name, r.last_name), customers: num(r.customers), open_tickets: num(r.open_tickets) })));
});

const options = wrap(async (req, res) => ok(res, { categories: CATEGORIES, priorities: PRIORITIES, channels: CHANNELS, commChannels: COMM_CHANNELS, stages: STAGES, slaHours: SLA_HOURS }));

module.exports = {
  summary, listCustomers, getCustomer, updateCustomer, addCommunication, updateDocument, uploadDocumentFile,
  listTickets, createTicket, updateTicket, ticketFeedback, listPossession, addPossession, team, options
};
