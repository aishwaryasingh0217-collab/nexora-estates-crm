/**
 * Business Suite — Dedicated controllers for:
 *   1. Inside Sales (Telecaller)
 *   2. Outside Sales (Field / Site Agent)
 *   3. Channel Partner (Broker Desk)
 */
const crypto = require('crypto');
const pool = require('../../config/db');
const { wrap, ok, httpError, page, num, pct, fullName } = require('./common');
const notifications = require('../../services/notificationService');
const audit = require('../../services/audit');
const timeline = require('../../services/timelineService');
const ws = require('../../services/salesWorkspace');

const BUCKET_SQL = ws.bucketSql ? ws.bucketSql() : "CASE WHEN l.stage IN ('NEW') THEN 'NEW' WHEN l.stage IN ('CONTACTED', 'IN_PROGRESS', 'QUALIFIED', 'FOLLOW_UP') THEN 'CONTACTED' WHEN l.stage IN ('VISIT_SCHEDULED', 'VISIT_CONFIRMED') THEN 'VISIT' WHEN l.stage IN ('VISIT_COMPLETED', 'SITE_VISIT_DONE') THEN 'VISITED' WHEN l.stage IN ('NEGOTIATION', 'OFFER_MADE') THEN 'NEGOTIATION' WHEN l.stage IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') THEN 'BOOKED' ELSE 'LOST' END";

function distanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3; // metres
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ============================================================================
// 1. INSIDE SALES (TELECALLER)
// ============================================================================

/**
 * Telecaller Calling Queue: Fresh uncalled, Due today, Overdue, Cold revival + Daily KPI scoreboard
 */
const getInsideQueue = wrap(async (req, res) => {
  const isAgent = req.user.role === 'INSIDE_SALES';
  const agentFilter = isAgent ? 'AND l.assigned_agent_id = ?' : '';
  const agentParams = isAgent ? [req.user.id] : [];

  // Fresh leads: uncontacted or newly assigned
  const [freshRows] = await pool.query(
    `SELECT l.*, ${BUCKET_SQL} AS bucket, p.name AS project_name, p.code AS project_code,
            cp.firm_name AS partner_firm,
            TIMESTAMPDIFF(MINUTE, l.created_at, NOW()) AS age_minutes
       FROM leads l
       LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE (l.first_contacted_at IS NULL OR l.stage = 'NEW')
        AND l.stage NOT IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'LOST')
        ${agentFilter}
      ORDER BY l.created_at DESC
      LIMIT 100`,
    agentParams
  );

  // Due today followups
  const [todayRows] = await pool.query(
    `SELECT l.*, ${BUCKET_SQL} AS bucket, p.name AS project_name, p.code AS project_code,
            cp.firm_name AS partner_firm
       FROM leads l
       LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE DATE(l.next_follow_up_at) = CURDATE()
        AND l.stage NOT IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'LOST')
        ${agentFilter}
      ORDER BY l.next_follow_up_at ASC
      LIMIT 100`,
    agentParams
  );

  // Overdue followups
  const [overdueRows] = await pool.query(
    `SELECT l.*, ${BUCKET_SQL} AS bucket, p.name AS project_name, p.code AS project_code,
            cp.firm_name AS partner_firm,
            TIMESTAMPDIFF(HOUR, l.next_follow_up_at, NOW()) AS overdue_hours
       FROM leads l
       LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE l.next_follow_up_at < NOW()
        AND DATE(l.next_follow_up_at) < CURDATE()
        AND l.stage NOT IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'LOST')
        ${agentFilter}
      ORDER BY l.next_follow_up_at ASC
      LIMIT 100`,
    agentParams
  );

  // Re-engagement / Cold revival
  const [revivalRows] = await pool.query(
    `SELECT l.*, ${BUCKET_SQL} AS bucket, p.name AS project_name, p.code AS project_code,
            cp.firm_name AS partner_firm
       FROM leads l
       LEFT JOIN projects p ON p.id = l.preferred_project_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE (l.stage IN ('LOST', 'NOT_INTERESTED') OR l.updated_at < NOW() - INTERVAL 21 DAY)
        AND l.stage NOT IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')
        ${agentFilter}
      ORDER BY l.updated_at DESC
      LIMIT 50`,
    agentParams
  );

  // Daily Scoreboard Stats
  const targetCalls = 75;
  const [[callStats]] = await pool.query(
    `SELECT
       COUNT(*) AS calls_today,
       SUM(CASE WHEN outcome IN ('CONNECTED_INTERESTED', 'SITE_VISIT_SCHEDULED', 'CALLBACK_REQUESTED', 'CONNECTED', 'INTERESTED') THEN 1 ELSE 0 END) AS connects_today,
       SUM(CASE WHEN outcome = 'SITE_VISIT_SCHEDULED' THEN 1 ELSE 0 END) AS visits_booked_today
     FROM lead_activities
    WHERE type = 'CALL'
      AND created_at >= CURDATE()
      ${isAgent ? 'AND user_id = ?' : ''}`,
    isAgent ? [req.user.id] : []
  );

  const [[slaStats]] = await pool.query(
    `SELECT
       COUNT(*) AS total_new,
       SUM(CASE WHEN first_contacted_at IS NOT NULL AND TIMESTAMPDIFF(MINUTE, created_at, first_contacted_at) <= 30 THEN 1 ELSE 0 END) AS within_sla
     FROM leads l
    WHERE l.created_at >= CURDATE() - INTERVAL 7 DAY
      ${agentFilter}`,
    agentParams
  );

  const callsToday = num(callStats.calls_today);
  const connectsToday = num(callStats.connects_today);
  const visitsBooked = num(callStats.visits_booked_today);
  const connectRate = callsToday > 0 ? Math.round((connectsToday / callsToday) * 100) : 0;
  const slaCompliance = num(slaStats.total_new) > 0 ? Math.round((num(slaStats.within_sla) / num(slaStats.total_new)) * 100) : 100;

  ok(res, {
    fresh: freshRows,
    today: todayRows,
    overdue: overdueRows,
    revival: revivalRows,
    scoreboard: {
      callsToday,
      targetCalls,
      connectsToday,
      connectRate,
      visitsBooked,
      slaCompliance
    }
  });
});

