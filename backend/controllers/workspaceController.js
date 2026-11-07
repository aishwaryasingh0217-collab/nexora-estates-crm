/**
 * Sales Workspace API — one set of endpoints that serves three portals:
 *   agent   (INSIDE_SALES / OUTSIDE_SALES): their own leads, follow-ups, visits, bookings
 *   partner (CHANNEL_PARTNER):              their firm's clients, visit requests, earnings
 *   manager (ADMIN / SUPER_ADMIN):          everything + team board, assignment
 * Every query is scoped through leadScope(), so a portal can only ever see its own slice.
 */
const crypto = require('crypto');
const pool = require('../config/db');
const ws = require('../services/salesWorkspace');
const { visitIcsPath, feedIcsPath } = require('./icsController');
const push = require('../services/pushService');
const settings = require('../services/settingsService');
const visits = require('../services/visitService');
const bookings = require('../services/bookingService');
const leadService = require('../services/leadService');
const audit = require('../services/audit');

const {
  AGENT_ROLES, MANAGER_ROLES, PARTNER_ROLE, STAGE_BUCKETS, CP_PROTECTION_DAYS,
  bucketSql, OPEN_STAGE_SQL, bucketOf, sqlList, phoneKey, findLeadByPhone,
  tomorrowAt, hoursFromNow, pickLeadOwner, whenText, logActivity,
  notifyManagers, notifyPartner, notifyUser, fullName
} = ws;

const BUCKET = bucketSql();
const OPEN = OPEN_STAGE_SQL();
const PARTNER_VISIBLE_TYPES = ['STAGE', 'VISIT', 'ASSIGN', 'BOOKING', 'SYSTEM', 'CALL', 'WHATSAPP'];
// Visits on someone's calendar (assigned through in progress), and every visit that isn't closed yet
const { VISIT_UPCOMING, VISIT_UPCOMING_SQL, VISIT_OPEN_SQL } = visits;
const VISIT_SEEN_SQL = sqlList([...VISIT_UPCOMING, 'COMPLETED']);
// Bookings that count (not waiting for approval, rejected or cancelled)
const BOOKED_DEAL_SQL = sqlList(['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON']);

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, extra });
const fail = (res, status, message, extra = {}) => res.status(status).json({ status: 'error', message, ...extra });

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ---------------------------------------------------------------------------
// Who is asking? (attached by loadWorkspaceUser in the routes file)
// ---------------------------------------------------------------------------
const kindOf = (role) => {
  if (role === PARTNER_ROLE) return 'partner';
  if (AGENT_ROLES.includes(role)) return 'agent';
  if (MANAGER_ROLES.includes(role)) return 'manager';
  return null;
};

