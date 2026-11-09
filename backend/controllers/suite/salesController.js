/**
 * Sales Head (SUPER_ADMIN) and Sales Manager (ADMIN) portals.
 *
 * A sales manager with a team (users.manager_id) sees that team's leads plus unassigned ones;
 * a company that hasn't set up teams lets managers see everything. The sales head sees everything.
 */
const crypto = require('crypto');
const { wrap, ok, httpError, dateRange, page, num, pct, fullName, pool } = require('./common');
const {
  AGENT_ROLES, STAGE_BUCKETS, bucketSql, OPEN_STAGE_SQL, sqlList
} = require('../../services/salesWorkspace');
const leadService = require('../../services/leadService');
const visits = require('../../services/visitService');
const bookings = require('../../services/bookingService');
const timeline = require('../../services/timelineService');
const audit = require('../../services/audit');
const { can } = require('../../services/permissions');

const BUCKET = bucketSql('l.stage');
const OPEN = OPEN_STAGE_SQL('l.stage');
const LIVE = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const SALES_ROLES = [...AGENT_ROLES, 'ADMIN'];

/** Agent ids a sales manager is limited to (null = no limit). */
async function teamOf(user) {
  if (user.role !== 'ADMIN') return null;
  const [rows] = await pool.query("SELECT id FROM users WHERE manager_id = ? AND status = 'ACTIVE'", [user.id]);
  return rows.length ? [user.id, ...rows.map((r) => r.id)] : null;
}

function leadTeamFilter(team, alias = 'l') {
  if (!team) return { sql: '1 = 1', params: [] };
  return { sql: `(${alias}.assigned_agent_id IN (?) OR ${alias}.assigned_agent_id IS NULL)`, params: [team] };
}