/**
 * Telecaller Call Disposition & Qualification Save
 */
const insideDisposition = wrap(async (req, res) => {
  const b = req.body || {};
  const leadId = b.lead_id;
  if (!leadId) throw httpError(400, 'lead_id is required');

  const [[lead]] = await pool.query('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead) throw httpError(404, 'Lead not found');

  const outcome = b.outcome || 'CONNECTED_INTERESTED';
  const notes = b.notes ? String(b.notes).trim() : '';
  const durationSec = num(b.call_duration_sec) || 60;
  const nextFollowUp = b.next_follow_up_at ? new Date(b.next_follow_up_at) : null;
  const lostReason = b.lost_reason ? String(b.lost_reason).trim() : null;

  // Map outcome to stage
  let nextStage = lead.stage;
  let qualificationStatus = lead.qualification_status;

  if (outcome === 'CONNECTED_INTERESTED') {
    nextStage = 'CONTACTED';
    qualificationStatus = 'QUALIFIED';
  } else if (outcome === 'SITE_VISIT_SCHEDULED') {
    nextStage = 'VISIT_SCHEDULED';
    qualificationStatus = 'QUALIFIED';
  } else if (outcome === 'CALLBACK_REQUESTED') {
    nextStage = 'IN_PROGRESS';
  } else if (outcome === 'NOT_INTERESTED') {
    nextStage = 'LOST';
    qualificationStatus = 'NOT_QUALIFIED';
  } else if (outcome === 'INVALID_NUMBER') {
    nextStage = 'LOST';
    qualificationStatus = 'NOT_QUALIFIED';
  }

  // Record call activity
  const actId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at)
     VALUES (?, ?, ?, 'CALL', ?, ?, NOW())`,
    [actId, leadId, req.user.id, outcome, notes || `Call outcome: ${outcome}`]
  );

  // Update lead
  const updates = [
    'last_contacted_at = NOW()',
    'first_contacted_at = COALESCE(first_contacted_at, NOW())',
    'stage = ?',
    'qualification_status = ?'
  ];
  const params = [nextStage, qualificationStatus];

  if (nextFollowUp) {
    updates.push('next_follow_up_at = ?');
    params.push(nextFollowUp);
  }
  if (lostReason) {
    updates.push('lost_reason = ?');
    params.push(lostReason);
  }

  // Qualification fields if provided
  const q = b.qualification || {};
  if (q.budget_min !== undefined) { updates.push('budget_min = ?'); params.push(num(q.budget_min) || null); }
  if (q.budget_max !== undefined) { updates.push('budget_max = ?'); params.push(num(q.budget_max) || null); }
  if (q.configuration) { updates.push('configuration = ?'); params.push(String(q.configuration).trim()); }
  if (q.property_type) { updates.push('property_type = ?'); params.push(String(q.property_type).trim()); }
  if (q.purchase_timeline) { updates.push('purchase_timeline = ?'); params.push(String(q.purchase_timeline).trim()); }
  if (q.purpose) { updates.push('purpose = ?'); params.push(String(q.purpose).trim()); }
  if (q.loan_required !== undefined) { updates.push('loan_required = ?'); params.push(q.loan_required ? 1 : 0); }
  if (q.preferred_location) { updates.push('preferred_location = ?'); params.push(String(q.preferred_location).trim()); }
  if (q.preferred_project_id) { updates.push('preferred_project_id = ?'); params.push(q.preferred_project_id); }
  if (b.temperature) { updates.push('temperature = ?'); params.push(b.temperature); }
  if (b.priority) { updates.push('priority = ?'); params.push(b.priority); }

  params.push(leadId);
  await pool.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, params);

  await audit.record({
    req,
    action: 'LEAD_CALLED',
    entityType: 'LEAD',
    entityId: leadId,
    summary: `Call logged for ${fullName(lead.first_name, lead.last_name)} (${outcome})`
  });

  ok(res, { leadId, outcome, nextStage }, 'Call disposition and notes saved successfully');
});

/**
 * Telecaller Instant Site Visit Scheduler
 */
const insideScheduleVisit = wrap(async (req, res) => {
  const b = req.body || {};
  const { lead_id, project_id, scheduled_time, assigned_agent_id, notes, cab_pickup_required, cab_pickup_address } = b;

  if (!lead_id) throw httpError(400, 'lead_id is required');
  if (!project_id) throw httpError(400, 'Please select a project for the site visit');
  if (!scheduled_time) throw httpError(400, 'Please select a date and time slot for the visit');

  const [[lead]] = await pool.query('SELECT * FROM leads WHERE id = ?', [lead_id]);
  if (!lead) throw httpError(404, 'Lead not found');

  const [[project]] = await pool.query('SELECT id, name, location FROM projects WHERE id = ?', [project_id]);
  if (!project) throw httpError(404, 'Project not found');

  const visitId = crypto.randomUUID();
  const feedbackNote = [
    notes ? `Note: ${notes}` : '',
    cab_pickup_required ? `[CAB PICKUP REQUIRED] Address: ${cab_pickup_address || 'Customer to confirm address'}` : ''
  ].filter(Boolean).join(' | ');

  await pool.query(
    `INSERT INTO site_visits (id, lead_id, project_id, scheduled_time, assigned_agent_id, status, requested_by, client_feedback)
     VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)`,
    [visitId, lead_id, project_id, new Date(scheduled_time), assigned_agent_id || null, req.user.id, feedbackNote || null]
  );

  // Update lead stage to VISIT_SCHEDULED
  await pool.query("UPDATE leads SET stage = 'VISIT_SCHEDULED', preferred_project_id = ? WHERE id = ?", [project_id, lead_id]);

  // Log activity
  await pool.query(
    `INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at)
     VALUES (?, ?, ?, 'VISIT', 'SCHEDULED', ?, NOW())`,
    [crypto.randomUUID(), lead_id, req.user.id, `Site visit scheduled at ${project.name} on ${new Date(scheduled_time).toLocaleString('en-IN')}`]
  );

  // If assigned to a field agent, dispatch notification
  if (assigned_agent_id) {
    await notifications.createNotification({
      recipientUserId: assigned_agent_id,
      type: 'SITE_VISIT',
      title: 'New Site Visit Assigned',
      message: `Client ${fullName(lead.first_name, lead.last_name)} scheduled for ${project.name} on ${new Date(scheduled_time).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      category: 'VISIT',
      referenceId: visitId
    });
  }

  await audit.record({
    req,
    action: 'VISIT_SCHEDULED',
    entityType: 'SITE_VISIT',
    entityId: visitId,
    summary: `Site visit scheduled for ${fullName(lead.first_name, lead.last_name)} at ${project.name}`
  });

  ok(res, { visitId, leadId: lead_id, projectName: project.name }, 'Site visit scheduled successfully');
});

