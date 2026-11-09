/**
 * Booking workflow — lead → booking → approval → inventory → finance → customer care → owner reports.
 *
 *   initiateBooking  checks the unit is free (row lock + one-live-booking-per-unit index), works out the
 *                    price, applies the company's approval rule, creates the deal and either
 *                    • reserves the unit (HOLD) and asks for approval, or
 *                    • books it straight away when no approval is needed.
 *   approveBooking   deal BOOKED, unit BOOKED, lead "Booking Done", partner commission, payment
 *                    schedule, customer onboarding — then tells sales, finance and customer care.
 *   rejectBooking    deal REJECTED, unit released, lead back in negotiation.
 *   cancelBooking    a booked deal is cancelled and the unit released (refunds go through finance).
 *   advanceBooking   agreement signed → registration done (unit SOLD).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const settings = require('./settingsService');
const { createApproval } = require('./approvalService');
const { notifyUsers, notifyRoles, usersWithRoles } = require('./notificationService');
const { STAGE_BUCKETS, logActivity, notifyPartner, fullName } = require('./salesWorkspace');

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const LIVE_DEAL_SQL = "status NOT IN ('CANCELLED', 'REJECTED')";
const BOOKING_APPROVERS = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_OWNER'];
const SELF_APPROVED_ROLES = ['SUPER_ADMIN', 'BUSINESS_OWNER'];

const DOCUMENT_CHECKLIST = [
  ['KYC_PAN', 'PAN card'],
  ['KYC_ID', 'Aadhaar / passport (identity proof)'],
  ['KYC_ADDRESS', 'Address proof'],
  ['PHOTO', 'Passport-size photographs'],
  ['BOOKING_FORM', 'Signed booking application form'],
  ['ALLOTMENT_LETTER', 'Allotment letter (issued by company)'],
  ['AGREEMENT_FOR_SALE', 'Agreement for sale'],
  ['LOAN_SANCTION', 'Home loan sanction letter (if financing)']
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function nextDealNumber(conn) {
  for (let i = 0; i < 5; i++) {
    const n = `DEAL-${new Date().getFullYear().toString().slice(2)}${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
    const [rows] = await conn.query('SELECT 1 FROM deals WHERE deal_number = ?', [n]);
    if (!rows.length) return n;
  }
  return `DEAL-${Date.now()}`;
}

/** Does this booking need someone else's approval under the company's rule? */
async function needsApproval(initiatorRole, discountPct) {
  if (SELF_APPROVED_ROLES.includes(initiatorRole)) return false;
  const wf = await settings.getWorkflowSettings();
  if (wf.booking_approval_mode === 'NEVER') return false;
  if (wf.booking_approval_mode === 'DISCOUNT_ONLY') return discountPct > Number(wf.booking_discount_threshold_pct || 0);
  return true;
}

/**
 * @param {object} user  the signed-in user ({ id, name, role, jobLevel })
 * @param {object} p     { leadId, unitId, discountAmount, tokenAmount, notes, channel }
 */
