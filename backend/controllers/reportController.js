const pool = require('../config/db');

/**
 * Helper to compute date boundaries for presets and previous comparison periods
 */
function resolveDateRange(preset, customStart, customEnd) {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  let prevStart = new Date();
  let prevEnd = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart.setDate(start.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(end.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;

    case 'this_week': {
      const day = now.getDay() || 7; // 1 = Monday
      start.setDate(now.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const diffMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1000);
      prevStart = new Date(prevEnd.getTime() - diffMs);
      break;
    }

    case 'this_month':
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28), 23, 59, 59, 999);
      break;

    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      break;

    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), qMonth - 3, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), qMonth, 0, 23, 59, 59, 999);
      break;
    }

    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case 'custom':
      if (customStart) start = new Date(customStart + ' 00:00:00');
      if (customEnd) end = new Date(customEnd + ' 23:59:59');
      const customDiff = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1000);
      prevStart = new Date(prevEnd.getTime() - customDiff);
      break;

    case 'all_time':
      start = new Date('2020-01-01 00:00:00');
      end.setHours(23, 59, 59, 999);
      prevStart = new Date('2019-01-01 00:00:00');
      prevEnd = new Date('2019-12-31 23:59:59');
      break;
  }

  const toSql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return {
    startStr: toSql(start),
    endStr: toSql(end),
    prevStartStr: toSql(prevStart),
    prevEndStr: toSql(prevEnd),
    displayPeriod: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  };
}

/**
 * Helper to calculate percentage trend and semantic direction
 */
function calculateTrend(current, previous, inverseIsPositive = false) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev === 0) {
    if (curr === 0) return { pct: 0, direction: 'neutral', label: '0.0%', isPositive: true };
    return { pct: 100, direction: 'up', label: '+100%', isPositive: !inverseIsPositive };
  }

  const pctChange = ((curr - prev) / prev) * 100;
  const rounded = pctChange.toFixed(1);

  if (pctChange > 0.5) {
    return {
      pct: pctChange,
      direction: 'up',
      label: `+${rounded}%`,
      isPositive: !inverseIsPositive
    };
  } else if (pctChange < -0.5) {
    return {
      pct: pctChange,
      direction: 'down',
      label: `${rounded}%`,
      isPositive: inverseIsPositive
    };
  }

  return {
    pct: 0,
    direction: 'neutral',
    label: '0.0%',
    isPositive: true
  };
}

/**
 * GET /api/reports/executive-analytics
 * High-performance enterprise business intelligence endpoint with time-series & visual breakdown
 */