// ------------------------------------------------------------------------------------------- dashboard
const dashboard = wrap(async (req, res) => {
  const { from, to, prevFrom, prevTo } = dateRange(req.query, 30);
  const team = await teamOf(req.user);
  const tf = leadTeamFilter(team);
  const [[k]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND ${tf.sql}) AS new_leads,
       (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND ${tf.sql}) AS prev_leads,
       (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND l.first_contacted_at IS NOT NULL AND ${tf.sql}) AS contacted,
       (SELECT AVG(TIMESTAMPDIFF(MINUTE, l.created_at, l.first_contacted_at)) FROM leads l
         WHERE l.created_at >= ? AND l.created_at < ? AND l.first_contacted_at IS NOT NULL AND l.first_contacted_at >= l.created_at AND ${tf.sql}) AS avg_response_min,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL AND ${tf.sql}) AS untouched,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.assigned_agent_id IS NULL) AS unassigned,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at < NOW() AND ${tf.sql}) AS overdue,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY AND ${tf.sql}) AS due_today,
       (SELECT COUNT(*) FROM site_visits sv WHERE sv.status IN (${visits.VISIT_OPEN_SQL}) AND sv.scheduled_time >= NOW()) AS visits_upcoming,
       (SELECT COUNT(*) FROM site_visits sv WHERE sv.status = 'COMPLETED' AND COALESCE(sv.completed_at, sv.scheduled_time) >= ? AND COALESCE(sv.completed_at, sv.scheduled_time) < ?) AS visits_done,
       (SELECT COUNT(*) FROM site_visits sv WHERE sv.status IN ('REQUESTED', 'PENDING_APPROVAL')) AS visits_unallocated,
       (SELECT COUNT(*) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS bookings,
       (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS revenue,
       (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS prev_revenue,
       (SELECT COUNT(*) FROM deals d WHERE d.status = 'PENDING_APPROVAL') AS pending_bookings,
       (SELECT COUNT(*) FROM escalations e WHERE e.status IN ('OPEN', 'ACKNOWLEDGED') AND e.escalated_to_role IN ('ADMIN', 'SUPER_ADMIN')) AS open_escalations,
       (SELECT COUNT(*) FROM call_logs c WHERE c.initiated_at >= ? AND c.initiated_at < ?) AS cloud_calls,
       (SELECT COUNT(*) FROM lead_activities a WHERE a.type = 'CALL' AND a.created_at >= ? AND a.created_at < ?) AS calls_logged`,
    [from, to, ...tf.params, prevFrom, prevTo, ...tf.params, from, to, ...tf.params, from, to, ...tf.params, ...tf.params, ...tf.params, ...tf.params,
      from, to, from, to, from, to, prevFrom, prevTo, from, to, from, to]
  );
  const [pipeline] = await pool.query(`SELECT ${BUCKET} AS bucket, COUNT(*) AS n FROM leads l WHERE ${tf.sql} GROUP BY bucket`, tf.params);
  const [sources] = await pool.query(
    `SELECT COALESCE(NULLIF(l.source, ''), 'OTHER') AS source, COUNT(*) AS leads, SUM(${BUCKET} = 'BOOKED') AS booked
       FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND ${tf.sql} GROUP BY source ORDER BY leads DESC LIMIT 12`,
    [from, to, ...tf.params]
  );
  const [trend] = await pool.query(
    `SELECT d.day, COALESCE(lc.n, 0) AS leads, COALESCE(bc.n, 0) AS bookings
       FROM (SELECT DATE(?) + INTERVAL seq DAY AS day FROM (
               SELECT a.N + b.N * 10 + c.N * 100 AS seq FROM
                 (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                 (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
                 (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) c) s
             WHERE DATE(?) + INTERVAL seq DAY < DATE(?)) d
       LEFT JOIN (SELECT DATE(l.created_at) AS day, COUNT(*) AS n FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND ${tf.sql} GROUP BY DATE(l.created_at)) lc ON lc.day = d.day
       LEFT JOIN (SELECT DATE(COALESCE(dd.approved_at, dd.created_at)) AS day, COUNT(*) AS n FROM deals dd WHERE dd.status IN ${LIVE}
                   AND COALESCE(dd.approved_at, dd.created_at) >= ? AND COALESCE(dd.approved_at, dd.created_at) < ? GROUP BY day) bc ON bc.day = d.day
      ORDER BY d.day`,
    [from, from, to, from, to, ...tf.params, from, to]
  );
  const [leaders] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, r.name AS role,
            (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN ${LIVE}
              AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS bookings,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN ${LIVE}
              AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS revenue,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status = 'COMPLETED'
              AND COALESCE(sv.completed_at, sv.scheduled_time) >= ? AND COALESCE(sv.completed_at, sv.scheduled_time) < ?) AS visits,
            (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.type = 'CALL' AND a.created_at >= ? AND a.created_at < ?)
              + (SELECT COUNT(*) FROM call_logs c WHERE c.agent_user_id = u.id AND c.initiated_at >= ? AND c.initiated_at < ?) AS calls
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(AGENT_ROLES)}) ${team ? 'AND u.id IN (?)' : ''}
      ORDER BY revenue DESC, bookings DESC, visits DESC LIMIT 10`,
    [from, to, from, to, from, to, from, to, from, to, ...(team ? [team] : [])]
  );
  ok(res, {
    range: { from, to },
    kpis: {
      newLeads: num(k.new_leads), leadsChangePct: num(k.prev_leads) ? Math.round(((num(k.new_leads) - num(k.prev_leads)) / num(k.prev_leads)) * 100) : null,
      contactRatePct: pct(k.contacted, k.new_leads), avgResponseMin: k.avg_response_min == null ? null : Math.round(Number(k.avg_response_min)),
      untouched: num(k.untouched), unassigned: num(k.unassigned), overdue: num(k.overdue), dueToday: num(k.due_today),
      visitsUpcoming: num(k.visits_upcoming), visitsDone: num(k.visits_done), visitsUnallocated: num(k.visits_unallocated),
      bookings: num(k.bookings), revenue: num(k.revenue),
      revenueChangePct: num(k.prev_revenue) ? Math.round(((num(k.revenue) - num(k.prev_revenue)) / num(k.prev_revenue)) * 100) : null,
      conversionPct: pct(k.bookings, k.new_leads), pendingBookings: num(k.pending_bookings), openEscalations: num(k.open_escalations),
      calls: num(k.cloud_calls) + num(k.calls_logged)
    },
    pipeline: Object.keys(STAGE_BUCKETS).map((b) => ({ bucket: b, label: STAGE_BUCKETS[b].label, count: num((pipeline.find((p) => p.bucket === b) || {}).n) })),
    sources: sources.map((s) => ({ source: s.source, leads: num(s.leads), booked: num(s.booked), conversionPct: pct(s.booked, s.leads) })),
    trend: trend.map((t) => ({ day: t.day, leads: num(t.leads), bookings: num(t.bookings) })),
    leaders: leaders.map((l) => ({ id: l.id, name: fullName(l.first_name, l.last_name), role: l.role, bookings: num(l.bookings), revenue: num(l.revenue), visits: num(l.visits), calls: num(l.calls) }))
  });
});

// ------------------------------------------------------------------------------------------- leads
const LEAD_VIEWS = {
  all: '1 = 1',
  open: OPEN,
  unassigned: `${OPEN} AND l.assigned_agent_id IS NULL`,
  untouched: `${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL`,
  overdue: `${OPEN} AND l.next_follow_up_at < NOW()`,
  today: `${OPEN} AND l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY`,
  hot: `${OPEN} AND (l.temperature = 'HOT' OR l.priority IN ('URGENT', 'HIGH'))`,
  booked: `${BUCKET} = 'BOOKED'`,
  lost: `${BUCKET} = 'LOST'`,
  duplicates: 'l.duplicate_of_lead_id IS NOT NULL',
  test: 'l.is_test_data = 1'
};

const listLeads = wrap(async (req, res) => {
  const q = req.query;
  const team = await teamOf(req.user);
  const tf = leadTeamFilter(team);
  const where = [LEAD_VIEWS[q.view] || OPEN, tf.sql];
  const params = [...tf.params];
  if (q.q) {
    where.push('(l.first_name LIKE ? OR l.last_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR CONCAT_WS(\' \', l.first_name, l.last_name) LIKE ?)');
    params.push(...Array(5).fill(`%${String(q.q).trim()}%`));
  }
  if (q.source) { where.push('l.source = ?'); params.push(q.source); }
  if (q.project_id) { where.push('l.preferred_project_id = ?'); params.push(q.project_id); }
  if (q.agent_id) { where.push(q.agent_id === 'none' ? 'l.assigned_agent_id IS NULL' : 'l.assigned_agent_id = ?'); if (q.agent_id !== 'none') params.push(q.agent_id); }
  if (q.bucket && STAGE_BUCKETS[q.bucket]) { where.push(`${BUCKET} = ?`); params.push(q.bucket); }
  if (q.priority) { where.push('l.priority = ?'); params.push(q.priority); }
  if (q.campaign_id) { where.push('l.campaign_id = ?'); params.push(q.campaign_id); }
  if (q.partner_id) { where.push('l.channel_partner_id = ?'); params.push(q.partner_id); }
  if (q.from) { where.push('l.created_at >= ?'); params.push(new Date(q.from)); }
  if (q.to) { where.push('l.created_at < ? + INTERVAL 1 DAY'); params.push(new Date(q.to)); }
  const { limit, offset } = page(q, 500);
  const sort = { created: 'l.created_at DESC', followup: 'l.next_follow_up_at IS NULL, l.next_follow_up_at ASC', priority: "FIELD(l.priority, 'URGENT', 'HIGH', 'MEDIUM', 'LOW', NULL), l.created_at DESC", name: 'l.first_name ASC' }[q.sort] || 'l.created_at DESC';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM leads l WHERE ${where.join(' AND ')}`, params);
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.stage, ${BUCKET} AS bucket, l.priority, l.temperature,
            l.qualification_status, l.budget_min, l.budget_max, l.configuration, l.preferred_location, l.next_follow_up_at,
            l.first_contacted_at, l.last_contacted_at, l.created_at, l.is_test_data, l.duplicate_of_lead_id,
            l.assigned_agent_id, ag.first_name AS agent_first, ag.last_name AS agent_last,
            p.name AS project_name, cp.firm_name AS partner_firm, cmp.name AS campaign_name
       FROM leads l
       LEFT JOIN users ag ON ag.id = l.assigned_agent_id
       LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
       LEFT JOIN campaigns cmp ON cmp.id = l.campaign_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  ok(res, { total: num(total), limit, offset, rows: rows.map((r) => ({ ...r, agent_name: fullName(r.agent_first, r.agent_last) || null })) });
});

const getLead = wrap(async (req, res) => {
  const team = await teamOf(req.user);
  const [[lead]] = await pool.query(
    `SELECT l.*, ${BUCKET} AS bucket, ag.first_name AS agent_first, ag.last_name AS agent_last, ag.phone AS agent_phone,
            p.name AS project_name, cp.firm_name AS partner_firm, cmp.name AS campaign_name
       FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id LEFT JOIN campaigns cmp ON cmp.id = l.campaign_id
      WHERE l.id = ?`,
    [req.params.id]
  );
  if (!lead) throw httpError(404, 'Lead not found.');
  if (team && lead.assigned_agent_id && !team.includes(lead.assigned_agent_id)) throw httpError(403, 'Lead not found in your team.');
  if (!can(req.user, 'leads.view.all')) {
    const isAssigned = lead.assigned_agent_id === req.user.id;
    const isPartner = req.user.channel_partner_id && lead.channel_partner_id === req.user.channel_partner_id;
    const [[assignedVisit]] = await pool.query('SELECT 1 FROM site_visits WHERE lead_id = ? AND assigned_agent_id = ? LIMIT 1', [lead.id, req.user.id]);
    if (!isAssigned && !isPartner && !assignedVisit) throw httpError(403, 'You do not have permission to view this lead.');
  }
  const [visitRows] = await pool.query(
    `SELECT sv.*, p.name AS project_name, ag.first_name AS agent_first, ag.last_name AS agent_last FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id LEFT JOIN users ag ON ag.id = sv.assigned_agent_id WHERE sv.lead_id = ? ORDER BY sv.scheduled_time DESC`,
    [lead.id]
  );
  const [dealRows] = await pool.query(
    `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.discount_amount, d.created_at, d.approved_at, d.rejection_reason,
            u.unit_number, p.name AS project_name,
            (SELECT COALESCE(SUM(amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'VERIFIED') AS collected
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id WHERE d.lead_id = ? ORDER BY d.created_at DESC`,
    [lead.id]
  );
  ok(res, {
    lead: { ...lead, agent_name: fullName(lead.agent_first, lead.agent_last) || null, suggested_priority: leadService.scorePriority(lead) },
    timeline: await timeline.leadTimeline(lead.id),
    assignments: await leadService.assignmentHistory(lead.id),
    visits: visitRows.map((v) => ({ ...v, agent_name: fullName(v.agent_first, v.agent_last) || null })),
    deals: dealRows,
    duplicates: await leadService.findDuplicates({ phone: lead.phone, email: lead.email, excludeId: lead.id })
  });
});

const assignLeads = wrap(async (req, res) => {
  const b = req.body || {};
  const ids = Array.isArray(b.lead_ids) ? b.lead_ids : b.lead_id ? [b.lead_id] : [];
  const team = await teamOf(req.user);
  const targets = b.to_user_id ? [b.to_user_id] : Array.isArray(b.user_ids) ? b.user_ids : [];
  if (team && targets.some((t) => !team.includes(t))) throw httpError(403, 'You can assign leads to your own team only.');
  const result = await leadService.bulkAssign(ids, {
    toUserId: b.to_user_id || null, userIds: b.user_ids || [],
    by: { id: req.user.id, name: req.user.name, role: req.user.role }, reason: b.reason || null, req,
    method: ids.length > 1 ? 'BULK' : 'MANUAL'
  });
  ok(res, result, `${result.assigned} lead${result.assigned === 1 ? '' : 's'} assigned${result.failed.length ? `, ${result.failed.length} failed` : ''}.`);
});

/** Bulk CSV/Excel import — same validation as the workspace import, plus campaign attribution. */
const importLeads = wrap(async (req, res) => {
  req.ws = { id: req.user.id, name: req.user.name, role: req.user.role, kind: 'manager' };
  return require('../workspaceController').importLeads(req, res);
});

const bookLead = wrap(async (req, res) => {
  const b = req.body || {};
  const result = await bookings.initiateBooking(req.user, {
    leadId: req.params.id, unitId: b.unit_id, discountAmount: b.discount_amount, tokenAmount: b.booking_token_amount, notes: b.note, channel: 'SUITE'
  }, req);
  ok(res, result, result.message, 201);
});

const scheduleVisit = wrap(async (req, res) => {
  const b = req.body || {};
  const [[lead]] = await pool.query(`SELECT l.*, ${BUCKET} AS bucket FROM leads l WHERE l.id = ?`, [req.params.id]);
  if (!lead) throw httpError(404, 'Lead not found.');
  if (['BOOKED', 'LOST'].includes(lead.bucket)) throw httpError(400, 'This lead is closed.');
  const result = await visits.createVisit(visits.visitActor(req.user), lead, {
    projectId: b.project_id || lead.preferred_project_id, when: b.scheduled_time ? new Date(b.scheduled_time) : null,
    agentId: b.agent_id || null, clientConfirmed: b.client_confirmed !== false, note: b.note || null, req
  });
  ok(res, result, result.message, 201);
});

// ------------------------------------------------------------------------------------------- team
const team = wrap(async (req, res) => {
  const t = await teamOf(req.user);
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.phone, u.email, u.is_available, u.last_login, u.job_level, u.manager_id, r.name AS role,
            m.first_name AS mgr_first, m.last_name AS mgr_last,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN}) AS open_leads,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL) AS untouched,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN} AND l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY) AS due_today,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN (${visits.VISIT_UPCOMING_SQL})
               AND sv.scheduled_time >= CURDATE() AND sv.scheduled_time < CURDATE() + INTERVAL 1 DAY) AS visits_today,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN (${visits.VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= NOW()) AS visits_upcoming,
            (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.type = 'CALL' AND a.created_at >= CURDATE())
              + (SELECT COUNT(*) FROM call_logs c WHERE c.agent_user_id = u.id AND c.initiated_at >= CURDATE()) AS calls_today,
            (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.created_at >= CURDATE()) AS actions_today,
            (SELECT MAX(a.created_at) FROM lead_activities a WHERE a.user_id = u.id) AS last_activity_at,
            (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN ${LIVE}
               AND COALESCE(d.approved_at, d.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS bookings_month
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN users m ON m.id = u.manager_id
      WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(SALES_ROLES)}) ${t ? 'AND u.id IN (?)' : ''}
      ORDER BY r.name = 'ADMIN' DESC, u.first_name`,
    t ? [t] : []
  );
  const agents = rows.filter((r) => r.role !== 'ADMIN');
  const avgLoad = agents.length ? agents.reduce((s, a) => s + num(a.open_leads), 0) / agents.length : 0;
  ok(res, rows.map((r) => {
    const load = num(r.open_leads);
    const workload = r.role === 'ADMIN' ? null : !r.is_available ? 'ON_LEAVE' : avgLoad && load > avgLoad * 1.5 ? 'OVERLOADED' : avgLoad && load < avgLoad * 0.5 ? 'LIGHT' : 'BALANCED';
    return {
      ...r, name: fullName(r.first_name, r.last_name), manager_name: fullName(r.mgr_first, r.mgr_last) || null, workload,
      open_leads: load, overdue: num(r.overdue), untouched: num(r.untouched), due_today: num(r.due_today), visits_today: num(r.visits_today),
      visits_upcoming: num(r.visits_upcoming), calls_today: num(r.calls_today), actions_today: num(r.actions_today), bookings_month: num(r.bookings_month)
    };
  }));
});

const setAvailability = wrap(async (req, res) => {
  const t = await teamOf(req.user);
  if (t && !t.includes(req.params.id)) throw httpError(403, 'Not in your team.');
  const available = Boolean(req.body && req.body.is_available);
  const [[u]] = await pool.query('SELECT is_available, first_name, last_name FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw httpError(404, 'Team member not found.');
  await pool.query('UPDATE users SET is_available = ? WHERE id = ?', [available ? 1 : 0, req.params.id]);
  await audit.record({ req, action: 'AVAILABILITY_CHANGED', entityType: 'USER', entityId: req.params.id, summary: `${fullName(u.first_name, u.last_name)} marked ${available ? 'available' : 'on leave'}`, before: { is_available: Boolean(u.is_available) }, after: { is_available: available } });
  ok(res, { is_available: available }, `${fullName(u.first_name, u.last_name)} is ${available ? 'available' : 'on leave'}.`);
});

// ------------------------------------------------------------------------------------------- performance & targets
async function agentStats(from, to, team) {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, r.name AS role, u.is_available,
            (SELECT COUNT(*) FROM lead_assignments la WHERE la.to_user_id = u.id AND la.created_at >= ? AND la.created_at < ?) AS assigned,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND l.first_contacted_at >= ? AND l.first_contacted_at < ?) AS contacted,
            (SELECT AVG(TIMESTAMPDIFF(MINUTE, l.created_at, l.first_contacted_at)) FROM leads l WHERE l.assigned_agent_id = u.id
               AND l.created_at >= ? AND l.created_at < ? AND l.first_contacted_at >= l.created_at) AS avg_response_min,
            (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.type = 'CALL' AND a.created_at >= ? AND a.created_at < ?) AS calls_logged,
            (SELECT COUNT(*) FROM call_logs c WHERE c.agent_user_id = u.id AND c.initiated_at >= ? AND c.initiated_at < ?) AS cloud_calls,
            (SELECT COUNT(*) FROM call_logs c WHERE c.agent_user_id = u.id AND c.initiated_at >= ? AND c.initiated_at < ? AND c.status = 'COMPLETED' AND c.duration_sec > 0) AS connected_calls,
            (SELECT COALESCE(SUM(c.duration_sec), 0) FROM call_logs c WHERE c.agent_user_id = u.id AND c.initiated_at >= ? AND c.initiated_at < ?) AS talk_sec,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status = 'COMPLETED'
               AND COALESCE(sv.completed_at, sv.scheduled_time) >= ? AND COALESCE(sv.completed_at, sv.scheduled_time) < ?) AS visits_done,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN ('MISSED', 'NO_SHOW')
               AND sv.scheduled_time >= ? AND sv.scheduled_time < ?) AS visits_missed,
            (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN ${LIVE}
               AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS bookings,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN ${LIVE}
               AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS revenue,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN}) AS open_leads,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(AGENT_ROLES)}) ${team ? 'AND u.id IN (?)' : ''}
      ORDER BY u.first_name`,
    [from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, ...(team ? [team] : [])]
  );
  return rows.map((r) => ({
    id: r.id, name: fullName(r.first_name, r.last_name), role: r.role, is_available: Boolean(r.is_available),
    assigned: num(r.assigned), contacted: num(r.contacted), avgResponseMin: r.avg_response_min == null ? null : Math.round(Number(r.avg_response_min)),
    calls: num(r.calls_logged) + num(r.cloud_calls), cloudCalls: num(r.cloud_calls), connectedCalls: num(r.connected_calls), talkMinutes: Math.round(num(r.talk_sec) / 60),
    visitsDone: num(r.visits_done), visitsMissed: num(r.visits_missed), bookings: num(r.bookings), revenue: num(r.revenue),
    conversionPct: pct(r.bookings, r.assigned), openLeads: num(r.open_leads), overdue: num(r.overdue)
  }));
}

const performance = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 30);
  ok(res, { range: { from, to }, agents: await agentStats(from, to, await teamOf(req.user)) });
});

function periodRange(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  const now = new Date();
  const y = m ? Number(m[1]) : now.getFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getMonth();
  const from = new Date(y, mo, 1);
  const to = new Date(y, mo + 1, 1);
  return { period: `${y}-${String(mo + 1).padStart(2, '0')}`, from, to };
}

const getTargets = wrap(async (req, res) => {
  const { period, from, to } = periodRange(req.query.period);
  const t = await teamOf(req.user);
  const stats = await agentStats(from, to, t);
  const [targets] = await pool.query('SELECT * FROM sales_targets WHERE period = ?', [period]);
  const byScope = Object.fromEntries(targets.map((x) => [x.scope_key, x]));
  const rows = stats.map((s) => ({ ...s, target: byScope[s.id] || null }));
  const company = {
    target: byScope.COMPANY || null,
    bookings: stats.reduce((a, s) => a + s.bookings, 0),
    revenue: stats.reduce((a, s) => a + s.revenue, 0),
    visitsDone: stats.reduce((a, s) => a + s.visitsDone, 0),
    calls: stats.reduce((a, s) => a + s.calls, 0)
  };
  ok(res, { period, agents: rows, company });
});

const setTargets = wrap(async (req, res) => {
  const { period } = periodRange(req.body && req.body.period);
  const list = Array.isArray(req.body && req.body.targets) ? req.body.targets : [];
  const t = await teamOf(req.user);
  let saved = 0;
  for (const x of list) {
    const scope = x.user_id || 'COMPANY';
    if (scope === 'COMPANY' && req.user.role === 'ADMIN') throw httpError(403, 'Only the sales head or owner sets the company target.');
    if (t && scope !== 'COMPANY' && !t.includes(scope)) throw httpError(403, 'You can set targets for your own team only.');
    const vals = ['target_bookings', 'target_revenue', 'target_site_visits', 'target_calls'].map((k) => Math.max(0, Number(x[k]) || 0));
    const [[before]] = await pool.query('SELECT * FROM sales_targets WHERE scope_key = ? AND period = ?', [scope, period]);
    await pool.query(
      `INSERT INTO sales_targets (id, scope_key, user_id, period, target_bookings, target_revenue, target_site_visits, target_calls, set_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE target_bookings = VALUES(target_bookings), target_revenue = VALUES(target_revenue),
         target_site_visits = VALUES(target_site_visits), target_calls = VALUES(target_calls), set_by = VALUES(set_by)`,
      [crypto.randomUUID(), scope, scope === 'COMPANY' ? null : scope, period, ...vals, req.user.id]
    );
    await audit.record({ req, action: 'TARGET_SET', entityType: 'TARGET', entityId: `${scope}:${period}`, summary: `Targets for ${scope === 'COMPANY' ? 'the company' : 'agent'} in ${period}`, before: before ? { bookings: before.target_bookings, revenue: Number(before.target_revenue), visits: before.target_site_visits, calls: before.target_calls } : null, after: { bookings: vals[0], revenue: vals[1], visits: vals[2], calls: vals[3] } });
    saved++;
  }
  ok(res, { saved, period }, `Targets saved for ${period}.`);
});

// ------------------------------------------------------------------------------------------- reports
const projectSales = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 90);
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.city, p.status,
            (SELECT COUNT(*) FROM leads l WHERE l.preferred_project_id = p.id AND l.created_at >= ? AND l.created_at < ?) AS leads,
            (SELECT COUNT(*) FROM site_visits sv WHERE sv.project_id = p.id AND sv.status = 'COMPLETED' AND COALESCE(sv.completed_at, sv.scheduled_time) >= ? AND COALESCE(sv.completed_at, sv.scheduled_time) < ?) AS visits,
            (SELECT COUNT(*) FROM deals d JOIN units u ON u.id = d.unit_id WHERE u.project_id = p.id AND d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS bookings,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN units u ON u.id = d.unit_id WHERE u.project_id = p.id AND d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) >= ? AND COALESCE(d.approved_at, d.created_at) < ?) AS revenue,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'AVAILABLE') AS available,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status <> 'ARCHIVED') AS total_units,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status IN ('BOOKED', 'SOLD')) AS sold
       FROM projects p WHERE p.status <> 'ARCHIVED' ORDER BY revenue DESC, leads DESC`,
    [from, to, from, to, from, to, from, to]
  );
  ok(res, { range: { from, to }, projects: rows.map((r) => ({ ...r, leads: num(r.leads), visits: num(r.visits), bookings: num(r.bookings), revenue: num(r.revenue), available: num(r.available), total_units: num(r.total_units), sold: num(r.sold), conversionPct: pct(r.bookings, r.leads), soldPct: pct(r.sold, r.total_units) })) });
});

