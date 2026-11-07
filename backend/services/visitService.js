/**
 * Site visit lifecycle — shared by the agent workspace, the partner desk and the manager portals.
 *
 *   REQUESTED ──(approval on)──> PENDING_APPROVAL ──approve──> REQUESTED / ASSIGNED
 *   REQUESTED ──assign──> ASSIGNED ──accept──> ACCEPTED ──confirm with client──> SCHEDULED
 *                              └──reject──> REQUESTED (back to the manager to re-allocate)
 *   SCHEDULED ──check in──> IN_PROGRESS ──complete──> COMPLETED
 *   any open ──reschedule──> RESCHEDULED ──accept──> ACCEPTED/SCHEDULED
 *   any open ──cancel──> CANCELLED      scheduled/in progress ──missed──> MISSED
 *
 * A visit fixed by a telecaller or partner with the client on the phone is "client confirmed", so
 * the field agent's acceptance moves it straight to SCHEDULED. A field agent who fixes their own
 * visit doesn't need to accept it.
 *
 * Every change writes site_visit_history, the lead timeline, the audit trail, and notifies the
 * people working this client (field agent, lead owner, partner firm, managers).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const audit = require('./audit');
const settings = require('./settingsService');
const {
  STAGE_BUCKETS, AGENT_ROLES, MANAGER_ROLES, sqlList, bucketSql, pickVisitAgent, tomorrowAt, hoursFromNow,
  whenText, logActivity, notifyManagers, notifyPartner, notifyUser, fullName
} = require('./salesWorkspace');

const VISIT_UPCOMING = ['ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'];
const VISIT_OPEN = ['REQUESTED', 'PENDING_APPROVAL', ...VISIT_UPCOMING];
const VISIT_CLOSED = ['COMPLETED', 'CANCELLED', 'MISSED', 'NO_SHOW'];
const VISIT_UPCOMING_SQL = sqlList(VISIT_UPCOMING);
const VISIT_OPEN_SQL = sqlList(VISIT_OPEN);

const STATUS_LABEL = {
  REQUESTED: 'requested', PENDING_APPROVAL: 'waiting for approval', ASSIGNED: 'assigned', ACCEPTED: 'accepted',
  SCHEDULED: 'scheduled', IN_PROGRESS: 'in progress', COMPLETED: 'completed', CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled', MISSED: 'missed', NO_SHOW: 'missed'
};

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });

/** Shape any signed-in user the way the workspace does (kind: manager | agent | partner). */
function visitActor(user) {
  const role = user.role;
  const kind = role === 'CHANNEL_PARTNER' ? 'partner' : AGENT_ROLES.includes(role) ? 'agent' : 'manager';
  return {
    id: user.id,
    role,
    kind,
    name: user.name || user.username,
    partnerId: user.partnerId || user.channelPartnerId || null,
    firm: user.firm || null
  };
}

