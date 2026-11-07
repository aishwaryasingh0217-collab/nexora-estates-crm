/**
 * Cloud telephony — provider-independent click-to-call, incoming-call identification and call
 * history. The provider (TELEPHONY_PROVIDER, default "exotel") only places calls and translates its
 * webhooks; everything else (who may call whom, call records, lead timeline, notifications,
 * after-call outcomes, analytics) lives here, so another provider can be added without touching it.
 *
 * Nothing here pretends: if the provider isn't configured, calling is unavailable and says so.
 * Call statuses come only from the provider's own responses and callbacks.
 */
const crypto = require('crypto');
const pool = require('../../config/db');
const audit = require('../audit');
const { notifyUsers, usersWithRoles, createNotification } = require('../notificationService');
const { phoneKey, findLeadByPhone, logActivity, fullName, notifyManagers, STAGE_BUCKETS, bucketOf, hoursFromNow, tomorrowAt } = require('../salesWorkspace');

const PROVIDERS = { exotel: require('./exotel') };
const ACTIVE = ['INITIATED', 'RINGING_AGENT', 'AGENT_ANSWERED', 'RINGING_CUSTOMER', 'CONNECTED'];
const FINAL = ['COMPLETED', 'MISSED', 'REJECTED', 'FAILED', 'BUSY'];
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });

function provider() {
  const key = String(process.env.TELEPHONY_PROVIDER || 'exotel').toLowerCase();
  return PROVIDERS[key] || null;
}

function webhookSecret() {
  return process.env.TELEPHONY_WEBHOOK_SECRET || '';
}

function publicBase() {
  return String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
}

/** What the UI may know about calling (no credentials). */
function status() {
  const p = provider();
  const ready = Boolean(p && p.configured() && webhookSecret() && publicBase());
  const missing = [];
  if (!p) missing.push('TELEPHONY_PROVIDER');
  else if (!p.configured()) missing.push(...['EXOTEL_ACCOUNT_SID', 'EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_CALLER_ID'].filter((k) => !process.env[k]));
  if (!webhookSecret()) missing.push('TELEPHONY_WEBHOOK_SECRET');
  if (!publicBase()) missing.push('PUBLIC_BASE_URL');
  const caller = p && p.settings ? p.settings().callerId : '';
  return {
    provider: p ? p.name : null,
    ready,
    missing,
    callerId: caller ? `${caller.slice(0, 3)}••••${caller.slice(-3)}` : null,
    recording: String(process.env.TELEPHONY_RECORD || '').toLowerCase() === 'true'
  };
}

function webhookUrls() {
  const p = provider();
  if (!p || !publicBase() || !webhookSecret()) return null;
  return {
    status: `${publicBase()}/api/telephony/webhooks/${p.name}/status/${webhookSecret()}`,
    incoming: `${publicBase()}/api/telephony/webhooks/${p.name}/incoming/${webhookSecret()}`
  };
}

/** Lead/customer the caller may call: agents only their own clients; managers and care staff more widely. */
async function resolveTarget(user, { leadId, customerId }) {
  if (leadId) {
    const [[lead]] = await pool.query('SELECT id, first_name, last_name, phone, assigned_agent_id, channel_partner_id FROM leads WHERE id = ?', [leadId]);
    if (!lead) throw httpError(404, 'Lead not found.');
    if (['INSIDE_SALES', 'OUTSIDE_SALES'].includes(user.role) && lead.assigned_agent_id !== user.id) {
      const [[visit]] = await pool.query('SELECT 1 FROM site_visits WHERE lead_id = ? AND assigned_agent_id = ? LIMIT 1', [lead.id, user.id]);
      if (!visit) throw httpError(404, 'Lead not found.');
    }
    if (['FINANCE', 'CUSTOMER_RELATIONS'].includes(user.role)) {
      const [[cust]] = await pool.query('SELECT id FROM customers WHERE lead_id = ?', [lead.id]);
      if (!cust) throw httpError(403, 'You can call customers, not open leads.');
    }
    return { leadId: lead.id, customerId: null, phone: lead.phone, name: fullName(lead.first_name, lead.last_name) };
  }
  if (customerId) {
    const [[c]] = await pool.query('SELECT id, lead_id, first_name, last_name, phone, relationship_manager_id FROM customers WHERE id = ?', [customerId]);
    if (!c) throw httpError(404, 'Customer not found.');
    if (user.role === 'CUSTOMER_RELATIONS' && user.jobLevel !== 'HEAD' && c.relationship_manager_id !== user.id) throw httpError(404, 'Customer not found.');
    return { leadId: c.lead_id || null, customerId: c.id, phone: c.phone, name: fullName(c.first_name, c.last_name) };
  }
  throw httpError(400, 'Choose the lead or customer to call.');
}

