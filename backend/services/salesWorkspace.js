/**
 * Sales Workspace domain service — the shared rules every portal (Super Admin CRM,
 * Sales Manager, Agents, Channel Partners, public website) relies on:
 *   - one stage vocabulary (legacy spellings mapped into 7 buckets)
 *   - phone-based duplicate detection
 *   - fair lead routing that skips people on leave
 *   - follow-up times that respect working hours
 *   - an activity timeline + cross-portal notifications
 */
const crypto = require('crypto');
const pool = require('../config/db');
const { createNotification } = require('./notificationService');

const AGENT_ROLES = ['INSIDE_SALES', 'OUTSIDE_SALES'];
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const PARTNER_ROLE = 'CHANNEL_PARTNER';
const FIELD_ROLES = [...AGENT_ROLES, PARTNER_ROLE];

const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR || '9', 10);
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR || '20', 10);
const CP_PROTECTION_DAYS = parseInt(process.env.CP_PROTECTION_DAYS || '60', 10);

// Canonical stage written for each bucket, plus every legacy spelling already in the data.
const STAGE_BUCKETS = {
  NEW:         { label: 'New',         stage: 'Fresh Lead',           aliases: ['Fresh Lead', 'New Lead', 'INCOMING', 'NEW'] },
  CONTACTED:   { label: 'Follow-up',   stage: 'Contacted',            aliases: ['Contacted', 'CONTACTED', '1st Attempt Done', '2nd Attempt Done', 'Not Answered', 'NOT ANSWERED', 'Not Reachable', 'No Response', 'Hold', 'HOLD', 'Qualified', 'Rescheduled', 'Site Visit Cancelled'] },
  VISIT:       { label: 'Visit fixed', stage: 'Site Visit Scheduled', aliases: ['Site Visit Scheduled', 'Site Visit Confirmed', '2nd Visit Scheduled', 'VISIT_SCHEDULED'] },
  VISITED:     { label: 'Visited',     stage: 'Site Visit Done',      aliases: ['Site Visit Done', 'VISIT_COMPLETED'] },
  NEGOTIATION: { label: 'Negotiation', stage: 'In Negotiation',       aliases: ['In Negotiation', 'NEGOTIATION', 'Negotiation'] },
  BOOKED:      { label: 'Booked',      stage: 'Booking Done',         aliases: ['Booking Done', 'WON', 'Closed Won'] },
  LOST:        { label: 'Lost',        stage: 'Lost',                 aliases: ['Lost', 'LOST', 'Junk', 'Duplicate'] }
};
const CLOSED_STAGES = [...STAGE_BUCKETS.BOOKED.aliases, ...STAGE_BUCKETS.LOST.aliases];

const sqlList = (arr) => arr.map((s) => pool.escape(s)).join(', ');

// Visits that occupy a field agent's calendar (see services/visitService.js for the full lifecycle)
const AGENT_BUSY_VISIT_STATUSES = ['ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'];

/** SQL CASE expression that maps leads.stage → bucket key. Unknown legacy values count as follow-ups. */
const bucketSql = (col = 'l.stage') =>
  `CASE ${Object.entries(STAGE_BUCKETS)
    .map(([key, b]) => `WHEN ${col} IN (${sqlList(b.aliases)}) THEN '${key}'`)
    .join(' ')} ELSE 'CONTACTED' END`;

const OPEN_STAGE_SQL = (col = 'l.stage') => `${col} NOT IN (${sqlList(CLOSED_STAGES)})`;

function bucketOf(stage) {
  for (const [key, b] of Object.entries(STAGE_BUCKETS)) {
    if (b.aliases.includes(stage)) return key;
  }
  return 'CONTACTED';
}

