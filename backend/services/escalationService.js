/**
 * Escalations — problems that need a manager's attention: overdue follow-ups, untouched new leads,
 * visits nobody turned up for, reservations about to lapse, or anything a team member raises by hand.
 *
 * System escalations carry a dedupe key, so the same problem is raised once (not every few minutes).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const { notifyUsers, usersWithRoles, createNotification } = require('./notificationService');
const { fullName } = require('./salesWorkspace');

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ROUTES = { ADMIN: ['ADMIN', 'SUPER_ADMIN'], SUPER_ADMIN: ['SUPER_ADMIN'], FINANCE: ['FINANCE'], CUSTOMER_RELATIONS: ['CUSTOMER_RELATIONS'], BUSINESS_OWNER: ['BUSINESS_OWNER'] };

/** Raises an escalation. Returns its id, or null when an identical system escalation already exists. */
async function raise({ entityType, entityId, leadId = null, title, reason = null, severity = 'MEDIUM', raisedBy = null, source = 'HUMAN', toRole = 'ADMIN', assignedTo = null, dedupeKey = null, req = null }) {
  if (!title) throw httpError(400, 'Give the escalation a short title.');
  const id = crypto.randomUUID();
  const sev = SEVERITIES.includes(severity) ? severity : 'MEDIUM';
  const role = ROUTES[toRole] ? toRole : 'ADMIN';
  try {
    await pool.query(
      `INSERT INTO escalations (id, entity_type, entity_id, lead_id, title, reason, severity, raised_by, source, escalated_to_role, assigned_to, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, leadId, String(title).slice(0, 255), reason, sev, raisedBy, source, role, assignedTo, dedupeKey]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }
  const recipients = assignedTo ? [assignedTo] : await usersWithRoles(ROUTES[role]);
  await notifyUsers(recipients, {
    type: sev === 'HIGH' || sev === 'CRITICAL' ? 'ERROR' : 'WARNING',
    title: `⚠ ${title}`,
    message: reason || 'Open escalations to act on it.',
    relatedEntityType: leadId ? 'LEAD' : entityType,
    relatedEntityId: leadId || entityId,
    category: 'ESCALATION'
  }, raisedBy);
  await audit.record({
    req, actor: req ? undefined : raisedBy ? { id: raisedBy } : { id: null, name: 'System' },
    action: 'ESCALATION_RAISED', entityType: 'ESCALATION', entityId: id, source: source === 'SYSTEM' ? 'SYSTEM' : 'HUMAN',
    summary: `${sev}: ${title}`, after: { entity_type: entityType, entity_id: entityId, escalated_to_role: role, reason }
  });
  return id;
}

function visibleRoles(user) {
  if (user.role === 'BUSINESS_OWNER') return null; // all
  if (user.role === 'SUPER_ADMIN') return ['ADMIN', 'SUPER_ADMIN'];
  if (user.role === 'ADMIN') return ['ADMIN'];
  if (['FINANCE', 'CUSTOMER_RELATIONS'].includes(user.role)) return [user.role];
  return [];
}

async function list(user, { status = 'OPEN', limit = 200 } = {}) {
  const roles = visibleRoles(user);
  const where = [];
  const params = [];
  if (status && status !== 'ALL') {
    if (status === 'OPEN') where.push("e.status IN ('OPEN', 'ACKNOWLEDGED')");
    else { where.push('e.status = ?'); params.push(status); }
  }
  if (roles) {
    if (!roles.length) { where.push('(e.raised_by = ? OR e.assigned_to = ?)'); params.push(user.id, user.id); }
    else { where.push('(e.escalated_to_role IN (?) OR e.raised_by = ? OR e.assigned_to = ?)'); params.push(roles, user.id, user.id); }
  }
  const [rows] = await pool.query(
    `SELECT e.*, l.first_name, l.last_name, rb.first_name AS rb_first, rb.last_name AS rb_last, rs.first_name AS rs_first, rs.last_name AS rs_last
       FROM escalations e
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN users rb ON rb.id = e.raised_by
       LEFT JOIN users rs ON rs.id = e.resolved_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY FIELD(e.severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), e.created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(limit) || 200, 500)]
  );
  return rows.map((e) => ({
    ...e,
    client_name: fullName(e.first_name, e.last_name) || null,
    raised_by_name: e.source === 'SYSTEM' ? 'System' : fullName(e.rb_first, e.rb_last) || null,
    resolved_by_name: fullName(e.rs_first, e.rs_last) || null
  }));
}

async function update(user, id, action, note = null, req = null) {
  const [[e]] = await pool.query('SELECT * FROM escalations WHERE id = ?', [id]);
  if (!e) throw httpError(404, 'Escalation not found.');
  const roles = visibleRoles(user);
  if (roles && !roles.includes(e.escalated_to_role) && e.assigned_to !== user.id) throw httpError(403, 'This escalation is for another team.');
  if (e.status === 'RESOLVED') throw httpError(409, 'Already resolved.');
  if (action === 'acknowledge') {
    await pool.query("UPDATE escalations SET status = 'ACKNOWLEDGED', assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", [user.id, e.id]);
  } else if (action === 'resolve') {
    if (!note || String(note).trim().length < 3) throw httpError(400, 'Say how it was resolved.');
    await pool.query("UPDATE escalations SET status = 'RESOLVED', resolution = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?", [String(note).slice(0, 2000), user.id, e.id]);
    if (e.raised_by && e.raised_by !== user.id) {
      await createNotification({ recipientUserId: e.raised_by, type: 'SUCCESS', title: `Resolved: ${e.title}`, message: `${user.name}: ${note}`, relatedEntityType: e.lead_id ? 'LEAD' : e.entity_type, relatedEntityId: e.lead_id || e.entity_id, category: 'ESCALATION' });
    }
  } else {
    throw httpError(400, 'Unknown action.');
  }
  await audit.record({ req, action: action === 'resolve' ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED', entityType: 'ESCALATION', entityId: e.id, summary: `${e.title}${note ? ` — ${note}` : ''}`, before: { status: e.status }, after: { status: action === 'resolve' ? 'RESOLVED' : 'ACKNOWLEDGED' } });
  return { id: e.id };
}

module.exports = { raise, list, update, SEVERITIES };