/**
 * Click-to-call: provider rings the employee's registered mobile, then the customer, and bridges them.
 */
async function startCall(user, { leadId = null, customerId = null }, req = null) {
  const p = provider();
  const st = status();
  if (!st.ready) throw httpError(503, 'Cloud calling isn’t set up yet. Ask the administrator to connect the telephony provider.', { code: 'TELEPHONY_NOT_CONFIGURED', missing: st.missing });
  const target = await resolveTarget(user, { leadId, customerId });
  const [[me]] = await pool.query('SELECT phone FROM users WHERE id = ?', [user.id]);
  if (!me || phoneKey(me.phone).length < 10) throw httpError(400, 'Add your mobile number to your profile — the call rings you first.', { code: 'AGENT_PHONE_MISSING' });
  if (phoneKey(target.phone).length < 10) throw httpError(400, 'This client has no valid phone number.');
  const [[busy]] = await pool.query(
    `SELECT id FROM call_logs WHERE agent_user_id = ? AND direction = 'OUTBOUND' AND status IN (?) AND initiated_at > NOW() - INTERVAL 2 MINUTE LIMIT 1`,
    [user.id, ACTIVE]
  );
  if (busy) throw httpError(409, 'You already have a call being connected. Finish it first.', { code: 'CALL_IN_PROGRESS', call_id: busy.id });

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO call_logs (id, provider, direction, agent_user_id, agent_phone, customer_phone, virtual_number, lead_id, customer_id, status)
     VALUES (?, ?, 'OUTBOUND', ?, ?, ?, ?, ?, ?, 'INITIATED')`,
    [id, p.name, user.id, me.phone, target.phone, p.settings ? p.settings().callerId : null, target.leadId, target.customerId]
  );
  try {
    const r = await p.startCall({ agentPhone: me.phone, customerPhone: target.phone, statusCallbackUrl: webhookUrls().status, customField: id });
    await pool.query("UPDATE call_logs SET provider_call_id = ?, status = 'RINGING_AGENT' WHERE id = ?", [r.providerCallId, id]);
    await audit.record({ req, action: 'CALL_STARTED', entityType: 'CALL', entityId: id, source: 'HUMAN', result: 'PENDING', summary: `Call to ${target.name} placed through ${p.name}`, after: { lead_id: target.leadId, customer_id: target.customerId, provider_call_id: r.providerCallId } });
    return { id, status: 'RINGING_AGENT', message: `Your phone will ring now. Answer it and ${p.name} connects you to ${target.name}.` };
  } catch (err) {
    await pool.query("UPDATE call_logs SET status = 'FAILED', failure_reason = ?, ended_at = NOW() WHERE id = ?", [String(err.message).slice(0, 255), id]);
    await audit.record({ req, action: 'CALL_FAILED', entityType: 'CALL', entityId: id, source: 'INTEGRATION', result: 'FAILED', summary: `Call to ${target.name} not placed: ${err.message}` });
    throw err;
  }
}

async function loadCall(id) {
  const [[c]] = await pool.query(
    `SELECT c.*, l.first_name, l.last_name, l.assigned_agent_id AS lead_owner_id, cu.first_name AS c_first, cu.last_name AS c_last,
            u.first_name AS a_first, u.last_name AS a_last
       FROM call_logs c LEFT JOIN leads l ON l.id = c.lead_id LEFT JOIN customers cu ON cu.id = c.customer_id LEFT JOIN users u ON u.id = c.agent_user_id
      WHERE c.id = ?`,
    [id]
  );
  if (!c) throw httpError(404, 'Call not found.');
  c.client_name = fullName(c.first_name, c.last_name) || fullName(c.c_first, c.c_last) || null;
  c.agent_name = fullName(c.a_first, c.a_last) || null;
  return c;
}

function assertCallAccess(user, call) {
  if (call.agent_user_id === user.id) return;
  if (['BUSINESS_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(user.role)) return;
  if (user.role === 'CUSTOMER_RELATIONS' && user.jobLevel === 'HEAD') return;
  throw httpError(404, 'Call not found.');
}

function shapeCall(c, user) {
  const out = { ...c };
  delete out.first_name; delete out.last_name; delete out.c_first; delete out.c_last; delete out.a_first; delete out.a_last;
  out.has_recording = Boolean(c.recording_url);
  delete out.recording_url;
  out.needs_outcome = FINAL.includes(c.status) && !c.outcome && c.agent_user_id === (user && user.id);
  return out;
}

/** Records one provider event exactly once. Returns false if it was already processed. */
async function rememberEvent(providerName, key, callLogId, type, payload) {
  try {
    await pool.query(
      'INSERT INTO telephony_events (id, provider, event_key, call_log_id, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), providerName, key.slice(0, 191), callLogId, type, JSON.stringify(payload).slice(0, 60000)]
    );
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
}

/** Provider → us: status of a click-to-call. Idempotent; never moves a finished call backwards. */
async function handleStatusCallback(providerName, body) {
  const p = PROVIDERS[providerName];
  if (!p) throw httpError(404, 'Unknown provider.');
  const ev = p.parseStatusCallback(body);
  if (!ev.providerCallId) return { ignored: 'no call id' };
  const [[call]] = await pool.query(
    'SELECT * FROM call_logs WHERE provider = ? AND (provider_call_id = ? OR id = ?) LIMIT 1',
    [providerName, ev.providerCallId, ev.customField || '']
  );
  const key = crypto.createHash('sha1').update(JSON.stringify([providerName, ev.providerCallId, ev.eventType, ev.providerStatus, ev.legs, ev.durationSec, body && body.DateUpdated])).digest('hex');
  const fresh = await rememberEvent(providerName, key, call ? call.id : null, `status:${ev.eventType}`, body);
  if (!fresh) return { duplicate: true };
  if (!call) {
    await pool.query("UPDATE telephony_events SET processing_status = 'IGNORED', error = 'No matching call' WHERE event_key = ?", [key]);
    return { ignored: 'unknown call' };
  }
  if (FINAL.includes(call.status)) return { ignored: 'already final' };

  const sets = { status: ev.status };
  if (!call.provider_call_id) sets.provider_call_id = ev.providerCallId;
  if (ev.status === 'AGENT_ANSWERED') sets.answered_at = new Date();
  if (FINAL.includes(ev.status)) {
    sets.ended_at = ev.endTime ? new Date(ev.endTime.replace(' ', 'T')) : new Date();
    if (Number.isNaN(sets.ended_at.getTime())) sets.ended_at = new Date();
    sets.duration_sec = ev.durationSec || 0;
    if (ev.status === 'COMPLETED') {
      if (!call.answered_at) sets.answered_at = ev.startTime ? new Date(ev.startTime.replace(' ', 'T')) : null;
      sets.connected_at = new Date(sets.ended_at.getTime() - (ev.durationSec || 0) * 1000);
    }
    if (ev.recordingUrl) sets.recording_url = ev.recordingUrl;
    if (ev.failureReason) sets.failure_reason = ev.failureReason;
  }
  const keys = Object.keys(sets);
  await pool.query(`UPDATE call_logs SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), call.id]);

  if (FINAL.includes(ev.status)) {
    if (call.lead_id) {
      await logActivity({
        leadId: call.lead_id, userId: call.agent_user_id, type: 'CALL', outcome: `CLOUD_${ev.status}`,
        note: ev.status === 'COMPLETED' ? `Call connected — ${Math.floor(ev.durationSec / 60)}m ${ev.durationSec % 60}s${ev.recordingUrl ? ' (recorded)' : ''}` : `Call not connected: ${ev.failureReason || ev.status.toLowerCase()}`
      });
      if (ev.status === 'COMPLETED') {
        await pool.query('UPDATE leads SET last_contacted_at = NOW(), first_contacted_at = COALESCE(first_contacted_at, NOW()) WHERE id = ?', [call.lead_id]);
      }
    }
    await createNotification({
      recipientUserId: call.agent_user_id, type: ev.status === 'COMPLETED' ? 'INFO' : 'WARNING',
      title: ev.status === 'COMPLETED' ? 'Call ended — add the outcome' : `Call not connected (${ev.failureReason || ev.status.toLowerCase()})`,
      message: 'Open the call to record what happened and the next follow-up.', relatedEntityType: 'CALL', relatedEntityId: call.id, category: 'CALL'
    });
    await audit.record({
      actor: { id: null, name: providerName, role: null }, source: 'INTEGRATION', action: `CALL_${ev.status}`, entityType: 'CALL', entityId: call.id,
      result: ev.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      summary: `${providerName}: call ${ev.status.toLowerCase()}${ev.durationSec ? ` after ${ev.durationSec}s` : ''}${ev.failureReason ? ` — ${ev.failureReason}` : ''}`,
      before: { status: call.status }, after: { status: ev.status, duration_sec: ev.durationSec }
    });
  }
  return { callId: call.id, status: ev.status };
}