/**
 * Match live available inventory for client requirement while on call
 */
const insideInventoryMatch = wrap(async (req, res) => {
  const { project_id, configuration, max_budget } = req.query;
  const where = ["u.status = 'AVAILABLE'"];
  const params = [];

  if (project_id) {
    where.push('u.project_id = ?');
    params.push(project_id);
  }
  if (configuration) {
    where.push('(u.unit_type = ? OR u.unit_type LIKE ?)');
    params.push(configuration, `%${configuration}%`);
  }
  if (max_budget && num(max_budget) > 0) {
    where.push('u.base_price <= ?');
    params.push(num(max_budget));
  }

  const [units] = await pool.query(
    `SELECT u.*, p.name AS project_name, p.code AS project_code, p.location AS project_location,
            p.brochure_url, p.possession_date
       FROM units u
       JOIN projects p ON p.id = u.project_id
      WHERE ${where.join(' AND ')}
      ORDER BY u.base_price ASC
      LIMIT 40`,
    params
  );

  ok(res, { units, matchCount: units.length });
});

// ============================================================================
// 2. OUTSIDE SALES (FIELD / SITE AGENT)
// ============================================================================

/**
 * Site Visit Command Center: Today's visits timeline, upcoming visits, past visits + field metrics
 */
const getOutsideVisits = wrap(async (req, res) => {
  const isField = req.user.role === 'OUTSIDE_SALES';
  const agentFilter = isField ? 'AND (sv.assigned_agent_id = ? OR sv.assigned_agent_id IS NULL)' : '';
  const agentParams = isField ? [req.user.id] : [];

  // Today's scheduled visits
  const [todayRows] = await pool.query(
    `SELECT sv.*, p.name AS project_name, p.code AS project_code, p.location AS project_location,
            p.latitude AS project_lat, p.longitude AS project_lng,
            l.first_name, l.last_name, l.phone, l.email, l.budget_min, l.budget_max,
            l.configuration, l.temperature, l.notes AS lead_notes,
            ag.first_name AS telecaller_first, ag.last_name AS telecaller_last, ag.phone AS telecaller_phone
       FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id
       JOIN leads l ON l.id = sv.lead_id
       LEFT JOIN users ag ON ag.id = l.assigned_agent_id
      WHERE DATE(sv.scheduled_time) = CURDATE()
        ${agentFilter}
      ORDER BY sv.scheduled_time ASC`,
    agentParams
  );

  // Upcoming visits (next 14 days)
  const [upcomingRows] = await pool.query(
    `SELECT sv.*, p.name AS project_name, p.code AS project_code,
            l.first_name, l.last_name, l.phone, l.budget_min, l.budget_max, l.configuration
       FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id
       JOIN leads l ON l.id = sv.lead_id
      WHERE sv.scheduled_time > NOW()
        AND DATE(sv.scheduled_time) > CURDATE()
        ${agentFilter}
      ORDER BY sv.scheduled_time ASC
      LIMIT 50`,
    agentParams
  );

  // Completed / Past visits
  const [completedRows] = await pool.query(
    `SELECT sv.*, p.name AS project_name, p.code AS project_code,
            l.first_name, l.last_name, l.phone
       FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id
       JOIN leads l ON l.id = sv.lead_id
      WHERE (sv.status IN ('COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED') OR sv.scheduled_time < NOW())
        AND DATE(sv.scheduled_time) < CURDATE()
        ${agentFilter}
      ORDER BY sv.scheduled_time DESC
      LIMIT 50`,
    agentParams
  );

  // Field agent monthly scoreboard
  const [[metrics]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM site_visits sv WHERE DATE(sv.scheduled_time) = CURDATE() ${agentFilter}) AS today_count,
       (SELECT COUNT(*) FROM site_visits sv WHERE sv.status = 'COMPLETED' AND sv.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01') ${agentFilter}) AS month_completed,
       (SELECT COUNT(*) FROM deals d WHERE d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') AND d.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') ${isField ? 'AND d.created_by = ?' : ''}) AS bookings_count,
       (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d WHERE d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') AND d.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') ${isField ? 'AND d.created_by = ?' : ''}) AS closed_revenue
     FROM dual`,
    isField ? [...agentParams, ...agentParams, req.user.id, req.user.id] : []
  );

  const completed = num(metrics.month_completed);
  const bookings = num(metrics.bookings_count);
  const conversionPct = completed > 0 ? Math.round((bookings / completed) * 100) : 0;
  // Standard incentive: 0.25% of closed booking revenue
  const closedRev = num(metrics.closed_revenue);
  const incentiveEst = Math.round(closedRev * 0.0025);

  ok(res, {
    today: todayRows.map((r) => ({
      ...r,
      client_name: fullName(r.first_name, r.last_name),
      telecaller_name: fullName(r.telecaller_first, r.telecaller_last)
    })),
    upcoming: upcomingRows.map((r) => ({
      ...r,
      client_name: fullName(r.first_name, r.last_name)
    })),
    completed: completedRows.map((r) => ({
      ...r,
      client_name: fullName(r.first_name, r.last_name)
    })),
    metrics: {
      todayCount: num(metrics.today_count),
      monthCompleted: completed,
      bookingsCount: bookings,
      conversionPct,
      closedRevenue: closedRev,
      incentiveEst
    }
  });
});

/**
 * 1-Click Geo Check-in / Check-out with GPS verification & Visit Feedback
 */
const outsideCheckIn = wrap(async (req, res) => {
  const visitId = req.params.id;
  const b = req.body || {};

  const [[visit]] = await pool.query(
    `SELECT sv.*, p.latitude, p.longitude, p.name AS project_name, l.first_name, l.last_name
       FROM site_visits sv
       JOIN projects p ON p.id = sv.project_id
       JOIN leads l ON l.id = sv.lead_id
      WHERE sv.id = ?`,
    [visitId]
  );
  if (!visit) throw httpError(404, 'Site visit not found');

  const status = b.status || 'IN_PROGRESS';
  const lat = b.latitude ? parseFloat(b.latitude) : null;
  const lng = b.longitude ? parseFloat(b.longitude) : null;
  const feedback = b.client_feedback ? String(b.client_feedback).trim() : null;
  const rating = b.rating ? parseInt(b.rating, 10) : null;
  const temperature = b.temperature || null;

  // Compute distance from project site if lat/lng available
  let distanceM = null;
  if (lat && lng && visit.latitude && visit.longitude) {
    distanceM = distanceInMeters(lat, lng, parseFloat(visit.latitude), parseFloat(visit.longitude));
  }

  const updates = [
    'status = ?',
    'check_in_at = COALESCE(check_in_at, NOW())'
  ];
  const params = [status];

  if (lat && lng) {
    updates.push('check_in_lat = ?', 'check_in_lng = ?', 'check_in_distance_m = ?');
    params.push(lat, lng, distanceM);
  }
  if (feedback) {
    updates.push('client_feedback = ?');
    params.push(feedback);
  }
  if (rating) {
    updates.push('rating = ?');
    params.push(rating);
  }
  if (status === 'COMPLETED') {
    updates.push('completed_at = NOW()');
  }

  params.push(visitId);
  await pool.query(`UPDATE site_visits SET ${updates.join(', ')} WHERE id = ?`, params);

  // Update lead stage and temperature
  if (status === 'COMPLETED') {
    await pool.query("UPDATE leads SET stage = 'VISIT_COMPLETED' WHERE id = ?", [visit.lead_id]);
  }
  if (temperature) {
    await pool.query('UPDATE leads SET temperature = ? WHERE id = ?', [temperature, visit.lead_id]);
  }

  // Record activity
  await pool.query(
    `INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at)
     VALUES (?, ?, ?, 'VISIT', ?, ?, NOW())`,
    [crypto.randomUUID(), visit.lead_id, req.user.id, status, `Site visit marked ${status}${distanceM != null ? ` (${distanceM}m from site)` : ''}${feedback ? `: "${feedback}"` : ''}`]
  );

  await audit.record({
    req,
    action: 'VISIT_UPDATED',
    entityType: 'SITE_VISIT',
    entityId: visitId,
    summary: `Site visit for ${fullName(visit.first_name, visit.last_name)} updated to ${status}`
  });

  ok(res, { visitId, status, distanceM, feedback }, 'Visit status and feedback updated successfully');
});

/**
 * Digital Project Showcase & Live Unit Matrix with complete cost sheet
 */
const getProjectMatrix = wrap(async (req, res) => {
  const { project_id } = req.query;

  // Fetch all active projects for picker
  const [projects] = await pool.query(
    `SELECT p.id, p.name, p.code, p.project_type, p.location, p.city, p.brochure_url, p.hero_image_url,
            p.possession_date, p.total_units,
            COUNT(u.id) AS unit_count,
            SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_count,
            SUM(CASE WHEN u.status = 'HOLD' THEN 1 ELSE 0 END) AS hold_count,
            SUM(CASE WHEN u.status IN ('BOOKED', 'SOLD') THEN 1 ELSE 0 END) AS booked_count
       FROM projects p
       LEFT JOIN units u ON u.project_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC`
  );

  let selectedProject = null;
  let units = [];

  const targetProjectId = project_id || (projects.find((p) => num(p.unit_count) > 0) ? projects.find((p) => num(p.unit_count) > 0).id : projects[0] ? projects[0].id : null);
  if (targetProjectId) {
    selectedProject = projects.find((p) => p.id === targetProjectId) || projects[0];

    const [unitRows] = await pool.query(
      `SELECT u.*,
              COALESCE(u.super_area_sqft, u.carpet_area_sqft * 1.3, 1000) AS calc_sba,
              (u.base_price + COALESCE(u.plc_charges, 0) + 300000 + (u.base_price * 0.05)) AS est_all_inclusive
         FROM units u
        WHERE u.project_id = ?
        ORDER BY u.floor_number ASC, u.unit_number ASC`,
      [targetProjectId]
    );

    units = unitRows.map((u) => ({
      ...u,
      base_price: num(u.base_price),
      plc_charges: num(u.plc_charges),
      parking_charges: 300000,
      gst_est: Math.round(num(u.base_price) * 0.05),
      est_all_inclusive: Math.round(num(u.est_all_inclusive))
    }));
  }

  ok(res, {
    projects,
    selectedProject,
    units
  });
});

/**
 * Outside Sales Spot Booking & Token Collection with Discount Approval Request
 */
const outsideSpotBook = wrap(async (req, res) => {
  const b = req.body || {};
  const { lead_id, unit_id, token_amount, payment_mode, reference_number, discount_requested, notes } = b;

  if (!lead_id) throw httpError(400, 'lead_id is required');
  if (!unit_id) throw httpError(400, 'unit_id is required');

  const [[unit]] = await pool.query('SELECT u.*, p.name AS project_name FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id = ?', [unit_id]);
  if (!unit) throw httpError(404, 'Unit not found');
  if (unit.status !== 'AVAILABLE' && unit.status !== 'HOLD') {
    throw httpError(400, `Unit ${unit.unit_number} is already ${unit.status} and cannot be booked`);
  }

  const [[lead]] = await pool.query('SELECT * FROM leads WHERE id = ?', [lead_id]);
  if (!lead) throw httpError(404, 'Lead not found');

  const basePrice = num(unit.base_price);
  const plcCharges = num(unit.plc_charges);
  const parkingCharges = 300000;
  const taxesEst = Math.round(basePrice * 0.05);
  const discountAmt = num(discount_requested);
  const totalAgreed = basePrice + plcCharges + parkingCharges + taxesEst - discountAmt;
  const tokenAmt = num(token_amount) || 100000;

  const dealId = crypto.randomUUID();
  const dealNumber = `DL-SPOT-${Math.floor(100000 + Math.random() * 900000)}`;
  const needsApproval = discountAmt > 0;
  const dealStatus = needsApproval ? 'PENDING_APPROVAL' : 'BOOKED';

  // Mark unit as HOLD
  await pool.query("UPDATE units SET status = 'HOLD' WHERE id = ?", [unit_id]);

  // Insert deal
  await pool.query(
    `INSERT INTO deals (id, deal_number, lead_id, unit_id, base_price, plc_charges, parking_charges,
                       taxes_amount, discount_amount, agreed_total_amount, booking_token_amount,
                       status, created_by, channel_partner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dealId,
      dealNumber,
      lead_id,
      unit_id,
      basePrice,
      plcCharges,
      parkingCharges,
      taxesEst,
      discountAmt,
      totalAgreed,
      tokenAmt,
      dealStatus,
      req.user.id,
      lead.channel_partner_id || null
    ]
  );

  // If token paid, record payment
  if (tokenAmt > 0) {
    const payId = crypto.randomUUID();
    const payNum = `PAY-SPOT-${Math.floor(100000 + Math.random() * 900000)}`;
    await pool.query(
      `INSERT INTO payments (id, payment_number, deal_id, amount_received, payment_date,
                             payment_mode, reference_number, received_by, notes, verification_status, payer_name)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, 'Site spot booking token', 'PENDING', ?)`,
      [payId, payNum, dealId, tokenAmt, payment_mode || 'UPI', reference_number || 'SPOT-COUNTER', req.user.id, fullName(lead.first_name, lead.last_name)]
    );
  }

  // If discount requested, create approval request for Sales Head / Manager
  if (needsApproval) {
    const appReqId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO approval_requests (id, request_type, entity_type, entity_id, title, details, amount, requested_by, approver_roles, status, created_at)
       VALUES (?, 'DISCOUNT', 'DEAL', ?, ?, ?, ?, ?, 'SUPER_ADMIN,ADMIN', 'PENDING', NOW())`,
      [
        appReqId,
        dealId,
        `Spot Discount Approval Request — Unit ${unit.unit_number}`,
        `Field agent ${fullName(req.user.firstName, req.user.lastName)} requested ₹${discountAmt.toLocaleString('en-IN')} special spot discount on ${unit.project_name} unit ${unit.unit_number}. Token collected: ₹${tokenAmt.toLocaleString('en-IN')}. Note: ${notes || 'Spot closing'}`,
        discountAmt,
        req.user.id
      ]
    );

    // Notify sales head & managers
    const [managers] = await pool.query("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('SUPER_ADMIN', 'ADMIN') AND u.status = 'ACTIVE'");
    for (const m of managers) {
      await notifications.createNotification({
        recipientUserId: m.id,
        type: 'APPROVAL',
        title: 'Discount Approval Required',
        message: `Spot discount of ₹${discountAmt.toLocaleString('en-IN')} requested for Unit ${unit.unit_number} by ${fullName(req.user.firstName, req.user.lastName)}`,
        category: 'FINANCE',
        referenceId: appReqId
      });
    }
  }

  // Update lead stage
  await pool.query("UPDATE leads SET stage = 'BOOKED' WHERE id = ?", [lead_id]);

  // Log timeline activity
  await pool.query(
    `INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at)
     VALUES (?, ?, ?, 'BOOKING', 'TOKEN_PAID', ?, NOW())`,
    [crypto.randomUUID(), lead_id, req.user.id, `Spot booking token ₹${tokenAmt.toLocaleString('en-IN')} recorded for Unit ${unit.unit_number} (${dealNumber})${needsApproval ? ' [Discount approval pending]' : ''}`]
  );

  await audit.record({
    req,
    action: 'DEAL_CREATED',
    entityType: 'DEAL',
    entityId: dealId,
    summary: `Spot booking ${dealNumber} created for ${fullName(lead.first_name, lead.last_name)} on Unit ${unit.unit_number}`
  });

  ok(res, {
    dealId,
    dealNumber,
    unitNumber: unit.unit_number,
    tokenAmount: tokenAmt,
    totalAgreed,
    needsApproval
  }, needsApproval ? 'Spot booking recorded and discount approval dispatched to Sales Head' : 'Spot booking completed and unit reserved successfully');
});

// ============================================================================
// 3. CHANNEL PARTNER (BROKER DESK)
// ============================================================================

/**
 * Broker Executive Dashboard: Firm details, tier badge, RM contact, pipeline & payout overview
 */
const getPartnerDashboard = wrap(async (req, res) => {
  let partnerId = req.user.channel_partner_id;

  // If partnerId missing on user, look up by email/user or pick primary partner
  if (!partnerId) {
    const [[cpRow]] = await pool.query('SELECT id FROM channel_partners WHERE status = "ACTIVE" ORDER BY id ASC LIMIT 1');
    if (cpRow) partnerId = cpRow.id;
  }
  if (!partnerId) throw httpError(404, 'No channel partner firm profile found');

  const [[partner]] = await pool.query('SELECT * FROM channel_partners WHERE id = ?', [partnerId]);
  if (!partner) throw httpError(404, 'Channel partner record not found');

  // Assigned Relationship Manager (Sales Manager)
  const [[rm]] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.phone, u.email
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('ADMIN', 'SUPER_ADMIN') AND u.status = 'ACTIVE'
      ORDER BY u.id ASC LIMIT 1`
  );

  // KPIs
  const [[kpiData]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM leads WHERE channel_partner_id = ?) AS total_registered,
       (SELECT COUNT(*) FROM leads WHERE channel_partner_id = ? AND cp_protected_until > NOW() AND stage NOT IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'LOST')) AS active_protected,
       (SELECT COUNT(*) FROM deals WHERE channel_partner_id = ? AND status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')) AS confirmed_bookings,
       (SELECT COALESCE(SUM(agreed_total_amount), 0) FROM deals WHERE channel_partner_id = ? AND status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')) AS total_booking_value
     FROM dual`,
    [partnerId, partnerId, partnerId, partnerId]
  );

  const rate = num(partner.commission_rate) || 2.5;
  const bookingValue = num(kpiData.total_booking_value);
  const earnedCommission = Math.round((bookingValue * rate) / 100);

  // Payout ledger
  const [[payoutData]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN verification_status = 'VERIFIED' THEN amount_received ELSE 0 END), 0) AS paid_commission
     FROM payments
    WHERE notes LIKE '%Commission%' OR notes LIKE '%Brokerage%'`
  );
  const paidCommission = num(payoutData.paid_commission);
  const pendingCommission = Math.max(0, earnedCommission - paidCommission);

  // Recent leads registered by this partner with 45-day protection expiry
  const [recentClients] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.phone, l.email, l.stage, ${BUCKET_SQL} AS bucket,
            l.cp_protected_until, l.created_at, p.name AS project_name,
            TIMESTAMPDIFF(DAY, NOW(), l.cp_protected_until) AS protection_days_left
       FROM leads l
       LEFT JOIN projects p ON p.id = l.preferred_project_id
      WHERE l.channel_partner_id = ?
      ORDER BY l.created_at DESC
      LIMIT 20`,
    [partnerId]
  );

  ok(res, {
    partner: {
      id: partner.id,
      firmName: partner.firm_name,
      contactPerson: partner.contact_person,
      phone: partner.phone,
      email: partner.email,
      reraNumber: partner.rera_number,
      tier: partner.tier || 'GOLD',
      commissionRate: rate
    },
    rm: rm ? {
      name: fullName(rm.first_name, rm.last_name),
      phone: rm.phone || '+91 98765 43210',
      email: rm.email
    } : null,
    kpis: {
      totalRegistered: num(kpiData.total_registered),
      activeProtected: num(kpiData.active_protected),
      confirmedBookings: num(kpiData.confirmed_bookings),
      totalBookingValue: bookingValue,
      earnedCommission,
      paidCommission,
      pendingCommission
    },
    recentClients: recentClients.map((c) => ({
      ...c,
      client_name: fullName(c.first_name, c.last_name),
      isProtected: c.cp_protected_until && new Date(c.cp_protected_until) > new Date()
    }))
  });
});

/**
 * Register Client with 45-Day Guaranteed Lead Protection
 */
const partnerRegisterClient = wrap(async (req, res) => {
  const b = req.body || {};
  let partnerId = req.user.channel_partner_id;

  if (!partnerId) {
    const [[cpRow]] = await pool.query('SELECT id FROM channel_partners WHERE status = "ACTIVE" ORDER BY id ASC LIMIT 1');
    if (cpRow) partnerId = cpRow.id;
  }
  if (!partnerId) throw httpError(403, 'Your account is not linked to a channel partner firm');

  const firstName = String(b.first_name || '').trim();
  const lastName = b.last_name ? String(b.last_name).trim() : '';
  const phone = String(b.phone || '').trim();
  const email = b.email ? String(b.email).trim().toLowerCase() : null;

  if (!firstName) throw httpError(400, 'Client first name is required');
  if (!phone || phone.length < 8) throw httpError(400, 'A valid 10-digit mobile number is required for registration');

  // Duplication check: if lead exists within active protection window
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const [[dup]] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.channel_partner_id, l.cp_protected_until,
            cp.firm_name AS existing_firm
       FROM leads l
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
      WHERE (REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '+', '') LIKE ?)
        AND l.created_at >= NOW() - INTERVAL 45 DAY
      LIMIT 1`,
    [`%${cleanPhone}`]
  );

  if (dup) {
    if (dup.channel_partner_id === partnerId) {
      throw httpError(409, `Client ${fullName(dup.first_name, dup.last_name)} is already registered under your firm with 45-day protection until ${new Date(dup.cp_protected_until).toLocaleDateString('en-IN')}`);
    } else {
      throw httpError(409, `Client with phone number ${phone} is already actively registered in the system (Protected under ${dup.existing_firm || 'Developer direct'}). Commission lock cannot be applied.`);
    }
  }

  const leadId = crypto.randomUUID();
  const protectedUntil = new Date(Date.now() + 45 * 86400000);

  await pool.query(
    `INSERT INTO leads (id, first_name, last_name, phone, email, source, stage,
                       channel_partner_id, registered_by, cp_protected_until,
                       preferred_project_id, budget_min, budget_max, configuration, notes,
                       temperature, priority, qualification_status)
     VALUES (?, ?, ?, ?, ?, 'CHANNEL_PARTNER', 'NEW', ?, ?, ?, ?, ?, ?, ?, ?, 'HOT', 'HIGH', 'QUALIFIED')`,
    [
      leadId,
      firstName,
      lastName || null,
      phone,
      email,
      partnerId,
      req.user.id,
      protectedUntil,
      b.preferred_project_id || null,
      num(b.budget_min) || null,
      num(b.budget_max) || null,
      b.configuration || null,
      b.notes ? `[Broker Registered] ${b.notes}` : '[Broker Registered] Client registered via Channel Partner Portal',
    ]
  );

  let projId = b.preferred_project_id || null;
  if (!projId) {
    const [[pRow]] = await pool.query('SELECT id FROM projects ORDER BY id ASC LIMIT 1');
    if (pRow) projId = pRow.id;
  }

  // Record 45-day lead lock
  const lockId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO cp_lead_locks (id, channel_partner_id, client_name, client_phone, project_id, status, locked_until)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE_LOCKED', ?)`,
    [lockId, partnerId, fullName(firstName, lastName), phone, projId, protectedUntil]
  );

  // Notify Sales Manager of new broker registration
  const [managers] = await pool.query("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('SUPER_ADMIN', 'ADMIN') AND u.status = 'ACTIVE'");
  for (const m of managers) {
    await notifications.createNotification({
      recipientUserId: m.id,
      type: 'LEAD',
      title: 'New Channel Partner Lead Registered',
      message: `${fullName(firstName, lastName)} registered by broker firm with 45-day protection until ${protectedUntil.toLocaleDateString('en-IN')}`,
      category: 'LEAD',
      referenceId: leadId
    });
  }

  await audit.record({
    req,
    action: 'LEAD_CREATED',
    entityType: 'LEAD',
    entityId: leadId,
    summary: `Lead ${fullName(firstName, lastName)} registered by channel partner firm with 45-day lock`
  });

  ok(res, {
    leadId,
    clientName: fullName(firstName, lastName),
    protectedUntil: protectedUntil.toISOString()
  }, `Client registered successfully! Guaranteed 45-day exclusive lead lock active until ${protectedUntil.toLocaleDateString('en-IN')}`);
});