const getExecutiveAnalytics = async (req, res, next) => {
  try {
    const { preset = 'this_month', start_date, end_date, project_id, agent_id, source, unit_type } = req.query;
    const { startStr, endStr, prevStartStr, prevEndStr, displayPeriod } = resolveDateRange(preset, start_date, end_date);

    // Build common filter fragments
    let leadFilter = 'WHERE 1=1';
    const leadParams = [];
    if (project_id) { leadFilter += ' AND l.preferred_project_id = ?'; leadParams.push(project_id); }
    if (agent_id) { leadFilter += ' AND l.assigned_agent_id = ?'; leadParams.push(agent_id); }
    if (source) { leadFilter += ' AND l.source = ?'; leadParams.push(source); }

    // 1. Current Period Leads & Opportunities
    const [[currLeads]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_leads,
        SUM(CASE WHEN stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST') THEN 1 ELSE 0 END) AS active_opportunities,
        SUM(CASE WHEN stage IN ('Booking Done', 'WON') THEN 1 ELSE 0 END) AS converted_leads,
        SUM(CASE WHEN stage IN ('Lost', 'LOST') THEN 1 ELSE 0 END) AS lost_leads,
        SUM(CASE WHEN sla_due_date < CURDATE() AND stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST') THEN 1 ELSE 0 END) AS overdue_leads
       FROM leads l
       ${leadFilter} AND (l.created_at BETWEEN ? AND ?)`,
      [...leadParams, startStr, endStr]
    );

    // Previous Period Leads
    const [[prevLeads]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_leads,
        SUM(CASE WHEN stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST') THEN 1 ELSE 0 END) AS active_opportunities,
        SUM(CASE WHEN stage IN ('Booking Done', 'WON') THEN 1 ELSE 0 END) AS converted_leads,
        SUM(CASE WHEN stage IN ('Lost', 'LOST') THEN 1 ELSE 0 END) AS lost_leads,
        SUM(CASE WHEN sla_due_date < CURDATE() AND stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST') THEN 1 ELSE 0 END) AS overdue_leads
       FROM leads l
       ${leadFilter} AND (l.created_at BETWEEN ? AND ?)`,
      [...leadParams, prevStartStr, prevEndStr]
    );

    // 2. Deals & Bookings Performance
    let dealFilter = 'WHERE 1=1';
    const dealParams = [];
    if (project_id) { dealFilter += ' AND un.project_id = ?'; dealParams.push(project_id); }
    if (agent_id) { dealFilter += ' AND d.created_by = ?'; dealParams.push(agent_id); }
    if (unit_type) { dealFilter += ' AND un.unit_type = ?'; dealParams.push(unit_type); }

    const [[currDeals]] = await pool.query(
      `SELECT 
        COUNT(d.id) AS total_bookings,
        COALESCE(SUM(d.agreed_total_amount), 0) AS total_booking_value,
        COALESCE(SUM(d.booking_token_amount), 0) AS total_token_value,
        SUM(CASE WHEN d.status = 'CLOSED_WON' THEN 1 ELSE 0 END) AS closed_deals,
        SUM(CASE WHEN d.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_deals
       FROM deals d
       JOIN units un ON d.unit_id = un.id
       ${dealFilter} AND (d.created_at BETWEEN ? AND ?)`,
      [...dealParams, startStr, endStr]
    );

    const [[prevDeals]] = await pool.query(
      `SELECT 
        COUNT(d.id) AS total_bookings,
        COALESCE(SUM(d.agreed_total_amount), 0) AS total_booking_value
       FROM deals d
       JOIN units un ON d.unit_id = un.id
       ${dealFilter} AND (d.created_at BETWEEN ? AND ?)`,
      [...dealParams, prevStartStr, prevEndStr]
    );

    // 3. Payments & Collections
    const [[currPayments]] = await pool.query(
      `SELECT 
        COUNT(py.id) AS total_receipts,
        COALESCE(SUM(py.amount_received), 0) AS payments_received
       FROM payments py
       JOIN deals d ON py.deal_id = d.id
       JOIN units un ON d.unit_id = un.id
       ${dealFilter} AND (py.payment_date BETWEEN ? AND ?) AND py.verification_status = 'VERIFIED'`,
      [...dealParams, startStr.slice(0, 10), endStr.slice(0, 10)]
    );

    const [[prevPayments]] = await pool.query(
      `SELECT 
        COALESCE(SUM(py.amount_received), 0) AS payments_received
       FROM payments py
       JOIN deals d ON py.deal_id = d.id
       JOIN units un ON d.unit_id = un.id
       ${dealFilter} AND (py.payment_date BETWEEN ? AND ?) AND py.verification_status = 'VERIFIED'`,
      [...dealParams, prevStartStr.slice(0, 10), prevEndStr.slice(0, 10)]
    );

    // 4. Site Visits Operational Analytics
    let visitFilter = 'WHERE 1=1';
    const visitParams = [];
    if (project_id) { visitFilter += ' AND sv.project_id = ?'; visitParams.push(project_id); }
    if (agent_id) { visitFilter += ' AND sv.assigned_agent_id = ?'; visitParams.push(agent_id); }

    const [[currVisits]] = await pool.query(
      `SELECT 
        COUNT(sv.id) AS total_visits,
        SUM(CASE WHEN sv.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_visits,
        SUM(CASE WHEN sv.status IN ('ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED') THEN 1 ELSE 0 END) AS scheduled_visits,
        SUM(CASE WHEN sv.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_visits
       FROM site_visits sv
       ${visitFilter} AND (sv.scheduled_time BETWEEN ? AND ?)`,
      [...visitParams, startStr, endStr]
    );

    const [[prevVisits]] = await pool.query(
      `SELECT COUNT(sv.id) AS total_visits
       FROM site_visits sv
       ${visitFilter} AND (sv.scheduled_time BETWEEN ? AND ?)`,
      [...visitParams, prevStartStr, prevEndStr]
    );

    // 5. Total Booking vs Realized vs Outstanding
    const totalBookingVal = Number(currDeals.total_booking_value || 0);
    const totalPaidVal = Number(currPayments.payments_received || 0);
    const outstandingVal = Math.max(0, totalBookingVal - totalPaidVal);
    const collectionRate = totalBookingVal > 0 ? ((totalPaidVal / totalBookingVal) * 100).toFixed(1) : 0;

    const currConvRate = (currLeads.total_leads || 0) > 0 ? (((currLeads.converted_leads || 0) / currLeads.total_leads) * 100).toFixed(1) : 0;
    const prevConvRate = (prevLeads.total_leads || 0) > 0 ? (((prevLeads.converted_leads || 0) / prevLeads.total_leads) * 100).toFixed(1) : 0;

    // 6. Lead Conversion Funnel with Drop-off Detection
    const [funnelStages] = await pool.query(
      `SELECT stage, COUNT(*) AS count
       FROM leads l
       ${leadFilter}
       GROUP BY stage
       ORDER BY FIELD(stage, 'Fresh Lead', 'INCOMING', '1st Attempt Done', 'CONTACTED', 'Site Visit Scheduled', 'VISIT_SCHEDULED', 'Site Visit Done', 'VISIT_COMPLETED', 'Booking Done', 'WON', 'Lost', 'LOST')`,
      leadParams
    );

    let fFresh = 0, fContacted = 0, fVisit = 0, fBooked = 0, fLost = 0;
    funnelStages.forEach(s => {
      const st = (s.stage || '').toUpperCase();
      const cnt = Number(s.count || 0);
      if (st.includes('FRESH') || st.includes('INCOMING')) fFresh += cnt;
      else if (st.includes('ATTEMPT') || st.includes('CONTACT') || st.includes('HOLD')) fContacted += cnt;
      else if (st.includes('VISIT')) fVisit += cnt;
      else if (st.includes('BOOKING') || st.includes('WON')) fBooked += cnt;
      else if (st.includes('LOST') || st.includes('JUNK')) fLost += cnt;
      else fFresh += cnt;
    });

    const funnelTotal = fFresh + fContacted + fVisit + fBooked + fLost || 1;
    const funnel = [
      { stage: 'Inquiries & New Leads', count: fFresh + fContacted + fVisit + fBooked, pct: 100 },
      { stage: 'Engaged & Contacted', count: fContacted + fVisit + fBooked, pct: Math.round(((fContacted + fVisit + fBooked) / funnelTotal) * 100) },
      { stage: 'Site Tours Conducted', count: fVisit + fBooked, pct: Math.round(((fVisit + fBooked) / funnelTotal) * 100) },
      { stage: 'Bookings & Won Deals', count: fBooked, pct: Math.round((fBooked / funnelTotal) * 100) }
    ];

    let largestDropoff = { stage: 'Site Tours → Bookings', pctDrop: 0 };
    for (let i = 0; i < funnel.length - 1; i++) {
      const drop = funnel[i].count - funnel[i + 1].count;
      const dropPct = funnel[i].count > 0 ? Math.round((drop / funnel[i].count) * 100) : 0;
      if (dropPct > largestDropoff.pctDrop) {
        largestDropoff = {
          stage: `${funnel[i].stage} → ${funnel[i + 1].stage}`,
          pctDrop: dropPct
        };
      }
    }

    // 7. Lead Acquisition Channels (For Pie/Donut Chart #2)
    const [sources] = await pool.query(
      `SELECT source, COUNT(*) AS count,
              SUM(CASE WHEN stage IN ('Booking Done', 'WON') THEN 1 ELSE 0 END) AS won_count
       FROM leads l
       ${leadFilter}
       GROUP BY source
       ORDER BY count DESC`,
      leadParams
    );

    const totalSourcesLeads = sources.reduce((acc, s) => acc + Number(s.count || 0), 0) || 1;
    const channelPerformance = sources.map(s => {
      const cnt = Number(s.count || 0);
      const won = Number(s.won_count || 0);
      return {
        source: s.source,
        count: cnt,
        percentage: Math.round((cnt / totalSourcesLeads) * 100),
        won_count: won,
        conversion_rate: cnt > 0 ? `${((won / cnt) * 100).toFixed(1)}%` : '0%'
      };
    });

    // 8. Unit Types & Configurations (For Pie/Donut Chart #3)
    let unitTypeFilter = "WHERE u.status != 'ARCHIVED'";
    const unitTypeParams = [];
    if (project_id) { unitTypeFilter += ' AND u.project_id = ?'; unitTypeParams.push(project_id); }

    const [unitTypeRows] = await pool.query(
      `SELECT u.unit_type, COUNT(*) AS count,
              SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
              SUM(CASE WHEN u.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked,
              COALESCE(SUM(u.base_price), 0) AS total_val
       FROM units u
       ${unitTypeFilter}
       GROUP BY u.unit_type
       ORDER BY count DESC`,
      unitTypeParams
    );

    const totalUnitsCount = unitTypeRows.reduce((acc, r) => acc + Number(r.count || 0), 0) || 1;
    const unitTypesDistribution = unitTypeRows.map(u => ({
      unit_type: u.unit_type || 'Residential',
      count: Number(u.count || 0),
      percentage: Math.round((Number(u.count || 0) / totalUnitsCount) * 100),
      available: Number(u.available || 0),
      booked: Number(u.booked || 0),
      total_val: Number(u.total_val || 0)
    }));

    // 9. Project Portfolio Performance (For Stacked Bar Chart & Cards)
    const [projectRows] = await pool.query(
      `SELECT p.id, p.name AS project_name, p.code, p.city, p.project_type,
              COUNT(u.id) AS total_units,
              SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
              SUM(CASE WHEN u.status = 'HOLD' THEN 1 ELSE 0 END) AS hold_units,
              SUM(CASE WHEN u.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units,
              SUM(CASE WHEN u.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units,
              COALESCE(SUM(CASE WHEN u.status = 'AVAILABLE' THEN u.base_price ELSE 0 END), 0) AS available_value
       FROM projects p
       LEFT JOIN units u ON p.id = u.project_id AND u.status != 'ARCHIVED'
       WHERE p.status != 'ARCHIVED'
       GROUP BY p.id
       ORDER BY p.name ASC`
    );

    const projectCards = projectRows.map(p => {
      const avail = Number(p.available_units || 0);
      const total = Number(p.total_units || 0);
      let status = 'HEALTHY';
      if (total > 0 && avail <= 2) {
        status = 'CRITICAL';
      } else if (p.hold_units > 0 && avail === 0) {
        status = 'ATTENTION';
      }
      return {
        ...p,
        status_indicator: status,
        occupancy_rate: total > 0 ? `${Math.round(((total - avail) / total) * 100)}%` : '0%'
      };
    });

    // 10. Portfolio Inventory Totals (For Donut Chart #1)
    const [[invTotals]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_inventory,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
        SUM(CASE WHEN status = 'HOLD' THEN 1 ELSE 0 END) AS on_hold,
        SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END) AS booked,
        SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) AS sold
       FROM units u
       ${unitTypeFilter}`,
      unitTypeParams
    );

    const invTotalCount = Number(invTotals.total_inventory || 0) || 1;
    const inventoryAllocation = [
      { status: 'AVAILABLE', label: 'Available', count: Number(invTotals.available || 0), percentage: Math.round((Number(invTotals.available || 0) / invTotalCount) * 100), color: '#06b6d4' },
      { status: 'HOLD', label: 'On Hold', count: Number(invTotals.on_hold || 0), percentage: Math.round((Number(invTotals.on_hold || 0) / invTotalCount) * 100), color: '#f59e0b' },
      { status: 'BOOKED', label: 'Booked', count: Number(invTotals.booked || 0), percentage: Math.round((Number(invTotals.booked || 0) / invTotalCount) * 100), color: '#10b981' },
      { status: 'SOLD', label: 'Sold Out', count: Number(invTotals.sold || 0), percentage: Math.round((Number(invTotals.sold || 0) / invTotalCount) * 100), color: '#3b82f6' }
    ];

    // 11. Time-Series Trends (For Area / Line Growth Chart)
    const [monthlyLeads] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%b %Y') AS period_label,
              DATE_FORMAT(created_at, '%Y-%m') AS ym,
              COUNT(*) AS count
       FROM leads
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym, period_label
       ORDER BY ym ASC`
    );

    const [monthlyDeals] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%b %Y') AS period_label,
              DATE_FORMAT(created_at, '%Y-%m') AS ym,
              COUNT(*) AS deals_count,
              COALESCE(SUM(agreed_total_amount), 0) AS booking_value
       FROM deals
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym, period_label
       ORDER BY ym ASC`
    );

    // Merge into standard 6-month continuous time series
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curDate = new Date();
    const timeSeries = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
      const ym = d.toISOString().slice(0, 7);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      
      const leadEntry = monthlyLeads.find(m => m.ym === ym);
      const dealEntry = monthlyDeals.find(m => m.ym === ym);

      timeSeries.push({
        label,
        ym,
        leads: leadEntry ? Number(leadEntry.count) : 0,
        bookings: dealEntry ? Number(dealEntry.deals_count) : 0,
        booking_value: dealEntry ? Number(dealEntry.booking_value) : 0
      });
    }

    // 12. Recent Deals & Financial Transactions (For Transaction Activity List)
    const [recentTransactions] = await pool.query(
      `(SELECT 'DEAL' AS tx_type, d.id, d.deal_number AS ref, d.agreed_total_amount AS amount,
               d.created_at AS date, 'Booking Done' AS status,
               CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS client_name,
               p.name AS project_name, un.unit_number
        FROM deals d
        JOIN customers c ON d.customer_id = c.id
        JOIN units un ON d.unit_id = un.id
        JOIN projects p ON un.project_id = p.id
        ORDER BY d.created_at DESC LIMIT 4)
       UNION ALL
       (SELECT 'PAYMENT' AS tx_type, py.id, py.payment_number AS ref, py.amount_received AS amount,
               py.payment_date AS date, CONCAT(py.payment_mode, IF(py.verification_status = 'VERIFIED', '', ' (not verified)')) AS status,
               CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS client_name,
               p.name AS project_name, un.unit_number
        FROM payments py
        JOIN deals d ON py.deal_id = d.id
        JOIN customers c ON d.customer_id = c.id
        JOIN units un ON d.unit_id = un.id
        JOIN projects p ON un.project_id = p.id
        ORDER BY py.payment_date DESC LIMIT 4)
       ORDER BY date DESC LIMIT 6`
    );

    // 13. Top Agent Performance Leaderboard (if authorized)
    let agentLeaderboard = [];
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      const [agents] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email,
                COUNT(DISTINCT l.id) AS assigned_leads,
                COUNT(DISTINCT sv.id) AS visits_conducted,
                COUNT(DISTINCT d.id) AS deals_booked,
                COALESCE(SUM(d.agreed_total_amount), 0) AS total_booking_value
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN leads l ON u.id = l.assigned_agent_id
         LEFT JOIN site_visits sv ON u.id = sv.assigned_agent_id
         LEFT JOIN deals d ON u.id = d.created_by
         WHERE u.status = 'ACTIVE'
         GROUP BY u.id
         ORDER BY deals_booked DESC, total_booking_value DESC
         LIMIT 10`
      );
      agentLeaderboard = agents.map(a => {
        const lCount = Number(a.assigned_leads || 0);
        const dCount = Number(a.deals_booked || 0);
        return {
          ...a,
          conversion_rate: lCount > 0 ? `${((dCount / lCount) * 100).toFixed(1)}%` : '0%'
        };
      });
    }

    // 14. Automated "Needs Attention" Exceptions Engine
    const alerts = [];
    const overdueLeadsCount = Number(currLeads.overdue_leads || 0);
    if (overdueLeadsCount > 0) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'SLA_OVERDUE',
        message: `${overdueLeadsCount} active lead follow-up${overdueLeadsCount > 1 ? 's are' : ' is'} overdue for action.`,
        actionView: 'leads'
      });
    }

    const lowInvProjects = projectCards.filter(p => p.status_indicator === 'CRITICAL' && p.total_units > 0);
    if (lowInvProjects.length > 0) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'LOW_INVENTORY',
        message: `Low inventory warning: ${lowInvProjects.map(p => p.project_name).join(', ')} has ≤ 2 available units remaining.`,
        actionView: 'projects'
      });
    }

    const cancelledVisits = Number(currVisits.cancelled_visits || 0);
    if (cancelledVisits > 0) {
      alerts.push({
        severity: 'WARNING',
        type: 'VISIT_CANCELLED',
        message: `${cancelledVisits} site tour appointment${cancelledVisits > 1 ? 's have' : ' has'} been cancelled and may require rescheduling.`,
        actionView: 'calendar'
      });
    }

    if (largestDropoff.pctDrop >= 50) {
      alerts.push({
        severity: 'WARNING',
        type: 'FUNNEL_DROPOFF',
        message: `High funnel attrition detected: ${largestDropoff.pctDrop}% drop-off between ${largestDropoff.stage}.`,
        actionView: 'leads'
      });
    }

    // Return complete, rich analytics response
    res.status(200).json({
      status: 'success',
      data: {
        period: {
          preset,
          label: displayPeriod,
          start: startStr,
          end: endStr
        },
        kpis: {
          total_leads: {
            value: currLeads.total_leads || 0,
            trend: calculateTrend(currLeads.total_leads, prevLeads.total_leads, false)
          },
          active_opportunities: {
            value: currLeads.active_opportunities || 0,
            trend: calculateTrend(currLeads.active_opportunities, prevLeads.active_opportunities, false)
          },
          site_visits: {
            value: currVisits.total_visits || 0,
            trend: calculateTrend(currVisits.total_visits, prevVisits.total_visits, false)
          },
          bookings_count: {
            value: currDeals.total_bookings || 0,
            trend: calculateTrend(currDeals.total_bookings, prevDeals.total_bookings, false)
          },
          booking_value: {
            value: totalBookingVal,
            formatted: `₹${totalBookingVal.toLocaleString()}`,
            trend: calculateTrend(totalBookingVal, prevDeals.total_booking_value, false)
          },
          payments_received: {
            value: totalPaidVal,
            formatted: `₹${totalPaidVal.toLocaleString()}`,
            trend: calculateTrend(totalPaidVal, prevPayments.payments_received, false)
          },
          outstanding_balance: {
            value: outstandingVal,
            formatted: `₹${outstandingVal.toLocaleString()}`
          },
          conversion_rate: {
            value: `${currConvRate}%`,
            trend: calculateTrend(currConvRate, prevConvRate, false)
          },
          overdue_followups: {
            value: overdueLeadsCount,
            trend: calculateTrend(overdueLeadsCount, prevLeads.overdue_leads, true)
          }
        },
        time_series: timeSeries,
        allocations: {
          inventory: inventoryAllocation,
          channels: channelPerformance,
          unit_types: unitTypesDistribution
        },
        funnel: {
          stages: funnel,
          largest_dropoff: largestDropoff
        },
        projects: projectCards,
        inventory_totals: invTotals,
        visits: {
          total: currVisits.total_visits || 0,
          completed: currVisits.completed_visits || 0,
          scheduled: currVisits.scheduled_visits || 0,
          cancelled: currVisits.cancelled_visits || 0,
          completion_rate: (currVisits.total_visits || 0) > 0 ? `${Math.round(((currVisits.completed_visits || 0) / currVisits.total_visits) * 100)}%` : '0%'
        },
        financials: {
          booking_value: totalBookingVal,
          payments_received: totalPaidVal,
          outstanding_balance: outstandingVal,
          collection_rate: `${collectionRate}%`
        },
        recent_transactions: recentTransactions,
        agents: agentLeaderboard,
        attention_alerts: alerts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Detailed report handlers for drill-down tabs
 */
const getSalesFunnelReport = async (req, res, next) => {
  try {
    const { start_date, end_date, project_id } = req.query;
    let leadFilter = 'WHERE 1=1';
    const params = [];
    if (start_date) { leadFilter += ' AND l.created_at >= ?'; params.push(start_date); }
    if (end_date) { leadFilter += ' AND l.created_at <= ?'; params.push(end_date + ' 23:59:59'); }
    if (project_id) { leadFilter += ' AND l.preferred_project_id = ?'; params.push(project_id); }

    const [stageRows] = await pool.query(`SELECT stage, COUNT(*) AS count FROM leads l ${leadFilter} GROUP BY stage`, params);
    const [sourceRows] = await pool.query(`SELECT source, COUNT(*) AS total_leads, SUM(CASE WHEN stage IN ('Booking Done', 'WON') THEN 1 ELSE 0 END) AS won_leads FROM leads l ${leadFilter} GROUP BY source`, params);

    res.status(200).json({ status: 'success', data: { by_stage: stageRows, by_source: sourceRows } });
  } catch (error) { next(error); }
};

const getInventoryReport = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name AS project_name, p.code AS project_code, p.city, p.project_type,
              COUNT(u.id) AS total_units,
              SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
              SUM(CASE WHEN u.status = 'HOLD' THEN 1 ELSE 0 END) AS hold_units,
              SUM(CASE WHEN u.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units,
              SUM(CASE WHEN u.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units,
              COALESCE(SUM(CASE WHEN u.status = 'AVAILABLE' THEN u.base_price ELSE 0 END), 0) AS available_inventory_value
       FROM projects p
       LEFT JOIN units u ON p.id = u.project_id AND u.status != 'ARCHIVED'
       WHERE p.status != 'ARCHIVED'
       GROUP BY p.id`
    );
    res.status(200).json({ status: 'success', data: { project_inventory: rows } });
  } catch (error) { next(error); }
};

const getSiteVisitsReport = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT sv.id, sv.scheduled_time, sv.status, sv.client_feedback,
              p.name AS project_name, p.city,
              COALESCE(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')), CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))) AS visitor_name,
              u.first_name AS agent_first_name, u.last_name AS agent_last_name
       FROM site_visits sv
       JOIN projects p ON sv.project_id = p.id
       LEFT JOIN customers c ON sv.customer_id = c.id
       LEFT JOIN leads l ON sv.lead_id = l.id
       LEFT JOIN users u ON sv.assigned_agent_id = u.id
       ORDER BY sv.scheduled_time DESC LIMIT 50`
    );
    res.status(200).json({ status: 'success', data: { records } });
  } catch (error) { next(error); }
};

const getDealsReport = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT d.id, d.deal_number, d.agreed_total_amount, d.booking_token_amount, d.status, d.created_at,
              CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS customer_name,
              un.unit_number, p.name AS project_name,
              COALESCE(SUM(py.amount_received), 0) AS total_paid
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       JOIN units un ON d.unit_id = un.id
       JOIN projects p ON un.project_id = p.id
       LEFT JOIN payments py ON d.id = py.deal_id AND py.verification_status = 'VERIFIED'
       GROUP BY d.id
       ORDER BY d.created_at DESC LIMIT 50`
    );
    res.status(200).json({ status: 'success', data: { records } });
  } catch (error) { next(error); }
};

const getPaymentsReport = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT py.id, py.payment_number, py.amount_received, py.payment_date, py.payment_mode, py.reference_number, py.verification_status, py.receipt_number,
              d.deal_number, CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS customer_name,
              un.unit_number, p.name AS project_name
       FROM payments py
       JOIN deals d ON py.deal_id = d.id
       JOIN customers c ON d.customer_id = c.id
       JOIN units un ON d.unit_id = un.id
       JOIN projects p ON un.project_id = p.id
       ORDER BY py.payment_date DESC LIMIT 50`
    );
    res.status(200).json({ status: 'success', data: { records } });
  } catch (error) { next(error); }
};

const getStaffPerformanceReport = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role_name,
              COUNT(DISTINCT l.id) AS total_leads,
              SUM(CASE WHEN l.stage IN ('Booking Done', 'WON') THEN 1 ELSE 0 END) AS won_leads,
              COUNT(DISTINCT sv.id) AS site_visits_conducted,
              COUNT(DISTINCT d.id) AS deals_booked,
              COALESCE(SUM(d.agreed_total_amount), 0) AS total_deal_value
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN leads l ON u.id = l.assigned_agent_id
       LEFT JOIN site_visits sv ON u.id = sv.assigned_agent_id
       LEFT JOIN deals d ON u.id = d.created_by
       WHERE u.status = 'ACTIVE'
       GROUP BY u.id
       ORDER BY won_leads DESC, total_deal_value DESC`
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (error) { next(error); }
};

module.exports = {
  getExecutiveAnalytics,
  getSalesFunnelReport,
  getInventoryReport,
  getSiteVisitsReport,
  getDealsReport,
  getPaymentsReport,
  getStaffPerformanceReport
};