/** Who is calling? Matches the number against leads and customers (last 10 digits). */
async function identify(phone) {
  const key = phoneKey(phone);
  if (key.length < 10) return { lead: null, customer: null };
  const lead = await findLeadByPhone(phone);
  const [[customer]] = await pool.query(
    "SELECT id, first_name, last_name, relationship_manager_id, lead_id FROM customers WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = ? ORDER BY created_at DESC LIMIT 1",
    [key]
  );
  return { lead: lead || null, customer: customer || null };
}

/** Provider → us: an incoming call reached the ExoPhone (Passthru applet). */
async function handleIncoming(providerName, params) {
  const p = PROVIDERS[providerName];
  if (!p) throw httpError(404, 'Unknown provider.');
  const ev = p.parseIncoming(params);
  if (!ev.providerCallId || !ev.from) return { ignored: 'missing call id or caller' };
  const key = crypto.createHash('sha1').update(JSON.stringify([providerName, 'in', ev.providerCallId, ev.agentNumber, ev.finalStatus])).digest('hex');
  if (!(await rememberEvent(providerName, key, null, 'incoming', params))) return { duplicate: true };

  const who = await identify(ev.from);
  let agentId = null;
  if (ev.agentNumber && phoneKey(ev.agentNumber).length >= 10) {
    const [[a]] = await pool.query(
      "SELECT id FROM users WHERE status = 'ACTIVE' AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = ? LIMIT 1",
      [phoneKey(ev.agentNumber)]
    );
    agentId = a ? a.id : null;
  }
  if (!agentId) agentId = (who.customer && who.customer.relationship_manager_id) || (who.lead && who.lead.assigned_agent_id) || null;

  const [[existing]] = await pool.query('SELECT * FROM call_logs WHERE provider = ? AND provider_call_id = ?', [providerName, ev.providerCallId]);
  let callId = existing ? existing.id : null;
  if (!existing) {
    callId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO call_logs (id, provider, provider_call_id, direction, agent_user_id, agent_phone, customer_phone, virtual_number, lead_id, customer_id, status)
       VALUES (?, ?, ?, 'INBOUND', ?, ?, ?, ?, ?, ?, ?)`,
      [callId, providerName, ev.providerCallId, agentId, ev.agentNumber, ev.from, ev.to, who.lead ? who.lead.id : (who.customer ? who.customer.lead_id : null), who.customer ? who.customer.id : null,
        ev.finalStatus || (ev.agentNumber ? 'RINGING_AGENT' : 'INITIATED')]
    );
  } else {
    const sets = {};
    if (agentId && !existing.agent_user_id) sets.agent_user_id = agentId;
    if (ev.agentNumber) sets.agent_phone = ev.agentNumber;
    if (ev.finalStatus && !FINAL.includes(existing.status)) {
      sets.status = ev.finalStatus;
      sets.ended_at = new Date();
      if (ev.durationSec) sets.duration_sec = ev.durationSec;
      if (ev.recordingUrl) sets.recording_url = ev.recordingUrl;
    }
    const keys = Object.keys(sets);
    if (keys.length) await pool.query(`UPDATE call_logs SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), existing.id]);
  }

  // Screen pop: tell the employee who is calling, with the record to open
  if (!existing) {
    const name = who.customer ? fullName(who.customer.first_name, who.customer.last_name) : who.lead ? fullName(who.lead.first_name, who.lead.last_name) : null;
    const payload = {
      type: 'INFO',
      title: name ? `📞 Incoming call: ${name}` : `📞 Incoming call from ${ev.from}`,
      message: name ? `${who.customer ? 'Customer' : 'Lead'} is calling the company number.` : 'Unknown number — you can create a lead from the call.',
      relatedEntityType: 'CALL', relatedEntityId: callId, category: 'CALL'
    };
    if (agentId) await notifyUsers([agentId], payload);
    else await notifyUsers(await usersWithRoles(['INSIDE_SALES', 'ADMIN']), payload);
  }
  if (ev.finalStatus === 'MISSED' && (!existing || !FINAL.includes(existing.status))) {
    await notifyUsers(agentId ? [agentId] : await usersWithRoles(['ADMIN']), {
      type: 'WARNING', title: `Missed call from ${ev.from}`, message: 'Call them back from the call log.', relatedEntityType: 'CALL', relatedEntityId: callId, category: 'CALL'
    });
  }
  await audit.record({ actor: { id: null, name: providerName, role: null }, source: 'INTEGRATION', action: 'CALL_INCOMING', entityType: 'CALL', entityId: callId, summary: `Incoming call from ${ev.from}${who.lead || who.customer ? ' (known client)' : ' (unknown)'}${ev.finalStatus ? ` — ${ev.finalStatus.toLowerCase()}` : ''}` });
  return { callId };
}

