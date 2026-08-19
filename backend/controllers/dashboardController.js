const pool = require('../config/db');

/**
 * GET /api/dashboard/stats
 * Returns high-performance KPI aggregates from core transactional tables
 */
const getDashboardStats = async (req, res, next) => {
  try {
    // 1. Projects KPI
    const [[projectStats]] = await pool.query('SELECT COUNT(*) AS total_projects FROM projects WHERE status != "ARCHIVED"');

    // 2. Units KPI Matrix
    const [[unitStats]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_units,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
        SUM(CASE WHEN status = 'HOLD' THEN 1 ELSE 0 END) AS hold_units,
        SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units,
        SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units
      FROM units WHERE status != 'ARCHIVED'
    `);

    // 3. Leads KPI Matrix
    const [[leadStats]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_leads,
        SUM(CASE WHEN stage = 'INCOMING' THEN 1 ELSE 0 END) AS incoming_leads,
        SUM(CASE WHEN stage = 'CONTACTED' THEN 1 ELSE 0 END) AS contacted_leads,
        SUM(CASE WHEN stage = 'VISIT_SCHEDULED' THEN 1 ELSE 0 END) AS visit_scheduled_leads,
        SUM(CASE WHEN stage = 'VISIT_COMPLETED' THEN 1 ELSE 0 END) AS visit_completed_leads,
        SUM(CASE WHEN stage = 'NEGOTIATION' THEN 1 ELSE 0 END) AS negotiation_leads,
        SUM(CASE WHEN stage = 'WON' THEN 1 ELSE 0 END) AS won_leads,
        SUM(CASE WHEN stage = 'LOST' THEN 1 ELSE 0 END) AS lost_leads,
        SUM(CASE WHEN sla_due_date < CURDATE() AND stage NOT IN ('WON', 'LOST') THEN 1 ELSE 0 END) AS sla_overdue_leads
      FROM leads
    `);

    // 3b. Lead Outcomes Breakdown
    const [[leadOutcomes]] = await pool.query(`
      SELECT 
        SUM(CASE WHEN lost_reason LIKE '%No Response%' OR lost_reason LIKE '%Unresponsive%' THEN 1 ELSE 0 END) AS no_response,
        SUM(CASE WHEN lost_reason LIKE '%Budget%' THEN 1 ELSE 0 END) AS budget_mismatch,
        SUM(CASE WHEN lost_reason LIKE '%Location%' THEN 1 ELSE 0 END) AS location_mismatch,
        SUM(CASE WHEN lost_reason LIKE '%Invalid%' OR lost_reason LIKE '%Unreachable%' THEN 1 ELSE 0 END) AS invalid_unreachable,
        SUM(CASE WHEN lost_reason LIKE '%Duplicate%' THEN 1 ELSE 0 END) AS duplicate_leads,
        SUM(CASE WHEN lost_reason LIKE '%Junk%' OR lost_reason LIKE '%Spam%' THEN 1 ELSE 0 END) AS junk_leads,
        SUM(CASE WHEN stage = 'LOST' THEN 1 ELSE 0 END) AS total_lost
      FROM leads
    `);

    // 4. Customers & Deals Financial KPI
    const [[customerStats]] = await pool.query('SELECT COUNT(*) AS total_customers FROM customers');

    const [[dealStats]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_deals,
        SUM(CASE WHEN status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') THEN agreed_total_amount ELSE 0 END) AS total_pipeline_revenue
      FROM deals
    `);

    const [[paymentStats]] = await pool.query('SELECT COALESCE(SUM(amount_received), 0) AS total_revenue_realized FROM payments');

    // 5. Recent Audit Activity Logs
    const [recentActivity] = await pool.query(`
      SELECT l.action, l.ip_address, l.metadata, l.created_at,
             u.first_name, u.last_name, u.username
      FROM user_audit_logs l
      LEFT JOIN users u ON l.performed_by = u.id
      ORDER BY l.created_at DESC
      LIMIT 6
    `);

    // 6. Site Visits KPI
    const [[siteVisitStats]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_site_visits,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) AS scheduled_visits,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_visits,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_visits,
        SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_visits
      FROM site_visits
    `);

    res.status(200).json({
      status: 'success',
      data: {
        projects: projectStats,
        units: unitStats,
        leads: {
          ...leadStats,
          outcomes: leadOutcomes
        },
        customers: customerStats,
        deals: {
          ...dealStats,
          total_revenue_realized: paymentStats.total_revenue_realized
        },
        siteVisits: siteVisitStats,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats
};