const conversion = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 90);
  const team = await teamOf(req.user);
  const tf = leadTeamFilter(team);
  const funnelSql = (groupBy) => `
    SELECT ${groupBy ? `${groupBy} AS grp,` : ''} COUNT(*) AS leads,
           SUM(l.first_contacted_at IS NOT NULL OR l.last_contacted_at IS NOT NULL) AS contacted,
           SUM(l.qualification_status = 'QUALIFIED') AS qualified,
           SUM(EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id)) AS visit_scheduled,
           SUM(EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status = 'COMPLETED')) AS visited,
           SUM(${BUCKET} IN ('NEGOTIATION', 'BOOKED') OR EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = l.id)) AS negotiation,
           SUM(${BUCKET} = 'BOOKED') AS booked,
           SUM(${BUCKET} = 'LOST') AS lost
      FROM leads l WHERE l.created_at >= ? AND l.created_at < ? AND ${tf.sql}
      ${groupBy ? `GROUP BY grp ORDER BY leads DESC` : ''}`;
  const shape = (r) => ({ leads: num(r.leads), contacted: num(r.contacted), qualified: num(r.qualified), visitScheduled: num(r.visit_scheduled), visited: num(r.visited), negotiation: num(r.negotiation), booked: num(r.booked), lost: num(r.lost), conversionPct: pct(r.booked, r.leads) });
  const [[total]] = await pool.query(funnelSql(null), [from, to, ...tf.params]);
  const [bySource] = await pool.query(funnelSql("COALESCE(NULLIF(l.source, ''), 'OTHER')"), [from, to, ...tf.params]);
  const [byProject] = await pool.query(funnelSql("COALESCE((SELECT p.name FROM projects p WHERE p.id = l.preferred_project_id), 'No project')"), [from, to, ...tf.params]);
  const [lostReasons] = await pool.query(
    `SELECT COALESCE(NULLIF(l.lost_reason, ''), 'Not given') AS reason, COUNT(*) AS n FROM leads l
      WHERE ${BUCKET} = 'LOST' AND COALESCE(l.lost_at, l.updated_at) >= ? AND COALESCE(l.lost_at, l.updated_at) < ? AND ${tf.sql}
      GROUP BY reason ORDER BY n DESC LIMIT 15`,
    [from, to, ...tf.params]
  );
  ok(res, {
    range: { from, to },
    funnel: shape(total),
    bySource: bySource.map((r) => ({ source: r.grp, ...shape(r) })),
    byProject: byProject.map((r) => ({ project: r.grp, ...shape(r) })),
    lostReasons: lostReasons.map((r) => ({ reason: r.reason, count: num(r.n) }))
  });
});

