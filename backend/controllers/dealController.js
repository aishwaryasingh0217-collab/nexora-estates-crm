const crypto = require('crypto');
const pool = require('../config/db');
const { createNotification, broadcastToAdmins } = require('../services/notificationService');
const { leadIdScope } = require('../services/recordScope');
/** Bookings an agent or partner may see on the older screens (null = no limit). */
const dealScope = (user) => {
  if (user && user.role === 'CHANNEL_PARTNER') return { sql: 'd.channel_partner_id = ?', params: [user.channelPartnerId || '__none__'] };
  const s = leadIdScope(user, 'd.lead_id');
  return s ? { sql: `(d.created_by = ? OR ${s.sql})`, params: [user.id, ...s.params] } : null;
};

/**
 * GET /api/deals
 * List deals with customer, unit, project, and milestone details
 */
const getDeals = async (req, res, next) => {
  try {
    const { status, customer_id, unit_id, search } = req.query;

    let query = `
      SELECT d.*, 
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone, c.email AS customer_email,
             un.unit_number, un.asset_category, un.unit_type,
             p.name AS project_name, p.code AS project_code,
             u.first_name AS creator_first_name, u.last_name AS creator_last_name,
             COALESCE(SUM(py.amount_received), 0) AS total_paid_amount
      FROM deals d
      JOIN customers c ON d.customer_id = c.id
      JOIN units un ON d.unit_id = un.id
      JOIN projects p ON un.project_id = p.id
      JOIN users u ON d.created_by = u.id
      LEFT JOIN payments py ON d.id = py.deal_id AND py.verification_status = 'VERIFIED'
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND d.status = ?`;
      params.push(status.toUpperCase());
    }
    if (customer_id) {
      query += ` AND d.customer_id = ?`;
      params.push(customer_id);
    }
    if (unit_id) {
      query += ` AND d.unit_id = ?`;
      params.push(unit_id);
    }
    if (search) {
      query += ` AND (d.deal_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR un.unit_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Agents see bookings for their own clients; partners see their firm's bookings
    const scope = dealScope(req.user);
    if (scope) {
      query += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }

    query += ` GROUP BY d.id ORDER BY d.created_at DESC`;

    const [deals] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: deals.length,
      data: deals
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/deals/:id
 * Get complete deal detail with milestone schedule and payment receipts
 */
const getDealById = async (req, res, next) => {
  try {
    const [deals] = await pool.query(
      `SELECT d.*, 
              c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone, c.email AS customer_email, c.pan_tax_id,
              un.unit_number, un.asset_category, un.unit_type, un.floor_number, un.carpet_area_sqft, un.super_area_sqft, un.plot_area_sqft,
              p.name AS project_name, p.code AS project_code, p.location AS project_location,
              u.first_name AS creator_first_name, u.last_name AS creator_last_name
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       JOIN units un ON d.unit_id = un.id
       JOIN projects p ON un.project_id = p.id
       JOIN users u ON d.created_by = u.id
       WHERE d.id = ?${dealScope(req.user) ? ` AND ${dealScope(req.user).sql}` : ''}`,
      [req.params.id, ...(dealScope(req.user) ? dealScope(req.user).params : [])]
    );

    if (deals.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Deal record not found.'
      });
    }

    const [milestones] = await pool.query(
      `SELECT * FROM payment_milestones WHERE deal_id = ? ORDER BY due_date ASC`,
      [req.params.id]
    );

    const [payments] = await pool.query(
      `SELECT py.*, u.first_name AS receiver_first_name, u.last_name AS receiver_last_name
       FROM payments py
       JOIN users u ON py.received_by = u.id
       WHERE py.deal_id = ?
       ORDER BY py.payment_date DESC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...deals[0],
        milestones,
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/deals
 * SUPER_ADMIN only: Create deal / booking reservation
 * ENFORCES DOUBLE-BOOKING PREVENTION VIA MYSQL ROW LOCKING (SELECT ... FOR UPDATE)
 */
const createDeal = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      customer_id,
      lead_id,
      unit_id,
      base_price,
      plc_charges,
      parking_charges,
      taxes_amount,
      discount_amount,
      maintenance_deposit,
      booking_token_amount,
      closing_date,
      milestones // Array of [{ milestone_name, due_percentage, due_amount, due_date }]
    } = req.body;

    if (!customer_id || !unit_id || !base_price || !booking_token_amount) {
      return res.status(400).json({
        status: 'error',
        message: 'customer_id, unit_id, base_price, and booking_token_amount are required.'
      });
    }

    await connection.beginTransaction();

    // 1. SELECT * FROM units WHERE id = ? FOR UPDATE to prevent double-booking concurrency
    const [units] = await connection.query(
      'SELECT id, status, base_price, plc_charges, hold_deal_id FROM units WHERE id = ? FOR UPDATE',
      [unit_id]
    );

    if (units.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Selected unit does not exist.'
      });
    }

    const unit = units[0];

    // Double-booking check: Unit MUST be AVAILABLE (or HOLD if held by current session).
    // A unit reserved for a booking that is waiting for approval belongs to that booking.
    if ((unit.status !== 'AVAILABLE' && unit.status !== 'HOLD') || (unit.status === 'HOLD' && unit.hold_deal_id)) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        message: unit.hold_deal_id
          ? 'Double-booking prevented! This unit is reserved for a booking that is waiting for approval.'
          : `Double-booking prevented! Unit is currently in '${unit.status}' state and cannot be booked.`
      });
    }

    // Cost calculation
    const parsedBase = parseFloat(base_price);
    const parsedPlc = parseFloat(plc_charges || 0);
    const parsedParking = parseFloat(parking_charges || 0);
    const parsedTaxes = parseFloat(taxes_amount || 0);
    const parsedDiscount = parseFloat(discount_amount || 0);
    const parsedMaintenance = parseFloat(maintenance_deposit || 0);

    const agreedTotal = parsedBase + parsedPlc + parsedParking + parsedTaxes + parsedMaintenance - parsedDiscount;

    const dealId = crypto.randomUUID();
    const dealNumber = `DEAL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 2. Insert new deal record
    await connection.query(
      `INSERT INTO deals (
        id, deal_number, customer_id, lead_id, unit_id, base_price, plc_charges,
        parking_charges, taxes_amount, discount_amount, maintenance_deposit,
        agreed_total_amount, booking_token_amount, status, created_by, closing_date
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?)`,
      [
        dealId,
        dealNumber,
        customer_id,
        lead_id || null,
        unit_id,
        parsedBase,
        parsedPlc,
        parsedParking,
        parsedTaxes,
        parsedDiscount,
        parsedMaintenance,
        agreedTotal,
        parseFloat(booking_token_amount),
        req.user.id,
        closing_date || null
      ]
    );

    // 3. Update unit status to BOOKED
    await connection.query(`UPDATE units SET status = 'BOOKED', hold_expires_at = NULL WHERE id = ?`, [unit_id]);

    // 4. Create Initial Booking Token Milestone
    const milestoneId = crypto.randomUUID();
    await connection.query(
      `INSERT INTO payment_milestones (id, deal_id, milestone_name, due_percentage, due_amount, due_date, status)
       VALUES (?, ?, 'Booking Token', ?, ?, CURDATE(), 'PENDING')`,
      [milestoneId, dealId, (parseFloat(booking_token_amount) / agreedTotal * 100).toFixed(2), parseFloat(booking_token_amount)]
    );

    // If custom milestone schedule provided, insert additional milestones
    if (Array.isArray(milestones) && milestones.length > 0) {
      for (const m of milestones) {
        if (m.milestone_name && m.due_amount && m.due_date) {
          const mId = crypto.randomUUID();
          await connection.query(
            `INSERT INTO payment_milestones (id, deal_id, milestone_name, due_percentage, due_amount, due_date, status)
             VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
            [mId, dealId, m.milestone_name.trim(), m.due_percentage || null, parseFloat(m.due_amount), m.due_date]
          );
        }
      }
    }

    await connection.commit();

    try {
      await require('../services/bookingService').afterBooked(dealId, req.user, req);
    } catch (hookErr) {
      console.error('[booking] post-booking steps failed for', dealId, hookErr.message);
    }

    // Trigger Notifications
    const notifMsg = `New Deal #${dealNumber} created for Unit ${unit.unit_number || unit_id} (Agreed Total: ₹${agreedTotal.toLocaleString()}).`;
    await broadcastToAdmins({
      type: 'SUCCESS',
      title: 'Deal Booking Created',
      message: notifMsg,
      relatedEntityType: 'DEAL',
      relatedEntityId: dealId
    });

    res.status(201).json({
      status: 'success',
      message: 'Deal created and unit successfully booked.',
      data: {
        id: dealId,
        deal_number: dealNumber,
        unit_id,
        agreed_total_amount: agreedTotal,
        status: 'BOOKED'
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
 * PUT /api/deals/:id
 * SUPER_ADMIN only: Update deal stage / status (DRAFT, BOOKED, AGREEMENT_SIGNED, CLOSED_WON)
 */
const updateDeal = async (req, res, next) => {
  try {
    const { status, closing_date, agreed_total_amount } = req.body;

    const [result] = await pool.query(
      `UPDATE deals
       SET status = COALESCE(?, status),
           closing_date = COALESCE(?, closing_date),
           agreed_total_amount = COALESCE(?, agreed_total_amount)
       WHERE id = ?`,
      [status, closing_date, agreed_total_amount, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Deal record not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Deal updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/deals/:id/cancel
 * SUPER_ADMIN only: Cancel deal in transaction, set deal.status = 'CANCELLED', and release unit to 'AVAILABLE'
 */
const cancelDeal = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { cancellation_reason } = req.body;

    await connection.beginTransaction();

    const [deals] = await connection.query('SELECT id, unit_id, status FROM deals WHERE id = ? FOR UPDATE', [req.params.id]);

    if (deals.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Deal record not found.'
      });
    }

    const deal = deals[0];

    if (deal.status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Deal is already cancelled.'
      });
    }

    // Update deal status to CANCELLED
    await connection.query(
      `UPDATE deals 
       SET status = 'CANCELLED', cancellation_reason = ?, cancelled_at = NOW() 
       WHERE id = ?`,
      [cancellation_reason || 'Cancelled by admin', deal.id]
    );

    // Release unit status back to AVAILABLE (allowing new historical deal for this unit)
    await connection.query(`UPDATE units SET status = 'AVAILABLE' WHERE id = ?`, [deal.unit_id]);

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'Deal cancelled and unit released to AVAILABLE status.',
      data: {
        dealId: deal.id,
        unitId: deal.unit_id,
        status: 'CANCELLED'
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  getDeals,
  getDealById,
  createDeal,
  updateDeal,
  cancelDeal
};
