/**
 * Lead ownership and lead quality — shared by the workspace, the sales head / manager portals,
 * imports, the website and the AI assistant.
 *
 *   assignLead      one lead → one agent, with ownership history, timeline, notifications, audit
 *   bulkAssign      many leads → one agent, or spread across a group (fewest open leads first)
 *   findDuplicates  same phone (last 10 digits) or same email
 *   scorePriority   URGENT / HIGH / MEDIUM / LOW from temperature, budget, timeline, source and age
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const {
  AGENT_ROLES, MANAGER_ROLES, OPEN_STAGE_SQL, sqlList, phoneKey, logActivity, notifyUser, notifyPartner, fullName
} = require('./salesWorkspace');

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });
const ASSIGNABLE_ROLES = [...AGENT_ROLES, ...MANAGER_ROLES];

async function loadAssignee(userId, conn = pool) {
  const [[agent]] = await conn.query(
    `SELECT u.id, u.first_name, u.last_name, u.phone, u.is_available, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN (${sqlList(ASSIGNABLE_ROLES)})`,
    [userId]
  );
  return agent || null;
}

/**
 * Gives a lead to an agent. `by` is the user doing it ({ id, name, role }) or null for the system.
 * method: MANUAL | AUTO | BULK | IMPORT | AI | REASSIGN | SYSTEM
 */
