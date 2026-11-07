/**
 * Background workflow checks, every few minutes (only one app copy runs them at a time):
 *
 *   follow-up due soon          → reminder to the lead owner (FOLLOWUP_DUE)
 *   follow-up overdue N hours   → escalation to sales managers (FOLLOWUP_OVERDUE)
 *   new lead untouched N mins   → alert to sales managers (LEAD_NEW)
 *   visit not accepted in 2 h   → reminder to the field agent, then the manager
 *   visit time passed, no check-in → field agent + manager asked to update it
 *   booking reservation lapsed  → escalation to the sales head
 *   payment milestone overdue   → finance + relationship manager (once, when it slips)
 *
 * Each alert is recorded in workflow_job_marks so it's sent once. Nothing here changes a lead,
 * visit or booking by itself — it only tells the right people.
 */
const pool = require('../config/db');
const settings = require('./settingsService');
const escalations = require('./escalationService');
const finance = require('./financeService');
const { notifyUsers, usersWithRoles } = require('./notificationService');
const { OPEN_STAGE_SQL, fullName } = require('./salesWorkspace');

const LOCK = 'nexora_workflow_jobs';

/** True the first time a key is seen (the alert should go out), false afterwards. */
async function firstTime(key) {
  const [r] = await pool.query('INSERT IGNORE INTO workflow_job_marks (mark_key) VALUES (?)', [String(key).slice(0, 191)]);
  return r.affectedRows === 1;
}

const today = () => new Date().toISOString().slice(0, 10);

async function followUpsDueSoon() {
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.phone, l.assigned_agent_id, l.next_follow_up_at
       FROM leads l
      WHERE l.assigned_agent_id IS NOT NULL AND ${OPEN_STAGE_SQL('l.stage')}
        AND l.next_follow_up_at BETWEEN NOW() AND NOW() + INTERVAL 15 MINUTE`
  );
  for (const l of rows) {
    if (!(await firstTime(`due:${l.id}:${new Date(l.next_follow_up_at).toISOString()}`))) continue;
    await notifyUsers([l.assigned_agent_id], {
      type: 'REMINDER', title: `📞 Follow-up due: ${fullName(l.first_name, l.last_name)}`,
      message: `At ${new Date(l.next_follow_up_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Call ${l.phone}.`,
      relatedEntityType: 'LEAD', relatedEntityId: l.id, category: 'FOLLOWUP_DUE'
    });
  }
  return rows.length;
}

async function overdueFollowUps(hours) {
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.next_follow_up_at, l.assigned_agent_id, ag.first_name AS ag_first, ag.last_name AS ag_last
       FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id
      WHERE ${OPEN_STAGE_SQL('l.stage')} AND l.next_follow_up_at < NOW() - INTERVAL ? HOUR
      ORDER BY l.next_follow_up_at ASC LIMIT 200`,
    [hours]
  );
  let raised = 0;
  for (const l of rows) {
    const id = await escalations.raise({
      entityType: 'LEAD', entityId: l.id, leadId: l.id, source: 'SYSTEM', toRole: 'ADMIN', severity: 'MEDIUM',
      title: `Follow-up overdue: ${fullName(l.first_name, l.last_name)}`,
      reason: `Due ${new Date(l.next_follow_up_at).toLocaleString('en-IN')} — ${fullName(l.ag_first, l.ag_last) || 'unassigned'} hasn't followed up.`,
      dedupeKey: `followup:${l.id}:${today()}`
    });
    if (id) {
      raised++;
      await notifyUsers([l.assigned_agent_id], {
        type: 'WARNING', title: `Overdue follow-up: ${fullName(l.first_name, l.last_name)}`, message: 'Your manager has been alerted. Please call today.',
        relatedEntityType: 'LEAD', relatedEntityId: l.id, category: 'FOLLOWUP_OVERDUE'
      });
    }
  }
  return raised;
}

async function untouchedLeads(minutes) {
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.source, l.created_at, l.assigned_agent_id, ag.first_name AS ag_first, ag.last_name AS ag_last
       FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id
      WHERE l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL AND ${OPEN_STAGE_SQL('l.stage')}
        AND l.created_at < NOW() - INTERVAL ? MINUTE AND l.created_at > NOW() - INTERVAL 3 DAY
      LIMIT 200`,
    [minutes]
  );
  const managers = await usersWithRoles(['ADMIN', 'SUPER_ADMIN']);
  let sent = 0;
  for (const l of rows) {
    if (!(await firstTime(`untouched:${l.id}`))) continue;
    sent++;
    await notifyUsers(managers, {
      type: 'WARNING', title: `Untouched lead: ${fullName(l.first_name, l.last_name)}`,
      message: `${l.source || 'New'} enquiry from ${new Date(l.created_at).toLocaleString('en-IN')} — ${l.assigned_agent_id ? `${fullName(l.ag_first, l.ag_last)} hasn't called yet` : 'not assigned to anyone'}.`,
      relatedEntityType: 'LEAD', relatedEntityId: l.id, category: 'LEAD_NEW'
    });
  }
  return sent;
}

async function visitChecks() {
  // Not accepted within 2 hours of being assigned
  const [pending] = await pool.query(
    `SELECT sv.id, sv.lead_id, sv.assigned_agent_id, sv.scheduled_time, p.name AS project_name, l.first_name, l.last_name
       FROM site_visits sv JOIN projects p ON p.id = sv.project_id LEFT JOIN leads l ON l.id = sv.lead_id
      WHERE sv.status IN ('ASSIGNED', 'RESCHEDULED') AND sv.updated_at < NOW() - INTERVAL 2 HOUR AND sv.scheduled_time > NOW()`
  );
  for (const v of pending) {
    if (!(await firstTime(`visit-accept:${v.id}:${v.scheduled_time.toISOString ? v.scheduled_time.toISOString() : v.scheduled_time}`))) continue;
    await notifyUsers([v.assigned_agent_id, ...(await usersWithRoles(['ADMIN']))], {
      type: 'WARNING', title: `Visit not accepted yet: ${fullName(v.first_name, v.last_name)}`,
      message: `${v.project_name}, ${new Date(v.scheduled_time).toLocaleString('en-IN')} — the field agent hasn't accepted it.`,
      relatedEntityType: 'LEAD', relatedEntityId: v.lead_id, category: 'VISIT_ASSIGNED'
    });
  }
  // Visit time passed by 2 hours with no check-in and no outcome
  const [stale] = await pool.query(
    `SELECT sv.id, sv.lead_id, sv.assigned_agent_id, sv.scheduled_time, p.name AS project_name, l.first_name, l.last_name, l.assigned_agent_id AS owner_id
       FROM site_visits sv JOIN projects p ON p.id = sv.project_id LEFT JOIN leads l ON l.id = sv.lead_id
      WHERE sv.status IN ('ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'RESCHEDULED') AND sv.scheduled_time < NOW() - INTERVAL 2 HOUR
        AND sv.scheduled_time > NOW() - INTERVAL 7 DAY`
  );
  for (const v of stale) {
    await escalations.raise({
      entityType: 'SITE_VISIT', entityId: v.id, leadId: v.lead_id, source: 'SYSTEM', toRole: 'ADMIN', severity: 'MEDIUM',
      title: `Visit not updated: ${fullName(v.first_name, v.last_name)}`,
      reason: `${v.project_name} was due ${new Date(v.scheduled_time).toLocaleString('en-IN')}. Mark it completed, missed or rescheduled.`,
      dedupeKey: `visit-stale:${v.id}`,
      assignedTo: null
    });
  }
  return pending.length + stale.length;
}

