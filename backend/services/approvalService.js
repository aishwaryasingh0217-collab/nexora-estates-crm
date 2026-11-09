/**
 * Approval centre — one queue for everything that needs a second person's yes:
 * bookings (per the company's approval rule), refunds, visits (when visit approval is on), and
 * anything else added later.
 *
 * approver_roles lists who may decide (e.g. "SUPER_ADMIN,ADMIN,BUSINESS_OWNER" or "FINANCE:HEAD").
 * Nobody may approve their own request. Deciding an approval runs the real action (the booking is
 * confirmed and the unit marked booked, the refund is approved, …) through that module's service.
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const { notifyUsers, createNotification } = require('./notificationService');

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

const parseRoles = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);

function mayDecide(user, approval) {
  return parseRoles(approval.approver_roles).some((entry) => {
    const [role, level] = entry.split(':');
    return role === user.role && (!level || level === user.jobLevel);
  });
}

async function approverIds(roles) {
  const ids = new Set();
  for (const entry of roles) {
    const [role, level] = entry.split(':');
    const [rows] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.name = ? ${level ? 'AND u.job_level = ?' : ''}`,
      level ? [role, level] : [role]
    );
    rows.forEach((r) => ids.add(r.id));
  }
  return [...ids];
}

async function createApproval({ type, entityType, entityId, title, details = null, amount = null, requestedBy = null, approverRoles }) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO approval_requests (id, request_type, entity_type, entity_id, title, details, amount, requested_by, approver_roles)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, entityType, entityId, String(title).slice(0, 255), details, amount, requestedBy, approverRoles.join(',')]
  );
  await notifyUsers(await approverIds(approverRoles), {
    type: 'WARNING',
    title: `Approval needed: ${title}`,
    message: details || 'Open the approval centre to approve or reject.',
    relatedEntityType: 'APPROVAL',
    relatedEntityId: id,
    category: 'APPROVAL_REQUEST'
  }, requestedBy);
  await audit.record({
    actor: requestedBy ? { id: requestedBy } : { id: null, name: 'System' },
    action: 'APPROVAL_REQUESTED', entityType: 'APPROVAL', entityId: id,
    summary: `${type}: ${title}`, after: { type, entityType, entityId, amount, approverRoles }, result: 'PENDING',
    source: requestedBy ? 'HUMAN' : 'SYSTEM'
  });
  return id;
}

/** Approvals this user may decide (pending first), plus the ones they asked for. */
async function listApprovals(user, { status = 'PENDING', type = null, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (status && status !== 'ALL') { where.push('a.status = ?'); params.push(status); }
  if (type) { where.push('a.request_type = ?'); params.push(type); }
  const [rows] = await pool.query(
    `SELECT a.*, rq.first_name AS req_first, rq.last_name AS req_last, dc.first_name AS dec_first, dc.last_name AS dec_last
       FROM approval_requests a
       LEFT JOIN users rq ON rq.id = a.requested_by
       LEFT JOIN users dc ON dc.id = a.decided_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.status = 'PENDING' DESC, a.created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(limit) || 100, 500)]
  );
  return rows
    .filter((a) => mayDecide(user, a) || a.requested_by === user.id || user.role === 'BUSINESS_OWNER')
    .map((a) => ({
      ...a,
      requested_by_name: [a.req_first, a.req_last].filter(Boolean).join(' ') || 'System',
      decided_by_name: [a.dec_first, a.dec_last].filter(Boolean).join(' ') || null,
      can_decide: a.status === 'PENDING' && mayDecide(user, a) && a.requested_by !== user.id
    }));
}

async function pendingCountFor(user) {
  const list = await listApprovals(user, { status: 'PENDING', limit: 500 });
  return list.filter((a) => a.can_decide).length;
}

/**
 * Approves or rejects. decision: 'APPROVE' | 'REJECT'. Runs the underlying action first; the
 * approval is only marked decided when that action succeeded.
 */
async function decide(user, approvalId, decision, note = null, req = null) {
  const [[approval]] = await pool.query('SELECT * FROM approval_requests WHERE id = ?', [approvalId]);
  if (!approval) throw httpError(404, 'Approval request not found.');
  if (approval.status !== 'PENDING') throw httpError(409, `This request was already ${approval.status.toLowerCase()}.`);
  if (!mayDecide(user, approval)) throw httpError(403, 'Your role cannot decide this request.');
  if (approval.requested_by && approval.requested_by === user.id) throw httpError(403, 'You cannot approve your own request.');
  const approve = String(decision).toUpperCase() === 'APPROVE';
  if (!approve && (!note || String(note).trim().length < 3)) throw httpError(400, 'Give a reason for rejecting.');

  // Claim it first so two approvers clicking at once can't both act
  const [claim] = await pool.query(
    `UPDATE approval_requests SET status = 'APPROVED', decided_by = ?, decided_at = NOW(), decision_note = ?
      WHERE id = ? AND status = 'PENDING'`,
    [user.id, note ? String(note).slice(0, 500) : null, approval.id]
  );
  if (!claim.affectedRows) throw httpError(409, 'Someone else just decided this request.');

  let outcome;
  try {
    outcome = await runAction(user, approval, approve, note, req);
  } catch (err) {
    await pool.query("UPDATE approval_requests SET status = 'PENDING', decided_by = NULL, decided_at = NULL, decision_note = NULL WHERE id = ?", [approval.id]);
    throw err;
  }
  if (!approve) await pool.query("UPDATE approval_requests SET status = 'REJECTED' WHERE id = ?", [approval.id]);

  if (approval.requested_by) {
    await createNotification({
      recipientUserId: approval.requested_by,
      type: approve ? 'SUCCESS' : 'WARNING',
      title: `${approve ? 'Approved' : 'Rejected'}: ${approval.title}`,
      message: `${user.name || 'An approver'}${approve ? ' approved' : ' rejected'} your request.${note ? ` Note: ${note}` : ''}`,
      relatedEntityType: approval.entity_type,
      relatedEntityId: approval.entity_id,
      category: approval.request_type === 'BOOKING' ? 'BOOKING_APPROVED' : approval.request_type === 'REFUND' ? 'REFUND' : 'APPROVAL_REQUEST'
    });
  }
  await audit.record({
    req, action: approve ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED', entityType: 'APPROVAL', entityId: approval.id,
    summary: `${approval.request_type}: ${approval.title} — ${approve ? 'approved' : 'rejected'}${note ? ` (${note})` : ''}`,
    before: { status: 'PENDING' }, after: { status: approve ? 'APPROVED' : 'REJECTED', note }
  });
  return { status: approve ? 'APPROVED' : 'REJECTED', outcome };
}

async function runAction(user, approval, approve, note, req) {
  switch (approval.request_type) {
    case 'BOOKING': {
      const bookings = require('./bookingService');
      return approve
        ? bookings.approveBooking(approval.entity_id, user, note, req)
        : bookings.rejectBooking(approval.entity_id, user, note, req);
    }
    case 'REFUND': {
      const finance = require('./financeService');
      return finance.decideRefund(approval.entity_id, user, approve, note, req);
    }
    case 'VISIT': {
      const visits = require('./visitService');
      const actor = visits.visitActor(user);
      return visits.transition(actor, approval.entity_id, approve ? 'approve' : 'cancel', { reason: note }, req);
    }
    default:
      return null;
  }
}

module.exports = { createApproval, listApprovals, pendingCountFor, decide, mayDecide };
