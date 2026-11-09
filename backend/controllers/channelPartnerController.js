const crypto = require('crypto');
const pool = require('../config/db');
const { stripBankDetails } = require('../services/recordScope');

/**
 * GET /api/channel-partners
 * List all channel partners with search, tier, and status filters
 */
const getChannelPartners = async (req, res, next) => {
  try {
    const { search, tier, status } = req.query;

    let query = `
      SELECT cp.*,
             COUNT(DISTINCT bc.id) AS total_deals_count,
             COALESCE(SUM(bc.total_commission), 0) AS total_commission_earned,
             COALESCE(SUM(bc.paid_amount), 0) AS total_commission_paid,
             COALESCE(SUM(bc.total_commission - bc.paid_amount), 0) AS balance_payable
      FROM channel_partners cp
      LEFT JOIN broker_commissions bc ON cp.id = bc.partner_id
      WHERE 1=1
    `;
    const params = [];

    if (tier) {
      query += ` AND cp.tier = ?`;
      params.push(tier.toUpperCase());
    }

    if (status) {
      query += ` AND cp.status = ?`;
      params.push(status.toUpperCase());
    }

    if (search) {
      query += ` AND (cp.firm_name LIKE ? OR cp.contact_person LIKE ? OR cp.phone LIKE ? OR cp.rera_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (req.user && req.user.role === 'CHANNEL_PARTNER') {
      query += ` AND cp.id = ?`;
      params.push(req.user.channelPartnerId || '__none__');
    }

    query += ` GROUP BY cp.id ORDER BY cp.created_at DESC`;

    const [partners] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: partners.length,
      data: partners.map((p) => stripBankDetails(req.user, p))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/channel-partners/summary
 * KPI metrics for broker network
 */
const getBrokerSummary = async (req, res, next) => {
  try {
    const [counts] = await pool.query(`
      SELECT 
        COUNT(DISTINCT cp.id) AS total_partners,
        COUNT(DISTINCT CASE WHEN cp.status = 'ACTIVE' THEN cp.id END) AS active_partners,
        COALESCE(SUM(bc.total_commission), 0) AS total_commissions_earned,
        COALESCE(SUM(bc.paid_amount), 0) AS total_commissions_paid,
        COALESCE(SUM(bc.total_commission - bc.paid_amount), 0) AS total_pending_payouts,
        COUNT(DISTINCT bc.deal_id) AS total_broker_deals
      FROM channel_partners cp
      LEFT JOIN broker_commissions bc ON cp.id = bc.partner_id
    `);

    res.status(200).json({
      status: 'success',
      data: counts[0] || {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/channel-partners/:id
 * Fetch single channel partner with detailed commission ledger & payout records
 */
const getChannelPartnerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.role === 'CHANNEL_PARTNER' && id !== req.user.channelPartnerId) {
      return res.status(404).json({ status: 'error', message: 'Channel partner not found.' });
    }

    const [partners] = await pool.query(`
      SELECT * FROM channel_partners WHERE id = ?
    `, [id]);

    if (partners.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Channel partner not found.'
      });
    }

    const partner = partners[0];

    // Fetch linked deals and commission records
    const [commissions] = await pool.query(`
      SELECT bc.*, d.deal_number, d.agreed_total_amount AS final_price, d.status AS deal_status,
             p.name AS project_name, u.unit_number,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name
      FROM broker_commissions bc
      JOIN deals d ON bc.deal_id = d.id
      JOIN units u ON d.unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      JOIN customers c ON d.customer_id = c.id
      WHERE bc.partner_id = ?
      ORDER BY bc.created_at DESC
    `, [id]);

    // Fetch payout history
    const [payouts] = await pool.query(`
      SELECT bpr.*, bc.deal_id
      FROM broker_payout_records bpr
      JOIN broker_commissions bc ON bpr.commission_id = bc.id
      WHERE bpr.partner_id = ?
      ORDER BY bpr.payout_date DESC
    `, [id]);

    res.status(200).json({
      status: 'success',
      data: {
        ...stripBankDetails(req.user, partner),
        commissions,
        payouts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/channel-partners
 * Onboard new Channel Partner (Broker)
 */
const createChannelPartner = async (req, res, next) => {
  try {
    const {
      firm_name,
      contact_person,
      phone,
      email,
      rera_number,
      tier = 'GOLD',
      commission_rate = 2.50,
      pan_number,
      gst_number,
      bank_name,
      bank_account_number,
      bank_ifsc_code,
      notes
    } = req.body;

    if (!firm_name || !contact_person || !phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Firm name, contact person, and phone number are required.'
      });
    }

    const id = crypto.randomUUID();

    await pool.query(`
      INSERT INTO channel_partners (
        id, firm_name, contact_person, phone, email, rera_number,
        tier, commission_rate, pan_number, gst_number, bank_name,
        bank_account_number, bank_ifsc_code, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [
      id, firm_name, contact_person, phone, email || null, rera_number || null,
      tier, commission_rate, pan_number || null, gst_number || null, bank_name || null,
      bank_account_number || null, bank_ifsc_code || null, notes || null
    ]);

    res.status(201).json({
      status: 'success',
      message: 'Channel partner registered successfully.',
      data: { id, firm_name, contact_person, phone, tier, commission_rate }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/channel-partners/:id
 */
const updateChannelPartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      firm_name,
      contact_person,
      phone,
      email,
      rera_number,
      tier,
      commission_rate,
      pan_number,
      gst_number,
      bank_name,
      bank_account_number,
      bank_ifsc_code,
      status,
      notes
    } = req.body;

    await pool.query(`
      UPDATE channel_partners
      SET firm_name = COALESCE(?, firm_name),
          contact_person = COALESCE(?, contact_person),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          rera_number = COALESCE(?, rera_number),
          tier = COALESCE(?, tier),
          commission_rate = COALESCE(?, commission_rate),
          pan_number = COALESCE(?, pan_number),
          gst_number = COALESCE(?, gst_number),
          bank_name = COALESCE(?, bank_name),
          bank_account_number = COALESCE(?, bank_account_number),
          bank_ifsc_code = COALESCE(?, bank_ifsc_code),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      firm_name, contact_person, phone, email, rera_number,
      tier, commission_rate, pan_number, gst_number, bank_name,
      bank_account_number, bank_ifsc_code, status, notes, id
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Channel partner profile updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/channel-partners/payouts
 * Record a broker commission disbursement with receipt generation
 */
const recordCommissionPayout = async (req, res, next) => {
  try {
    const { commission_id, partner_id, payout_amount, payment_mode = 'NEFT', transaction_reference, payout_date, notes } = req.body;

    if (!commission_id || !partner_id || !payout_amount || !transaction_reference) {
      return res.status(400).json({
        status: 'error',
        message: 'Commission ID, Partner ID, payout amount, and transaction reference are required.'
      });
    }

    const payoutId = crypto.randomUUID();
    const payDate = payout_date || new Date().toISOString().split('T')[0];

    // Insert payout record
    await pool.query(`
      INSERT INTO broker_payout_records (
        id, commission_id, partner_id, payout_amount, payment_mode, transaction_reference, payout_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [payoutId, commission_id, partner_id, payout_amount, payment_mode, transaction_reference, payDate, notes || null]);

    // Update paid_amount and status on commission record
    const [commRows] = await pool.query('SELECT total_commission, paid_amount FROM broker_commissions WHERE id = ?', [commission_id]);
    if (commRows.length > 0) {
      const newPaid = Number(commRows[0].paid_amount || 0) + Number(payout_amount);
      const total = Number(commRows[0].total_commission || 0);
      const newStatus = newPaid >= total ? 'FULLY_PAID' : 'PARTIALLY_PAID';

      await pool.query(`
        UPDATE broker_commissions
        SET paid_amount = ?, status = ?
        WHERE id = ?
      `, [newPaid, newStatus, commission_id]);
    }

    res.status(201).json({
      status: 'success',
      message: 'Broker commission payout recorded successfully.',
      data: {
        payoutId,
        payoutAmount: payout_amount,
        transactionReference: transaction_reference,
        payoutDate: payDate
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChannelPartners,
  getBrokerSummary,
  getChannelPartnerById,
  createChannelPartner,
  updateChannelPartner,
  recordCommissionPayout
};