const loadWorkspaceUser = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone, u.email, u.username, u.is_available,
              u.channel_partner_id, r.name AS role,
              cp.firm_name, cp.tier, cp.commission_rate
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN channel_partners cp ON cp.id = u.channel_partner_id
        WHERE u.id = ?`,
      [req.user.id]
    );
    const u = rows[0];
    const kind = u && kindOf(u.role);
    if (!kind) return fail(res, 403, 'Your account does not have a workspace.');
    req.ws = {
      id: u.id,
      role: u.role,
      kind,
      name: fullName(u.first_name, u.last_name),
      firstName: u.first_name,
      phone: u.phone,
      email: u.email,
      isAvailable: !!u.is_available,
      partnerId: u.channel_partner_id,
      firm: u.channel_partner_id ? { id: u.channel_partner_id, name: u.firm_name, tier: u.tier, rate: Number(u.commission_rate) } : null
    };
    next();
  } catch (err) {
    next(err);
  }
};

const requireKind = (...kinds) => (req, res, next) =>
  kinds.includes(req.ws.kind) ? next() : fail(res, 403, 'Not available for your role.');

/** WHERE fragment restricting leads (alias l) to the caller's slice. */
function leadScope(me) {
  if (me.kind === 'agent') {
    return {
      sql: `(l.assigned_agent_id = ? OR EXISTS (SELECT 1 FROM site_visits svs WHERE svs.lead_id = l.id AND svs.assigned_agent_id = ?
              AND svs.status IN (${VISIT_SEEN_SQL})))`,
      params: [me.id, me.id]
    };
  }
  if (me.kind === 'partner') return me.partnerId ? { sql: 'l.channel_partner_id = ?', params: [me.partnerId] } : { sql: '1 = 0', params: [] };
  return { sql: '1 = 1', params: [] };
}

async function loadLeadInScope(me, leadId, conn = pool) {
  const scope = leadScope(me);
  const [rows] = await conn.query(
    `SELECT l.*, ${BUCKET} AS bucket FROM leads l WHERE l.id = ? AND ${scope.sql}`,
    [leadId, ...scope.params]
  );
  if (!rows[0]) throw httpError(404, 'Lead not found.');
  return rows[0];
}

const LEAD_LIST_COLUMNS = `
  l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.stage, ${BUCKET} AS bucket,
  l.temperature, l.next_follow_up_at, l.last_contacted_at, l.created_at, l.updated_at,
  l.budget_min, l.budget_max, l.preferred_project_id, l.assigned_agent_id, l.channel_partner_id,
  l.cp_protected_until,
  p.name AS project_name,
  ag.first_name AS agent_first_name, ag.last_name AS agent_last_name, ag.phone AS agent_phone,
  cp.firm_name AS partner_firm,
  (SELECT a.note FROM lead_activities a
    WHERE a.lead_id = l.id AND a.note IS NOT NULL AND a.type IN ('CALL','WHATSAPP','NOTE','VISIT')
    ORDER BY a.created_at DESC LIMIT 1) AS last_note,
  (SELECT MIN(sv.scheduled_time) FROM site_visits sv
    WHERE sv.lead_id = l.id AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= CURDATE()) AS next_visit_at`;

const LEAD_LIST_JOINS = `
  FROM leads l
  LEFT JOIN projects p ON p.id = l.preferred_project_id
  LEFT JOIN users ag ON ag.id = l.assigned_agent_id
  LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id`;

/** Partners see the client and the progress, not the sales team's private call notes. */
function shapeLeadForViewer(me, lead) {
  const out = { ...lead, agent_name: fullName(lead.agent_first_name, lead.agent_last_name) || null };
  delete out.agent_first_name;
  delete out.agent_last_name;
  if (me.kind === 'partner') {
    delete out.last_note;
    delete out.notes;
  }
  return out;
}

// ---------------------------------------------------------------------------
// GET /workspace/me
// ---------------------------------------------------------------------------
const getMe = async (req, res) => {
  const [company, pushDevices] = await Promise.all([settings.getSettings(), push.countSubscriptions(req.ws.id).catch(() => 0)]);
  res.json({
    status: 'success',
    data: {
      ...req.ws,
      company,
      pushDevices,
      calendarFeed: feedIcsPath(req.ws.id),
      config: {
        workStartHour: ws.WORK_START_HOUR,
        workEndHour: ws.WORK_END_HOUR,
        protectionDays: CP_PROTECTION_DAYS,
        buckets: Object.fromEntries(Object.entries(STAGE_BUCKETS).map(([k, b]) => [k, b.label]))
      }
    }
  });
};

// PATCH /workspace/me/availability  { is_available }
const setMyAvailability = async (req, res, next) => {
  try {
    const available = req.body.is_available ? 1 : 0;
    await pool.query('UPDATE users SET is_available = ? WHERE id = ?', [available, req.ws.id]);
    if (!available && req.ws.kind === 'agent') {
      await notifyManagers({
        type: 'INFO',
        title: `${req.ws.name} is on leave`,
        message: 'New leads will be routed to available teammates until they are back.',
        category: 'SYSTEM'
      });
    }
    res.json({ status: 'success', data: { is_available: !!available } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /workspace/today — the one screen an agent needs to plan the day
// ---------------------------------------------------------------------------
const getToday = async (req, res, next) => {
  try {
    const me = req.ws;
    if (me.kind === 'partner') return res.json({ status: 'success', data: await partnerToday(me) });

    // Agents and managers: leads assigned to *me* that need action today
    const [leads] = await pool.query(
      `SELECT ${LEAD_LIST_COLUMNS} ${LEAD_LIST_JOINS}
        WHERE l.assigned_agent_id = ? AND ${OPEN}
          AND ( (${BUCKET} = 'NEW' AND l.last_contacted_at IS NULL)
                OR l.next_follow_up_at < CURDATE() + INTERVAL 1 DAY )
        ORDER BY l.next_follow_up_at IS NULL, l.next_follow_up_at ASC, l.created_at ASC
        LIMIT 300`,
      [me.id]
    );

    const now = Date.now();
    const fresh = [];
    const overdue = [];
    const later = [];
    for (const raw of leads) {
      const lead = shapeLeadForViewer(me, raw);
      if (lead.bucket === 'NEW' && !lead.last_contacted_at) fresh.push(lead);
      else if (lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now) overdue.push(lead);
      else later.push(lead);
    }

    const [visits] = await pool.query(
      `SELECT sv.id, sv.lead_id, sv.scheduled_time, sv.status, sv.client_feedback,
              l.first_name, l.last_name, l.phone, cp.firm_name AS partner_firm,
              p.id AS project_id, p.name AS project_name, p.location, p.city
         FROM site_visits sv
         JOIN projects p ON p.id = sv.project_id
         LEFT JOIN leads l ON l.id = sv.lead_id
         LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
        WHERE sv.assigned_agent_id = ? AND sv.scheduled_time >= CURDATE() AND sv.scheduled_time < CURDATE() + INTERVAL 1 DAY
          AND sv.status IN (${VISIT_SEEN_SQL})
        ORDER BY sv.scheduled_time ASC`,
      [me.id]
    );

    const [[stats]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = ? AND a.created_at >= CURDATE()
             AND a.type IN ('CALL','WHATSAPP','VISIT','BOOKING')) AS done_today,
         (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = ? AND ${OPEN}) AS open_leads,
         (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id
           WHERE l.assigned_agent_id = ? AND d.status IN (${BOOKED_DEAL_SQL})
             AND d.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS bookings_month,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = ? AND sv.status = 'COMPLETED'
             AND sv.scheduled_time >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS visits_month`,
      [me.id, me.id, me.id, me.id]
    );

    res.json({
      status: 'success',
      data: {
        fresh,
        overdue,
        later,
        visits: visits.map((v) => ({ ...v, ics: visitIcsPath(v.id) })),
        stats: {
          doneToday: Number(stats.done_today),
          openLeads: Number(stats.open_leads),
          bookingsMonth: Number(stats.bookings_month),
          visitsMonth: Number(stats.visits_month),
          remaining: fresh.length + overdue.length + later.length + visits.filter((v) => VISIT_UPCOMING.includes(v.status)).length
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

async function partnerToday(me) {
  if (!me.partnerId) {
    return { stats: { activeClients: 0, upcomingVisits: 0, bookings: 0, pendingEarnings: 0 }, visits: [], updates: [], unlinked: true };
  }
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM leads l WHERE l.channel_partner_id = ? AND ${OPEN}) AS active_clients,
       (SELECT COUNT(*) FROM site_visits sv JOIN leads l ON l.id = sv.lead_id
         WHERE l.channel_partner_id = ? AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= NOW()) AS upcoming_visits,
       (SELECT COUNT(*) FROM deals d WHERE d.channel_partner_id = ? AND d.status IN (${BOOKED_DEAL_SQL})) AS bookings,
       (SELECT COALESCE(SUM(bc.total_commission - bc.paid_amount), 0) FROM broker_commissions bc WHERE bc.partner_id = ?) AS pending_earnings`,
    [me.partnerId, me.partnerId, me.partnerId, me.partnerId]
  );

  const [visits] = await pool.query(
    `SELECT sv.id, sv.lead_id, sv.scheduled_time, sv.status, l.first_name, l.last_name, l.phone,
            p.name AS project_name, p.location, p.city,
            ag.first_name AS agent_first_name, ag.last_name AS agent_last_name, ag.phone AS agent_phone
       FROM site_visits sv
       JOIN leads l ON l.id = sv.lead_id
       JOIN projects p ON p.id = sv.project_id
       LEFT JOIN users ag ON ag.id = sv.assigned_agent_id
      WHERE l.channel_partner_id = ? AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= CURDATE()
      ORDER BY sv.scheduled_time ASC
      LIMIT 20`,
    [me.partnerId]
  );

  const [updates] = await pool.query(
    `SELECT a.id, a.lead_id, a.type, a.outcome, a.created_at,
            IF(a.type IN ('CALL','WHATSAPP') AND (u.channel_partner_id IS NULL OR u.channel_partner_id <> ?), NULL, a.note) AS note,
            l.first_name, l.last_name, u.first_name AS by_first_name, u.last_name AS by_last_name
       FROM lead_activities a
       JOIN leads l ON l.id = a.lead_id
       LEFT JOIN users u ON u.id = a.user_id
      WHERE l.channel_partner_id = ? AND (a.type IN (${sqlList(PARTNER_VISIBLE_TYPES)}) OR u.channel_partner_id = ?)
      ORDER BY a.created_at DESC
      LIMIT 25`,
    [me.partnerId, me.partnerId, me.partnerId]
  );

  return {
    stats: {
      activeClients: Number(stats.active_clients),
      upcomingVisits: Number(stats.upcoming_visits),
      bookings: Number(stats.bookings),
      pendingEarnings: Number(stats.pending_earnings)
    },
    visits: visits.map((v) => ({ ...v, agent_name: fullName(v.agent_first_name, v.agent_last_name) || null, ics: visitIcsPath(v.id) })),
    updates: updates.map((u) => ({ ...u, by_name: fullName(u.by_first_name, u.by_last_name) || 'System' }))
  };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
// GET /workspace/leads?bucket=&q=&agent_id=&view=unassigned|overdue|stale
const listLeads = async (req, res, next) => {
  try {
    const me = req.ws;
    const scope = leadScope(me);
    const where = [scope.sql];
    const params = [...scope.params];
    const { bucket, q, agent_id: agentId, view } = req.query;

    if (bucket && STAGE_BUCKETS[bucket]) {
      where.push(`${BUCKET} = ?`);
      params.push(bucket);
    } else if (bucket === 'OPEN') {
      where.push(OPEN);
    }
    if (q) {
      const like = `%${String(q).trim()}%`;
      where.push(`(CONCAT_WS(' ', l.first_name, l.last_name) LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR p.name LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (me.kind === 'manager') {
      if (agentId) { where.push('l.assigned_agent_id = ?'); params.push(agentId); }
      if (view === 'unassigned') where.push(`l.assigned_agent_id IS NULL AND ${OPEN}`);
    }
    if (view === 'overdue') where.push(`${OPEN} AND l.next_follow_up_at < NOW()`);
    if (view === 'stale') {
      where.push(`${OPEN} AND l.next_follow_up_at IS NULL AND NOT EXISTS (
        SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= NOW())`);
    }

    const [rows] = await pool.query(
      `SELECT ${LEAD_LIST_COLUMNS} ${LEAD_LIST_JOINS}
        WHERE ${where.join(' AND ')}
        ORDER BY (${OPEN}) DESC, l.next_follow_up_at IS NULL, l.next_follow_up_at ASC, l.created_at DESC
        LIMIT 500`,
      params
    );

    const [counts] = await pool.query(
      `SELECT ${BUCKET} AS bucket, COUNT(*) AS n FROM leads l WHERE ${scope.sql} GROUP BY bucket`,
      scope.params
    );

    res.json({
      status: 'success',
      results: rows.length,
      counts: Object.fromEntries(counts.map((c) => [c.bucket, Number(c.n)])),
      data: rows.map((r) => shapeLeadForViewer(me, r))
    });
  } catch (err) {
    next(err);
  }
};

// GET /workspace/leads/:id
const getLead = async (req, res, next) => {
  try {
    const me = req.ws;
    await loadLeadInScope(me, req.params.id);

    const [[lead]] = await pool.query(
      `SELECT ${LEAD_LIST_COLUMNS}, l.notes, l.lost_reason, l.registered_by,
              cp.contact_person AS partner_contact, cp.phone AS partner_phone,
              rb.first_name AS reg_first_name, rb.last_name AS reg_last_name, rb.phone AS reg_phone
         ${LEAD_LIST_JOINS}
         LEFT JOIN users rb ON rb.id = l.registered_by
        WHERE l.id = ?`,
      [req.params.id]
    );

    const activityFilter = me.kind === 'partner'
      ? `AND (a.type IN (${sqlList(PARTNER_VISIBLE_TYPES)}) OR u.channel_partner_id = ${pool.escape(me.partnerId)})`
      : '';
    const [activities] = await pool.query(
      `SELECT a.id, a.type, a.outcome, a.note, a.created_at, a.user_id,
              u.first_name, u.last_name, u.channel_partner_id AS by_partner_id
         FROM lead_activities a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.lead_id = ? ${activityFilter}
        ORDER BY a.created_at DESC
        LIMIT 100`,
      [req.params.id]
    );

    const [visits] = await pool.query(
      `SELECT sv.id, sv.scheduled_time, sv.status, sv.client_feedback, sv.rating,
              p.id AS project_id, p.name AS project_name, p.location, p.city,
              ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
         FROM site_visits sv
         JOIN projects p ON p.id = sv.project_id
         LEFT JOIN users ag ON ag.id = sv.assigned_agent_id
        WHERE sv.lead_id = ?
        ORDER BY sv.scheduled_time DESC`,
      [req.params.id]
    );

    const [deals] = await pool.query(
      `SELECT d.id, d.deal_number, d.agreed_total_amount, d.booking_token_amount, d.status, d.created_at,
              un.unit_number, un.unit_type, p.name AS project_name
         FROM deals d
         JOIN units un ON un.id = d.unit_id
         JOIN projects p ON p.id = un.project_id
        WHERE d.lead_id = ?
        ORDER BY d.created_at DESC`,
      [req.params.id]
    );

    const shaped = shapeLeadForViewer(me, lead);
    shaped.registered_by_name = fullName(lead.reg_first_name, lead.reg_last_name) || null;
    shaped.registered_by_phone = lead.reg_phone || null;
    delete shaped.reg_first_name;
    delete shaped.reg_last_name;
    delete shaped.reg_phone;

    res.json({
      status: 'success',
      data: {
        ...shaped,
        activities: activities.map((a) => {
          // Partners never see the sales team's private call notes
          const hideNote = me.kind === 'partner' && ['CALL', 'WHATSAPP'].includes(a.type) && a.by_partner_id !== me.partnerId;
          return {
            id: a.id, type: a.type, outcome: a.outcome, created_at: a.created_at,
            note: hideNote ? null : a.note,
            by_name: fullName(a.first_name, a.last_name) || 'System',
            mine: a.user_id === me.id
          };
        }),
        visits: visits.map((v) => ({ ...v, agent_name: fullName(v.agent_first_name, v.agent_last_name) || null })),
        deals
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /workspace/leads — agent adds own lead · partner registers a client · manager adds & routes
const PURPOSES = ['SELF_USE', 'INVESTMENT', 'RENTAL_INCOME'];
const TIMELINES = ['IMMEDIATE', '3_MONTHS', '6_MONTHS', '12_MONTHS', 'EXPLORING'];
/** Customer requirements captured with a lead (all optional). */
function leadRequirements(b) {
  const pick = (v, list) => (list.includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : null);
  const text = (v, max) => (v ? String(v).trim().slice(0, max) || null : null);
  return {
    property_type: text(b.property_type, 30),
    configuration: text(b.configuration, 60),
    preferred_location: text(b.preferred_location, 150),
    purpose: pick(b.purpose, PURPOSES),
    purchase_timeline: pick(b.purchase_timeline, TIMELINES),
    loan_required: b.loan_required === undefined || b.loan_required === null || b.loan_required === '' ? null : (b.loan_required === true || b.loan_required === 'true' || b.loan_required === 1 || b.loan_required === '1' ? 1 : 0)
  };
}

/** Marketing attribution: an explicit campaign id, or the campaign whose UTM code matches. */
async function campaignFor(campaignId, utmCampaign) {
  if (campaignId) {
    const [[c]] = await pool.query('SELECT id FROM campaigns WHERE id = ?', [campaignId]);
    if (c) return c.id;
  }
  if (utmCampaign) {
    const [[c]] = await pool.query('SELECT id FROM campaigns WHERE utm_campaign = ? OR code = ? ORDER BY created_at DESC LIMIT 1', [utmCampaign, utmCampaign]);
    if (c) return c.id;
  }
  return null;
}

const createLead = async (req, res, next) => {
  try {
    const me = req.ws;
    const b = req.body || {};
    const firstName = String(b.first_name || '').trim();
    const lastName = String(b.last_name || '').trim() || null;
    const phone = String(b.phone || '').trim();
    const projectId = b.preferred_project_id || null;

    if (!firstName) return fail(res, 400, 'Client name is required.');
    if (phoneKey(phone).length < 10) return fail(res, 400, 'Enter a valid 10-digit mobile number.');
    if (me.kind === 'partner' && !me.partnerId) return fail(res, 403, 'Your login is not linked to a partner firm yet. Please contact the sales manager.');
    if (me.kind === 'partner' && !projectId) return fail(res, 400, 'Choose the project you are registering this client for.');
    if (projectId) {
      const [p] = await pool.query('SELECT id FROM projects WHERE id = ?', [projectId]);
      if (!p[0]) return fail(res, 400, 'Selected project does not exist.');
    }

    const clientName = fullName(firstName, lastName);
    const duplicate = await findLeadByPhone(phone);
    const protectedUntil = me.kind === 'partner' ? new Date(Date.now() + CP_PROTECTION_DAYS * 86400000) : null;

    if (duplicate) {
      if (me.kind === 'partner') {
        if (duplicate.channel_partner_id === me.partnerId) {
          return fail(res, 409, 'This client is already registered by your firm.', { code: 'ALREADY_YOURS', lead_id: duplicate.id });
        }
        const protectionActive = duplicate.cp_protected_until && new Date(duplicate.cp_protected_until) > new Date();
        const claimable = duplicate.bucket === 'LOST' && !protectionActive;
        if (!claimable) {
          await notifyManagers({
            type: 'WARNING',
            title: 'Duplicate registration attempt',
            message: `${me.firm.name} tried to register ${clientName} (${phone}), who is already an active client.`,
            leadId: duplicate.id,
            category: 'ESCALATION'
          });
          return fail(res, 409, 'This client is already registered with us. If you introduced them first, please raise it with the sales manager — they have been notified.', { code: 'ALREADY_REGISTERED' });
        }
        // A lost lead with no active protection can be re-introduced by a partner
        const agent = duplicate.assigned_agent_id ? { id: duplicate.assigned_agent_id } : await pickLeadOwner();
        await pool.query(
          `UPDATE leads SET channel_partner_id = ?, registered_by = ?, cp_protected_until = ?, stage = 'Fresh Lead',
                  lost_reason = NULL, preferred_project_id = ?, assigned_agent_id = ?, next_follow_up_at = NOW(), source = 'CHANNEL_PARTNER'
            WHERE id = ?`,
          [me.partnerId, me.id, protectedUntil, projectId, agent ? agent.id : null, duplicate.id]
        );
        await logActivity({ leadId: duplicate.id, userId: me.id, type: 'SYSTEM', outcome: 'REGISTERED', note: `Re-introduced by ${me.firm.name}${b.note ? ` — ${b.note}` : ''}` });
        await insertPartnerLock(me.partnerId, clientName, phone, projectId, protectedUntil);
        await notifyUser(agent && agent.id, { type: 'SUCCESS', title: `Partner client: ${clientName}`, message: `${me.firm.name} re-introduced this client. Coordinate with ${me.name} (${me.phone || 'no phone'}).`, leadId: duplicate.id, category: 'LEAD_ASSIGNED' });
        return res.status(201).json({ status: 'success', message: `Client registered and protected for ${CP_PROTECTION_DAYS} days.`, data: { id: duplicate.id, reclaimed: true } });
      }

      // Staff: tell them who owns it so they can coordinate instead of double-calling the client
      const [[owner]] = await pool.query(
        `SELECT ag.first_name, ag.last_name, cp.firm_name FROM leads l
           LEFT JOIN users ag ON ag.id = l.assigned_agent_id
           LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
          WHERE l.id = ?`,
        [duplicate.id]
      );
      const ownerName = fullName(owner.first_name, owner.last_name);
      const mine = me.kind === 'manager' || duplicate.assigned_agent_id === me.id;
      return fail(res, 409,
        `This number already exists${ownerName ? ` — assigned to ${ownerName}` : ' (unassigned)'}${owner.firm_name ? `, via ${owner.firm_name}` : ''}.`,
        { code: 'DUPLICATE', lead_id: mine ? duplicate.id : null });
    }

    // Decide the owner
    let assignedId = null;
    if (me.kind === 'agent') {
      assignedId = me.id;
    } else if (me.kind === 'manager') {
      assignedId = b.assigned_agent_id || (await pickLeadOwner())?.id || null;
    } else {
      assignedId = (await pickLeadOwner())?.id || null;
    }

    const leadId = crypto.randomUUID();
    const source = me.kind === 'partner' ? 'CHANNEL_PARTNER' : String(b.source || 'DIRECT_CALL').toUpperCase().slice(0, 100);
    const temperature = ['HOT', 'WARM', 'COLD'].includes(b.temperature) ? b.temperature : null;
    const followUp = parseDate(b.next_follow_up_at) || new Date();
    const req_ = leadRequirements(b);
    const campaignId = me.kind === 'partner' ? null : await campaignFor(b.campaign_id, b.utm_campaign);
    const priority = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(b.priority) ? b.priority
      : leadService.scorePriority({ temperature, budget_max: b.budget_max, budget_min: b.budget_min, source, created_at: new Date(), ...req_ });

    await pool.query(
      `INSERT INTO leads (id, first_name, last_name, email, phone, source, stage, budget_min, budget_max,
                          preferred_project_id, assigned_agent_id, notes, next_follow_up_at, temperature,
                          channel_partner_id, registered_by, cp_protected_until, priority, campaign_id,
                          property_type, configuration, preferred_location, purpose, purchase_timeline, loan_required)
       VALUES (?, ?, ?, ?, ?, ?, 'Fresh Lead', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [leadId, firstName, lastName, b.email || null, phone, source, b.budget_min || null, b.budget_max || null,
        projectId, assignedId, b.note || null, followUp, temperature,
        me.kind === 'partner' ? me.partnerId : null, me.id, protectedUntil, priority, campaignId,
        req_.property_type, req_.configuration, req_.preferred_location, req_.purpose, req_.purchase_timeline, req_.loan_required]
    );

    await logActivity({ leadId, userId: me.id, type: 'SYSTEM', outcome: 'CREATED', note: me.kind === 'partner' ? `Registered by ${me.firm.name}${b.note ? ` — ${b.note}` : ''}` : (b.note || null) });
    if (assignedId) {
      await pool.query(
        `INSERT INTO lead_assignments (id, lead_id, from_user_id, to_user_id, assigned_by, method, reason) VALUES (?, ?, NULL, ?, ?, ?, 'New lead')`,
        [crypto.randomUUID(), leadId, assignedId, me.id, me.kind === 'manager' && b.assigned_agent_id ? 'MANUAL' : me.kind === 'agent' ? 'MANUAL' : 'AUTO']
      );
    }
    await audit.record({
      req, action: 'LEAD_CREATED', entityType: 'LEAD', entityId: leadId,
      summary: `${fullName(firstName, lastName)} (${source})${me.kind === 'partner' ? ` registered by ${me.firm.name}` : ''}`,
      after: { first_name: firstName, last_name: lastName, phone, source, preferred_project_id: projectId, assigned_agent_id: assignedId, priority, campaign_id: campaignId }
    });

    let assigneeName = null;
    if (assignedId) {
      const [[assignee]] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [assignedId]);
      assigneeName = assignee ? fullName(assignee.first_name, assignee.last_name) : null;
      if (assignedId !== me.id) await logActivity({ leadId, type: 'ASSIGN', note: `Assigned to ${assigneeName}` });
    }

    if (me.kind === 'partner') {
      await insertPartnerLock(me.partnerId, clientName, phone, projectId, protectedUntil);
      if (assignedId) {
        await notifyUser(assignedId, {
          type: 'SUCCESS',
          title: `🤝 Partner client: ${clientName}`,
          message: `${me.firm.name} registered a client. Coordinate with ${me.name}${me.phone ? ` (${me.phone})` : ''} before calling.`,
          leadId,
          category: 'LEAD_ASSIGNED'
        });
      } else {
        await notifyManagers({ type: 'WARNING', title: `Unassigned partner client: ${clientName}`, message: `${me.firm.name} registered a client and no agent is available. Please assign.`, leadId, category: 'LEAD_NEW' });
      }
    } else if (assignedId && assignedId !== me.id) {
      await notifyUser(assignedId, { type: 'SUCCESS', title: `🔥 New lead: ${clientName}`, message: `Assigned by ${me.name}. Call ${phone}.`, leadId, category: 'LEAD_ASSIGNED' });
    }

    res.status(201).json({
      status: 'success',
      message: me.kind === 'partner'
        ? `Client registered and protected for ${CP_PROTECTION_DAYS} days${assigneeName ? `. Relationship manager: ${assigneeName}` : ''}.`
        : 'Lead added.',
      data: { id: leadId, assigned_to: assigneeName }
    });
  } catch (err) {
    next(err);
  }
};

async function insertPartnerLock(partnerId, clientName, phone, projectId, lockedUntil) {
  if (!projectId) return;
  await pool.query(
    `INSERT INTO cp_lead_locks (id, channel_partner_id, client_name, client_phone, project_id, status, locked_until)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE_LOCKED', ?)`,
    [crypto.randomUUID(), partnerId, clientName, phone, projectId, lockedUntil]
  );
}

// PATCH /workspace/leads/:id — edit details, temperature, follow-up, or move stage (agent/manager)
const updateLead = async (req, res, next) => {
  try {
    const me = req.ws;
    const lead = await loadLeadInScope(me, req.params.id);
    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

    for (const col of ['first_name', 'last_name', 'email', 'budget_min', 'budget_max']) {
      if (b[col] !== undefined) set(col, b[col] === '' ? null : b[col]);
    }
    if (b.phone !== undefined) {
      if (phoneKey(b.phone).length < 10) return fail(res, 400, 'Enter a valid 10-digit mobile number.');
      set('phone', String(b.phone).trim());
    }
    if (b.preferred_project_id !== undefined) set('preferred_project_id', b.preferred_project_id || null);
    if (b.temperature !== undefined) set('temperature', ['HOT', 'WARM', 'COLD'].includes(b.temperature) ? b.temperature : null);
    if (b.next_follow_up_at !== undefined) set('next_follow_up_at', parseDate(b.next_follow_up_at));
    if (me.kind !== 'partner') {
      // Requirements & qualification (what the client wants, and whether they're a real buyer)
      const reqs = leadRequirements(b);
      for (const col of ['property_type', 'configuration', 'preferred_location', 'purpose', 'purchase_timeline', 'loan_required']) {
        if (b[col] !== undefined) set(col, reqs[col]);
      }
      if (b.priority !== undefined) set('priority', ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(b.priority) ? b.priority : null);
      if (b.qualification_status !== undefined) {
        if (!['PENDING', 'QUALIFIED', 'NOT_QUALIFIED'].includes(b.qualification_status)) return fail(res, 400, 'Unknown qualification status.');
        set('qualification_status', b.qualification_status);
        set('qualified_at', b.qualification_status === 'PENDING' ? null : new Date());
      }
    }

    let stageNote = null;
    if (b.bucket && STAGE_BUCKETS[b.bucket] && b.bucket !== lead.bucket) {
      if (b.bucket === 'BOOKED') return fail(res, 400, 'Use "Mark booked" so the unit and deal are recorded.');
      if (b.bucket === 'LOST' && !b.lost_reason) return fail(res, 400, 'Please give a reason for losing this lead.');
      set('stage', STAGE_BUCKETS[b.bucket].stage);
      if (b.bucket === 'LOST') { set('lost_reason', String(b.lost_reason).slice(0, 255)); set('next_follow_up_at', null); set('lost_at', new Date()); }
      stageNote = `${STAGE_BUCKETS[lead.bucket].label} → ${STAGE_BUCKETS[b.bucket].label}${b.lost_reason ? ` (${b.lost_reason})` : ''}`;
    }

    if (sets.length === 0) return fail(res, 400, 'Nothing to update.');
    await pool.query(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, [...params, lead.id]);
    const changedCols = sets.map((x) => x.split(' = ')[0]);
    const after = Object.fromEntries(changedCols.map((c, i) => [c, params[i]]));
    const before = Object.fromEntries(changedCols.map((c) => [c, lead[c] === undefined ? null : lead[c]]));
    const d = audit.diff(before, after);
    if (b.qualification_status && b.qualification_status !== lead.qualification_status) {
      await logActivity({ leadId: lead.id, userId: me.id, type: 'QUALIFY', outcome: b.qualification_status, note: b.qualification_status === 'QUALIFIED' ? 'Qualified as a genuine buyer' : b.qualification_status === 'NOT_QUALIFIED' ? 'Marked not qualified' : 'Qualification reset' });
    }
    if (Object.keys(d.after).length) {
      await audit.record({ req, action: stageNote ? 'LEAD_STAGE_CHANGED' : 'LEAD_UPDATED', entityType: 'LEAD', entityId: lead.id, summary: `${fullName(lead.first_name, lead.last_name)}${stageNote ? `: ${stageNote}` : ' updated'}`, before: d.before, after: d.after });
    }
    if (stageNote) {
      await logActivity({ leadId: lead.id, userId: me.id, type: 'STAGE', outcome: b.bucket, note: stageNote });
      if (b.bucket === 'LOST') {
        await notifyPartner(lead.channel_partner_id, { type: 'WARNING', title: `Client closed as lost: ${fullName(lead.first_name, lead.last_name)}`, message: `Reason: ${b.lost_reason}`, leadId: lead.id, category: 'SYSTEM' });
      }
    }
    res.json({ status: 'success', message: 'Lead updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /workspace/leads/:id/activities — the "log & move on" button.
 * Each outcome sets a sensible next follow-up (inside working hours) so the agent never has to
 * remember who to call next — the Today list does.
 */
const OUTCOMES = {
  NO_ANSWER:      { type: 'CALL',     label: 'No answer',      next: () => hoursFromNow(3),  stageFromNew: 'Not Answered' },
  CALLBACK:       { type: 'CALL',     label: 'Call back',      next: () => hoursFromNow(2),  stageFromNew: 'Contacted' },
  INTERESTED:     { type: 'CALL',     label: 'Interested',     next: () => tomorrowAt(11),   stageFromNew: 'Contacted' },
  NEGOTIATING:    { type: 'CALL',     label: 'Negotiating',    next: () => tomorrowAt(11),   stage: 'In Negotiation' },
  NOT_INTERESTED: { type: 'CALL',     label: 'Not interested', next: () => null,             stage: 'Lost' },
  WHATSAPP_SENT:  { type: 'WHATSAPP', label: 'WhatsApp sent',  next: () => hoursFromNow(24), stageFromNew: 'Contacted' },
  NOTE:           { type: 'NOTE',     label: 'Note',           next: null }
};

const logLeadActivity = async (req, res, next) => {
  try {
    const me = req.ws;
    const lead = await loadLeadInScope(me, req.params.id);
    const b = req.body || {};
    const outcomeKey = b.outcome && OUTCOMES[b.outcome] ? b.outcome : 'NOTE';
    const outcome = OUTCOMES[outcomeKey];
    const note = b.note ? String(b.note).trim().slice(0, 2000) : null;

    if (me.kind === 'partner' && outcomeKey !== 'NOTE') return fail(res, 403, 'Partners can add notes for the sales team.');
    if (outcomeKey === 'NOTE' && !note) return fail(res, 400, 'Write a note first.');
    if (outcomeKey === 'NOT_INTERESTED' && !note && !b.lost_reason) return fail(res, 400, 'Add a short reason (e.g. budget, location, bought elsewhere).');

    const sets = [];
    const params = [];
    if (outcome.type === 'CALL' || outcome.type === 'WHATSAPP') sets.push('last_contacted_at = NOW()', 'first_contacted_at = COALESCE(first_contacted_at, NOW())');

    const explicitNext = parseDate(b.next_follow_up_at);
    if (outcome.next) {
      sets.push('next_follow_up_at = ?');
      params.push(outcomeKey === 'NOT_INTERESTED' ? null : explicitNext || outcome.next());
    } else if (explicitNext) {
      sets.push('next_follow_up_at = ?');
      params.push(explicitNext);
    }

    let newStage = null;
    if (outcome.stage) newStage = outcome.stage;
    else if (outcome.stageFromNew && lead.bucket === 'NEW') newStage = outcome.stageFromNew;
    if (newStage && bucketOf(newStage) !== lead.bucket) {
      sets.push('stage = ?');
      params.push(newStage);
    }
    if (outcomeKey === 'NOT_INTERESTED') { sets.push('lost_reason = ?'); params.push(String(b.lost_reason || note).slice(0, 255)); }
    if (['HOT', 'WARM', 'COLD'].includes(b.temperature)) { sets.push('temperature = ?'); params.push(b.temperature); }

    if (sets.length) await pool.query(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, [...params, lead.id]);
    await logActivity({ leadId: lead.id, userId: me.id, type: outcome.type, outcome: outcomeKey, note });

    const clientName = fullName(lead.first_name, lead.last_name);
    if (me.kind === 'partner') {
      await notifyUser(lead.assigned_agent_id, { type: 'INFO', title: `Note from ${me.firm.name} on ${clientName}`, message: note, leadId: lead.id, category: 'SYSTEM' });
    } else if (outcomeKey === 'NOT_INTERESTED') {
      await notifyPartner(lead.channel_partner_id, { type: 'WARNING', title: `Client not interested: ${clientName}`, message: `Reason: ${b.lost_reason || note}`, leadId: lead.id, category: 'SYSTEM' });
    }

    const [[updated]] = await pool.query('SELECT next_follow_up_at, stage FROM leads WHERE id = ?', [lead.id]);
    res.status(201).json({
      status: 'success',
      message: `${outcome.label} logged.`,
      data: { next_follow_up_at: updated.next_follow_up_at, stage: updated.stage, bucket: bucketOf(updated.stage) }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Site visits
// ---------------------------------------------------------------------------
const { assertAgentFree } = visits;

// POST /workspace/leads/:id/visits { project_id, scheduled_time, note, agent_id? }
// Telecallers and partners fix the visit; a free field agent conducts it. Managers may pick the agent.
const scheduleVisit = async (req, res, next) => {
  try {
    const me = req.ws;
    const lead = await loadLeadInScope(me, req.params.id);
    const b = req.body || {};
    const when = parseDate(b.scheduled_time);
    const projectId = b.project_id || lead.preferred_project_id;

    if (!when) return fail(res, 400, 'Pick a date and time for the visit.');
    if (!projectId) return fail(res, 400, 'Choose the project to visit.');
    if (lead.bucket === 'BOOKED' || lead.bucket === 'LOST') return fail(res, 400, 'This lead is closed.');

    const result = await visits.createVisit(me, lead, {
      projectId,
      when,
      agentId: me.kind === 'manager' ? b.agent_id || null : null,
      // Telecallers and partners fix the time with the client on the phone; a request without that is unconfirmed
      clientConfirmed: b.client_confirmed !== false,
      note: b.note || null,
      req
    });
    res.status(201).json({ status: 'success', message: result.message, data: { id: result.id, status: result.status, agent: result.agentName } });
  } catch (err) {
    next(err);
  }
};

// GET /workspace/visits?range=upcoming|past
const listVisits = async (req, res, next) => {
  try {
    const me = req.ws;
    const where = [];
    const params = [];
    if (me.kind === 'agent') { where.push('(sv.assigned_agent_id = ? OR l.assigned_agent_id = ?)'); params.push(me.id, me.id); }
    if (me.kind === 'partner') { where.push('l.channel_partner_id = ?'); params.push(me.partnerId || ''); }
    if (me.kind === 'manager' && req.query.agent_id) { where.push('(sv.assigned_agent_id = ? OR l.assigned_agent_id = ?)'); params.push(req.query.agent_id, req.query.agent_id); }

    const past = req.query.range === 'past';
    where.push(past
      ? `(sv.scheduled_time < CURDATE() OR sv.status NOT IN (${VISIT_OPEN_SQL})) AND sv.scheduled_time >= CURDATE() - INTERVAL 60 DAY`
      : `sv.status IN (${VISIT_OPEN_SQL}) AND sv.scheduled_time >= CURDATE()`);

    const [rows] = await pool.query(
      `SELECT sv.id, sv.lead_id, sv.scheduled_time, sv.status, sv.client_feedback, sv.rating,
              l.first_name, l.last_name, l.phone, l.temperature, cp.firm_name AS partner_firm,
              p.id AS project_id, p.name AS project_name, p.location, p.city,
              ag.first_name AS agent_first_name, ag.last_name AS agent_last_name, ag.phone AS agent_phone
         FROM site_visits sv
         JOIN projects p ON p.id = sv.project_id
         LEFT JOIN leads l ON l.id = sv.lead_id
         LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
         LEFT JOIN users ag ON ag.id = sv.assigned_agent_id
        WHERE ${where.join(' AND ')}
        ORDER BY sv.scheduled_time ${past ? 'DESC' : 'ASC'}
        LIMIT 200`,
      params
    );
    res.json({
      status: 'success',
      data: rows.map((v) => {
        const out = { ...v, agent_name: fullName(v.agent_first_name, v.agent_last_name) || null, ics: visitIcsPath(v.id) };
        delete out.agent_first_name;
        delete out.agent_last_name;
        if (me.kind === 'partner') delete out.client_feedback;
        return out;
      })
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /workspace/visits/:id { action: complete|no_show|cancel|reschedule, feedback, temperature, scheduled_time, next_follow_up_at }
const updateVisit = async (req, res, next) => {
  try {
    const b = req.body || {};
    const result = await visits.transition(req.ws, req.params.id, b.action, b, req);
    res.json({ status: 'success', message: result.message, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /workspace/leads/:id/book { unit_id, booking_token_amount, discount_amount }
const bookUnit = async (req, res, next) => {
  try {
    const me = req.ws;
    const lead = await loadLeadInScope(me, req.params.id);
    const b = req.body || {};
    const result = await bookings.initiateBooking(
      { id: me.id, name: me.name, role: me.role, jobLevel: req.user.jobLevel },
      { leadId: lead.id, unitId: b.unit_id, discountAmount: b.discount_amount, tokenAmount: b.booking_token_amount, notes: b.note || null, channel: 'WORKSPACE' },
      req
    );
    res.status(201).json({ status: 'success', message: result.message, data: result });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Inventory (all roles) — what can I sell today, and what do I send the client?
// ---------------------------------------------------------------------------
const listProjects = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.code, p.project_type, p.builder_developer, p.location, p.city, p.status,
              p.possession_date, p.rera_number, p.brochure_url, p.hero_image_url, p.total_units,
              COUNT(u.id) AS listed_units,
              COALESCE(SUM(u.status = 'AVAILABLE'), 0) AS available_units,
              MIN(CASE WHEN u.status = 'AVAILABLE' AND u.base_price > 0 THEN u.base_price END) AS min_price,
              MAX(CASE WHEN u.status = 'AVAILABLE' AND u.base_price > 0 THEN u.base_price END) AS max_price,
              GROUP_CONCAT(DISTINCT CASE WHEN u.status = 'AVAILABLE' THEN u.unit_type END ORDER BY u.unit_type SEPARATOR ', ') AS unit_types
         FROM projects p
         LEFT JOIN units u ON u.project_id = p.id
        WHERE p.status <> 'ARCHIVED'
        GROUP BY p.id
        ORDER BY available_units DESC, p.created_at DESC`
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    next(err);
  }
};

const listProjectUnits = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.unit_number, u.floor_number, u.unit_type, u.carpet_area_sqft, u.super_area_sqft,
              u.plot_area_sqft, u.facing, u.is_corner, u.base_price, u.plc_charges, u.status, b.name AS building_name
         FROM units u
         LEFT JOIN buildings b ON b.id = u.building_id
        WHERE u.project_id = ? AND u.status IN ('AVAILABLE', 'HOLD')
        ORDER BY u.status = 'AVAILABLE' DESC, b.name, u.floor_number, u.unit_number`,
      [req.params.id]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Manager: team board, assignment, fair distribution
// ---------------------------------------------------------------------------
const getTeam = async (req, res, next) => {
  try {
    const [agents] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone, u.is_available, u.last_login, r.name AS role,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN}) AS open_leads,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${BUCKET} = 'NEW' AND l.last_contacted_at IS NULL) AS untouched,
        (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status IN (${VISIT_SEEN_SQL})
            AND sv.scheduled_time >= CURDATE() AND sv.scheduled_time < CURDATE() + INTERVAL 1 DAY) AS visits_today,
        (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.created_at >= CURDATE()
            AND a.type IN ('CALL','WHATSAPP','VISIT','BOOKING')) AS actions_today,
        (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id
            AND d.status IN (${BOOKED_DEAL_SQL}) AND d.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS bookings_month
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(AGENT_ROLES)})
        ORDER BY u.first_name`
    );

    const [[summary]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id IS NULL AND ${OPEN}) AS unassigned,
         (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at < NOW()) AS overdue,
         (SELECT COUNT(*) FROM leads l WHERE ${OPEN} AND l.next_follow_up_at IS NULL AND NOT EXISTS (
             SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status IN (${VISIT_UPCOMING_SQL}) AND sv.scheduled_time >= NOW())) AS stale,
         (SELECT COUNT(*) FROM leads l WHERE l.created_at >= CURDATE()) AS new_today,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.status IN (${VISIT_SEEN_SQL})
             AND sv.scheduled_time >= CURDATE() AND sv.scheduled_time < CURDATE() + INTERVAL 1 DAY) AS visits_today,
         (SELECT COUNT(*) FROM deals d WHERE d.status IN (${BOOKED_DEAL_SQL}) AND d.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS bookings_month`
    );

    const [partners] = await pool.query(
      `SELECT cp.id, cp.firm_name, cp.contact_person, cp.phone, cp.tier,
              (SELECT COUNT(*) FROM leads l WHERE l.channel_partner_id = cp.id AND l.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS clients_month,
              (SELECT COUNT(*) FROM leads l WHERE l.channel_partner_id = cp.id AND ${OPEN}) AS active_clients,
              (SELECT COUNT(*) FROM deals d WHERE d.channel_partner_id = cp.id AND d.status IN (${BOOKED_DEAL_SQL})) AS bookings,
              (SELECT COUNT(*) FROM users u WHERE u.channel_partner_id = cp.id AND u.status = 'ACTIVE') AS logins
         FROM channel_partners cp
        WHERE cp.status = 'ACTIVE'
        ORDER BY clients_month DESC, active_clients DESC`
    );

    const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v]));
    res.json({
      status: 'success',
      data: {
        summary: num(summary),
        agents: agents.map((a) => ({ ...num(a), name: fullName(a.first_name, a.last_name), is_available: !!a.is_available })),
        partners: partners.map(num)
      }
    });
  } catch (err) {
    next(err);
  }
};

async function assignLeadTo(lead, agent, me, req = null, method = 'MANUAL', reason = null) {
  return leadService.assignLead(lead.id, agent.id, { by: { id: me.id, name: me.name, role: me.role }, method, reason, req });
}

// POST /workspace/leads/:id/assign { agent_id }
const assignLead = async (req, res, next) => {
  try {
    const lead = await loadLeadInScope(req.ws, req.params.id);
    const [[agent]] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN (${sqlList([...AGENT_ROLES, ...MANAGER_ROLES])})`,
      [req.body.agent_id]
    );
    if (!agent) return fail(res, 400, 'Choose an active team member.');
    if (agent.id === lead.assigned_agent_id) return res.json({ status: 'success', message: 'Already assigned.' });
    await assignLeadTo(lead, agent, req.ws, req, 'MANUAL', req.body.reason || null);
    res.json({ status: 'success', message: `Assigned to ${fullName(agent.first_name, agent.last_name)}.` });
  } catch (err) {
    next(err);
  }
};

// POST /workspace/leads/distribute — share every unassigned open lead fairly among available agents
const distributeLeads = async (req, res, next) => {
  try {
    const [leads] = await pool.query(
      `SELECT l.* FROM leads l WHERE l.assigned_agent_id IS NULL AND ${OPEN} ORDER BY l.created_at ASC LIMIT 200`
    );
    if (leads.length === 0) return res.json({ status: 'success', message: 'No unassigned leads.', data: { assigned: 0 } });

    const perAgent = {};
    for (const lead of leads) {
      const agent = await pickLeadOwner();
      if (!agent) break;
      const [[full]] = await pool.query('SELECT id, first_name, last_name, phone FROM users WHERE id = ?', [agent.id]);
      await assignLeadTo(lead, full, req.ws, req, 'AUTO', 'Fair distribution');
      const name = fullName(full.first_name, full.last_name);
      perAgent[name] = (perAgent[name] || 0) + 1;
    }
    const assigned = Object.values(perAgent).reduce((a, b) => a + b, 0);
    if (assigned === 0) return fail(res, 409, 'No agents are available right now (everyone is on leave or inactive).');
    res.json({
      status: 'success',
      message: `${assigned} lead${assigned === 1 ? '' : 's'} distributed: ${Object.entries(perAgent).map(([n, c]) => `${n} ${c}`).join(', ')}.`,
      data: { assigned, perAgent }
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /workspace/team/:id/availability { is_available } — manager marks someone on leave
const setAgentAvailability = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE users u JOIN roles r ON r.id = u.role_id SET u.is_available = ?
        WHERE u.id = ? AND r.name IN (${sqlList(AGENT_ROLES)})`,
      [req.body.is_available ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Agent not found.');
    res.json({ status: 'success', data: { is_available: !!req.body.is_available } });
  } catch (err) {
    next(err);
  }
};

// GET /workspace/team/members — lightweight list for "assign to" pickers
const listAssignees = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.is_available, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList([...AGENT_ROLES, 'ADMIN'])})
        ORDER BY r.name = 'ADMIN', u.first_name`
    );
    res.json({ status: 'success', data: rows.map((r) => ({ id: r.id, name: fullName(r.first_name, r.last_name), role: r.role, is_available: !!r.is_available })) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Partner earnings — total transparency on what's earned and what's been paid
// ---------------------------------------------------------------------------
const getEarnings = async (req, res, next) => {
  try {
    const me = req.ws;
    if (!me.partnerId) return res.json({ status: 'success', data: { commissions: [], payouts: [], totals: { earned: 0, paid: 0, pending: 0 }, firm: null } });

    const [commissions] = await pool.query(
      `SELECT bc.id, bc.deal_amount, bc.commission_rate, bc.total_commission, bc.paid_amount, bc.status, bc.created_at,
              d.deal_number, d.status AS deal_status, c.first_name, c.last_name,
              un.unit_number, un.unit_type, p.name AS project_name
         FROM broker_commissions bc
         JOIN deals d ON d.id = bc.deal_id
         LEFT JOIN customers c ON c.id = d.customer_id
         LEFT JOIN units un ON un.id = d.unit_id
         LEFT JOIN projects p ON p.id = un.project_id
        WHERE bc.partner_id = ?
        ORDER BY bc.created_at DESC`,
      [me.partnerId]
    );
    const [payouts] = await pool.query(
      `SELECT id, payout_amount, payment_mode, transaction_reference, payout_date, notes
         FROM broker_payout_records WHERE partner_id = ? ORDER BY payout_date DESC`,
      [me.partnerId]
    );
    const earned = commissions.reduce((s, c) => s + Number(c.total_commission), 0);
    const paid = commissions.reduce((s, c) => s + Number(c.paid_amount), 0);
    res.json({
      status: 'success',
      data: { commissions, payouts, totals: { earned, paid, pending: earned - paid }, firm: me.firm }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Calendar — visits + planned calls for a date window, scoped like everything else
// GET /workspace/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&agent_id=
// ---------------------------------------------------------------------------
const dayStart = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const getCalendar = async (req, res, next) => {
  try {
    const me = req.ws;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = dayStart(req.query.from) || today;
    let to = dayStart(req.query.to) || new Date(from.getTime() + 7 * 86400000);
    if (to <= from) to = new Date(from.getTime() + 86400000);
    if (to - from > 62 * 86400000) to = new Date(from.getTime() + 62 * 86400000);
    const agentId = me.kind === 'manager' ? req.query.agent_id || null : null;

    const vWhere = ['sv.scheduled_time >= ?', 'sv.scheduled_time < ?'];
    const vParams = [from, to];
    if (me.kind === 'agent') { vWhere.push('(sv.assigned_agent_id = ? OR l.assigned_agent_id = ?)'); vParams.push(me.id, me.id); }
    if (me.kind === 'partner') { vWhere.push('l.channel_partner_id = ?'); vParams.push(me.partnerId || ''); }
    if (agentId) { vWhere.push('(sv.assigned_agent_id = ? OR l.assigned_agent_id = ?)'); vParams.push(agentId, agentId); }

    const [visits] = await pool.query(
      `SELECT sv.id, sv.lead_id, sv.scheduled_time, sv.status, sv.assigned_agent_id,
              l.first_name, l.last_name, l.phone, l.temperature, cp.firm_name AS partner_firm,
              p.id AS project_id, p.name AS project_name, p.location, p.city,
              ag.first_name AS agent_first_name, ag.last_name AS agent_last_name, ag.phone AS agent_phone
         FROM site_visits sv
         JOIN projects p ON p.id = sv.project_id
         LEFT JOIN leads l ON l.id = sv.lead_id
         LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
         LEFT JOIN users ag ON ag.id = sv.assigned_agent_id
        WHERE ${vWhere.join(' AND ')}
        ORDER BY sv.scheduled_time ASC
        LIMIT 500`,
      vParams
    );

    let followups = [];
    if (me.kind !== 'partner') {
      const fWhere = [OPEN, 'l.next_follow_up_at >= ?', 'l.next_follow_up_at < ?'];
      const fParams = [from, to];
      if (me.kind === 'agent') { fWhere.push('l.assigned_agent_id = ?'); fParams.push(me.id); }
      if (agentId) { fWhere.push('l.assigned_agent_id = ?'); fParams.push(agentId); }
      [followups] = await pool.query(
        `SELECT l.id, l.first_name, l.last_name, l.phone, l.temperature, l.next_follow_up_at, ${BUCKET} AS bucket,
                p.name AS project_name, ag.first_name AS agent_first_name, ag.last_name AS agent_last_name
           FROM leads l
           LEFT JOIN projects p ON p.id = l.preferred_project_id
           LEFT JOIN users ag ON ag.id = l.assigned_agent_id
          WHERE ${fWhere.join(' AND ')}
          ORDER BY l.next_follow_up_at ASC
          LIMIT 500`,
        fParams
      );
    }

    const withAgent = (r) => {
      const out = { ...r, agent_name: fullName(r.agent_first_name, r.agent_last_name) || null };
      delete out.agent_first_name; delete out.agent_last_name;
      return out;
    };
    res.json({ status: 'success', data: { from, to, visits: visits.map((v) => ({ ...withAgent(v), ics: visitIcsPath(v.id) })), followups: followups.map(withAgent) } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Pulse — a cheap fingerprint of "my slice". Screens poll it and refresh only when someone,
// anywhere (website, partner, agent, manager), changed something the viewer can see.
// ---------------------------------------------------------------------------
const getPulse = async (req, res, next) => {
  try {
    const me = req.ws;
    const scope = leadScope(me);
    const [[r]] = await pool.query(
      `SELECT
         (SELECT MAX(l.updated_at) FROM leads l WHERE ${scope.sql}) AS leads_at,
         (SELECT COUNT(*) FROM leads l WHERE ${scope.sql}) AS leads_n,
         (SELECT MAX(a.created_at) FROM lead_activities a JOIN leads l ON l.id = a.lead_id WHERE ${scope.sql}) AS act_at,
         (SELECT MAX(sv.updated_at) FROM site_visits sv JOIN leads l ON l.id = sv.lead_id WHERE ${scope.sql}) AS visits_at,
         (SELECT COUNT(*) FROM notifications n WHERE n.recipient_user_id = ? AND n.is_read = 0) AS unread`,
      [...scope.params, ...scope.params, ...scope.params, ...scope.params, me.id]
    );
    const stamp = (d) => (d ? new Date(d).getTime() : 0);
    res.json({
      status: 'success',
      data: { v: [stamp(r.leads_at), Number(r.leads_n), stamp(r.act_at), stamp(r.visits_at)].join('.'), unread: Number(r.unread) }
    });
  } catch (err) {
    next(err);
  }
};

// GET /workspace/activity?limit= — manager's live feed of what the whole team is doing
const getActivity = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 30));
    const [rows] = await pool.query(
      `SELECT a.id, a.lead_id, a.type, a.outcome, a.note, a.created_at,
              l.first_name, l.last_name, cp.firm_name AS partner_firm,
              u.first_name AS by_first_name, u.last_name AS by_last_name, r.name AS by_role
         FROM lead_activities a
         JOIN leads l ON l.id = a.lead_id
         LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN roles r ON r.id = u.role_id
        ORDER BY a.created_at DESC
        LIMIT ?`,
      [limit]
    );
    res.json({
      status: 'success',
      data: rows.map((a) => ({
        id: a.id, lead_id: a.lead_id, type: a.type, outcome: a.outcome, note: a.note, created_at: a.created_at,
        first_name: a.first_name, last_name: a.last_name, partner_firm: a.partner_firm,
        by_name: fullName(a.by_first_name, a.by_last_name) || (a.type === 'ASSIGN' ? 'Auto-routing' : 'Automatic'), by_role: a.by_role
      }))
    });
  } catch (err) {
    next(err);
  }
};

// GET /workspace/reports?days=30 — the five numbers a sales head actually runs the week on
const getReports = async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const FIRST_TOUCH = `(SELECT MIN(a.created_at) FROM lead_activities a WHERE a.lead_id = l.id AND a.type IN ('CALL','WHATSAPP'))`;

    const [[funnel]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ?) AS leads,
         (SELECT COUNT(*) FROM leads l WHERE l.created_at >= ? AND (l.last_contacted_at IS NOT NULL OR ${BUCKET} <> 'NEW')) AS contacted,
         (SELECT COUNT(DISTINCT sv.lead_id) FROM site_visits sv WHERE sv.created_at >= ?) AS visits_fixed,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.status = 'COMPLETED' AND sv.scheduled_time >= ?) AS visits_done,
         (SELECT COUNT(*) FROM deals d WHERE d.status IN (${BOOKED_DEAL_SQL}) AND d.created_at >= ?) AS bookings,
         (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN (${BOOKED_DEAL_SQL}) AND d.created_at >= ?) AS booking_value,
         (SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, l.created_at, ${FIRST_TOUCH}))) FROM leads l WHERE l.created_at >= ? AND ${FIRST_TOUCH} IS NOT NULL) AS first_call_mins`,
      [since, since, since, since, since, since, since]
    );

    const [sources] = await pool.query(
      `SELECT l.source, COUNT(*) AS leads,
              SUM(EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status = 'COMPLETED')) AS visited,
              SUM(EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = l.id AND d.status IN (${BOOKED_DEAL_SQL}))) AS booked
         FROM leads l WHERE l.created_at >= ?
        GROUP BY l.source ORDER BY leads DESC LIMIT 12`,
      [since]
    );

    const [agents] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, r.name AS role,
              (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND l.created_at >= ?) AS leads,
              (SELECT COUNT(*) FROM lead_activities a WHERE a.user_id = u.id AND a.type IN ('CALL','WHATSAPP') AND a.created_at >= ?) AS calls,
              (SELECT COUNT(*) FROM site_visits sv WHERE sv.assigned_agent_id = u.id AND sv.status = 'COMPLETED' AND sv.scheduled_time >= ?) AS visits_done,
              (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.assigned_agent_id = u.id AND d.status IN (${BOOKED_DEAL_SQL}) AND d.created_at >= ?) AS bookings,
              (SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, l.created_at, ${FIRST_TOUCH}))) FROM leads l
                WHERE l.assigned_agent_id = u.id AND l.created_at >= ? AND ${FIRST_TOUCH} IS NOT NULL) AS first_call_mins
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.name IN (${sqlList(AGENT_ROLES)})
        ORDER BY bookings DESC, visits_done DESC, calls DESC`,
      [since, since, since, since, since]
    );

    const [lost] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(l.lost_reason), ''), 'No reason given') AS reason, COUNT(*) AS n
         FROM leads l WHERE ${BUCKET} = 'LOST' AND l.updated_at >= ?
        GROUP BY reason ORDER BY n DESC LIMIT 6`,
      [since]
    );

    const n = (v) => (v === null || v === undefined ? null : Number(v));
    res.json({
      status: 'success',
      data: {
        days,
        funnel: Object.fromEntries(Object.entries(funnel).map(([k, v]) => [k, n(v)])),
        sources: sources.map((r) => ({ source: r.source, leads: n(r.leads), visited: n(r.visited), booked: n(r.booked) })),
        agents: agents.map((a) => ({ id: a.id, name: fullName(a.first_name, a.last_name), role: a.role, leads: n(a.leads), calls: n(a.calls), visits_done: n(a.visits_done), bookings: n(a.bookings), first_call_mins: n(a.first_call_mins) })),
        lost: lost.map((r) => ({ reason: r.reason, n: n(r.n) }))
      }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Import leads from Excel/CSV (manager) — the browser parses the file, the server applies the rules
// POST /workspace/leads/import { rows: [{ name, phone, email, project, source, budget, stage, notes }], assign_to, file_name }
// ---------------------------------------------------------------------------
function parseBudget(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toLowerCase().replace(/[,₹\s]/g, '');
  const m = /^([\d.]+)(cr|crore|crores|l|lac|lakh|lakhs|k)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3 }[m[2]] || 1;
  const out = Math.round(n * mult);
  return Number.isFinite(out) && out > 0 ? out : null;
}

/** Stage text from someone else's spreadsheet ("visit done", "BOOKED", "not interested"…) → our stage. */
function stageFromText(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return STAGE_BUCKETS.NEW.stage;
  for (const b of Object.values(STAGE_BUCKETS)) {
    if (b.aliases.some((a) => a.toLowerCase() === t) || b.label.toLowerCase() === t) return b.stage;
  }
  if (/book|sold|closed won|\bwon\b/.test(t)) return STAGE_BUCKETS.BOOKED.stage;
  if (/lost|not interested|junk|dead|dropped|invalid/.test(t)) return STAGE_BUCKETS.LOST.stage;
  if (/negotiat/.test(t)) return STAGE_BUCKETS.NEGOTIATION.stage;
  if (/visit/.test(t) && /done|complete|visited/.test(t)) return STAGE_BUCKETS.VISITED.stage;
  if (/visit|sv /.test(t)) return STAGE_BUCKETS.VISIT.stage;
  if (/^(new|fresh)/.test(t)) return STAGE_BUCKETS.NEW.stage;
  return STAGE_BUCKETS.CONTACTED.stage;
}

const importLeads = async (req, res) => {
  const me = req.ws;
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (!rows.length) return fail(res, 400, 'The file has no rows to import.');
  if (rows.length > 5000) return fail(res, 400, 'Import up to 5,000 rows at a time — split the file.');
  const fileName = String((req.body && req.body.file_name) || 'a file').slice(0, 80);
  const assignTo = String((req.body && req.body.assign_to) || 'auto');
  const importCampaign = await campaignFor(req.body && req.body.campaign_id, null);
  if (req.body && req.body.campaign_id && !importCampaign) return fail(res, 400, 'The chosen campaign no longer exists.');

  // Who gets the leads: one chosen person, or fair distribution among available agents (telecallers first)
  let fixed = null;
  let team = [];
  if (assignTo !== 'auto') {
    [[fixed]] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN (${sqlList([...AGENT_ROLES, ...MANAGER_ROLES])})`,
      [assignTo]
    );
    if (!fixed) return fail(res, 400, 'Choose an active team member to assign the leads to.');
  } else {
    const loadOf = async (roles) => (await pool.query(
      `SELECT u.id, u.first_name, u.last_name, (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND ${OPEN}) AS open_leads
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND u.is_available = 1 AND r.name IN (${sqlList(roles)})`
    ))[0];
    team = await loadOf(['INSIDE_SALES']);
    if (!team.length) team = await loadOf(AGENT_ROLES);
    team.forEach((a) => { a.open_leads = Number(a.open_leads); });
  }
  const nextOwner = () => {
    if (fixed) return fixed;
    if (!team.length) return null;
    const a = team.reduce((best, x) => (x.open_leads < best.open_leads ? x : best), team[0]);
    a.open_leads += 1;
    return a;
  };

  const [projects] = await pool.query('SELECT id, name FROM projects');
  const findProject = (name) => {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return projects.find((p) => p.name.toLowerCase() === n)
      || projects.find((p) => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())) || null;
  };
  const [existing] = await pool.query(`SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) AS k FROM leads`);
  const seen = new Set(existing.map((r) => r.k));

  const summary = { created: 0, duplicates: 0, invalid: 0, perAgent: {}, problems: [] };
  const problem = (row, reason) => { if (summary.problems.length < 50) summary.problems.push({ row, reason }); };
  const perAgentIds = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const rowNo = i + 2; // the header is row 1 in the spreadsheet
    const phone = String(r.phone || '').trim().slice(0, 20);
    const key = phoneKey(phone);
    if (key.length < 10) { summary.invalid++; problem(rowNo, 'No valid 10-digit mobile number'); continue; }
    if (seen.has(key)) { summary.duplicates++; problem(rowNo, `${phone} already exists`); continue; }
    seen.add(key);

    const full = String(r.name || '').trim().replace(/\s+/g, ' ');
    const [first, ...rest] = full ? full.split(' ') : ['Imported'];
    const owner = nextOwner();
    const project = findProject(r.project);
    const stage = stageFromText(r.stage);
    const source = String(r.source || 'IMPORT').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 100) || 'IMPORT';
    const closed = ['BOOKED', 'LOST'].includes(bucketOf(stage));
    let email = r.email ? String(r.email).trim().slice(0, 150) : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { problem(rowNo, `Email "${email}" looks wrong — imported without it`); email = null; }
    const leadId = crypto.randomUUID();
    const reqs = leadRequirements({ configuration: r.configuration, preferred_location: r.location, property_type: r.property_type });
    const campaignId = importCampaign || (r.campaign ? await campaignFor(null, String(r.campaign).trim()) : null);
    const priority = leadService.scorePriority({ source, budget_max: parseBudget(r.budget_max || r.budget), created_at: new Date() });
    await pool.query(
      `INSERT INTO leads (id, first_name, last_name, email, phone, source, stage, budget_min, budget_max, preferred_project_id,
                          assigned_agent_id, notes, next_follow_up_at, registered_by, lost_reason, campaign_id, priority,
                          configuration, preferred_location, property_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [leadId, first.slice(0, 100), rest.join(' ').slice(0, 100) || null, email, phone, source,
        stage, parseBudget(r.budget_min || r.budget), parseBudget(r.budget_max), project ? project.id : null,
        owner ? owner.id : null, r.notes ? String(r.notes).slice(0, 2000) : null,
        closed ? null : new Date(), me.id, bucketOf(stage) === 'LOST' ? 'Imported as lost' : null, campaignId, priority,
        reqs.configuration, reqs.preferred_location, reqs.property_type]
    );
    await logActivity({ leadId, userId: me.id, type: 'SYSTEM', outcome: 'CREATED', note: `Imported from ${fileName}${r.notes ? ` — ${String(r.notes).slice(0, 200)}` : ''}` });
    if (owner) {
      await pool.query(
        `INSERT INTO lead_assignments (id, lead_id, from_user_id, to_user_id, assigned_by, method, reason) VALUES (?, ?, NULL, ?, ?, 'IMPORT', ?)`,
        [crypto.randomUUID(), leadId, owner.id, me.id, `Imported from ${fileName}`.slice(0, 255)]
      );
    }
    summary.created++;
    if (owner) {
      const name = fullName(owner.first_name, owner.last_name);
      summary.perAgent[name] = (summary.perAgent[name] || 0) + 1;
      perAgentIds[owner.id] = (perAgentIds[owner.id] || 0) + 1;
    }
  }

  for (const [agentId, n] of Object.entries(perAgentIds)) {
    await notifyUser(agentId, { type: 'INFO', title: `📥 ${n} imported lead${n === 1 ? '' : 's'} assigned to you`, message: `From ${fileName}, added by ${me.name}. They're on your Today list.`, category: 'LEAD_ASSIGNED' }, me.id);
  }
  await audit.record({
    req, action: 'LEADS_IMPORTED', entityType: 'IMPORT', entityId: null,
    summary: `${summary.created} imported from ${fileName}; ${summary.duplicates} duplicates and ${summary.invalid} invalid rows skipped`,
    after: { file: fileName, created: summary.created, duplicates: summary.duplicates, invalid: summary.invalid, perAgent: summary.perAgent, campaign_id: importCampaign }
  });
  res.status(201).json({ status: 'success', message: `${summary.created} lead${summary.created === 1 ? '' : 's'} imported.`, data: summary });
};

// GET /workspace/leads/export?bucket=&q=&agent_id= — CSV of whatever the person can see (opens in Excel)
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const exportLeads = async (req, res) => {
  const me = req.ws;
  const scope = leadScope(me);
  const where = [scope.sql];
  const params = [...scope.params];
  const { bucket, q, agent_id: agentId } = req.query;
  if (bucket && STAGE_BUCKETS[bucket]) { where.push(`${BUCKET} = ?`); params.push(bucket); } else if (bucket === 'OPEN') where.push(OPEN);
  if (q) {
    const like = `%${String(q).trim()}%`;
    where.push(`(CONCAT_WS(' ', l.first_name, l.last_name) LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR p.name LIKE ?)`);
    params.push(like, like, like, like);
  }
  if (me.kind === 'manager' && agentId) { where.push('l.assigned_agent_id = ?'); params.push(agentId); }
  const [rows] = await pool.query(
    `SELECT ${LEAD_LIST_COLUMNS}, l.lost_reason, l.notes ${LEAD_LIST_JOINS} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 20000`,
    params
  );
  const headers = ['Name', 'Mobile', 'Email', 'Project', 'Stage', 'Temperature', 'Source', 'Assigned to', 'Channel partner', 'Next follow-up', 'Last contacted', 'Created', 'Budget from', 'Budget to', 'Lost reason'];
  if (me.kind !== 'partner') headers.push('Notes');
  const lines = [headers.join(',')];
  for (const r of rows) {
    const cells = [fullName(r.first_name, r.last_name), r.phone, r.email, r.project_name, STAGE_BUCKETS[r.bucket] ? STAGE_BUCKETS[r.bucket].label : r.stage,
      r.temperature, r.source, fullName(r.agent_first_name, r.agent_last_name), r.partner_firm, r.next_follow_up_at, r.last_contacted_at, r.created_at,
      r.budget_min, r.budget_max, r.lost_reason];
    if (me.kind !== 'partner') cells.push(r.notes);
    lines.push(cells.map(csvCell).join(','));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${stamp}.csv"`);
  res.send(`﻿${lines.join('\r\n')}\r\n`); // BOM so Excel shows ₹ and Indian names correctly
};

// ---------------------------------------------------------------------------
// Phone alerts (Web Push)
// ---------------------------------------------------------------------------
const getPushKey = async (req, res) => {
  const { publicKey } = await push.getVapidKeys();
  res.json({ status: 'success', data: { publicKey } });
};
const subscribePush = async (req, res) => {
  await push.saveSubscription(req.ws.id, req.body && req.body.subscription, req.get('user-agent'));
  res.status(201).json({ status: 'success', message: 'Alerts are on for this device.', data: { devices: await push.countSubscriptions(req.ws.id) } });
};
const unsubscribePush = async (req, res) => {
  await push.removeSubscription(req.ws.id, req.body && req.body.endpoint);
  res.json({ status: 'success', data: { devices: await push.countSubscriptions(req.ws.id) } });
};
const testPush = async (req, res) => {
  if (!(await push.countSubscriptions(req.ws.id))) return fail(res, 409, 'No device with alerts turned on. Turn on alerts first.');
  const r = await push.sendToUser(req.ws.id, { title: '🔔 Alerts are working', body: 'New enquiries and visit updates will appear here, even when the app is closed.', tag: 'test' });
  if (!r.sent) return fail(res, 502, "Couldn't reach this device's alert service. Turn alerts off and on again, or check the phone's internet.");
  res.json({ status: 'success', message: `Test alert sent to ${r.sent} device${r.sent === 1 ? '' : 's'}.` });
};

// ---------------------------------------------------------------------------
// Company settings (owner only)
// ---------------------------------------------------------------------------
const updateCompanySettings = async (req, res) => {
  if (req.ws.role !== 'SUPER_ADMIN') return fail(res, 403, 'Only the owner can change company settings.');
  const saved = await settings.updateSettings(req.body || {}, req.ws.id);
  res.json({ status: 'success', message: 'Company settings saved.', data: saved });
};

/** Converts thrown httpErrors into clean JSON responses. */
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, (err) => {
      if (err && err.statusCode && err.statusCode < 500) return fail(res, err.statusCode, err.message, err.extra);
      return next(err);
    });
  } catch (err) {
    if (err && err.statusCode && err.statusCode < 500) return fail(res, err.statusCode, err.message, err.extra);
    next(err);
  }
};

module.exports = {
  loadWorkspaceUser,
  requireKind,
  wrap,
  getMe,
  setMyAvailability,
  getToday,
  listLeads,
  getLead,
  createLead,
  updateLead,
  logLeadActivity,
  scheduleVisit,
  listVisits,
  updateVisit,
  bookUnit,
  listProjects,
  listProjectUnits,
  getTeam,
  assignLead,
  distributeLeads,
  setAgentAvailability,
  listAssignees,
  getEarnings,
  getCalendar,
  getPulse,
  getActivity,
  getReports,
  importLeads,
  exportLeads,
  getPushKey,
  subscribePush,
  unsubscribePush,
  testPush,
  updateCompanySettings,
  OUTCOMES
};