const OUTCOMES = {
  INTERESTED: { label: 'Interested', next: () => tomorrowAt(11), stageFromNew: 'Contacted' },
  CALLBACK: { label: 'Call back later', next: () => hoursFromNow(2), stageFromNew: 'Contacted' },
  NEGOTIATING: { label: 'Negotiating', next: () => tomorrowAt(11), stage: 'In Negotiation' },
  VISIT_PLANNED: { label: 'Wants a site visit', next: () => hoursFromNow(1), stageFromNew: 'Contacted' },
  NOT_INTERESTED: { label: 'Not interested', next: () => null, stage: 'Lost' },
  NO_ANSWER: { label: 'No answer', next: () => hoursFromNow(3), stageFromNew: 'Not Answered' },
  WRONG_NUMBER: { label: 'Wrong number', next: () => null, stage: 'Lost' },
  CUSTOMER_QUERY: { label: 'Customer query handled', next: () => null },
  OTHER: { label: 'Other', next: () => null }
};

/** After-call form: outcome, remarks and the next follow-up; updates the lead and its timeline. */
async function saveOutcome(user, callId, b, req = null) {
  const call = await loadCall(callId);
  if (call.agent_user_id !== user.id && !['SUPER_ADMIN', 'ADMIN', 'BUSINESS_OWNER'].includes(user.role)) throw httpError(404, 'Call not found.');
  if (!FINAL.includes(call.status)) throw httpError(409, 'Wait for the call to finish before adding the outcome.');
  const key = String(b.outcome || '').toUpperCase();
  const o = OUTCOMES[key];
  if (!o) throw httpError(400, `Choose an outcome: ${Object.keys(OUTCOMES).join(', ')}.`);
  if (key === 'NOT_INTERESTED' && !b.remarks && !b.lost_reason) throw httpError(400, 'Add the reason the client isn’t interested.');
  const remarks = b.remarks ? String(b.remarks).slice(0, 2000) : null;
  await pool.query('UPDATE call_logs SET outcome = ?, remarks = ?, outcome_by = ?, outcome_at = NOW() WHERE id = ?', [key, remarks, user.id, call.id]);

  let followUp = null;
  if (call.lead_id) {
    const [[lead]] = await pool.query('SELECT stage, channel_partner_id, first_name, last_name FROM leads WHERE id = ?', [call.lead_id]);
    const sets = [];
    const params = [];
    followUp = b.next_follow_up_at ? new Date(b.next_follow_up_at) : o.next();
    if (followUp && Number.isNaN(followUp.getTime())) throw httpError(400, 'Pick a valid follow-up time.');
    // Closing outcomes clear the follow-up; neutral ones without a new time keep the existing one
    if (followUp || ['NOT_INTERESTED', 'WRONG_NUMBER'].includes(key)) { sets.push('next_follow_up_at = ?'); params.push(followUp); }
    const bucket = bucketOf(lead.stage);
    const stage = o.stage || (o.stageFromNew && bucket === 'NEW' ? o.stageFromNew : null);
    if (stage && bucketOf(stage) !== bucket && !['BOOKED'].includes(bucket)) { sets.push('stage = ?'); params.push(stage); }
    if (o.stage === 'Lost') { sets.push('lost_reason = ?', 'lost_at = NOW()'); params.push(String(b.lost_reason || remarks || o.label).slice(0, 255)); }
    if (['HOT', 'WARM', 'COLD'].includes(b.temperature)) { sets.push('temperature = ?'); params.push(b.temperature); }
    if (sets.length) await pool.query(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, [...params, call.lead_id]);
    await logActivity({ leadId: call.lead_id, userId: user.id, type: 'CALL', outcome: key, note: `${o.label}${remarks ? ` — ${remarks}` : ''}${followUp ? ` · next follow-up ${followUp.toLocaleString('en-IN')}` : ''}` });
    if (['INTERESTED', 'NEGOTIATING', 'NOT_INTERESTED', 'VISIT_PLANNED'].includes(key)) {
      await notifyManagers({ type: key === 'NOT_INTERESTED' ? 'WARNING' : 'INFO', title: `${user.name}: ${o.label.toLowerCase()} — ${fullName(lead.first_name, lead.last_name)}`, message: remarks || o.label, leadId: call.lead_id, category: 'CALL' }, user.id);
    }
  } else if (call.customer_id) {
    await pool.query(
      "INSERT INTO customer_communications (id, customer_id, channel, direction, subject, summary, user_id) VALUES (?, ?, 'CALL', ?, ?, ?, ?)",
      [crypto.randomUUID(), call.customer_id, call.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND', `Call — ${o.label}`, remarks || o.label, user.id]
    );
  }
  await audit.record({ req, action: 'CALL_OUTCOME_RECORDED', entityType: 'CALL', entityId: call.id, summary: `${call.client_name || call.customer_phone}: ${o.label}${remarks ? ` — ${remarks}` : ''}`, after: { outcome: key, remarks, next_follow_up_at: followUp } });
  return { id: call.id, outcome: key, nextFollowUpAt: followUp };
}

/** Creates a lead from an unknown incoming caller (authorised roles only). */
async function createLeadFromCall(user, callId, b, req = null) {
  const call = await loadCall(callId);
  assertCallAccess(user, call);
  if (call.direction !== 'INBOUND') throw httpError(400, 'Only incoming calls from unknown numbers become new leads.');
  if (call.lead_id || call.customer_id) throw httpError(409, 'This caller is already in the CRM.');
  const dup = await findLeadByPhone(call.customer_phone);
  if (dup) {
    await pool.query('UPDATE call_logs SET lead_id = ? WHERE id = ?', [dup.id, call.id]);
    throw httpError(409, 'This number already belongs to a lead — the call is now linked to it.', { lead_id: dup.id });
  }
  const first = String(b.first_name || '').trim();
  if (!first) throw httpError(400, 'Enter the caller’s name.');
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO leads (id, first_name, last_name, phone, source, stage, assigned_agent_id, registered_by, next_follow_up_at, preferred_project_id, notes, first_contacted_at, last_contacted_at)
     VALUES (?, ?, ?, ?, 'INBOUND_CALL', 'Contacted', ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, first.slice(0, 100), b.last_name ? String(b.last_name).slice(0, 100) : null, call.customer_phone, call.agent_user_id || user.id, user.id, tomorrowAt(11), b.preferred_project_id || null, b.note ? String(b.note).slice(0, 2000) : null]
  );
  await pool.query(
    "INSERT INTO lead_assignments (id, lead_id, from_user_id, to_user_id, assigned_by, method, reason) VALUES (?, ?, NULL, ?, ?, 'MANUAL', 'Created from an incoming call')",
    [crypto.randomUUID(), id, call.agent_user_id || user.id, user.id]
  );
  await pool.query('UPDATE call_logs SET lead_id = ? WHERE id = ?', [id, call.id]);
  await logActivity({ leadId: id, userId: user.id, type: 'SYSTEM', outcome: 'CREATED', note: `Created from an incoming call${b.note ? ` — ${b.note}` : ''}` });
  await audit.record({ req, action: 'LEAD_CREATED', entityType: 'LEAD', entityId: id, summary: `${fullName(first, b.last_name)} created from incoming call ${call.customer_phone}`, after: { source: 'INBOUND_CALL', call_id: call.id } });
  return { leadId: id };
}

