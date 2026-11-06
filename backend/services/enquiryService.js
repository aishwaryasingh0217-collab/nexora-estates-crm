/**
 * One way in for every enquiry that comes from outside the team — website forms, ad webhooks
 * (Meta / Google / 99acres), share links, and marketplace actions (priority pass, group buy, offers).
 *
 *   1. normalise the payload and refuse anything without a reachable mobile number
 *   2. de-duplicate by mobile: a repeat enquiry warms up the existing lead instead of creating a twin
 *   3. route a new lead to a telecaller (inside sales) — or keep it with the agent/partner whose link it came from
 *   4. if the client picked a date, book the site visit with a free field agent
 *   5. tell everyone who needs to know: the telecaller, the field agent, the owner and sales managers, the partner
 */
const crypto = require('crypto');
const pool = require('../config/db');
const { createNotification } = require('./notificationService');
const ws = require('./salesWorkspace');

const {
  PARTNER_ROLE, CLOSED_STAGES, CP_PROTECTION_DAYS, STAGE_BUCKETS, WORK_START_HOUR, WORK_END_HOUR,
  findLeadByPhone, pickLeadOwner, pickVisitAgent, insertVisit, logActivity, notifyManagers, notifyPartner,
  notifyUser, hoursFromNow, fullName, whenText, isWorkingTime
} = ws;

class EnquiryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function normaliseSource(raw) {
  const s = String(raw || 'WEBSITE').toUpperCase().slice(0, 100);
  if (/META|\bFB\b|FACEBOOK|INSTAGRAM/.test(s)) return 'FACEBOOK_ADS';
  if (s.includes('99ACRES')) return '99ACRES';
  if (s.includes('MAGIC')) return 'MAGICBRICKS';
  if (s.includes('HOUSING')) return 'HOUSING_COM';
  if (s.includes('GOOGLE')) return 'GOOGLE_ADS';
  if (s.includes('WEB') || s.includes('LANDING')) return 'WEBSITE';
  return s.replace(/[^A-Z0-9_]/g, '_');
}

const SOURCE_TEXT = {
  WEBSITE: 'the website', WEBSITE_RENTAL: 'the website (rental)', FACEBOOK_ADS: 'Facebook ads', GOOGLE_ADS: 'Google ads',
  '99ACRES': '99acres', MAGICBRICKS: 'MagicBricks', HOUSING_COM: 'Housing.com', PRIORITY_PASS: 'a priority pass',
  GROUP_BUY: 'a group-buy pool', RESALE_OFFER: 'a resale offer'
};
/** "the website", "Facebook ads" — how a source reads inside a sentence. */
const sourceText = (s) => SOURCE_TEXT[s] || String(s).replace(/_/g, ' ').toLowerCase();

function splitName(payload) {
  let first = String(payload.first_name || payload.name || payload.full_name || payload.client_name || '').trim();
  let last = String(payload.last_name || '').trim();
  if (!last && first.includes(' ')) {
    const parts = first.split(/\s+/);
    first = parts.shift();
    last = parts.join(' ');
  }
  return { firstName: (first || 'Website visitor').slice(0, 100), lastName: last ? last.slice(0, 100) : null };
}