async function initiateBooking(user, { leadId, unitId, discountAmount = 0, tokenAmount = null, notes = null, channel = 'WORKSPACE' }, req = null) {
  if (!unitId) throw httpError(400, 'Choose the unit being booked.');
  const discount = Math.max(0, Number(discountAmount) || 0);
  const conn = await pool.getConnection();
  let deal;
  let lead;
  let unit;
  let pending;
  try {
    await conn.beginTransaction();
    [[lead]] = await conn.query('SELECT * FROM leads WHERE id = ? FOR UPDATE', [leadId]);
    if (!lead) throw httpError(404, 'Lead not found.');
    [[unit]] = await conn.query(
      `SELECT u.*, p.name AS project_name FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id = ? FOR UPDATE`,
      [unitId]
    );
    if (!unit) throw httpError(404, 'Unit not found.');
    const [live] = await conn.query(`SELECT id, deal_number, lead_id FROM deals WHERE unit_id = ? AND ${LIVE_DEAL_SQL} LIMIT 1 FOR UPDATE`, [unit.id]);
    if (live[0]) {
      throw httpError(409, live[0].lead_id === lead.id
        ? `This client already has a booking for unit ${unit.unit_number} (${live[0].deal_number}).`
        : `Unit ${unit.unit_number} is already reserved or booked for another client.`, { code: 'UNIT_TAKEN' });
    }
    if (unit.status !== 'AVAILABLE') {
      throw httpError(409, `Unit ${unit.unit_number} is ${unit.status === 'HOLD' ? 'reserved' : unit.status.toLowerCase()} and can't be booked.`, { code: 'UNIT_TAKEN' });
    }

    const listPrice = Number(unit.base_price) + Number(unit.plc_charges || 0);
    if (listPrice <= 0) throw httpError(400, 'This unit has no price set. Ask the inventory team to price it before booking.');
    if (discount >= listPrice) throw httpError(400, 'Discount cannot be more than the unit price.');
    const total = listPrice - discount;
    const token = Number(tokenAmount) > 0 ? Math.min(Number(tokenAmount), total) : Math.round(total * 0.1);
    const discountPct = listPrice ? (discount / listPrice) * 100 : 0;
    pending = await needsApproval(user.role, discountPct);

    // Customer record (one per person; matched by lead, phone or email)
    const [existing] = await conn.query(
      'SELECT id FROM customers WHERE lead_id = ? OR phone = ? OR (email IS NOT NULL AND email <> \'\' AND email = ?) LIMIT 1',
      [lead.id, lead.phone, lead.email || '__none__']
    );
    let customerId = existing[0] && existing[0].id;
    if (!customerId) {
      customerId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO customers (id, lead_id, first_name, last_name, email, phone, kyc_status, assigned_rep_id, is_test_data)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [customerId, lead.id, lead.first_name, lead.last_name, lead.email, lead.phone, lead.assigned_agent_id || user.id, lead.is_test_data ? 1 : 0]
      );
    }

    const dealId = crypto.randomUUID();
    const dealNumber = await nextDealNumber(conn);
    await conn.query(
      `INSERT INTO deals (id, deal_number, customer_id, lead_id, unit_id, base_price, plc_charges, discount_amount,
                          agreed_total_amount, booking_token_amount, status, created_by, channel_partner_id, booking_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dealId, dealNumber, customerId, lead.id, unit.id, unit.base_price, unit.plc_charges || 0, discount, total, token,
        pending ? 'PENDING_APPROVAL' : 'BOOKED', user.id, lead.channel_partner_id || null, channel]
    );

    if (pending) {
      const holdHours = Number((await settings.getWorkflowSettings()).reservation_hold_hours) || 48;
      await conn.query(
        `UPDATE units SET status = 'HOLD', hold_deal_id = ?, hold_expires_at = NOW() + INTERVAL ? HOUR, status_changed_at = NOW() WHERE id = ?`,
        [dealId, holdHours, unit.id]
      );
      await conn.query(
        'UPDATE leads SET stage = ?, preferred_project_id = ?, next_follow_up_at = NULL WHERE id = ?',
        [STAGE_BUCKETS.NEGOTIATION.stage, unit.project_id, lead.id]
      );
    }
    await logActivity({
      leadId: lead.id, userId: user.id, type: 'BOOKING', outcome: pending ? 'SUBMITTED' : 'BOOKED',
      note: `${pending ? 'Booking submitted for approval' : 'Booked'}: unit ${unit.unit_number} at ${unit.project_name} — ${dealNumber}, ${money(total)}${discount ? ` (discount ${money(discount)})` : ''}${notes ? ` — ${notes}` : ''}`
    }, conn);
    await conn.commit();
    deal = { id: dealId, deal_number: dealNumber, total, token, discount, customerId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY' && /active_unit/.test(err.message)) {
      throw httpError(409, 'This unit was just booked by someone else.', { code: 'UNIT_TAKEN' });
    }
    throw err;
  } finally {
    conn.release();
  }

  const clientName = fullName(lead.first_name, lead.last_name);
  await audit.record({
    req, actor: req ? undefined : { id: user.id, name: user.name, role: user.role },
    action: pending ? 'BOOKING_SUBMITTED' : 'BOOKING_CREATED', entityType: 'DEAL', entityId: deal.id,
    summary: `${clientName}: unit ${unit.unit_number} (${unit.project_name}) — ${deal.deal_number}, ${money(deal.total)}`,
    after: { lead_id: lead.id, unit_id: unit.id, agreed_total_amount: deal.total, discount_amount: deal.discount, status: pending ? 'PENDING_APPROVAL' : 'BOOKED' },
    result: pending ? 'PENDING' : 'SUCCESS'
  });

  if (pending) {
    await createApproval({
      type: 'BOOKING', entityType: 'DEAL', entityId: deal.id,
      title: `Booking ${deal.deal_number} — ${clientName}, unit ${unit.unit_number}`,
      details: `${unit.project_name}, unit ${unit.unit_number}. Agreed ${money(deal.total)}${deal.discount ? ` after ${money(deal.discount)} discount` : ''}; booking amount ${money(deal.token)}. Unit reserved meanwhile.`,
      amount: deal.total, requestedBy: user.id, approverRoles: BOOKING_APPROVERS
    });
    await notifyUsers([lead.assigned_agent_id], {
      type: 'INFO', title: `Booking submitted: ${clientName}`, message: `Unit ${unit.unit_number} is reserved while ${deal.deal_number} awaits approval.`,
      relatedEntityType: 'LEAD', relatedEntityId: lead.id, category: 'BOOKING_SUBMITTED'
    }, user.id);
    return { dealId: deal.id, dealNumber: deal.deal_number, status: 'PENDING_APPROVAL', agreedTotal: deal.total,
      message: `Booking ${deal.deal_number} submitted for approval. Unit ${unit.unit_number} is reserved for this client.` };
  }

  await afterBooked(deal.id, user, req);
  return { dealId: deal.id, dealNumber: deal.deal_number, status: 'BOOKED', agreedTotal: deal.total,
    message: `Booked! ${deal.deal_number} — unit ${unit.unit_number}.` };
}

async function loadDeal(dealId, conn = pool, lock = false) {
  const [[deal]] = await conn.query(
    `SELECT d.*, u.unit_number, u.project_id, u.status AS unit_status, u.hold_deal_id, p.name AS project_name,
            l.first_name, l.last_name, l.assigned_agent_id, l.channel_partner_id AS lead_partner_id
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id
       LEFT JOIN leads l ON l.id = d.lead_id
      WHERE d.id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [dealId]
  );
  if (!deal) throw httpError(404, 'Booking not found.');
  deal.client_name = fullName(deal.first_name, deal.last_name);
  return deal;
}