/**
 * Channel Partner Commission & Payouts Ledger
 */
const getPartnerCommissions = wrap(async (req, res) => {
  let partnerId = req.user.channel_partner_id;
  if (!partnerId) {
    const [[cpRow]] = await pool.query('SELECT id FROM channel_partners WHERE status = "ACTIVE" ORDER BY id ASC LIMIT 1');
    if (cpRow) partnerId = cpRow.id;
  }
  if (!partnerId) throw httpError(404, 'No channel partner firm profile found');

  const [[partner]] = await pool.query('SELECT * FROM channel_partners WHERE id = ?', [partnerId]);
  const rate = num(partner.commission_rate) || 2.5;

  const [deals] = await pool.query(
    `SELECT d.id, d.deal_number, d.status, d.agreed_total_amount, d.created_at, d.approved_at,
            l.first_name, l.last_name, l.phone,
            u.unit_number, p.name AS project_name
       FROM deals d
       JOIN leads l ON l.id = d.lead_id
       JOIN units u ON u.id = d.unit_id
       JOIN projects p ON p.id = u.project_id
      WHERE d.channel_partner_id = ?
      ORDER BY d.created_at DESC`,
    [partnerId]
  );

  const rows = deals.map((d) => {
    const totalAmount = num(d.agreed_total_amount);
    const commTotal = Math.round((totalAmount * rate) / 100);
    const isApproved = ['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON'].includes(d.status);

    return {
      deal_id: d.id,
      deal_number: d.deal_number,
      client_name: fullName(d.first_name, d.last_name),
      project_name: d.project_name,
      unit_number: d.unit_number,
      agreed_total_amount: totalAmount,
      commission_rate: rate,
      total_commission: commTotal,
      booking_date: d.created_at,
      status: isApproved ? 'APPROVED' : 'UNDER_REVIEW',
      slabs: [
        { milestone: 'Token Clearance (25%)', amount: Math.round(commTotal * 0.25), status: isApproved ? 'DISBURSED' : 'PENDING', utr: isApproved ? 'UTR' + Math.floor(100000000 + Math.random() * 900000000) : null },
        { milestone: 'Sale Agreement (50%)', amount: Math.round(commTotal * 0.50), status: d.status === 'AGREEMENT_SIGNED' || d.status === 'CLOSED_WON' ? 'DISBURSED' : 'ELIGIBLE', utr: null },
        { milestone: 'Registry / Possession (25%)', amount: Math.round(commTotal * 0.25), status: d.status === 'CLOSED_WON' ? 'DISBURSED' : 'ON_COMPLETION', utr: null }
      ]
    };
  });

  ok(res, {
    partnerId,
    firmName: partner.firm_name,
    commissionRate: rate,
    deals: rows
  });
});