/** A visit time the client asked for — only honoured if it's in the future, within 60 days, in working hours. */
function parseVisitTime(value) {
  if (!value) return { when: null, reason: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { when: null, reason: 'unreadable date' };
  if (d.getTime() < Date.now() + 30 * 60000) return { when: null, reason: 'time already passed' };
  if (d.getTime() > Date.now() + 60 * 86400000) return { when: null, reason: 'more than 60 days away' };
  if (!isWorkingTime(d)) return { when: null, reason: `outside visiting hours (${WORK_START_HOUR}:00–${WORK_END_HOUR}:00)` };
  return { when: d, reason: null };
}

async function resolveProject(payload) {
  if (payload.project_id) {
    const [rows] = await pool.query('SELECT id, name FROM projects WHERE id = ? LIMIT 1', [String(payload.project_id)]);
    if (rows[0]) return rows[0];
  }
  if (payload.project_name) {
    const [rows] = await pool.query('SELECT id, name FROM projects WHERE name LIKE ? ORDER BY created_at DESC LIMIT 1', [`%${String(payload.project_name).trim()}%`]);
    if (rows[0]) return rows[0];
  }
  return null;
}

/** "Pooja will call you within 2 working hours" — or tomorrow morning when the office is closed. */
function callbackPromise(agent) {
  const who = agent ? agent.first_name : 'Our advisor';
  const h = new Date().getHours();
  if (h >= WORK_START_HOUR && h < WORK_END_HOUR - 1) return `${who} from our team will call you within 2 hours.`;
  return `${who} from our team will call you ${h < WORK_START_HOUR ? 'this' : 'tomorrow'} morning after ${WORK_START_HOUR} am.`;
}

async function bookRequestedVisit({ lead, project, when, ownerId, clientName, source }) {
  const agent = await pickVisitAgent(when, ownerId);
  if (!agent) return null;
  const visitId = await insertVisit({
    leadId: lead.id, projectId: project.id, agentId: agent.id, when,
    note: `Requested online by the client via ${sourceText(source)}`
  });
  const bucket = ws.bucketOf(lead.stage || 'Fresh Lead');
  await pool.query(
    `UPDATE leads SET stage = IF(?, ?, stage), preferred_project_id = COALESCE(preferred_project_id, ?), next_follow_up_at = ? WHERE id = ?`,
    [['NEW', 'CONTACTED'].includes(bucket), STAGE_BUCKETS.VISIT.stage, project.id, hoursFromNow(0.5), lead.id]
  );
  const slot = whenText(when);
  await logActivity({ leadId: lead.id, type: 'VISIT', outcome: 'SCHEDULED', note: `Client booked a site visit online: ${project.name}, ${slot}. Call to confirm.` });

  if (agent.id !== ownerId) {
    await notifyUser(agent.id, { type: 'REMINDER', title: `📍 New site visit: ${clientName}`, message: `${project.name}, ${slot} — booked by the client on the website.`, leadId: lead.id });
  }
  await notifyUser(ownerId, { type: 'REMINDER', title: `📍 ${clientName} booked a visit`, message: `${project.name}, ${slot}${agent.id !== ownerId ? ` with ${agent.first_name}` : ''}. Call now to confirm.`, leadId: lead.id });
  await notifyManagers({ type: 'INFO', title: `Site visit booked online: ${clientName}`, message: `${project.name}, ${slot} — ${fullName(agent.first_name, agent.last_name)}.`, leadId: lead.id });
  if (lead.channel_partner_id) {
    await notifyPartner(lead.channel_partner_id, { type: 'REMINDER', title: `Visit booked for ${clientName}`, message: `${project.name}, ${slot}.`, leadId: lead.id });
  }
  return { id: visitId, when, agent };
}

/**
 * @returns {Promise<{ status: number, body: object }>}
 * @throws {EnquiryError} for input the client must fix (missing number, etc.)
 */
async function captureEnquiry(payload = {}) {
  const { firstName, lastName } = splitName(payload);
  const clientName = fullName(firstName, lastName);
  const phone = String(payload.phone || payload.phone_number || payload.mobile || payload.contact || '').trim().slice(0, 20);
  if (phone.replace(/\D/g, '').length < 10) throw new EnquiryError('Please enter a valid 10-digit mobile number.');

  const email = payload.email || payload.email_address ? String(payload.email || payload.email_address).trim().slice(0, 150) : null;
  const source = normaliseSource(payload.source || payload.platform || payload.lead_source);
  const project = await resolveProject(payload);
  const message = String(payload.message || payload.notes || payload.comments || '').trim().slice(0, 1000) || null;
  const temperature = ['HOT', 'WARM', 'COLD'].includes(payload.temperature) ? payload.temperature : null;
  const visit = parseVisitTime(payload.visit_at);
  const wantsVisit = Boolean(payload.visit_at);
  const visitNote = wantsVisit && !visit.when ? ` (asked for a visit but the time couldn't be booked: ${visit.reason})` : '';

  // ---- Repeat enquiry: warm up the lead we already have -------------------------------------
  const existing = await findLeadByPhone(phone);
  if (existing) {
    const reopen = CLOSED_STAGES.includes(existing.stage) && existing.bucket === 'LOST';
    await logActivity({ leadId: existing.id, type: 'SYSTEM', outcome: 'RE_ENQUIRY', note: `Enquired again via ${sourceText(source)}${project ? ` about ${project.name}` : ''}${message ? `: ${message}` : ''}${visitNote}` });
    await pool.query(
      `UPDATE leads SET next_follow_up_at = ?, stage = IF(?, 'Fresh Lead', stage), lost_reason = IF(?, NULL, lost_reason),
              temperature = COALESCE(?, temperature, 'WARM') WHERE id = ?`,
      [hoursFromNow(0.5), reopen, reopen, temperature, existing.id]
    );
    let owner = existing.assigned_agent_id;
    if (!owner) {
      const picked = await pickLeadOwner();
      owner = picked ? picked.id : null;
      if (owner) await pool.query('UPDATE leads SET assigned_agent_id = ? WHERE id = ?', [owner, existing.id]);
    }
    const existingName = fullName(existing.first_name, existing.last_name);
    let booked = null;
    if (visit.when && project && existing.bucket !== 'BOOKED') {
      booked = await bookRequestedVisit({ lead: existing, project, when: visit.when, ownerId: owner, clientName: existingName, source });
    }
    if (!booked) {
      await notifyUser(owner, { type: 'WARNING', title: `🔁 Re-enquiry: ${existingName}`, message: `Enquired again via ${sourceText(source)}${project ? ` about ${project.name}` : ''}. They're warm — call back soon.`, leadId: existing.id });
    }
    const [[ownerRow]] = owner ? await pool.query('SELECT first_name FROM users WHERE id = ?', [owner]) : [[null]];
    return {
      status: 200,
      body: {
        status: 'success',
        action: 'DUPLICATE_UPDATED',
        message: booked
          ? `Thanks! Your visit request for ${whenText(booked.when)} is noted. ${ownerRow ? ownerRow.first_name : 'Our advisor'} will call to confirm.`
          : `Thanks! ${callbackPromise(ownerRow)}`,
        leadId: existing.id,
        visitBooked: Boolean(booked)
      }
    };
  }

  // ---- New lead -------------------------------------------------------------------------------
  let referrer = null;
  if (payload.ref) {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.channel_partner_id, u.is_available, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.status = 'ACTIVE'`,
      [String(payload.ref)]
    );
    referrer = rows[0] || null;
  }
  const partnerId = referrer && referrer.role === PARTNER_ROLE ? referrer.channel_partner_id : null;
  const owner = referrer && referrer.role !== PARTNER_ROLE && referrer.is_available ? referrer : await pickLeadOwner();
  const protectedUntil = partnerId ? new Date(Date.now() + CP_PROTECTION_DAYS * 86400000) : null;

  const leadId = crypto.randomUUID();
  const budgetMin = Number(payload.budget_min) || null;
  const budgetMax = Number(payload.budget_max) || null;
  await pool.query(
    `INSERT INTO leads (id, first_name, last_name, phone, email, source, stage, budget_min, budget_max, preferred_project_id,
                        assigned_agent_id, sla_due_date, notes, next_follow_up_at, temperature, channel_partner_id, registered_by, cp_protected_until)
     VALUES (?, ?, ?, ?, ?, ?, 'Fresh Lead', ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
    [leadId, firstName, lastName, phone, email, source, budgetMin, budgetMax, project ? project.id : null,
      owner ? owner.id : null, hoursFromNow(2), message, temperature, partnerId, referrer ? referrer.id : null, protectedUntil]
  );

  await logActivity({
    leadId,
    userId: referrer ? referrer.id : null,
    type: 'SYSTEM',
    outcome: 'CREATED',
    note: `Enquiry via ${sourceText(source)}${project ? ` for ${project.name}` : ''}${referrer ? ` (shared link from ${fullName(referrer.first_name, referrer.last_name)})` : ''}${message ? ` — "${message}"` : ''}${visitNote}`
  });
  if (owner) await logActivity({ leadId, type: 'ASSIGN', note: `Assigned to ${fullName(owner.first_name, owner.last_name)}` });
  if (partnerId && project) {
    await pool.query(
      `INSERT INTO cp_lead_locks (id, channel_partner_id, client_name, client_phone, project_id, status, locked_until)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE_LOCKED', ?)`,
      [crypto.randomUUID(), partnerId, clientName, phone, project.id, protectedUntil]
    );
  }

  const lead = { id: leadId, stage: 'Fresh Lead', channel_partner_id: partnerId };
  const booked = visit.when && project ? await bookRequestedVisit({ lead, project, when: visit.when, ownerId: owner ? owner.id : null, clientName, source }) : null;

  if (owner && !booked) {
    await createNotification({
      recipientUserId: owner.id,
      type: 'SUCCESS',
      title: `🔥 New enquiry: ${clientName}`,
      message: `Via ${sourceText(source)}${project ? ` · ${project.name}` : ''}. Call within 2 hours: ${phone}`,
      relatedEntityType: 'LEAD',
      relatedEntityId: leadId
    });
  }
  if (!booked) {
    await notifyManagers({
      type: owner ? 'INFO' : 'WARNING',
      title: owner ? `New enquiry: ${clientName}` : `Unassigned enquiry: ${clientName}`,
      message: owner ? `Via ${sourceText(source)}${project ? ` · ${project.name}` : ''} → ${fullName(owner.first_name, owner.last_name)}.` : `No agent is available right now. Please assign this enquiry from ${sourceText(source)}.`,
      leadId
    });
  }
  if (partnerId) {
    await notifyPartner(partnerId, { type: 'SUCCESS', title: `New client from your link: ${clientName}`, message: `Registered under your firm and protected for ${CP_PROTECTION_DAYS} days.`, leadId });
  }

  return {
    status: 201,
    body: {
      status: 'success',
      action: 'LEAD_INGESTED',
      message: booked
        ? `Thanks, ${firstName}! Your site visit request for ${whenText(booked.when)} is noted. ${owner ? owner.first_name : 'Our advisor'} will call you to confirm.`
        : `Thanks, ${firstName}! ${callbackPromise(owner)}`,
      leadId,
      visitBooked: Boolean(booked),
      data: { leadId, assignedTo: owner ? fullName(owner.first_name, owner.last_name) : 'Unassigned', source }
    }
  };
}

/** Fire-and-forget capture for flows whose own response must not fail (marketplace actions). */
function captureQuietly(payload) {
  return captureEnquiry(payload).catch((err) => console.warn('[Enquiry capture]', err.message));
}

module.exports = { captureEnquiry, captureQuietly, EnquiryError, normaliseSource, parseVisitTime };