/** Last 10 digits — how Indian mobile numbers are compared regardless of +91 / spaces / dashes. */
function phoneKey(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function findLeadByPhone(phone, conn = pool) {
  const key = phoneKey(phone);
  if (key.length < 10) return null;
  const [rows] = await conn.query(
    `SELECT l.*, ${bucketSql()} AS bucket
       FROM leads l
      WHERE RIGHT(REGEXP_REPLACE(l.phone, '[^0-9]', ''), 10) = ?
      ORDER BY l.created_at DESC
      LIMIT 1`,
    [key]
  );
  return rows[0] || null;
}

/**
 * Moves a proposed follow-up time inside working hours so nobody is nudged at 11pm.
 * Before the day starts → that morning at start+1h; after it ends → next morning.
 */
function withinWorkingHours(date) {
  const d = new Date(date);
  const morning = (day) => { day.setHours(WORK_START_HOUR + 1, 0, 0, 0); return day; };
  if (d.getHours() < WORK_START_HOUR) return morning(d);
  if (d.getHours() >= WORK_END_HOUR) { d.setDate(d.getDate() + 1); return morning(d); }
  return d;
}

function tomorrowAt(hour) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function hoursFromNow(h) {
  return withinWorkingHours(new Date(Date.now() + h * 3600 * 1000));
}

/**
 * Fair routing: the available agent with the fewest open leads (ties → whoever got a lead longest ago).
 * Agents who switched on "On leave" are skipped, so their queue doesn't grow while they're away.
 */
async function pickAvailableAgent(roles = AGENT_ROLES) {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name,
            COUNT(l.id) AS open_leads,
            MAX(l.created_at) AS last_assigned_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN leads l ON l.assigned_agent_id = u.id AND ${OPEN_STAGE_SQL()}
      WHERE u.status = 'ACTIVE' AND u.is_available = 1 AND r.name IN (${sqlList(roles)})
      GROUP BY u.id
      ORDER BY open_leads ASC, last_assigned_at ASC
      LIMIT 1`
  );
  return rows[0] || null;
}

/** New enquiries go to telecallers (inside sales) first; field agents only if no telecaller is free. */
async function pickLeadOwner() {
  return (await pickAvailableAgent(['INSIDE_SALES'])) || (await pickAvailableAgent(AGENT_ROLES));
}

/**
 * Who conducts a site visit at `when`: an available field agent with no visit within the hour,
 * lightest day first. Falls back to `fallbackId` (usually the lead's owner), then to a manager —
 * a client's visit is never dropped for want of an assignee.
 */
async function pickVisitAgent(when, fallbackId = null) {
  const [field] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.phone,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN (${sqlList(AGENT_BUSY_VISIT_STATUSES)})
                AND DATE(sv.scheduled_time) = DATE(?)) AS day_load
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND u.is_available = 1 AND r.name = 'OUTSIDE_SALES'
        AND NOT EXISTS (SELECT 1 FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN (${sqlList(AGENT_BUSY_VISIT_STATUSES)})
                          AND sv.scheduled_time BETWEEN ? - INTERVAL 59 MINUTE AND ? + INTERVAL 59 MINUTE)
      ORDER BY day_load ASC, u.first_name
      LIMIT 1`,
    [when, when, when]
  );
  if (field[0]) return field[0];
  const ids = [fallbackId].filter(Boolean);
  if (ids.length) {
    const [rows] = await pool.query('SELECT id, first_name, last_name, phone FROM users WHERE id = ? AND status = \'ACTIVE\'', ids);
    if (rows[0]) return rows[0];
  }
  const [mgr] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.phone FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN ('ADMIN', 'SUPER_ADMIN') ORDER BY r.name = 'SUPER_ADMIN', u.created_at LIMIT 1`
  );
  return mgr[0] || null;
}

/**
 * Inserts a visit + its history row. Returns the new visit id. A visit handed to a field agent starts
 * as ASSIGNED (they accept it); without an agent it is REQUESTED for a manager to allocate.
 */
async function insertVisit({ leadId, projectId, agentId, when, byUserId = null, note = null, status = null, clientConfirmed = true }) {
  const visitId = crypto.randomUUID();
  const initial = status || (agentId ? 'ASSIGNED' : 'REQUESTED');
  await pool.query(
    `INSERT INTO site_visits (id, lead_id, project_id, assigned_agent_id, scheduled_time, status, client_feedback, requested_by, client_confirmed)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [visitId, leadId, projectId, agentId, when, initial, byUserId, clientConfirmed ? 1 : 0]
  );
  await pool.query(
    `INSERT INTO site_visit_history (id, site_visit_id, action, performed_by, previous_status, new_status, notes)
     VALUES (?, ?, 'CREATED', ?, NULL, ?, ?)`,
    [crypto.randomUUID(), visitId, byUserId, initial, note]
  );
  return visitId;
}

const whenText = (d) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** True when `d` falls inside working hours (used to sanity-check times picked by clients). */
const isWorkingTime = (d) => d.getHours() >= WORK_START_HOUR && d.getHours() < WORK_END_HOUR;

async function logActivity({ leadId, userId = null, type, outcome = null, note = null }, conn = pool) {
  const id = crypto.randomUUID();
  await conn.query(
    `INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, leadId, userId, type, outcome, note]
  );
  return id;
}

async function notifyManagers({ type = 'INFO', title, message, leadId = null, category = null }, exceptUserId = null) {
  const [rows] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(MANAGER_ROLES)})`
  );
  await Promise.all(rows.filter((r) => r.id !== exceptUserId).map((r) => createNotification({
    recipientUserId: r.id, type, title, message, relatedEntityType: 'LEAD', relatedEntityId: leadId, category
  })));
}

/** Notifies every login that belongs to a channel-partner firm. */
async function notifyPartner(channelPartnerId, { type = 'INFO', title, message, leadId = null, category = null }, exceptUserId = null) {
  if (!channelPartnerId) return;
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE channel_partner_id = ? AND status = 'ACTIVE'`,
    [channelPartnerId]
  );
  await Promise.all(rows.filter((r) => r.id !== exceptUserId).map((r) => createNotification({
    recipientUserId: r.id, type, title, message, relatedEntityType: 'LEAD', relatedEntityId: leadId, category
  })));
}

async function notifyUser(userId, { type = 'INFO', title, message, leadId = null, category = null }, exceptUserId = null) {
  if (!userId || userId === exceptUserId) return;
  await createNotification({ recipientUserId: userId, type, title, message, relatedEntityType: 'LEAD', relatedEntityId: leadId, category });
}

const fullName = (first, last) => [first, last].filter(Boolean).join(' ').trim();

module.exports = {
  AGENT_BUSY_VISIT_STATUSES,
  AGENT_ROLES,
  MANAGER_ROLES,
  PARTNER_ROLE,
  FIELD_ROLES,
  WORK_START_HOUR,
  WORK_END_HOUR,
  CP_PROTECTION_DAYS,
  STAGE_BUCKETS,
  CLOSED_STAGES,
  sqlList,
  bucketSql,
  OPEN_STAGE_SQL,
  bucketOf,
  phoneKey,
  findLeadByPhone,
  withinWorkingHours,
  tomorrowAt,
  hoursFromNow,
  pickAvailableAgent,
  pickLeadOwner,
  pickVisitAgent,
  insertVisit,
  whenText,
  isWorkingTime,
  logActivity,
  notifyManagers,
  notifyPartner,
  notifyUser,
  fullName
};
