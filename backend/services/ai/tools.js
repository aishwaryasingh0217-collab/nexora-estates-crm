/**
 * The AI assistant's tools. Every tool runs real queries against the CRM, as the signed-in person:
 *   - a tool is offered to the model only if the person's role has its capability
 *   - each tool checks the capability again and limits records the same way the app does
 *     (agents: own leads; partners: own firm; executives: own customers)
 *   - read tools return data; ACTION tools never run here — they are prepared for the person to confirm
 * Results carry an optional table so the screen can show it and export it to Excel / PDF.
 */
const pool = require('../../config/db');
const { can } = require('../permissions');
const { leadScope } = require('../recordScope');
const { bucketSql, OPEN_STAGE_SQL, fullName } = require('../salesWorkspace');
const finance = require('../financeService');
const leadService = require('../leadService');
const timeline = require('../timelineService');

const BUCKET = bucketSql('l.stage');
const OPEN = OPEN_STAGE_SQL('l.stage');
const LIVE = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const MAX_ROWS = 25;
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function range(input, days = 30) {
  const to = input && input.to ? new Date(`${input.to}T23:59:59`) : new Date();
  const from = input && input.from ? new Date(`${input.from}T00:00:00`) : new Date(to.getTime() - days * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error('Dates must be YYYY-MM-DD.');
  return { from, to };
}

const DATE_RANGE = {
  from: { type: 'string', description: 'Start date YYYY-MM-DD (default: 30 days ago)' },
  to: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' }
};

/** Lead filter for the caller: managers see everything, agents/partners their own. */
function scopeFor(user) {
  if (can(user, 'leads.view.all')) return { sql: '1 = 1', params: [] };
  const s = leadScope(user, 'l');
  return s || { sql: '1 = 0', params: [] };
}

const TOOLS = [
  {
    name: 'search_leads',
    capability: null, // any role that has leads; scope applied inside
    description: 'Find leads (clients) the user is allowed to see. Filter by a name/phone search, a view, or a source. Returns up to 25 rows plus the total count.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, phone or email text to search for' },
        view: { type: 'string', enum: ['open', 'overdue', 'today', 'untouched', 'unassigned', 'hot', 'booked', 'lost', 'all'], description: 'Which leads (default open)' },
        source: { type: 'string', description: 'Lead source code, e.g. WEBSITE, FACEBOOK_ADS, WALK_IN, REFERRAL, CHANNEL_PARTNER' }
      },
      additionalProperties: false
    },
    async run(user, input) {
      const s = scopeFor(user);
      const views = {
        open: OPEN, all: '1 = 1', overdue: `${OPEN} AND l.next_follow_up_at < NOW()`,
        today: `${OPEN} AND l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY`,
        untouched: `${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL`, unassigned: `${OPEN} AND l.assigned_agent_id IS NULL`,
        hot: `${OPEN} AND (l.temperature = 'HOT' OR l.priority IN ('URGENT', 'HIGH'))`, booked: `${BUCKET} = 'BOOKED'`, lost: `${BUCKET} = 'LOST'`
      };
      const where = [views[input.view] || OPEN, s.sql];
      const params = [...s.params];
      if (input.query) { where.push("(CONCAT_WS(' ', l.first_name, l.last_name) LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)"); params.push(...Array(3).fill(`%${input.query}%`)); }
      if (input.source) { where.push('l.source = ?'); params.push(String(input.source).toUpperCase()); }
      const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM leads l WHERE ${where.join(' AND ')}`, params);
      const [rows] = await pool.query(
        `SELECT l.id, l.first_name, l.last_name, l.phone, l.source, ${BUCKET} AS bucket, l.priority, l.next_follow_up_at, p.name AS project, ag.first_name AS ag_first, ag.last_name AS ag_last
           FROM leads l LEFT JOIN projects p ON p.id = l.preferred_project_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
          WHERE ${where.join(' AND ')} ORDER BY l.next_follow_up_at IS NULL, l.next_follow_up_at ASC, l.created_at DESC LIMIT ${MAX_ROWS}`,
        params
      );
      return {
        total: Number(total),
        table: {
          title: `Leads (${input.view || 'open'})`,
          columns: ['Lead ID', 'Client', 'Phone', 'Source', 'Stage', 'Priority', 'Next follow-up', 'Project', 'Agent'],
          rows: rows.map((r) => [r.id, fullName(r.first_name, r.last_name), r.phone, r.source, r.bucket, r.priority || '', day(r.next_follow_up_at), r.project || '', fullName(r.ag_first, r.ag_last) || 'Unassigned'])
        }
      };
    }
  },
  {
    name: 'get_lead_details',
    capability: null,
    description: 'Full details and recent history (calls, visits, notes, stage changes, bookings) of one lead the user may see. Use the Lead ID from search_leads.',
    input_schema: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'], additionalProperties: false },
    async run(user, input) {
      const s = scopeFor(user);
      const [[l]] = await pool.query(
        `SELECT l.*, ${BUCKET} AS bucket, p.name AS project, ag.first_name AS ag_first, ag.last_name AS ag_last, cp.firm_name
           FROM leads l LEFT JOIN projects p ON p.id = l.preferred_project_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
           LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id WHERE l.id = ? AND ${s.sql}`,
        [input.lead_id, ...s.params]
      );
      if (!l) return { error: 'Lead not found or not visible to this user.' };
      const items = (await timeline.leadTimeline(l.id, { includePrivate: user.role !== 'CHANNEL_PARTNER' })).slice(0, 15);
      return {
        lead: {
          name: fullName(l.first_name, l.last_name), phone: l.phone, email: l.email, source: l.source, stage: l.stage, bucket: l.bucket, priority: l.priority,
          temperature: l.temperature, qualification: l.qualification_status, budget: [l.budget_min, l.budget_max].filter(Boolean).map(inr).join(' – ') || null,
          configuration: l.configuration, location: l.preferred_location, purpose: l.purpose, timeline: l.purchase_timeline, project: l.project,
          agent: fullName(l.ag_first, l.ag_last) || null, partner: l.firm_name, next_follow_up: day(l.next_follow_up_at), created: day(l.created_at),
          lost_reason: l.lost_reason
        },
        recent_history: items.map((i) => `${day(i.at)} · ${i.by || ''} · ${i.type}${i.outcome ? `/${i.outcome}` : ''}: ${i.text || ''}`)
      };
    }
  },
  {
    name: 'sales_summary',
    capability: 'reports.sales',
    description: 'Company sales numbers for a period: new leads, contact rate, pipeline by stage, site visits, bookings and booked value, overdue and untouched leads, leads by source.',
    input_schema: { type: 'object', properties: DATE_RANGE, additionalProperties: false },
    async run(user, input) {
      const { from, to } = range(input);
      const [[k]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM leads WHERE created_at >= ? AND created_at <= ?) AS new_leads,
                (SELECT COUNT(*) FROM leads WHERE created_at >= ? AND created_at <= ? AND first_contacted_at IS NOT NULL) AS contacted,
                (SELECT COUNT(*) FROM site_visits WHERE status = 'COMPLETED' AND COALESCE(completed_at, scheduled_time) BETWEEN ? AND ?) AS visits_done,
                (SELECT COUNT(*) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) BETWEEN ? AND ?) AS bookings,
                (SELECT COALESCE(SUM(agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) BETWEEN ? AND ?) AS booked_value,
                (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue,
                (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.first_contacted_at IS NULL AND l.last_contacted_at IS NULL) AS untouched,
                (SELECT COUNT(*) FROM deals WHERE status = 'PENDING_APPROVAL') AS awaiting_approval`,
        [from, to, from, to, from, to, from, to, from, to]
      );
      const [pipeline] = await pool.query(`SELECT ${BUCKET} AS stage, COUNT(*) AS n FROM leads l GROUP BY stage`);
      const [sources] = await pool.query(
        `SELECT COALESCE(l.source, 'OTHER') AS source, COUNT(*) AS leads, SUM(${BUCKET} = 'BOOKED') AS booked FROM leads l WHERE l.created_at BETWEEN ? AND ? GROUP BY source ORDER BY leads DESC`,
        [from, to]
      );
      return {
        period: `${from.toDateString()} – ${to.toDateString()}`,
        kpis: { ...Object.fromEntries(Object.entries(k).map(([a, b]) => [a, Number(b)])), booked_value: inr(k.booked_value) },
        pipeline: Object.fromEntries(pipeline.map((p) => [p.stage, Number(p.n)])),
        table: { title: 'Leads by source', columns: ['Source', 'Leads', 'Booked'], rows: sources.map((s) => [s.source, Number(s.leads), Number(s.booked)]) }
      };
    }
  },
  {
    name: 'team_performance',
    capability: 'reports.sales',
    description: 'Productivity of each sales agent for a period: leads assigned and contacted, calls, connected calls, talk time, site visits done/missed, bookings, revenue, conversion, response time, open and overdue leads.',
    input_schema: { type: 'object', properties: DATE_RANGE, additionalProperties: false },
    async run(user, input) {
      const { from, to } = range(input);
      const sales = require('../../controllers/suite/salesController');
      const rows = await sales.agentStats(from, to, await sales.teamOf(user));
      return {
        period: `${from.toDateString()} – ${to.toDateString()}`,
        table: {
          title: 'Team productivity',
          columns: ['Agent', 'Role', 'Assigned', 'Contacted', 'Calls', 'Connected', 'Talk (min)', 'Visits done', 'Missed visits', 'Bookings', 'Revenue', 'Conversion %', 'Avg first response (min)', 'Open', 'Overdue'],
          rows: rows.map((r) => [r.name, r.role, r.assigned, r.contacted, r.calls, r.connectedCalls, r.talkMinutes, r.visitsDone, r.visitsMissed, r.bookings, inr(r.revenue), r.conversionPct, r.avgResponseMin ?? '', r.openLeads, r.overdue])
        }
      };
    }
  },
  {
    name: 'follow_ups',
    capability: null,
    description: 'Follow-ups the user is responsible for (managers: whole team): overdue, due today, or upcoming in the next 7 days.',
    input_schema: { type: 'object', properties: { scope: { type: 'string', enum: ['overdue', 'today', 'upcoming'] } }, required: ['scope'], additionalProperties: false },
    async run(user, input) {
      const s = scopeFor(user);
      const cond = { overdue: 'l.next_follow_up_at < NOW()', today: 'l.next_follow_up_at >= CURDATE() AND l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY', upcoming: 'l.next_follow_up_at >= CURDATE() + INTERVAL 1 DAY AND l.next_follow_up_at < CURDATE() + INTERVAL 8 DAY' }[input.scope];
      const [rows] = await pool.query(
        `SELECT l.id, l.first_name, l.last_name, l.phone, ${BUCKET} AS bucket, l.next_follow_up_at, ag.first_name AS ag_first, ag.last_name AS ag_last
           FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id WHERE ${OPEN} AND ${cond} AND ${s.sql} ORDER BY l.next_follow_up_at LIMIT ${MAX_ROWS}`,
        s.params
      );
      return { table: { title: `Follow-ups (${input.scope})`, columns: ['Lead ID', 'Client', 'Phone', 'Stage', 'Due', 'Agent'], rows: rows.map((r) => [r.id, fullName(r.first_name, r.last_name), r.phone, r.bucket, day(r.next_follow_up_at), fullName(r.ag_first, r.ag_last) || '']) } };
    }
  },
  {
    name: 'inventory_search',
    capability: 'inventory.directory',
    description: 'Available units to sell, filtered by project name, city, unit type (1BHK, 2BHK, 3BHK, 4BHK, PENTHOUSE, PLOT, OFFICE, RETAIL) and price range in rupees.',
    input_schema: {
      type: 'object',
      properties: { project: { type: 'string' }, city: { type: 'string' }, unit_type: { type: 'string' }, min_price: { type: 'number' }, max_price: { type: 'number' } },
      additionalProperties: false
    },
    async run(user, input) {
      const where = ["u.status = 'AVAILABLE'", "p.status <> 'ARCHIVED'"];
      const params = [];
      if (user.role === 'CHANNEL_PARTNER') where.push('p.partner_visible = 1');
      if (input.project) { where.push('p.name LIKE ?'); params.push(`%${input.project}%`); }
      if (input.city) { where.push('p.city LIKE ?'); params.push(`%${input.city}%`); }
      if (input.unit_type) { where.push('u.unit_type = ?'); params.push(String(input.unit_type).toUpperCase().replace(/\s+/g, '')); }
      if (input.min_price) { where.push('u.base_price + COALESCE(u.plc_charges, 0) >= ?'); params.push(input.min_price); }
      if (input.max_price) { where.push('u.base_price + COALESCE(u.plc_charges, 0) <= ?'); params.push(input.max_price); }
      const [rows] = await pool.query(
        `SELECT p.name AS project, p.city, b.name AS tower, u.unit_number, u.unit_type, u.floor_number, u.super_area_sqft, u.facing, u.base_price + COALESCE(u.plc_charges, 0) AS price
           FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN buildings b ON b.id = u.building_id WHERE ${where.join(' AND ')} ORDER BY price LIMIT ${MAX_ROWS}`,
        params
      );
      return { table: { title: 'Available units', columns: ['Project', 'City', 'Tower', 'Unit', 'Type', 'Floor', 'Area (sq ft)', 'Facing', 'Price'], rows: rows.map((r) => [r.project, r.city, r.tower || '', r.unit_number, r.unit_type, r.floor_number, r.super_area_sqft || '', r.facing || '', inr(r.price)]) } };
    }
  },
  {
    name: 'inventory_overview',
    capability: 'inventory.view',
    description: 'Inventory by project: total, available, reserved, booked and sold units, unsold stock value, and how long available units have been unsold (ageing).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      const [rows] = await pool.query(
        `SELECT p.name, COUNT(u.id) AS total, SUM(u.status = 'AVAILABLE') AS available, SUM(u.status = 'HOLD') AS reserved, SUM(u.status = 'BOOKED') AS booked, SUM(u.status = 'SOLD') AS sold,
                COALESCE(SUM(CASE WHEN u.status = 'AVAILABLE' THEN u.base_price + COALESCE(u.plc_charges, 0) END), 0) AS unsold_value,
                AVG(CASE WHEN u.status = 'AVAILABLE' THEN DATEDIFF(CURDATE(), u.created_at) END) AS avg_age
           FROM projects p LEFT JOIN units u ON u.project_id = p.id WHERE p.status <> 'ARCHIVED' GROUP BY p.id ORDER BY p.name`
      );
      return { table: { title: 'Inventory by project', columns: ['Project', 'Units', 'Available', 'Reserved', 'Booked', 'Sold', 'Unsold value', 'Avg days unsold'], rows: rows.map((r) => [r.name, Number(r.total), Number(r.available || 0), Number(r.reserved || 0), Number(r.booked || 0), Number(r.sold || 0), inr(r.unsold_value), r.avg_age == null ? '' : Math.round(r.avg_age)]) } };
    }
  },
  {
    name: 'finance_summary',
    capability: 'finance.view',
    description: 'Collections and receivables: booked value, verified collections, outstanding, overdue amount, payments waiting for verification, refunds, commission due, monthly verified collections.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      const t = await finance.overview();
      const months = await finance.collectionsByMonth(6);
      return {
        totals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, /Amount|Value|collected|outstanding|refunded|commission/i.test(k) ? inr(v) : v])),
        table: { title: 'Verified collections by month', columns: ['Month', 'Collected', 'Payments'], rows: months.map((m) => [m.month, inr(m.collected), m.payments]) }
      };
    }
  },
  {
    name: 'overdue_payments',
    capability: 'finance.view',
    description: 'Payment instalments past their due date with the unpaid balance, customer and booking.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      const rows = (await finance.outstandingByDeal({ overdueOnly: true })).slice(0, MAX_ROWS);
      return { table: { title: 'Overdue payments', columns: ['Booking', 'Customer', 'Phone', 'Project', 'Unit', 'Overdue', 'Outstanding'], rows: rows.map((r) => [r.deal_number, r.client_name, r.phone, r.project_name, r.unit_number, inr(r.overdue), inr(r.outstanding)]) } };
    }
  },
  {
    name: 'marketing_summary',
    capability: 'marketing.view',
    description: 'Lead sources and campaigns for a period: leads, bookings, revenue, recorded spend, cost per lead, conversion and ROI.',
    input_schema: { type: 'object', properties: DATE_RANGE, additionalProperties: false },
    async run(user, input) {
      const { from, to } = range(input, 90);
      const [rows] = await pool.query(
        `SELECT c.name, c.code, c.budget,
                (SELECT COALESCE(SUM(s.amount), 0) FROM campaign_spend s WHERE s.campaign_id = c.id AND s.spend_date BETWEEN ? AND ?) AS spend,
                (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id AND l.created_at BETWEEN ? AND ?) AS leads,
                (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.campaign_id = c.id AND d.status IN ${LIVE}) AS bookings,
                (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.campaign_id = c.id AND d.status IN ${LIVE}) AS revenue
           FROM campaigns c ORDER BY c.created_at DESC LIMIT ${MAX_ROWS}`,
        [from, to, from, to]
      );
      return { period: `${from.toDateString()} – ${to.toDateString()}`, table: { title: 'Campaign results', columns: ['Campaign', 'Code', 'Budget', 'Spend', 'Leads', 'Cost per lead', 'Bookings', 'Revenue', 'ROI %'], rows: rows.map((r) => [r.name, r.code, inr(r.budget), inr(r.spend), Number(r.leads), Number(r.leads) && Number(r.spend) ? inr(Number(r.spend) / Number(r.leads)) : '', Number(r.bookings), inr(r.revenue), Number(r.spend) ? Math.round(((Number(r.revenue) - Number(r.spend)) / Number(r.spend)) * 100) : '']) } };
    }
  },
  {
    name: 'customer_care_summary',
    capability: 'crm.view',
    description: 'After-sales status: customers onboarding, documents pending, open complaints and service requests, requests past their SLA, average feedback rating.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    async run(user) {
      const own = user.role === 'CUSTOMER_RELATIONS' && user.jobLevel !== 'HEAD';
      const [[s]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM customers c WHERE c.onboarding_status = 'IN_PROGRESS' ${own ? 'AND c.relationship_manager_id = ?' : ''}) AS onboarding,
                (SELECT COUNT(*) FROM customer_documents d JOIN customers c ON c.id = d.customer_id WHERE d.status IN ('PENDING', 'SUBMITTED') ${own ? 'AND c.relationship_manager_id = ?' : ''}) AS documents_pending,
                (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.category = 'COMPLAINT' ${own ? 'AND t.assigned_to = ?' : ''}) AS open_complaints,
                (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS') ${own ? 'AND t.assigned_to = ?' : ''}) AS open_requests,
                (SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.due_at < NOW() ${own ? 'AND t.assigned_to = ?' : ''}) AS past_sla,
                (SELECT ROUND(AVG(t.feedback_rating), 1) FROM support_tickets t WHERE t.feedback_rating IS NOT NULL) AS avg_rating`,
        own ? Array(5).fill(user.id) : []
      );
      return { summary: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v == null ? null : Number(v)])) };
    }
  },
  {
    name: 'business_overview',
    capability: 'owner.dashboard',
    description: 'Owner-level company overview for a period: revenue (confirmed bookings), bookings, verified collections, outstanding and overdue receivables, leads and conversion, marketing spend, open approvals and escalations.',
    input_schema: { type: 'object', properties: DATE_RANGE, additionalProperties: false },
    async run(user, input) {
      const { from, to } = range(input);
      const [[k]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) BETWEEN ? AND ?) AS bookings,
                (SELECT COALESCE(SUM(agreed_total_amount), 0) FROM deals d WHERE d.status IN ${LIVE} AND COALESCE(d.approved_at, d.created_at) BETWEEN ? AND ?) AS revenue,
                (SELECT COALESCE(SUM(amount_received), 0) FROM payments WHERE verification_status = 'VERIFIED' AND payment_date BETWEEN ? AND ?) AS collections,
                (SELECT COUNT(*) FROM leads WHERE created_at BETWEEN ? AND ?) AS leads,
                (SELECT COALESCE(SUM(amount), 0) FROM campaign_spend WHERE spend_date BETWEEN ? AND ?) AS marketing_spend,
                (SELECT COUNT(*) FROM approval_requests WHERE status = 'PENDING') AS approvals_pending,
                (SELECT COUNT(*) FROM escalations WHERE status IN ('OPEN', 'ACKNOWLEDGED')) AS escalations_open`,
        [from, to, from, to, from, to, from, to, from, to]
      );
      const f = await finance.overview();
      return {
        period: `${from.toDateString()} – ${to.toDateString()}`,
        kpis: {
          revenue: inr(k.revenue), bookings: Number(k.bookings), verified_collections: inr(k.collections), outstanding: inr(f.outstanding), overdue: inr(f.overdueAmount),
          leads: Number(k.leads), conversion_pct: Number(k.leads) ? Math.round((Number(k.bookings) / Number(k.leads)) * 1000) / 10 : 0,
          marketing_spend: inr(k.marketing_spend), approvals_pending: Number(k.approvals_pending), escalations_open: Number(k.escalations_open)
        }
      };
    }
  },
  {
    name: 'check_duplicate',
    capability: 'leads.create',
    description: 'Check whether a phone number or email already belongs to a lead before adding a new one.',
    input_schema: { type: 'object', properties: { phone: { type: 'string' }, email: { type: 'string' } }, additionalProperties: false },
    async run(user, input) {
      const dups = await leadService.findDuplicates({ phone: input.phone, email: input.email });
      const full = can(user, 'leads.view.all');
      return { duplicates: dups.map((d) => (full ? { lead_id: d.id, name: fullName(d.first_name, d.last_name), stage: d.stage, agent: d.agent_name, partner: d.partner_firm } : { exists: true, owned_by: d.agent_name || 'the sales team' })) };
    }
  },
  {
    name: 'suggest_lead_distribution',
    capability: 'leads.assign',
    description: 'Propose which available agent should take each unassigned lead, based on their conversion record for that source and project, workload and response speed. Proposals only — to apply them use assign_leads.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    async run(user) {
      const sales = require('../../controllers/suite/salesController');
      const r = await leadService.suggestDistribution({ team: await sales.teamOf(user), limit: 50 });
      return { message: r.message, table: { title: 'Suggested assignments', columns: ['Lead ID', 'Lead', 'Source', 'Project', 'Suggested agent', 'Agent ID', 'Why'], rows: r.proposals.map((p) => [p.lead_id, p.lead_name, p.source, p.project || '', p.to_name, p.to_user_id, p.reasons.join('; ')]) } };
    }
  },
  // ------------------------------------------------------------------ actions (prepared, then confirmed by the person)
  {
    name: 'schedule_follow_up',
    capability: 'calls.make',
    action: true,
    description: 'ACTION (needs the user to confirm): set the next follow-up time for a lead, with an optional note.',
    input_schema: { type: 'object', properties: { lead_id: { type: 'string' }, when: { type: 'string', description: 'ISO date-time in India time, e.g. 2026-11-08T11:00' }, note: { type: 'string' } }, required: ['lead_id', 'when'], additionalProperties: false },
    async describe(user, input) {
      const l = await visibleLead(user, input.lead_id);
      const when = new Date(input.when);
      if (Number.isNaN(when.getTime())) throw new Error('The follow-up time is not a valid date.');
      return `Set the next follow-up for ${fullName(l.first_name, l.last_name)} to ${day(when)}${input.note ? ` — note: “${input.note}”` : ''}`;
    }
  },
  {
    name: 'add_lead_note',
    capability: 'calls.make',
    action: true,
    description: 'ACTION (needs the user to confirm): add a note to a lead’s history.',
    input_schema: { type: 'object', properties: { lead_id: { type: 'string' }, note: { type: 'string' } }, required: ['lead_id', 'note'], additionalProperties: false },
    async describe(user, input) {
      const l = await visibleLead(user, input.lead_id);
      return `Add a note to ${fullName(l.first_name, l.last_name)}: “${String(input.note).slice(0, 300)}”`;
    }
  },
  {
    name: 'assign_leads',
    capability: 'leads.assign',
    action: true,
    description: 'ACTION (needs the user to confirm): assign one or more leads to a sales agent (use agent IDs from suggest_lead_distribution or team_performance).',
    input_schema: { type: 'object', properties: { lead_ids: { type: 'array', items: { type: 'string' } }, to_user_id: { type: 'string' }, reason: { type: 'string' } }, required: ['lead_ids', 'to_user_id'], additionalProperties: false },
    async describe(user, input) {
      const agent = await leadService.loadAssignee(input.to_user_id);
      if (!agent) throw new Error('That agent is not an active sales team member.');
      if (!Array.isArray(input.lead_ids) || !input.lead_ids.length) throw new Error('No leads given.');
      return `Assign ${input.lead_ids.length} lead${input.lead_ids.length === 1 ? '' : 's'} to ${fullName(agent.first_name, agent.last_name)}${input.reason ? ` (${input.reason})` : ''}`;
    }
  }
];

async function visibleLead(user, leadId) {
  const s = scopeFor(user);
  const [[l]] = await pool.query(`SELECT l.* FROM leads l WHERE l.id = ? AND ${s.sql}`, [leadId, ...s.params]);
  if (!l) throw new Error('Lead not found or not visible to you.');
  return l;
}

/** The tools this person may use (definitions for the API, without our extra fields). */
function toolsFor(user) {
  return TOOLS.filter((t) => !t.capability || can(user, t.capability))
    .filter((t) => user.role !== 'CHANNEL_PARTNER' || ['search_leads', 'get_lead_details', 'follow_ups', 'inventory_search', 'check_duplicate'].includes(t.name))
    .map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

function find(name) {
  return TOOLS.find((t) => t.name === name) || null;
}

module.exports = { TOOLS, toolsFor, find, visibleLead };