async function approveBooking(dealId, user, note = null, req = null) {
  const conn = await pool.getConnection();
  let deal;
  try {
    await conn.beginTransaction();
    deal = await loadDeal(dealId, conn, true);
    if (deal.status !== 'PENDING_APPROVAL') throw httpError(409, `Booking ${deal.deal_number} is ${deal.status.toLowerCase()}, not waiting for approval.`);
    const [[unit]] = await conn.query('SELECT * FROM units WHERE id = ? FOR UPDATE', [deal.unit_id]);
    if (unit.status !== 'AVAILABLE' && !(unit.status === 'HOLD' && unit.hold_deal_id === deal.id)) {
      throw httpError(409, `Unit ${unit.unit_number} is no longer reserved for this booking (${unit.status}).`);
    }
    await conn.query(
      "UPDATE deals SET status = 'BOOKED', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [user.id, deal.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'APPROVAL', outcome: 'APPROVED', note: `Booking ${deal.deal_number} approved by ${user.name}${note ? ` — ${note}` : ''}` });
  await afterBooked(deal.id, user, req);
  return { dealId: deal.id, status: 'BOOKED' };
}

/**
 * Everything that follows a confirmed booking. Safe to call once per deal (it checks what's done).
 * Also called by the older booking screens after they book directly.
 */
async function afterBooked(dealId, user = null, req = null) {
  const deal = await loadDeal(dealId);
  const actorId = user ? user.id : null;

  // Inventory, lead
  await pool.query(
    "UPDATE units SET status = 'BOOKED', hold_deal_id = NULL, hold_expires_at = NULL, status_changed_at = NOW() WHERE id = ? AND status <> 'SOLD'",
    [deal.unit_id]
  );
  if (deal.lead_id) {
    await pool.query(
      `UPDATE leads SET stage = ?, preferred_project_id = ?, next_follow_up_at = NULL, converted_at = COALESCE(converted_at, NOW()) WHERE id = ?`,
      [STAGE_BUCKETS.BOOKED.stage, deal.project_id, deal.lead_id]
    );
  }

  // Partner commission (earned at booking, at the firm's agreed rate)
  let commission = null;
  const partnerId = deal.channel_partner_id || deal.lead_partner_id;
  if (partnerId) {
    const [[already]] = await pool.query('SELECT id, total_commission FROM broker_commissions WHERE deal_id = ?', [deal.id]);
    if (already) {
      commission = { amount: Number(already.total_commission) };
    } else {
      const [[cp]] = await pool.query('SELECT commission_rate FROM channel_partners WHERE id = ?', [partnerId]);
      if (cp) {
        const rate = Number(cp.commission_rate) || 0;
        commission = { rate, amount: Math.round(Number(deal.agreed_total_amount) * rate) / 100 };
        await pool.query(
          `INSERT INTO broker_commissions (id, partner_id, deal_id, deal_amount, commission_rate, total_commission, paid_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'PENDING')`,
          [crypto.randomUUID(), partnerId, deal.id, deal.agreed_total_amount, rate, commission.amount]
        );
      }
    }
  }

  // Payment schedule (unless one was entered already)
  const [[{ n: milestones }]] = await pool.query('SELECT COUNT(*) AS n FROM payment_milestones WHERE deal_id = ?', [deal.id]);
  if (!Number(milestones)) {
    const total = Number(deal.agreed_total_amount);
    const token = Math.min(Number(deal.booking_token_amount) || Math.round(total * 0.1), total);
    const agreement = Math.max(Math.round(total * 0.2) - token, 0);
    const construction = Math.round(total * 0.7);
    const possession = Math.max(total - token - agreement - construction, 0);
    const plan = [
      ['Booking amount', token, 7],
      ['On agreement for sale', agreement, 30],
      ['Construction-linked instalments', construction, 180],
      ['On possession', possession, 365]
    ].filter(([, amount]) => amount > 0);
    for (const [name, amount, days] of plan) {
      await pool.query(
        `INSERT INTO payment_milestones (id, deal_id, milestone_name, due_percentage, due_amount, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [crypto.randomUUID(), deal.id, name, total ? Math.round((amount / total) * 10000) / 100 : null, amount, addDays(days)]
      );
    }
  }

  // Customer care onboarding: relationship manager + document checklist
  const [[customer]] = await pool.query('SELECT * FROM customers WHERE id = ?', [deal.customer_id]);
  let rmId = customer ? customer.relationship_manager_id : null;
  if (customer && !rmId) {
    const [rms] = await pool.query(
      `SELECT u.id, (SELECT COUNT(*) FROM customers c WHERE c.relationship_manager_id = u.id) AS load_count
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.name = 'CUSTOMER_RELATIONS'
        ORDER BY load_count ASC, u.job_level = 'HEAD' ASC, u.created_at ASC LIMIT 1`
    );
    rmId = rms[0] ? rms[0].id : null;
  }
  if (customer) {
    await pool.query(
      `UPDATE customers SET relationship_manager_id = COALESCE(relationship_manager_id, ?),
              onboarding_status = IF(onboarding_status = 'NOT_STARTED', 'IN_PROGRESS', onboarding_status) WHERE id = ?`,
      [rmId, customer.id]
    );
    const [[{ n: docs }]] = await pool.query('SELECT COUNT(*) AS n FROM customer_documents WHERE customer_id = ? AND deal_id = ?', [customer.id, deal.id]);
    if (!Number(docs)) {
      for (const [type, title] of DOCUMENT_CHECKLIST) {
        await pool.query(
          'INSERT INTO customer_documents (id, customer_id, deal_id, doc_type, title, status) VALUES (?, ?, ?, ?, ?, \'PENDING\')',
          [crypto.randomUUID(), customer.id, deal.id, type, title]
        );
      }
      await pool.query(
        `INSERT INTO customer_communications (id, customer_id, deal_id, channel, direction, subject, summary, user_id)
         VALUES (?, ?, ?, 'NOTE', 'INTERNAL', 'Booking confirmed', ?, ?)`,
        [crypto.randomUUID(), customer.id, deal.id,
          `Booking ${deal.deal_number} confirmed: unit ${deal.unit_number}, ${deal.project_name}, ${money(deal.agreed_total_amount)}. Onboarding started.`, actorId]
      );
    }
  }

  // Tell everyone who now has work to do
  const title = `🎉 Booking confirmed: ${deal.client_name}`;
  const detail = `Unit ${deal.unit_number}, ${deal.project_name} — ${deal.deal_number}, ${money(deal.agreed_total_amount)}.`;
  await notifyUsers([deal.assigned_agent_id, deal.created_by], {
    type: 'SUCCESS', title, message: detail, relatedEntityType: 'DEAL', relatedEntityId: deal.id, category: 'BOOKING_APPROVED'
  }, actorId);
  await notifyRoles(['SUPER_ADMIN', 'ADMIN'], { type: 'SUCCESS', title, message: detail, relatedEntityType: 'DEAL', relatedEntityId: deal.id, category: 'BOOKING_APPROVED' }, actorId);
  await notifyRoles(['FINANCE'], {
    type: 'INFO', title: `New booking to collect: ${deal.deal_number}`,
    message: `${deal.client_name}, unit ${deal.unit_number}. Booking amount ${money(deal.booking_token_amount)} is due within 7 days.`,
    relatedEntityType: 'DEAL', relatedEntityId: deal.id, category: 'BOOKING_APPROVED'
  }, actorId);
  const careTeam = rmId ? [rmId] : await usersWithRoles(['CUSTOMER_RELATIONS']);
  await notifyUsers(careTeam, {
    type: 'INFO', title: `New customer to onboard: ${deal.client_name}`,
    message: `${detail} Document checklist created.`, relatedEntityType: 'CUSTOMER', relatedEntityId: deal.customer_id, category: 'BOOKING_APPROVED'
  }, actorId);
  if (partnerId) {
    await notifyPartner(partnerId, {
      type: 'SUCCESS', title: `🎉 Your client booked: ${deal.client_name}`,
      message: commission ? `Unit ${deal.unit_number} booked. Commission ${money(commission.amount)} added to your earnings.` : `Unit ${deal.unit_number} booked.`,
      leadId: deal.lead_id, category: 'COMMISSION'
    });
  }

  await audit.record({
    req, actor: req ? undefined : (user ? { id: user.id, name: user.name, role: user.role } : { id: null, name: 'System' }),
    action: 'BOOKING_CONFIRMED', entityType: 'DEAL', entityId: deal.id,
    summary: `${deal.client_name}: ${deal.deal_number} confirmed — unit ${deal.unit_number} booked, schedule and onboarding created`,
    after: { status: 'BOOKED', unit_status: 'BOOKED', commission: commission ? commission.amount : null, relationship_manager_id: rmId }
  });
  return { commission, relationshipManagerId: rmId };
}

async function rejectBooking(dealId, user, reason, req = null) {
  if (!reason || String(reason).trim().length < 3) throw httpError(400, 'Give a reason for rejecting the booking.');
  const conn = await pool.getConnection();
  let deal;
  try {
    await conn.beginTransaction();
    deal = await loadDeal(dealId, conn, true);
    if (deal.status !== 'PENDING_APPROVAL') throw httpError(409, `Booking ${deal.deal_number} is ${deal.status.toLowerCase()}, not waiting for approval.`);
    await conn.query("UPDATE deals SET status = 'REJECTED', rejection_reason = ?, approved_by = ?, approved_at = NOW() WHERE id = ?", [String(reason).slice(0, 255), user.id, deal.id]);
    await conn.query(
      "UPDATE units SET status = 'AVAILABLE', hold_deal_id = NULL, hold_expires_at = NULL, status_changed_at = NOW() WHERE id = ? AND status = 'HOLD' AND hold_deal_id = ?",
      [deal.unit_id, deal.id]
    );
    if (deal.lead_id) {
      await conn.query('UPDATE leads SET stage = ?, next_follow_up_at = NOW() + INTERVAL 1 DAY WHERE id = ?', [STAGE_BUCKETS.NEGOTIATION.stage, deal.lead_id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'APPROVAL', outcome: 'REJECTED', note: `Booking ${deal.deal_number} rejected by ${user.name}: ${reason}. Unit ${deal.unit_number} released.` });
  await notifyUsers([deal.assigned_agent_id, deal.created_by], {
    type: 'WARNING', title: `Booking rejected: ${deal.client_name}`, message: `${deal.deal_number} — ${reason}. Unit ${deal.unit_number} is available again.`,
    relatedEntityType: 'LEAD', relatedEntityId: deal.lead_id, category: 'BOOKING_APPROVED'
  }, user.id);
  await audit.record({
    req, action: 'BOOKING_REJECTED', entityType: 'DEAL', entityId: deal.id,
    summary: `${deal.client_name}: ${deal.deal_number} rejected — ${reason}`,
    before: { status: 'PENDING_APPROVAL', unit_status: 'HOLD' }, after: { status: 'REJECTED', unit_status: 'AVAILABLE', reason }
  });
  return { dealId: deal.id, status: 'REJECTED' };
}

async function cancelBooking(dealId, user, reason, req = null) {
  if (!reason || String(reason).trim().length < 3) throw httpError(400, 'Give a reason for cancelling.');
  const conn = await pool.getConnection();
  let deal;
  try {
    await conn.beginTransaction();
    deal = await loadDeal(dealId, conn, true);
    if (!['PENDING_APPROVAL', 'BOOKED', 'AGREEMENT_SIGNED'].includes(deal.status)) throw httpError(409, `Booking ${deal.deal_number} is ${deal.status.toLowerCase()} and can't be cancelled.`);
    await conn.query("UPDATE deals SET status = 'CANCELLED', cancellation_reason = ?, cancelled_at = NOW() WHERE id = ?", [String(reason).slice(0, 255), deal.id]);
    await conn.query(
      "UPDATE units SET status = 'AVAILABLE', hold_deal_id = NULL, hold_expires_at = NULL, status_changed_at = NOW() WHERE id = ? AND status IN ('HOLD', 'BOOKED')",
      [deal.unit_id]
    );
    await conn.query("UPDATE approval_requests SET status = 'CANCELLED', decided_by = ?, decided_at = NOW() WHERE entity_type = 'DEAL' AND entity_id = ? AND status = 'PENDING'", [user.id, deal.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'BOOKING', outcome: 'CANCELLED', note: `Booking ${deal.deal_number} cancelled: ${reason}. Unit ${deal.unit_number} released.` });
  await notifyRoles(['FINANCE', 'CUSTOMER_RELATIONS', 'SUPER_ADMIN'], {
    type: 'WARNING', title: `Booking cancelled: ${deal.deal_number}`, message: `${deal.client_name}, unit ${deal.unit_number} — ${reason}. Check for refunds due.`,
    relatedEntityType: 'DEAL', relatedEntityId: deal.id, category: 'REFUND'
  }, user.id);
  await audit.record({
    req, action: 'BOOKING_CANCELLED', entityType: 'DEAL', entityId: deal.id,
    summary: `${deal.client_name}: ${deal.deal_number} cancelled — ${reason}`,
    before: { status: deal.status }, after: { status: 'CANCELLED', unit_status: 'AVAILABLE', reason }
  });
  return { dealId: deal.id, status: 'CANCELLED' };
}

/** BOOKED → AGREEMENT_SIGNED → CLOSED_WON (registration; unit becomes SOLD). */
async function advanceBooking(dealId, user, status, req = null) {
  const flow = { BOOKED: 'AGREEMENT_SIGNED', AGREEMENT_SIGNED: 'CLOSED_WON' };
  const deal = await loadDeal(dealId);
  if (flow[deal.status] !== status) throw httpError(400, `A ${deal.status.toLowerCase().replace('_', ' ')} booking can't move to ${String(status).toLowerCase().replace('_', ' ')}.`);
  await pool.query('UPDATE deals SET status = ?, closing_date = IF(? = \'CLOSED_WON\', CURDATE(), closing_date) WHERE id = ? AND status = ?', [status, status, deal.id, deal.status]);
  if (status === 'CLOSED_WON') await pool.query("UPDATE units SET status = 'SOLD', status_changed_at = NOW() WHERE id = ?", [deal.unit_id]);
  await logActivity({ leadId: deal.lead_id, userId: user.id, type: 'BOOKING', outcome: status, note: status === 'CLOSED_WON' ? `Sale registered — unit ${deal.unit_number} sold` : `Agreement for sale signed (${deal.deal_number})` });
  await audit.record({ req, action: status === 'CLOSED_WON' ? 'SALE_REGISTERED' : 'AGREEMENT_SIGNED', entityType: 'DEAL', entityId: deal.id, summary: `${deal.client_name}: ${deal.deal_number} → ${status}`, before: { status: deal.status }, after: { status } });
  return { dealId: deal.id, status };
}

module.exports = { initiateBooking, approveBooking, rejectBooking, cancelBooking, advanceBooking, afterBooked, loadDeal, needsApproval, DOCUMENT_CHECKLIST };
