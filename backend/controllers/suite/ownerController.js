/**
 * Business owner / CEO portal — the whole company on one page, every number computed from live
 * records (no stored or estimated metrics). Revenue = confirmed bookings in the period;
 * collections = finance-verified payments in the period; outstanding = booked value not yet collected.
 */
const { wrap, ok, httpError, dateRange, num, pct, fullName, pool } = require('./common');
const finance = require('../../services/financeService');
const { bucketSql, OPEN_STAGE_SQL } = require('../../services/salesWorkspace');
const { ROLE_INFO } = require('../../services/permissions');

const LIVE = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const BUCKET = bucketSql('l.stage');
const OPEN = OPEN_STAGE_SQL('l.stage');
const BOOKED_AT = 'COALESCE(d.approved_at, d.created_at)';
const change = (now, before) => (num(before) ? Math.round(((num(now) - num(before)) / num(before)) * 1000) / 10 : null);

const dashboard = wrap(async (req, res) => {
  const { from, to, prevFrom, prevTo } = dateRange(req.query, 30);
  const period = async (a, b) => {
    const [[r]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM deals d WHERE d.status IN ${LIVE} AND ${BOOKED_AT} >= ? AND ${BOOKED_AT} < ?) AS bookings,
         (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND ${BOOKED_AT} >= ? AND ${BOOKED_AT} < ?) AS revenue,
         (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p WHERE p.verification_status = 'VERIFIED' AND p.payment_date >= ? AND p.payment_date < ?) AS collections,
         (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ? AND l.created_at < ?) AS leads,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.status = 'COMPLETED' AND COALESCE(sv.completed_at, sv.scheduled_time) >= ? AND COALESCE(sv.completed_at, sv.scheduled_time) < ?) AS visits,
         (SELECT COALESCE(SUM(s.amount), 0) FROM campaign_spend s WHERE s.spend_date >= ? AND s.spend_date < ?) AS marketing_spend,
         (SELECT COUNT(*) FROM deals d WHERE d.status = 'CANCELLED' AND d.cancelled_at >= ? AND d.cancelled_at < ?) AS cancellations`,
      [a, b, a, b, a, b, a, b, a, b, a, b, a, b]
    );
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, num(v)]));
  };
  const now = await period(from, to);
  const before = await period(prevFrom, prevTo);
  const fin = await finance.overview();

  const [inventory] = await pool.query(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(base_price + COALESCE(plc_charges, 0)), 0) AS value FROM units GROUP BY status`
  );
  const inv = Object.fromEntries(inventory.map((r) => [r.status, { units: num(r.n), value: num(r.value) }]));

  const [trend] = await pool.query(
    `SELECT m.month,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND DATE_FORMAT(${BOOKED_AT}, '%Y-%m') = m.month) AS revenue,
            (SELECT COUNT(*) FROM deals d WHERE d.status IN ${LIVE} AND DATE_FORMAT(${BOOKED_AT}, '%Y-%m') = m.month) AS bookings,
            (SELECT COALESCE(SUM(p.amount_received), 0) FROM payments p WHERE p.verification_status = 'VERIFIED' AND DATE_FORMAT(p.payment_date, '%Y-%m') = m.month) AS collections,
            (SELECT COUNT(*) FROM leads l WHERE DATE_FORMAT(l.created_at, '%Y-%m') = m.month) AS leads
       FROM (SELECT DATE_FORMAT(CURDATE() - INTERVAL n MONTH, '%Y-%m') AS month FROM
              (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
               UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11) x) m
      ORDER BY m.month`
  );

  const [projects] = await pool.query(
    `SELECT p.id, p.name, p.city, p.status,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status <> 'ARCHIVED') AS units,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'AVAILABLE') AS available,
            (SELECT COUNT(*) FROM deals d JOIN units u ON u.id = d.unit_id WHERE u.project_id = p.id AND d.status IN ${LIVE} AND ${BOOKED_AT} >= ? AND ${BOOKED_AT} < ?) AS bookings,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN units u ON u.id = d.unit_id WHERE u.project_id = p.id AND d.status IN ${LIVE} AND ${BOOKED_AT} >= ? AND ${BOOKED_AT} < ?) AS revenue,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN units u ON u.id = d.unit_id WHERE u.project_id = p.id AND d.status IN ${LIVE}) AS booked_total,
            (SELECT COALESCE(SUM(py.amount_received), 0) FROM payments py JOIN deals d ON d.id = py.deal_id JOIN units u ON u.id = d.unit_id
              WHERE u.project_id = p.id AND py.verification_status = 'VERIFIED' AND d.status IN ${LIVE}) AS collected_total,
            (SELECT COUNT(*) FROM leads l WHERE l.preferred_project_id = p.id AND l.created_at >= ? AND l.created_at < ?) AS leads
       FROM projects p WHERE p.status <> 'ARCHIVED' ORDER BY revenue DESC, booked_total DESC`,
    [from, to, from, to, from, to]
  );

  const [[dept]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN}) AS open_leads,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue_followups,
       (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL) AS untouched_leads,
       (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS')) AS open_tickets,
       (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.category = 'COMPLAINT') AS open_complaints,
       (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.due_at < NOW()) AS sla_breached,
       (SELECT AVG(t.feedback_rating) FROM support_tickets t WHERE t.feedback_rating IS NOT NULL) AS csat,
       (SELECT COUNT(*) FROM customers c WHERE c.onboarding_status = 'IN_PROGRESS') AS onboarding,
       (SELECT COUNT(*) FROM campaigns c WHERE c.status = 'ACTIVE') AS active_campaigns,
       (SELECT COUNT(*) FROM approval_requests a WHERE a.status = 'PENDING') AS pending_approvals,
       (SELECT COUNT(*) FROM escalations e WHERE e.status IN ('OPEN', 'ACKNOWLEDGED') AND e.severity IN ('HIGH', 'CRITICAL')) AS critical_escalations,
       (SELECT COUNT(*) FROM escalations e WHERE e.status IN ('OPEN', 'ACKNOWLEDGED')) AS open_escalations`
  );

  // Alerts: what needs the owner's attention right now
  const alerts = [];
  if (num(dept.critical_escalations)) alerts.push({ level: 'critical', title: `${dept.critical_escalations} high-priority escalation(s) open`, link: 'escalations' });
  if (fin.overdueAmount > 0) alerts.push({ level: 'warning', title: `₹${Math.round(fin.overdueAmount).toLocaleString('en-IN')} of payments overdue (${fin.overdueCount} instalment${fin.overdueCount === 1 ? '' : 's'})`, link: 'finance-overdue' });
  if (fin.pendingVerification) alerts.push({ level: 'info', title: `${fin.pendingVerification} payment(s) waiting for finance verification`, link: 'finance-payments' });
  if (num(dept.pending_approvals)) alerts.push({ level: 'warning', title: `${dept.pending_approvals} approval(s) pending`, link: 'approvals' });
  if (num(dept.untouched_leads)) alerts.push({ level: 'warning', title: `${dept.untouched_leads} open lead(s) never contacted`, link: 'sales-leads-untouched' });
  if (num(dept.sla_breached)) alerts.push({ level: 'warning', title: `${dept.sla_breached} customer request(s) past their SLA`, link: 'crm-tickets' });
  if (now.cancellations) alerts.push({ level: 'info', title: `${now.cancellations} booking cancellation(s) in this period`, link: 'sales-bookings' });

  ok(res, {
    range: { from, to },
    kpis: {
      revenue: now.revenue, revenueChangePct: change(now.revenue, before.revenue),
      bookings: now.bookings, bookingsChangePct: change(now.bookings, before.bookings),
      collections: now.collections, collectionsChangePct: change(now.collections, before.collections),
      outstanding: fin.outstanding, overdueAmount: fin.overdueAmount,
      leads: now.leads, leadsChangePct: change(now.leads, before.leads), conversionPct: pct(now.bookings, now.leads),
      visits: now.visits, marketingSpend: now.marketing_spend, costPerBooking: now.bookings && now.marketing_spend ? Math.round(now.marketing_spend / now.bookings) : null,
      cancellations: now.cancellations
    },
    finance: fin,
    inventory: {
      byStatus: inv,
      availableValue: (inv.AVAILABLE || {}).value || 0,
      totalUnits: Object.entries(inv).filter(([s]) => s !== 'ARCHIVED').reduce((a, [, v]) => a + v.units, 0)
    },
    departments: {
      sales: { openLeads: num(dept.open_leads), overdueFollowups: num(dept.overdue_followups), untouchedLeads: num(dept.untouched_leads), bookings: now.bookings, visits: now.visits },
      finance: { collections: now.collections, pendingVerification: fin.pendingVerification, overdueAmount: fin.overdueAmount, openRefunds: fin.openRefunds },
      marketing: { spend: now.marketing_spend, activeCampaigns: num(dept.active_campaigns), leads: now.leads, costPerLead: now.leads && now.marketing_spend ? Math.round(now.marketing_spend / now.leads) : null },
      customerCare: { openTickets: num(dept.open_tickets), openComplaints: num(dept.open_complaints), slaBreached: num(dept.sla_breached), onboarding: num(dept.onboarding), csat: dept.csat == null ? null : Math.round(Number(dept.csat) * 10) / 10 },
      inventory: { available: (inv.AVAILABLE || {}).units || 0, reserved: (inv.HOLD || {}).units || 0, booked: (inv.BOOKED || {}).units || 0, sold: (inv.SOLD || {}).units || 0 }
    },
    approvalsPending: num(dept.pending_approvals),
    openEscalations: num(dept.open_escalations),
    alerts,
    trend: trend.map((t) => ({ month: t.month, revenue: num(t.revenue), bookings: num(t.bookings), collections: num(t.collections), leads: num(t.leads) })),
    projects: projects.map((p) => ({
      ...p, units: num(p.units), available: num(p.available), bookings: num(p.bookings), revenue: num(p.revenue), leads: num(p.leads),
      booked_total: num(p.booked_total), collected_total: num(p.collected_total), outstanding: Math.max(num(p.booked_total) - num(p.collected_total), 0),
      soldPct: pct(num(p.units) - num(p.available), num(p.units))
    }))
  });
});

/** The records behind a number on the dashboard. */
const drilldown = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 30);
  const metric = req.params.metric;
  const projectFilter = req.query.project_id ? 'AND u.project_id = ?' : '';
  const pf = req.query.project_id ? [req.query.project_id] : [];
  let rows;
  if (metric === 'revenue' || metric === 'bookings') {
    [rows] = await pool.query(
      `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.discount_amount, ${BOOKED_AT} AS booked_at, u.unit_number, p.name AS project_name,
              c.first_name, c.last_name, ag.first_name AS ag_first, ag.last_name AS ag_last, cp.firm_name AS partner_firm, l.source
         FROM deals d JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id LEFT JOIN customers c ON c.id = d.customer_id
         LEFT JOIN leads l ON l.id = d.lead_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id LEFT JOIN channel_partners cp ON cp.id = d.channel_partner_id
        WHERE d.status IN ${LIVE} AND ${BOOKED_AT} >= ? AND ${BOOKED_AT} < ? ${projectFilter} ORDER BY booked_at DESC LIMIT 1000`,
      [from, to, ...pf]
    );
    rows = rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), agent_name: fullName(r.ag_first, r.ag_last) || null }));
  } else if (metric === 'collections') {
    [rows] = await pool.query(
      `SELECT py.id, py.payment_number, py.receipt_number, py.amount_received, py.payment_date, py.payment_mode, d.deal_number, u.unit_number, p.name AS project_name, c.first_name, c.last_name
         FROM payments py JOIN deals d ON d.id = py.deal_id JOIN units u ON u.id = d.unit_id JOIN projects p ON p.id = u.project_id LEFT JOIN customers c ON c.id = d.customer_id
        WHERE py.verification_status = 'VERIFIED' AND py.payment_date >= ? AND py.payment_date < ? ${projectFilter} ORDER BY py.payment_date DESC LIMIT 1000`,
      [from, to, ...pf]
    );
    rows = rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name) }));
  } else if (metric === 'outstanding') {
    rows = await finance.outstandingByDeal({ overdueOnly: req.query.overdue === '1' });
  } else if (metric === 'leads') {
    [rows] = await pool.query(
      `SELECT l.id, l.first_name, l.last_name, l.source, l.stage, ${BUCKET} AS bucket, l.created_at, p.name AS project_name, ag.first_name AS ag_first, ag.last_name AS ag_last
         FROM leads l LEFT JOIN projects p ON p.id = l.preferred_project_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
        WHERE l.created_at >= ? AND l.created_at < ? ${req.query.project_id ? 'AND l.preferred_project_id = ?' : ''} ORDER BY l.created_at DESC LIMIT 2000`,
      [from, to, ...pf]
    );
    rows = rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), agent_name: fullName(r.ag_first, r.ag_last) || null }));
  } else {
    throw httpError(400, 'Unknown metric.');
  }
  ok(res, { metric, range: { from, to }, rows });
});

const employees = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.name AS role, u.job_level, u.status, COUNT(*) AS n, MAX(u.last_login) AS last_login,
            SUM(u.last_login > NOW() - INTERVAL 7 DAY) AS active_week
       FROM users u JOIN roles r ON r.id = u.role_id GROUP BY r.name, u.job_level, u.status`
  );
  const byRole = {};
  for (const r of rows) {
    const key = r.role;
    byRole[key] = byRole[key] || { role: key, label: (ROLE_INFO[key] || {}).label || key, department: (ROLE_INFO[key] || {}).department || 'Other', active: 0, inactive: 0, heads: 0, activeThisWeek: 0 };
    if (r.status === 'ACTIVE') byRole[key].active += num(r.n); else byRole[key].inactive += num(r.n);
    if (r.job_level === 'HEAD' && r.status === 'ACTIVE') byRole[key].heads += num(r.n);
    if (r.status === 'ACTIVE') byRole[key].activeThisWeek += num(r.active_week);
  }
  const [people] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.job_level, u.last_login, u.is_available, r.name AS role,
            (SELECT COUNT(*) FROM audit_events a WHERE a.actor_user_id = u.id AND a.created_at > NOW() - INTERVAL 7 DAY) AS actions_week
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.status = 'ACTIVE' ORDER BY r.name, u.first_name`
  );
  ok(res, {
    byRole: Object.values(byRole),
    people: people.map((p) => ({ ...p, name: fullName(p.first_name, p.last_name), roleLabel: (ROLE_INFO[p.role] || {}).label || p.role, department: (ROLE_INFO[p.role] || {}).department || 'Other', actions_week: num(p.actions_week) }))
  });
});

module.exports = { dashboard, drilldown, employees };