// ------------------------------------------------------------------------------------------- visits & bookings monitoring
const listVisits = wrap(async (req, res) => {
  const q = req.query;
  const where = ['1 = 1'];
  const params = [];
  if (q.status) {
    const statuses = String(q.status).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    where.push('sv.status IN (?)'); params.push(statuses);
  } else if (q.view === 'open') where.push(`sv.status IN (${visits.VISIT_OPEN_SQL})`);
  if (q.agent_id) { where.push('sv.assigned_agent_id = ?'); params.push(q.agent_id); }
  if (q.project_id) { where.push('sv.project_id = ?'); params.push(q.project_id); }
  if (q.from) { where.push('sv.scheduled_time >= ?'); params.push(new Date(q.from)); }
  if (q.to) { where.push('sv.scheduled_time < ? + INTERVAL 1 DAY'); params.push(new Date(q.to)); }
  const [rows] = await pool.query(
    `SELECT sv.id, sv.lead_id, sv.status, sv.scheduled_time, sv.client_confirmed, sv.check_in_at, sv.check_in_distance_m, sv.completed_at,
            sv.client_feedback, sv.rating, sv.reschedule_count, sv.rejection_reason, sv.created_at,
            l.first_name, l.last_name, l.phone, p.name AS project_name, ag.first_name AS agent_first, ag.last_name AS agent_last,
            ow.first_name AS owner_first, ow.last_name AS owner_last, cp.firm_name AS partner_firm
       FROM site_visits sv JOIN projects p ON p.id = sv.project_id LEFT JOIN leads l ON l.id = sv.lead_id
       LEFT JOIN users ag ON ag.id = sv.assigned_agent_id LEFT JOIN users ow ON ow.id = l.assigned_agent_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE ${where.join(' AND ')}
      ORDER BY FIELD(sv.status, 'PENDING_APPROVAL', 'REQUESTED', 'ASSIGNED', 'RESCHEDULED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS') = 0, sv.scheduled_time ${q.view === 'past' ? 'DESC' : 'ASC'}
      LIMIT 500`,
    params
  );
  const [counts] = await pool.query('SELECT status, COUNT(*) AS n FROM site_visits GROUP BY status');
  ok(res, {
    counts: Object.fromEntries(counts.map((c) => [c.status, num(c.n)])),
    rows: rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), agent_name: fullName(r.agent_first, r.agent_last) || null, owner_name: fullName(r.owner_first, r.owner_last) || null }))
  });
});