async function assertAgentFree(agentId, when, ignoreVisitId = null, conn = pool) {
  const [clash] = await conn.query(
    `SELECT sv.scheduled_time, p.name AS project_name FROM site_visits sv JOIN projects p ON p.id = sv.project_id
      WHERE sv.assigned_agent_id = ? AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.id <> ?
        AND sv.scheduled_time BETWEEN ? - INTERVAL 59 MINUTE AND ? + INTERVAL 59 MINUTE
      LIMIT 1`,
    [agentId, ignoreVisitId || '', when, when]
  );
  if (clash[0]) {
    const t = new Date(clash[0].scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    throw httpError(409, `The agent already has a visit at ${t} (${clash[0].project_name}). Please pick a time at least an hour apart.`);
  }
}

async function loadVisit(visitId) {
  const [[visit]] = await pool.query(
    `SELECT sv.*, p.name AS project_name, p.latitude AS project_lat, p.longitude AS project_lng,
            l.first_name, l.last_name, l.phone AS client_phone, l.assigned_agent_id AS lead_owner_id,
            l.channel_partner_id, l.stage AS lead_stage, ${bucketSql('l.stage')} AS lead_bucket,
            ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
       FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id
       LEFT JOIN leads l ON l.id = sv.lead_id
       LEFT JOIN users ag ON ag.id = sv.assigned_agent_id
      WHERE sv.id = ?`,
    [visitId]
  );
  if (!visit) throw httpError(404, 'Visit not found.');
  visit.client_name = fullName(visit.first_name, visit.last_name);
  visit.agent_name = fullName(visit.agent_first_name, visit.agent_last_name) || null;
  return visit;
}

/** Can this person see / act on the visit at all? */
function assertVisitAccess(actor, visit) {
  if (actor.kind === 'manager') return;
  if (actor.kind === 'partner') {
    if (actor.partnerId && visit.channel_partner_id === actor.partnerId) return;
  } else if (visit.assigned_agent_id === actor.id || visit.lead_owner_id === actor.id) {
    return;
  }
  throw httpError(404, 'Visit not found.');
}

async function writeHistory(visitId, action, actorId, from, to, notes) {
  await pool.query(
    `INSERT INTO site_visit_history (id, site_visit_id, action, performed_by, previous_status, new_status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), visitId, action.toUpperCase().slice(0, 50), actorId, from, to, notes ? String(notes).slice(0, 1000) : null]
  );
}

/** Notifies everyone working this client, except the person who acted. */
async function tellStakeholders(visit, actor, { title, message, type = 'INFO', category = 'VISIT_UPDATE', managers = false, partner = true, agentCategory = null }) {
  const leadId = visit.lead_id;
  await notifyUser(visit.assigned_agent_id, { type, title, message, leadId, category: agentCategory || category }, actor.id);
  if (visit.lead_owner_id && visit.lead_owner_id !== visit.assigned_agent_id) {
    await notifyUser(visit.lead_owner_id, { type, title, message, leadId, category }, actor.id);
  }
  if (partner && actor.kind !== 'partner') await notifyPartner(visit.channel_partner_id, { type, title, message, leadId, category });
  if (managers) await notifyManagers({ type, title, message, leadId, category }, actor.id);
}

async function setLead(leadId, sets) {
  const keys = Object.keys(sets).filter((k) => sets[k] !== undefined);
  if (!keys.length || !leadId) return;
  await pool.query(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), leadId]);
}

/**
 * Creates a visit for a lead.
 * @param {object} actor    visitActor()
 * @param {object} lead     the lead row (already scope-checked by the caller)
 * @param {object} opts     { projectId, when, agentId?, clientConfirmed?, note? }
 */
async function createVisit(actor, lead, { projectId, when, agentId = null, clientConfirmed = true, note = null, req = null }) {
  const [[project]] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [projectId]);
  if (!project) throw httpError(400, 'Selected project does not exist.');
  if (!when || Number.isNaN(when.getTime())) throw httpError(400, 'Pick a date and time for the visit.');
  if (when.getTime() < Date.now() - 5 * 60000) throw httpError(400, 'Visit time is in the past.');

  const needsApproval = actor.kind !== 'manager' && String(await settings.getSetting('visit_approval_required')) === '1';

  // Who conducts it
  let agent = null;
  if (actor.kind === 'manager' && agentId) {
    [[agent]] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN (${sqlList([...AGENT_ROLES, ...MANAGER_ROLES])})`,
      [agentId]
    );
    if (!agent) throw httpError(400, 'Choose an active team member.');
  } else if (actor.role === 'OUTSIDE_SALES') {
    agent = { id: actor.id, first_name: actor.name, last_name: null };
  } else if (!needsApproval) {
    agent = await pickVisitAgent(when, lead.assigned_agent_id || (actor.kind === 'partner' ? null : actor.id));
  }
  if (agent) await assertAgentFree(agent.id, when);

  let status;
  if (needsApproval) status = 'PENDING_APPROVAL';
  else if (!agent) status = 'REQUESTED';
  else if (agent.id === actor.id) status = clientConfirmed ? 'SCHEDULED' : 'ACCEPTED'; // their own visit
  else status = 'ASSIGNED';

  const visitId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO site_visits (id, lead_id, project_id, assigned_agent_id, scheduled_time, status, requested_by, client_confirmed, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [visitId, lead.id, project.id, agent ? agent.id : null, when, status, actor.id, clientConfirmed ? 1 : 0,
      ['SCHEDULED', 'ACCEPTED'].includes(status) ? new Date() : null]
  );
  await writeHistory(visitId, 'CREATED', actor.id, null, status, note);

  if (!lead.assigned_agent_id && actor.kind !== 'partner') {
    const ownerId = actor.kind === 'agent' ? actor.id : (agent ? agent.id : null);
    if (ownerId) await setLead(lead.id, { assigned_agent_id: ownerId });
    lead.assigned_agent_id = ownerId;
  }
  await setLead(lead.id, { stage: STAGE_BUCKETS.VISIT.stage, next_follow_up_at: null });
  await pool.query('UPDATE leads SET preferred_project_id = COALESCE(preferred_project_id, ?) WHERE id = ?', [project.id, lead.id]);

  const slot = whenText(when);
  const clientName = fullName(lead.first_name, lead.last_name);
  const agentName = agent ? fullName(agent.first_name, agent.last_name) : null;
  const by = actor.kind === 'partner' && actor.firm ? actor.firm.name : actor.name;
  await logActivity({
    leadId: lead.id, userId: actor.id, type: 'VISIT', outcome: status,
    note: `Visit to ${project.name} on ${slot} ${STATUS_LABEL[status]}${agentName && agent.id !== actor.id ? ` — ${agentName} to conduct` : ''}${note ? ` — ${note}` : ''}`
  });

  if (status === 'ASSIGNED') {
    await notifyUser(agent.id, { type: 'REMINDER', title: `📍 New site visit: ${clientName}`, message: `${project.name}, ${slot} — fixed by ${by}. Please accept or reject.`, leadId: lead.id, category: 'VISIT_ASSIGNED' }, actor.id);
  }
  if (lead.assigned_agent_id && (!agent || lead.assigned_agent_id !== agent.id)) {
    await notifyUser(lead.assigned_agent_id, { type: 'REMINDER', title: `Visit ${STATUS_LABEL[status]}: ${clientName}`, message: `${project.name}, ${slot}${agentName ? ` with ${agentName}` : ''}.`, leadId: lead.id, category: 'VISIT_UPDATE' }, actor.id);
  }
  if (actor.kind !== 'partner') {
    await notifyPartner(lead.channel_partner_id, { type: 'REMINDER', title: `Visit fixed for ${clientName}`, message: `${project.name}, ${slot}.`, leadId: lead.id, category: 'VISIT_UPDATE' });
  }
  if (status === 'PENDING_APPROVAL') {
    await require('./approvalService').createApproval({
      type: 'VISIT', entityType: 'SITE_VISIT', entityId: visitId,
      title: `Site visit for ${clientName}`, details: `${project.name}, ${slot} — requested by ${by}.`,
      requestedBy: actor.id, approverRoles: ['ADMIN', 'SUPER_ADMIN']
    });
  } else if (status === 'REQUESTED') {
    await notifyManagers({ type: 'WARNING', title: `Visit needs a field agent: ${clientName}`, message: `${project.name}, ${slot}. No field agent is free — please allocate one.`, leadId: lead.id, category: 'VISIT_ASSIGNED' }, actor.id);
  } else {
    await notifyManagers({ type: 'INFO', title: `Visit fixed: ${clientName}`, message: `${project.name}, ${slot}${agentName ? ` — ${agentName}` : ''} (by ${by}).`, leadId: lead.id, category: 'VISIT_UPDATE' }, actor.id);
  }

  await audit.record({
    req, actor: req ? undefined : { id: actor.id, name: actor.name, role: actor.role },
    action: 'VISIT_CREATED', entityType: 'SITE_VISIT', entityId: visitId,
    summary: `Visit for ${clientName} at ${project.name} on ${slot} (${STATUS_LABEL[status]})`,
    after: { lead_id: lead.id, project_id: project.id, assigned_agent_id: agent ? agent.id : null, scheduled_time: when, status }
  });

  return { id: visitId, status, agentName, slot, message: status === 'PENDING_APPROVAL'
    ? `Visit request sent for approval (${slot}).`
    : status === 'REQUESTED' ? `Visit requested for ${slot}. The sales manager will allocate a field agent.`
      : `Visit ${STATUS_LABEL[status]} for ${slot}${agentName && agent.id !== actor.id ? ` with ${agent.first_name}` : ''}.` };
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Applies an action to a visit.
 * actions: approve, assign, accept, reject, confirm, check_in, complete, missed (alias no_show), cancel, reschedule
 */
async function transition(actor, visitId, action, body = {}, req = null) {
  if (action === 'no_show') action = 'missed';
  const visit = await loadVisit(visitId);
  assertVisitAccess(actor, visit);
  const from = visit.status;
  const isFieldAgent = visit.assigned_agent_id === actor.id;
  const isLeadOwner = visit.lead_owner_id === actor.id;
  const isManager = actor.kind === 'manager';
  const deny = (msg = 'You cannot do that on this visit.') => { throw httpError(403, msg); };
  const needFrom = (...allowed) => {
    if (!allowed.includes(from)) throw httpError(400, `This visit is ${STATUS_LABEL[from] || from.toLowerCase()} — it can't be ${action.replace('_', ' ')}ed now.`);
  };

  if (actor.kind === 'partner' && !['reschedule', 'cancel'].includes(action)) deny('Partners can reschedule or cancel a visit.');

  let to = from;
  const sets = {};
  let summary;
  let note = body.feedback || body.reason || body.note || null;
  let notifyOpts = {};
  let leadSets = {};

  switch (action) {
    case 'approve': {
      if (!isManager) deny('Only managers can approve visits.');
      needFrom('PENDING_APPROVAL');
      const agent = await pickVisitAgent(new Date(visit.scheduled_time), visit.lead_owner_id);
      to = agent ? 'ASSIGNED' : 'REQUESTED';
      sets.approved_by = actor.id;
      if (agent) sets.assigned_agent_id = agent.id;
      summary = `Visit approved${agent ? ` and assigned to ${fullName(agent.first_name, agent.last_name)}` : ''}`;
      notifyOpts = { title: `Visit approved: ${visit.client_name}`, message: `${visit.project_name}, ${whenText(visit.scheduled_time)}.`, type: 'SUCCESS', agentCategory: 'VISIT_ASSIGNED' };
      visit.assigned_agent_id = sets.assigned_agent_id || visit.assigned_agent_id;
      break;
    }
    case 'assign': {
      if (!isManager) deny('Only managers can allocate visits.');
      needFrom('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'RESCHEDULED');
      if (!body.agent_id) throw httpError(400, 'Choose the field agent.');
      const [[agent]] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name FROM users u JOIN roles r ON r.id = u.role_id
          WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN (${sqlList([...AGENT_ROLES, ...MANAGER_ROLES])})`,
        [body.agent_id]
      );
      if (!agent) throw httpError(400, 'Choose an active team member.');
      await assertAgentFree(agent.id, new Date(visit.scheduled_time), visit.id);
      const previousAgent = visit.assigned_agent_id;
      to = agent.id === actor.id ? (visit.client_confirmed ? 'SCHEDULED' : 'ACCEPTED') : 'ASSIGNED';
      sets.assigned_agent_id = agent.id;
      sets.accepted_at = null;
      sets.rejection_reason = null;
      summary = `Visit allocated to ${fullName(agent.first_name, agent.last_name)}`;
      if (previousAgent && previousAgent !== agent.id) {
        await notifyUser(previousAgent, { type: 'INFO', title: `Visit moved: ${visit.client_name}`, message: `${visit.project_name}, ${whenText(visit.scheduled_time)} is now with ${agent.first_name}.`, leadId: visit.lead_id, category: 'VISIT_UPDATE' }, actor.id);
      }
      visit.assigned_agent_id = agent.id;
      notifyOpts = { title: `📍 Site visit assigned: ${visit.client_name}`, message: `${visit.project_name}, ${whenText(visit.scheduled_time)}. Please accept or reject.`, type: 'REMINDER', agentCategory: 'VISIT_ASSIGNED' };
      break;
    }
    case 'accept': {
      if (!isFieldAgent && !isManager) deny('Only the assigned field agent can accept this visit.');
      needFrom('ASSIGNED', 'RESCHEDULED');
      to = visit.client_confirmed ? 'SCHEDULED' : 'ACCEPTED';
      sets.accepted_at = new Date();
      summary = `Visit accepted by ${actor.name}${to === 'SCHEDULED' ? ' — confirmed with the client' : ''}`;
      notifyOpts = { title: `✓ Visit accepted: ${visit.client_name}`, message: `${actor.name} will take the visit at ${visit.project_name}, ${whenText(visit.scheduled_time)}.`, type: 'SUCCESS', category: 'VISIT_ACCEPTED', managers: true, partner: to === 'SCHEDULED' };
      break;
    }
    case 'reject': {
      if (!isFieldAgent) deny('Only the assigned field agent can reject this visit.');
      needFrom('ASSIGNED', 'RESCHEDULED');
      if (!body.reason || String(body.reason).trim().length < 3) throw httpError(400, 'Tell the manager why you can’t take this visit.');
      to = 'REQUESTED';
      sets.assigned_agent_id = null;
      sets.rejection_reason = String(body.reason).slice(0, 255);
      note = body.reason;
      summary = `${actor.name} can't take the visit: ${body.reason}`;
      notifyOpts = { title: `✗ Visit rejected: ${visit.client_name}`, message: `${actor.name}: ${body.reason}. Please allocate another field agent.`, type: 'WARNING', category: 'VISIT_ACCEPTED', managers: true, partner: false };
      break;
    }
    case 'confirm': {
      if (!isManager && !isLeadOwner && !isFieldAgent) deny();
      needFrom('ACCEPTED');
      to = 'SCHEDULED';
      sets.client_confirmed = 1;
      summary = 'Visit confirmed with the client';
      notifyOpts = { title: `Visit confirmed: ${visit.client_name}`, message: `${visit.project_name}, ${whenText(visit.scheduled_time)}.`, type: 'SUCCESS' };
      break;
    }
    case 'check_in': {
      if (!isFieldAgent && !isManager) deny('Only the field agent conducting the visit can check in.');
      needFrom('SCHEDULED', 'ACCEPTED', 'RESCHEDULED');
      to = 'IN_PROGRESS';
      sets.check_in_at = new Date();
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        sets.check_in_lat = lat;
        sets.check_in_lng = lng;
        if (visit.project_lat != null && visit.project_lng != null) {
          sets.check_in_distance_m = distanceMeters(lat, lng, Number(visit.project_lat), Number(visit.project_lng));
        }
      }
      summary = `Checked in at ${visit.project_name}${sets.check_in_distance_m != null ? ` (${sets.check_in_distance_m < 1000 ? `${sets.check_in_distance_m} m` : `${(sets.check_in_distance_m / 1000).toFixed(1)} km`} from the project)` : sets.check_in_lat != null ? ' (location recorded)' : ' (location not shared)'}`;
      notifyOpts = { title: `Visit started: ${visit.client_name}`, message: summary, managers: true, partner: false };
      break;
    }
    case 'complete': {
      if (!isFieldAgent && !isLeadOwner && !isManager) deny();
      needFrom('SCHEDULED', 'ACCEPTED', 'IN_PROGRESS', 'RESCHEDULED');
      to = 'COMPLETED';
      sets.completed_at = new Date();
      sets.client_feedback = body.feedback || null;
      sets.rating = { HOT: 5, WARM: 3, COLD: 1 }[body.temperature] || (Number(body.rating) >= 1 && Number(body.rating) <= 5 ? Number(body.rating) : null);
      leadSets = {
        stage: ['BOOKED', 'LOST', 'NEGOTIATION'].includes(visit.lead_bucket) ? undefined : STAGE_BUCKETS.VISITED.stage,
        next_follow_up_at: body.next_follow_up_at ? new Date(body.next_follow_up_at) : tomorrowAt(11),
        temperature: ['HOT', 'WARM', 'COLD'].includes(body.temperature) ? body.temperature : undefined
      };
      summary = `Visit done at ${visit.project_name}${body.temperature ? ` — client is ${String(body.temperature).toLowerCase()}` : ''}${body.feedback ? `: ${body.feedback}` : ''}`;
      notifyOpts = { title: `${visit.client_name}: site visit done`, message: summary, type: 'SUCCESS', category: 'VISIT_COMPLETED', managers: true };
      break;
    }
    case 'missed': {
      if (!isFieldAgent && !isLeadOwner && !isManager) deny();
      needFrom('SCHEDULED', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'RESCHEDULED');
      to = 'MISSED';
      if (body.feedback) sets.client_feedback = body.feedback;
      leadSets = { stage: ['BOOKED', 'LOST', 'NEGOTIATION'].includes(visit.lead_bucket) ? undefined : STAGE_BUCKETS.CONTACTED.stage, next_follow_up_at: hoursFromNow(1) };
      summary = `Client did not come for the visit (${visit.project_name})${body.feedback ? ` — ${body.feedback}` : ''}`;
      notifyOpts = { title: `${visit.client_name}: did not show up`, message: summary, type: 'WARNING', managers: true };
      break;
    }
    case 'cancel': {
      if (actor.kind === 'agent' && !isFieldAgent && !isLeadOwner) deny();
      needFrom(...VISIT_OPEN);
      to = 'CANCELLED';
      if (body.feedback || body.reason) sets.client_feedback = body.feedback || body.reason;
      leadSets = { stage: ['BOOKED', 'LOST', 'NEGOTIATION'].includes(visit.lead_bucket) ? undefined : STAGE_BUCKETS.CONTACTED.stage, next_follow_up_at: hoursFromNow(2) };
      summary = `Visit cancelled (${visit.project_name})${note ? ` — ${note}` : ''}`;
      notifyOpts = { title: `${visit.client_name}: visit cancelled`, message: summary, type: 'WARNING', managers: true };
      break;
    }
    case 'reschedule': {
      needFrom(...VISIT_OPEN.filter((s) => s !== 'IN_PROGRESS'));
      const when = body.scheduled_time ? new Date(body.scheduled_time) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now()) throw httpError(400, 'Pick a new date and time in the future.');
      if (visit.assigned_agent_id) await assertAgentFree(visit.assigned_agent_id, when, visit.id);
      sets.scheduled_time = when;
      sets.reschedule_count = (visit.reschedule_count || 0) + 1;
      sets.client_confirmed = actor.kind === 'partner' || isLeadOwner || body.client_confirmed ? 1 : visit.client_confirmed;
      // The field agent moving their own visit keeps it on their calendar; anyone else asks them to re-accept
      if (['REQUESTED', 'PENDING_APPROVAL'].includes(from)) to = from;
      else if (isFieldAgent) to = sets.client_confirmed ? 'SCHEDULED' : 'ACCEPTED';
      else to = 'RESCHEDULED';
      summary = `Visit moved to ${whenText(when)}`;
      notifyOpts = { title: `${visit.client_name}: visit rescheduled`, message: `${visit.project_name}, now ${whenText(when)}${to === 'RESCHEDULED' ? ' — field agent, please accept the new time' : ''}.`, type: 'WARNING', agentCategory: to === 'RESCHEDULED' ? 'VISIT_ASSIGNED' : 'VISIT_UPDATE' };
      break;
    }
    default:
      throw httpError(400, 'Unknown visit action.');
  }

  sets.status = to;
  const keys = Object.keys(sets);
  const [result] = await pool.query(
    `UPDATE site_visits SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND status = ?`,
    [...keys.map((k) => sets[k]), visit.id, from]
  );
  if (!result.affectedRows) throw httpError(409, 'Someone else just updated this visit. Refresh and try again.');

  await writeHistory(visit.id, action, actor.id, from, to, note);
  await setLead(visit.lead_id, leadSets);
  if (visit.lead_id) await logActivity({ leadId: visit.lead_id, userId: actor.id, type: 'VISIT', outcome: action.toUpperCase(), note: summary });
  if (notifyOpts.title) await tellStakeholders(visit, actor, notifyOpts);

  await audit.record({
    req, actor: req ? undefined : { id: actor.id, name: actor.name, role: actor.role },
    action: `VISIT_${action.toUpperCase()}`, entityType: 'SITE_VISIT', entityId: visit.id,
    summary: `${visit.client_name}: ${summary}`,
    before: { status: from, scheduled_time: visit.scheduled_time, assigned_agent_id: visit.assigned_agent_id },
    after: { status: to, ...sets }
  });

  // A pending visit approval is settled by the approval centre; keep the two in step
  if (action === 'approve' || (from === 'PENDING_APPROVAL' && to === 'CANCELLED')) {
    await pool.query(
      `UPDATE approval_requests SET status = ?, decided_by = ?, decided_at = NOW()
        WHERE entity_type = 'SITE_VISIT' AND entity_id = ? AND status = 'PENDING'`,
      [action === 'approve' ? 'APPROVED' : 'CANCELLED', actor.id, visit.id]
    );
  }

  return { id: visit.id, from, to, message: summary };
}

/** Visit history for the record timeline. */
async function history(visitId) {
  const [rows] = await pool.query(
    `SELECT h.*, u.first_name, u.last_name FROM site_visit_history h LEFT JOIN users u ON u.id = h.performed_by
      WHERE h.site_visit_id = ? ORDER BY h.created_at ASC`,
    [visitId]
  );
  return rows.map((r) => ({ ...r, by: fullName(r.first_name, r.last_name) || 'System' }));
}

module.exports = {
  VISIT_UPCOMING,
  VISIT_OPEN,
  VISIT_CLOSED,
  VISIT_UPCOMING_SQL,
  VISIT_OPEN_SQL,
  STATUS_LABEL,
  visitActor,
  assertAgentFree,
  loadVisit,
  assertVisitAccess,
  createVisit,
  transition,
  history
};
