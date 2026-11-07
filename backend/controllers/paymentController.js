const crypto = require('crypto');
const pool = require('../config/db');
const { createNotification, broadcastToAdmins } = require('../services/notificationService');

/**
 * GET /api/payments
 * List payment transaction receipts
 */
const getPayments = async (req, res, next) => {
  try {
    const { deal_id, milestone_id, payment_mode, search } = req.query;

    let query = `
      SELECT py.*, d.deal_number,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name,
             pm.milestone_name,
             u.first_name AS receiver_first_name, u.last_name AS receiver_last_name
      FROM payments py
      JOIN deals d ON py.deal_id = d.id
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN payment_milestones pm ON py.milestone_id = pm.id
      JOIN users u ON py.received_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (deal_id) {
      query += ` AND py.deal_id = ?`;
      params.push(deal_id);
    }
    if (milestone_id) {
      query += ` AND py.milestone_id = ?`;
      params.push(milestone_id);
    }
    if (payment_mode) {
      query += ` AND py.payment_mode = ?`;
      params.push(payment_mode.toUpperCase());
    }
    if (search) {
      query += ` AND (py.payment_number LIKE ? OR py.reference_number LIKE ? OR c.first_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY py.payment_date DESC, py.created_at DESC`;

    const [payments] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/milestones/:deal_id
 * Get milestones for a specific deal
 */
const getDealMilestones = async (req, res, next) => {
  try {
    const [milestones] = await pool.query(
      `SELECT pm.*, COALESCE(SUM(py.amount_received), 0) AS total_paid
       FROM payment_milestones pm
       LEFT JOIN payments py ON pm.id = py.milestone_id
       WHERE pm.deal_id = ?
       GROUP BY pm.id
       ORDER BY pm.due_date ASC`,
      [req.params.deal_id]
    );

    res.status(200).json({
      status: 'success',
      results: milestones.length,
      data: milestones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments
 * SUPER_ADMIN only: Record monetary payment transaction against deal/milestone
 */
const recordPayment = async (req, res, next) => {
  // Recorded payments wait for a finance team member to verify them (services/financeService.js);
  // until then they don't count as received and the milestone isn't marked paid.
  try {
    const result = await require('../services/financeService').recordPayment(req.user, req.body || {}, req);
    res.status(201).json({
      status: 'success',
      message: result.message,
      data: { id: result.id, payment_number: result.paymentNumber, verification_status: 'PENDING' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/milestones
 * SUPER_ADMIN only: Add milestone to deal schedule
 */
const createMilestone = async (req, res, next) => {
  try {
    const { deal_id, milestone_name, due_percentage, due_amount, due_date } = req.body;

    if (!deal_id || !milestone_name || !due_amount || !due_date) {
      return res.status(400).json({
        status: 'error',
        message: 'deal_id, milestone_name, due_amount, and due_date are required.'
      });
    }

    const milestoneId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO payment_milestones (id, deal_id, milestone_name, due_percentage, due_amount, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [milestoneId, deal_id, milestone_name.trim(), due_percentage || null, parseFloat(due_amount), due_date]
    );

    res.status(201).json({
      status: 'success',
      message: 'Payment milestone created successfully.',
      data: {
        id: milestoneId,
        deal_id,
        milestone_name: milestone_name.trim(),
        due_amount: parseFloat(due_amount),
        due_date
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/demand-notices/summary
 * Aggregates pending and overdue construction milestones for batch demand notice dispatch
 */
const getDemandNoticesSummary = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id AS project_id,
        p.name AS project_name,
        p.rera_number,
        b.id AS building_id,
        b.name AS building_name,
        pm.milestone_name,
        COUNT(DISTINCT pm.id) AS total_notices_count,
        SUM(pm.due_amount) AS total_demand_amount,
        SUM(COALESCE(paid_tbl.paid_sum, 0)) AS total_received_amount,
        SUM(pm.due_amount - COALESCE(paid_tbl.paid_sum, 0)) AS total_balance_due,
        MIN(pm.due_date) AS earliest_due_date,
        MAX(pm.due_date) AS latest_due_date
      FROM payment_milestones pm
      JOIN deals d ON pm.deal_id = d.id
      JOIN units u ON d.unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      LEFT JOIN buildings b ON u.building_id = b.id
      LEFT JOIN (
        SELECT milestone_id, SUM(amount_received) AS paid_sum
        FROM payments
        GROUP BY milestone_id
      ) paid_tbl ON pm.id = paid_tbl.milestone_id
      WHERE pm.status IN ('PENDING', 'PARTIAL')
        AND d.status NOT IN ('CANCELLED', 'DRAFT')
      GROUP BY p.id, b.id, pm.milestone_name
      ORDER BY earliest_due_date ASC
    `);

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/demand-notices/eligible
 * List granular eligible demand notice unit records
 */
const getEligibleDemandNotices = async (req, res, next) => {
  try {
    const { project_id, building_id, milestone_name, search } = req.query;

    let query = `
      SELECT 
        pm.id AS milestone_id,
        pm.milestone_name,
        pm.due_percentage,
        pm.due_amount,
        pm.due_date,
        pm.status AS milestone_status,
        COALESCE(paid_tbl.paid_sum, 0) AS total_paid,
        (pm.due_amount - COALESCE(paid_tbl.paid_sum, 0)) AS balance_payable,
        DATEDIFF(CURDATE(), pm.due_date) AS days_overdue,
        d.id AS deal_id,
        d.deal_number,
        d.agreed_total_amount,
        u.id AS unit_id,
        u.unit_number,
        u.floor_number,
        u.unit_type,
        u.super_area_sqft,
        b.id AS building_id,
        COALESCE(b.name, 'Phase 1') AS building_name,
        p.id AS project_id,
        p.name AS project_name,
        p.rera_number,
        c.id AS customer_id,
        c.first_name AS customer_first_name,
        c.last_name AS customer_last_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.pan_tax_id AS customer_pan
      FROM payment_milestones pm
      JOIN deals d ON pm.deal_id = d.id
      JOIN units u ON d.unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN buildings b ON u.building_id = b.id
      LEFT JOIN (
        SELECT milestone_id, SUM(amount_received) AS paid_sum
        FROM payments
        GROUP BY milestone_id
      ) paid_tbl ON pm.id = paid_tbl.milestone_id
      WHERE pm.status IN ('PENDING', 'PARTIAL')
        AND d.status NOT IN ('CANCELLED', 'DRAFT')
    `;
    const params = [];

    if (project_id) {
      query += ` AND p.id = ?`;
      params.push(project_id);
    }
    if (building_id) {
      query += ` AND b.id = ?`;
      params.push(building_id);
    }
    if (milestone_name) {
      query += ` AND pm.milestone_name = ?`;
      params.push(milestone_name);
    }
    if (search) {
      query += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR u.unit_number LIKE ? OR d.deal_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY pm.due_date ASC, u.unit_number ASC`;

    const [notices] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: notices.length,
      data: notices
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayments,
  getDealMilestones,
  recordPayment,
  createMilestone,
  getDemandNoticesSummary,
  getEligibleDemandNotices
};