const visitAction = wrap(async (req, res) => {
  const b = req.body || {};
  const result = await visits.transition(visits.visitActor(req.user), req.params.id, b.action, b, req);
  ok(res, result, result.message);
});

const visitHistory = wrap(async (req, res) => ok(res, await visits.history(req.params.id)));

const listBookings = wrap(async (req, res) => {
  const q = req.query;
  const where = ['1 = 1'];
  const params = [];
  if (q.status) { where.push('d.status IN (?)'); params.push(String(q.status).split(',').map((s) => s.trim().toUpperCase())); }
  if (q.project_id) { where.push('u.project_id = ?'); params.push(q.project_id); }
  if (q.from) { where.push('d.created_at >= ?'); params.push(new Date(q.from)); }
  if (q.to) { where.push('d.created_at < ? + INTERVAL 1 DAY'); params.push(new Date(q.to)); }
  const [rows] = await pool.query(
    `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.discount_amount, d.booking_token_amount, d.created_at, d.approved_at,
            d.rejection_reason, d.cancellation_reason, d.lead_id, u.unit_number, u.status AS unit_status, u.hold_expires_at, p.name AS project_name,
            c.first_name, c.last_name, c.phone, cb.first_name AS by_first, cb.last_name AS by_last, ag.first_name AS ag_first, ag.last_name AS ag_last,
            ap.first_name AS ap_first, ap.last_name AS ap_last, cp.firm_name AS partner_firm,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py WHERE py.deal_id = d.id AND py.verification_status = 'VERIFIED') AS collected,
            (SELECT a.id FROM approval_requests a WHERE a.entity_type = 'DEAL' AND a.entity_id = d.id AND a.status = 'PENDING' LIMIT 1) AS approval_id
       FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id
       LEFT JOIN customers c ON c.id = d.customer_id LEFT JOIN users cb ON cb.id = d.created_by
       LEFT JOIN leads l ON l.id = d.lead_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
       LEFT JOIN users ap ON ap.id = d.approved_by LEFT JOIN channel_partners cp ON cp.id = d.channel_partner_id
      WHERE ${where.join(' AND ')}
      ORDER BY d.status = 'PENDING_APPROVAL' DESC, d.created_at DESC LIMIT 500`,
    params
  );
  ok(res, rows.map((r) => ({
    ...r, client_name: fullName(r.first_name, r.last_name), created_by_name: fullName(r.by_first, r.by_last) || null,
    agent_name: fullName(r.ag_first, r.ag_last) || null, approved_by_name: fullName(r.ap_first, r.ap_last) || null,
    collected: num(r.collected), outstanding: Math.max(num(r.agreed_total_amount) - num(r.collected), 0)
  })));
});