async function lapsedReservations() {
  const [rows] = await pool.query(
    `SELECT d.id, d.deal_number, u.unit_number, u.hold_expires_at, l.first_name, l.last_name, d.lead_id
       FROM deals d JOIN units u ON u.id = d.unit_id AND u.hold_deal_id = d.id LEFT JOIN leads l ON l.id = d.lead_id
      WHERE d.status = 'PENDING_APPROVAL' AND u.hold_expires_at < NOW()`
  );
  for (const d of rows) {
    await escalations.raise({
      entityType: 'DEAL', entityId: d.id, leadId: d.lead_id, source: 'SYSTEM', toRole: 'SUPER_ADMIN', severity: 'HIGH',
      title: `Reservation lapsed: ${d.deal_number} (unit ${d.unit_number})`,
      reason: `${fullName(d.first_name, d.last_name)}'s booking has waited past its reservation window. Approve or reject it so the unit isn't blocked.`,
      dedupeKey: `hold:${d.id}`
    });
  }
  return rows.length;
}

let lastDaily = null;
async function runOnce() {
  const conn = await pool.getConnection();
  try {
    const [[{ got }]] = await conn.query('SELECT GET_LOCK(?, 0) AS got', [LOCK]);
    if (Number(got) !== 1) return { skipped: true };
    try {
      const wf = await settings.getWorkflowSettings();
      const out = {
        dueSoon: await followUpsDueSoon(),
        overdueEscalated: await overdueFollowUps(Number(wf.followup_escalation_hours) || 24),
        untouched: await untouchedLeads(Number(wf.untouched_lead_minutes) || 30),
        visits: await visitChecks(),
        lapsed: await lapsedReservations()
      };
      if (lastDaily !== today()) {
        out.overdueMilestones = await finance.markOverdueMilestones();
        await pool.query('DELETE FROM workflow_job_marks WHERE created_at < NOW() - INTERVAL 45 DAY');
        lastDaily = today();
      }
      return out;
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK]).catch(() => {});
    }
  } finally {
    conn.release();
  }
}

module.exports = { runOnce, firstTime };