/**
 * Project Collaterals, Marketing Hub & Co-branded Banners
 */
const getPartnerCollaterals = wrap(async (req, res) => {
  const [projects] = await pool.query(
    `SELECT p.id, p.name, p.code, p.project_type, p.location, p.city, p.brochure_url,
            p.hero_image_url, p.rera_number, p.possession_date, p.total_units,
            (SELECT COUNT(*) FROM units WHERE project_id = p.id AND status = 'AVAILABLE') AS available_units
       FROM projects p
      WHERE p.partner_visible = 1 OR p.partner_visible IS NULL
      ORDER BY p.name ASC`
  );

  let partner = null;
  if (req.user.channel_partner_id) {
    const [[p]] = await pool.query('SELECT firm_name, phone, rera_number FROM channel_partners WHERE id = ?', [req.user.channel_partner_id]);
    partner = p;
  }

  ok(res, {
    projects,
    partner
  });
});

module.exports = {
  // Inside Sales
  getInsideQueue,
  insideDisposition,
  insideScheduleVisit,
  insideInventoryMatch,

  // Outside Sales
  getOutsideVisits,
  outsideCheckIn,
  getProjectMatrix,
  outsideSpotBook,

  // Channel Partner
  getPartnerDashboard,
  partnerRegisterClient,
  getPartnerCommissions,
  getPartnerCollaterals
};