const bookingAction = wrap(async (req, res) => {
  const b = req.body || {};
  let result;
  if (b.action === 'cancel') {
    if (!['SUPER_ADMIN', 'BUSINESS_OWNER'].includes(req.user.role)) throw httpError(403, 'Only the sales head or owner can cancel a booking.');
    result = await bookings.cancelBooking(req.params.id, req.user, b.reason, req);
  } else if (b.action === 'advance') {
    result = await bookings.advanceBooking(req.params.id, req.user, String(b.status || '').toUpperCase(), req);
  } else {
    throw httpError(400, 'Unknown booking action.');
  }
  ok(res, result, 'Booking updated.');
});

// ------------------------------------------------------------------------------------------- activity, calls, follow-ups
const activity = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 7);
  const t = await teamOf(req.user);
  const where = ['a.created_at >= ?', 'a.created_at < ?'];
  const params = [from, to];
  if (req.query.user_id) { where.push('a.user_id = ?'); params.push(req.query.user_id); }
  if (req.query.type) { where.push('a.type = ?'); params.push(String(req.query.type).toUpperCase()); }
  if (t) { where.push('(a.user_id IN (?) OR l.assigned_agent_id IN (?))'); params.push(t, t); }
  const [rows] = await pool.query(
    `SELECT a.id, a.type, a.outcome, a.note, a.created_at, a.lead_id, l.first_name AS lead_first, l.last_name AS lead_last,
            u.first_name, u.last_name, r.name AS role
       FROM lead_activities a JOIN leads l ON l.id = a.lead_id LEFT JOIN users u ON u.id = a.user_id LEFT JOIN roles r ON r.id = u.role_id
      WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT 400`,
    params
  );
  const [byType] = await pool.query(
    `SELECT a.type, COUNT(*) AS n FROM lead_activities a JOIN leads l ON l.id = a.lead_id WHERE ${where.join(' AND ')} GROUP BY a.type`,
    params
  );
  ok(res, {
    range: { from, to },
    counts: Object.fromEntries(byType.map((x) => [x.type, num(x.n)])),
    rows: rows.map((r) => ({ ...r, by: fullName(r.first_name, r.last_name) || 'System', client_name: fullName(r.lead_first, r.lead_last) }))
  });
});

