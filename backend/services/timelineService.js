/**
 * Record-level timelines: everything that happened to one lead (or any audited record), in order.
 *
 * A lead's timeline merges its activity log (calls, WhatsApp, notes, stage changes, visits, bookings,
 * payments, approvals — each workflow service writes one entry), its cloud-telephony calls (with real
 * status and duration), and field-level edits from the audit trail (who changed what, before → after).
 */
const pool = require('../config/db');
const { fullName } = require('./salesWorkspace');

const parse = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

async function leadTimeline(leadId, { includePrivate = true } = {}) {
  const [activities] = await pool.query(
    `SELECT a.id, a.type, a.outcome, a.note, a.created_at, u.first_name, u.last_name, r.name AS role
       FROM lead_activities a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN roles r ON r.id = u.role_id
      WHERE a.lead_id = ? ORDER BY a.created_at DESC LIMIT 500`,
    [leadId]
  );
  const [calls] = await pool.query(
    `SELECT c.id, c.direction, c.status, c.initiated_at, c.duration_sec, c.outcome, c.remarks, c.recording_url, c.failure_reason,
            u.first_name, u.last_name
       FROM call_logs c LEFT JOIN users u ON u.id = c.agent_user_id
      WHERE c.lead_id = ? ORDER BY c.initiated_at DESC LIMIT 200`,
    [leadId]
  );
  const [edits] = await pool.query(
    `SELECT id, action, summary, before_data, after_data, actor_name, actor_role, source, result, created_at
       FROM audit_events WHERE entity_type = 'LEAD' AND entity_id = ? AND action IN ('LEAD_UPDATED', 'LEAD_STAGE_CHANGED', 'LEAD_CREATED')
      ORDER BY seq DESC LIMIT 200`,
    [leadId]
  );
  const items = [
    ...activities
      .filter((a) => includePrivate || ['STAGE', 'VISIT', 'ASSIGN', 'BOOKING', 'SYSTEM'].includes(a.type))
      .map((a) => ({ kind: 'activity', id: a.id, type: a.type, outcome: a.outcome, text: a.note, at: a.created_at, by: fullName(a.first_name, a.last_name) || 'System', role: a.role })),
    ...(includePrivate ? calls.map((c) => ({
      kind: 'call', id: c.id, type: 'CALL', outcome: c.outcome || c.status, at: c.initiated_at,
      by: fullName(c.first_name, c.last_name) || null,
      text: `${c.direction === 'INBOUND' ? 'Incoming' : 'Outgoing'} call — ${c.status.toLowerCase().replace(/_/g, ' ')}${c.duration_sec ? `, ${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : ''}${c.remarks ? `: ${c.remarks}` : ''}${c.failure_reason ? ` (${c.failure_reason})` : ''}`,
      recording: Boolean(c.recording_url)
    })) : []),
    ...(includePrivate ? edits.map((e) => ({
      kind: 'audit', id: e.id, type: 'EDIT', outcome: e.action, at: e.created_at, by: e.actor_name || 'System', role: e.actor_role,
      text: e.summary, before: parse(e.before_data), after: parse(e.after_data), source: e.source
    })) : [])
  ];
  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

/** Audit events for any record (deal, payment, unit, customer, ticket, …). */
async function recordTimeline(entityType, entityId) {
  const [rows] = await pool.query(
    `SELECT id, action, summary, before_data, after_data, actor_name, actor_role, source, result, created_at
       FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY seq DESC LIMIT 300`,
    [String(entityType).toUpperCase(), entityId]
  );
  return rows.map((e) => ({ ...e, before_data: parse(e.before_data), after_data: parse(e.after_data) }));
}

module.exports = { leadTimeline, recordTimeline };