async function assignLead(leadId, toUserId, { by = null, method = 'MANUAL', reason = null, req = null, source = null } = {}) {
  const [[lead]] = await pool.query('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead) throw httpError(404, 'Lead not found.');
  const agent = await loadAssignee(toUserId);
  if (!agent) throw httpError(400, 'Choose an active sales team member.');
  if (lead.assigned_agent_id === agent.id) return { changed: false, lead, agent };

  const previousId = lead.assigned_agent_id;
  const effectiveMethod = previousId && method === 'MANUAL' ? 'REASSIGN' : method;
  await pool.query(
    'UPDATE leads SET assigned_agent_id = ?, next_follow_up_at = COALESCE(next_follow_up_at, NOW()) WHERE id = ?',
    [agent.id, lead.id]
  );
  await pool.query(
    `INSERT INTO lead_assignments (id, lead_id, from_user_id, to_user_id, assigned_by, method, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), lead.id, previousId, agent.id, by ? by.id : null, effectiveMethod, reason ? String(reason).slice(0, 255) : null]
  );

  const agentName = fullName(agent.first_name, agent.last_name);
  const clientName = fullName(lead.first_name, lead.last_name);
  let previousName = null;
  if (previousId) {
    const [[prev]] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [previousId]);
    previousName = prev ? fullName(prev.first_name, prev.last_name) : null;
  }
  await logActivity({
    leadId: lead.id, userId: by ? by.id : null, type: 'ASSIGN', outcome: effectiveMethod,
    note: previousName ? `Moved from ${previousName} to ${agentName}${reason ? ` — ${reason}` : ''}` : `Assigned to ${agentName}${reason ? ` — ${reason}` : ''}`
  });

  const byName = by ? by.name : 'Auto-assignment';
  await notifyUser(agent.id, {
    type: 'SUCCESS',
    title: previousId ? `Lead moved to you: ${clientName}` : `🔥 New lead: ${clientName}`,
    message: `${previousId ? 'Reassigned' : 'Assigned'} by ${byName}. Call ${lead.phone}.${reason ? ` Note: ${reason}` : ''}`,
    leadId: lead.id,
    category: previousId ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED'
  }, by ? by.id : null);
  if (previousId) {
    await notifyUser(previousId, {
      type: 'INFO',
      title: `Lead reassigned: ${clientName}`,
      message: `${byName} moved this client to ${agentName}.${reason ? ` Reason: ${reason}` : ''}`,
      leadId: lead.id,
      category: 'LEAD_REASSIGNED'
    }, by ? by.id : null);
  }
  await notifyPartner(lead.channel_partner_id, {
    type: 'INFO', title: `Relationship manager for ${clientName}`,
    message: `${agentName}${agent.phone ? ` (${agent.phone})` : ''} is now handling your client.`, leadId: lead.id, category: 'LEAD_REASSIGNED'
  });

  await audit.record({
    req,
    actor: req ? undefined : (by ? { id: by.id, name: by.name, role: by.role } : { id: null, name: 'System', role: null }),
    action: previousId ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED',
    entityType: 'LEAD', entityId: lead.id,
    summary: previousName ? `${clientName}: ${previousName} → ${agentName}` : `${clientName} assigned to ${agentName}`,
    before: { assigned_agent_id: previousId }, after: { assigned_agent_id: agent.id, method: effectiveMethod, reason },
    source: source || (method === 'AI' ? 'AI' : by ? 'HUMAN' : 'SYSTEM')
  });
  return { changed: true, lead, agent, previousId };
}

/** Open-lead load per candidate, lightest first (people on leave are skipped). */
async function loadByAgent(userIds) {
  if (!userIds.length) return [];
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.is_available,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN_STAGE_SQL('l.stage')}) AS open_leads
       FROM users u WHERE u.id IN (?) AND u.status = 'ACTIVE'`,
    [userIds]
  );
  return rows.filter((r) => r.is_available).sort((a, b) => Number(a.open_leads) - Number(b.open_leads));
}

/**
 * Assigns many leads at once.
 *   toUserId          → all to one person
 *   userIds (array)   → spread across them, always to whoever has the fewest open leads
 */
async function bulkAssign(leadIds, { toUserId = null, userIds = [], by, reason = null, req = null, method = 'BULK' }) {
  const ids = [...new Set((leadIds || []).filter(Boolean))].slice(0, 1000);
  if (!ids.length) throw httpError(400, 'Select at least one lead.');
  const results = { assigned: 0, unchanged: 0, failed: [], perAgent: {} };
  let pool_ = [];
  if (!toUserId) {
    pool_ = await loadByAgent(userIds);
    if (!pool_.length) throw httpError(400, 'Choose at least one available team member.');
  }
  for (const leadId of ids) {
    try {
      let target = toUserId;
      if (!target) {
        pool_.sort((a, b) => Number(a.open_leads) - Number(b.open_leads));
        target = pool_[0].id;
      }
      const r = await assignLead(leadId, target, { by, method, reason, req });
      if (r.changed) {
        results.assigned++;
        const name = fullName(r.agent.first_name, r.agent.last_name);
        results.perAgent[name] = (results.perAgent[name] || 0) + 1;
        const slot = pool_.find((p) => p.id === target);
        if (slot) slot.open_leads = Number(slot.open_leads) + 1;
      } else {
        results.unchanged++;
      }
    } catch (err) {
      results.failed.push({ leadId, error: err.message });
    }
  }
  return results;
}

/** Ownership history for a lead (newest first). */
async function assignmentHistory(leadId) {
  const [rows] = await pool.query(
    `SELECT a.*, f.first_name AS from_first, f.last_name AS from_last, t.first_name AS to_first, t.last_name AS to_last,
            b.first_name AS by_first, b.last_name AS by_last
       FROM lead_assignments a
       LEFT JOIN users f ON f.id = a.from_user_id
       LEFT JOIN users t ON t.id = a.to_user_id
       LEFT JOIN users b ON b.id = a.assigned_by
      WHERE a.lead_id = ? ORDER BY a.created_at DESC`,
    [leadId]
  );
  return rows.map((r) => ({
    id: r.id, method: r.method, reason: r.reason, created_at: r.created_at,
    from: fullName(r.from_first, r.from_last) || null,
    to: fullName(r.to_first, r.to_last) || null,
    by: fullName(r.by_first, r.by_last) || 'System'
  }));
}

/** Leads with the same phone (last 10 digits) or email, excluding `excludeId`. */
async function findDuplicates({ phone = null, email = null, excludeId = null } = {}) {
  const key = phoneKey(phone);
  const conds = [];
  const params = [];
  if (key.length >= 10) { conds.push("RIGHT(REGEXP_REPLACE(l.phone, '[^0-9]', ''), 10) = ?"); params.push(key); }
  if (email && /@/.test(email)) { conds.push('LOWER(l.email) = ?'); params.push(String(email).trim().toLowerCase()); }
  if (!conds.length) return [];
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.phone, l.email, l.stage, l.source, l.created_at,
            l.assigned_agent_id, ag.first_name AS agent_first, ag.last_name AS agent_last, cp.firm_name AS partner_firm
       FROM leads l
       LEFT JOIN users ag ON ag.id = l.assigned_agent_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE (${conds.join(' OR ')}) ${excludeId ? 'AND l.id <> ?' : ''}
      ORDER BY l.created_at ASC LIMIT 20`,
    excludeId ? [...params, excludeId] : params
  );
  return rows.map((r) => ({ ...r, agent_name: fullName(r.agent_first, r.agent_last) || null }));
}

/**
 * Suggested priority. Hot, high-budget, ready-to-buy and partner/referral leads come first;
 * new leads nobody has called yet are bumped so they're not left waiting.
 */
function scorePriority(lead) {
  let score = 0;
  if (lead.temperature === 'HOT') score += 40;
  else if (lead.temperature === 'WARM') score += 20;
  const budget = Number(lead.budget_max || lead.budget_min || 0);
  if (budget >= 20000000) score += 20;
  else if (budget >= 8000000) score += 12;
  else if (budget > 0) score += 5;
  if (lead.purchase_timeline === 'IMMEDIATE') score += 25;
  else if (lead.purchase_timeline === '3_MONTHS') score += 15;
  else if (lead.purchase_timeline === '6_MONTHS') score += 5;
  if (['REFERRAL', 'CHANNEL_PARTNER', 'WALK_IN', 'WALK IN'].includes(String(lead.source || '').toUpperCase())) score += 10;
  if (!lead.first_contacted_at && lead.created_at && Date.now() - new Date(lead.created_at).getTime() < 24 * 3600000) score += 10;
  if (lead.qualification_status === 'QUALIFIED') score += 10;
  if (lead.qualification_status === 'NOT_QUALIFIED') score -= 30;
  if (score >= 60) return 'URGENT';
  if (score >= 35) return 'HIGH';
  if (score >= 15) return 'MEDIUM';
  return 'LOW';
}

/** Marks the first real contact with a lead (calls, WhatsApp, visits) — used for "untouched" reports. */
async function markContacted(leadId, conn = pool) {
  await conn.query(
    'UPDATE leads SET first_contacted_at = COALESCE(first_contacted_at, NOW()), last_contacted_at = NOW() WHERE id = ?',
    [leadId]
  );
}

module.exports = { assignLead, bulkAssign, assignmentHistory, findDuplicates, scorePriority, markContacted, loadAssignee, loadByAgent, ASSIGNABLE_ROLES };