const calls = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 7);
  const t = await teamOf(req.user);
  const where = ['c.initiated_at >= ?', 'c.initiated_at < ?'];
  const params = [from, to];
  if (req.query.agent_id) { where.push('c.agent_user_id = ?'); params.push(req.query.agent_id); }
  if (req.query.status) { where.push('c.status = ?'); params.push(String(req.query.status).toUpperCase()); }
  if (req.query.direction) { where.push('c.direction = ?'); params.push(String(req.query.direction).toUpperCase()); }
  if (t) { where.push('c.agent_user_id IN (?)'); params.push(t); }
  const [rows] = await pool.query(
    `SELECT c.*, u.first_name, u.last_name, l.first_name AS lead_first, l.last_name AS lead_last
       FROM call_logs c LEFT JOIN users u ON u.id = c.agent_user_id LEFT JOIN leads l ON l.id = c.lead_id
      WHERE ${where.join(' AND ')} ORDER BY c.initiated_at DESC LIMIT 500`,
    params
  );
  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(c.status = 'COMPLETED' AND c.duration_sec > 0) AS connected, SUM(c.status IN ('MISSED', 'BUSY', 'REJECTED', 'FAILED')) AS unsuccessful,
            SUM(c.direction = 'INBOUND') AS inbound, COALESCE(SUM(c.duration_sec), 0) AS talk_sec, SUM(c.outcome IS NULL AND c.status IN ('COMPLETED', 'MISSED', 'BUSY', 'REJECTED', 'FAILED')) AS outcome_pending
       FROM call_logs c WHERE ${where.join(' AND ')}`,
    params
  );
  const [logged] = await pool.query(
    `SELECT a.outcome, COUNT(*) AS n FROM lead_activities a ${t ? 'JOIN leads l ON l.id = a.lead_id' : ''}
      WHERE a.type = 'CALL' AND a.created_at >= ? AND a.created_at < ? ${req.query.agent_id ? 'AND a.user_id = ?' : ''} ${t ? 'AND a.user_id IN (?)' : ''}
      GROUP BY a.outcome`,
    [from, to, ...(req.query.agent_id ? [req.query.agent_id] : []), ...(t ? [t] : [])]
  );
  ok(res, {
    range: { from, to },
    summary: { total: num(summary.total), connected: num(summary.connected), unsuccessful: num(summary.unsuccessful), inbound: num(summary.inbound), talkMinutes: Math.round(num(summary.talk_sec) / 60), outcomePending: num(summary.outcome_pending) },
    loggedOutcomes: Object.fromEntries(logged.map((x) => [x.outcome || 'OTHER', num(x.n)])),
    rows: rows.map((r) => ({ ...r, agent_name: fullName(r.first_name, r.last_name) || null, client_name: fullName(r.lead_first, r.lead_last) || null }))
  });
});

const followups = wrap(async (req, res) => {
  const scope = req.query.scope || 'overdue';
  const t = await teamOf(req.user);
  const tf = leadTeamFilter(t);
  const cond = {
    overdue: 'l.next_follow_up_at < NOW()',
    today: 'l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY',
    upcoming: 'l.next_follow_up_at >= CURDATE() + INTERVAL 1 DAY AND l.next_follow_up_at < CURDATE() + INTERVAL 8 DAY',
    none: `l.next_follow_up_at IS NULL AND NOT EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status IN (${visits.VISIT_OPEN_SQL}))`
  }[scope] || 'l.next_follow_up_at < NOW()';
  const where = [OPEN, cond, tf.sql];
  const params = [...tf.params];
  if (req.query.agent_id) { where.push('l.assigned_agent_id = ?'); params.push(req.query.agent_id); }
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.phone, l.stage, ${BUCKET} AS bucket, l.priority, l.temperature, l.next_follow_up_at, l.last_contacted_at,
            ag.first_name AS ag_first, ag.last_name AS ag_last, p.name AS project_name,
            TIMESTAMPDIFF(HOUR, l.next_follow_up_at, NOW()) AS hours_overdue
       FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id LEFT JOIN projects p ON p.id = l.preferred_project_id
      WHERE ${where.join(' AND ')} ORDER BY l.next_follow_up_at ASC LIMIT 500`,
    params
  );
  const [byAgent] = await pool.query(
    `SELECT l.assigned_agent_id AS id, ag.first_name, ag.last_name, COUNT(*) AS n FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id
      WHERE ${OPEN} AND l.next_follow_up_at < NOW() AND ${tf.sql} GROUP BY l.assigned_agent_id, ag.first_name, ag.last_name ORDER BY n DESC`,
    tf.params
  );
  ok(res, {
    scope,
    overdueByAgent: byAgent.map((a) => ({ id: a.id, name: fullName(a.first_name, a.last_name) || 'Unassigned', overdue: num(a.n) })),
    rows: rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), agent_name: fullName(r.ag_first, r.ag_last) || null }))
  });
});

const members = wrap(async (req, res) => {
  const t = await teamOf(req.user);
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.is_available, r.name AS role,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN}) AS open_leads
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(SALES_ROLES)}) ${t ? 'AND u.id IN (?)' : ''}
      ORDER BY r.name = 'ADMIN', u.first_name`,
    t ? [t] : []
  );
  ok(res, rows.map((r) => ({ id: r.id, name: fullName(r.first_name, r.last_name), role: r.role, is_available: Boolean(r.is_available), open_leads: num(r.open_leads) })));
});

module.exports = {
  dashboard, listLeads, getLead, assignLeads, importLeads, bookLead, scheduleVisit,
  team, setAvailability, performance, getTargets, setTargets, projectSales, conversion,
  listVisits, visitAction, visitHistory, listBookings, bookingAction, activity, calls, followups, members,
  teamOf, agentStats, can
};