async function myCalls(user, { pendingOutcome = false, limit = 50 } = {}) {
  const [rows] = await pool.query(
    `SELECT c.*, l.first_name, l.last_name, cu.first_name AS c_first, cu.last_name AS c_last
       FROM call_logs c LEFT JOIN leads l ON l.id = c.lead_id LEFT JOIN customers cu ON cu.id = c.customer_id
      WHERE c.agent_user_id = ? ${pendingOutcome ? `AND c.outcome IS NULL AND c.status IN (?)` : ''}
      ORDER BY c.initiated_at DESC LIMIT ?`,
    pendingOutcome ? [user.id, FINAL, limit] : [user.id, limit]
  );
  return rows.map((c) => shapeCall({ ...c, client_name: fullName(c.first_name, c.last_name) || fullName(c.c_first, c.c_last) || null }, user));
}

/** The latest incoming call for this person in the last 2 minutes (screen pop). */
async function liveIncoming(user) {
  const [[c]] = await pool.query(
    `SELECT c.id FROM call_logs c WHERE c.direction = 'INBOUND' AND c.agent_user_id = ? AND c.initiated_at > NOW() - INTERVAL 2 MINUTE
      ORDER BY c.initiated_at DESC LIMIT 1`,
    [user.id]
  );
  if (!c) return null;
  return shapeCall(await loadCall(c.id), user);
}

module.exports = {
  status, webhookUrls, webhookSecret, startCall, loadCall, assertCallAccess, shapeCall, handleStatusCallback, handleIncoming,
  saveOutcome, createLeadFromCall, myCalls, liveIncoming, identify, OUTCOMES, FINAL, ACTIVE, PROVIDERS
};
