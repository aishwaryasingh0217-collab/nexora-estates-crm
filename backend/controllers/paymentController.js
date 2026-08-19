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
  const connection = await pool.getConnection();
  try {
    const {
      deal_id,
      milestone_id,
      amount_received,
      payment_date,
      payment_mode,
      reference_number,
      notes
    } = req.body;

    if (!deal_id || !amount_received || !payment_mode) {
      return res.status(400).json({
        status: 'error',
        message: 'deal_id, amount_received, and payment_mode are required.'
      });
    }

    await connection.beginTransaction();

    // Verify deal exists
    const [deals] = await connection.query('SELECT id, status FROM deals WHERE id = ? FOR UPDATE', [deal_id]);
    if (deals.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Deal record not found.'
      });
    }

    const paymentId = crypto.randomUUID();
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const parsedAmount = parseFloat(amount_received);

    await connection.query(
      `INSERT INTO payments (
        id, payment_number, deal_id, milestone_id, amount_received, payment_date,
        payment_mode, reference_number, received_by, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        paymentNumber,
        deal_id,
        milestone_id || null,
        parsedAmount,
        payment_date || new Date().toISOString().slice(0, 10),
        payment_mode.toUpperCase(),
        reference_number || null,
        req.user.id,
        notes || null
      ]
    );

    // If milestone_id provided, update milestone status (PARTIAL or PAID)
    if (milestone_id) {
      const [milestones] = await connection.query('SELECT due_amount FROM payment_milestones WHERE id = ?', [milestone_id]);
      if (milestones.length > 0) {
        const dueAmount = parseFloat(milestones[0].due_amount);
        const [sumResult] = await connection.query(
          'SELECT SUM(amount_received) AS total FROM payments WHERE milestone_id = ?',
          [milestone_id]
        );
        const totalPaid = parseFloat(sumResult[0].total || 0);

        let newStatus = 'PARTIAL';
        if (totalPaid >= dueAmount) {
          newStatus = 'PAID';
        }

        await connection.query('UPDATE payment_milestones SET status = ? WHERE id = ?', [newStatus, milestone_id]);
      }
    }

    await connection.commit();

    // Trigger Notification
    await broadcastToAdmins({
      type: 'SUCCESS',
      title: 'Payment Received',
      message: `Payment of ₹${parsedAmount.toLocaleString()} received via ${payment_mode.toUpperCase()} (Receipt #${paymentNumber}).`,
      relatedEntityType: 'PAYMENT',
      relatedEntityId: paymentId
    });

    res.status(201).json({
      status: 'success',
      message: 'Payment recorded successfully.',
      data: {
        id: paymentId,
        payment_number: paymentNumber,
        deal_id,
        amount_received: parsedAmount,
        payment_mode: payment_mode.toUpperCase()
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
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

module.exports = {
  getPayments,
  getDealMilestones,
  recordPayment,
  createMilestone
};
