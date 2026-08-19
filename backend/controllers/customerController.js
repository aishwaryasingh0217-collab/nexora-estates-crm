const crypto = require('crypto');
const pool = require('../config/db');

const getCustomers = async (req, res, next) => {
  try {
    const { search, kyc_status, rep_id } = req.query;

    let query = `
      SELECT c.*, u.first_name AS rep_first_name, u.last_name AS rep_last_name,
             COUNT(d.id) AS total_deals,
             SUM(CASE WHEN d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') THEN d.agreed_total_amount ELSE 0 END) AS total_purchased_value
      FROM customers c
      LEFT JOIN users u ON c.assigned_rep_id = u.id
      LEFT JOIN deals d ON c.id = d.customer_id
      WHERE 1=1
    `;
    const params = [];

    if (kyc_status) {
      query += ` AND c.kyc_status = ?`;
      params.push(kyc_status.toUpperCase());
    }
    if (rep_id) {
      query += ` AND c.assigned_rep_id = ?`;
      params.push(rep_id);
    }
    if (search) {
      query += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.pan_tax_id LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const [customers] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: customers.length,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const [customers] = await pool.query(
      `SELECT c.*, u.first_name AS rep_first_name, u.last_name AS rep_last_name
       FROM customers c
       LEFT JOIN users u ON c.assigned_rep_id = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer profile not found.'
      });
    }

    const [deals] = await pool.query(
      `SELECT d.*, un.unit_number, un.asset_category, un.unit_type, p.name AS project_name
       FROM deals d
       JOIN units un ON d.unit_id = un.id
       JOIN projects p ON un.project_id = p.id
       WHERE d.customer_id = ?
       ORDER BY d.created_at DESC`,
      [req.params.id]
    );

    const [siteVisits] = await pool.query(
      `SELECT sv.*, p.name AS project_name
       FROM site_visits sv
       JOIN projects p ON sv.project_id = p.id
       WHERE sv.customer_id = ?
       ORDER BY sv.scheduled_time DESC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...customers[0],
        deals,
        siteVisits
      }
    });
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      pan_tax_id,
      address_line1,
      city,
      state,
      pincode,
      kyc_status,
      assigned_rep_id
    } = req.body;

    if (!first_name || !phone) {
      return res.status(400).json({
        status: 'error',
        message: 'first_name and phone are required.'
      });
    }

    const customerId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO customers (
        id, first_name, last_name, email, phone, pan_tax_id,
        address_line1, city, state, pincode, kyc_status, assigned_rep_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        first_name.trim(),
        last_name ? last_name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone.trim(),
        pan_tax_id ? pan_tax_id.trim().toUpperCase() : null,
        address_line1 || null,
        city || null,
        state || null,
        pincode || null,
        kyc_status ? kyc_status.toUpperCase() : 'PENDING',
        assigned_rep_id || req.user.id
      ]
    );

    res.status(201).json({
      status: 'success',
      message: 'Customer profile created successfully.',
      data: {
        id: customerId,
        first_name,
        last_name,
        email,
        phone,
        kyc_status: kyc_status ? kyc_status.toUpperCase() : 'PENDING'
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      pan_tax_id,
      address_line1,
      city,
      state,
      pincode,
      kyc_status,
      assigned_rep_id
    } = req.body;

    const [result] = await pool.query(
      `UPDATE customers
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           pan_tax_id = COALESCE(?, pan_tax_id),
           address_line1 = COALESCE(?, address_line1),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           pincode = COALESCE(?, pincode),
           kyc_status = COALESCE(?, kyc_status),
           assigned_rep_id = COALESCE(?, assigned_rep_id)
       WHERE id = ?`,
      [
        first_name,
        last_name,
        email,
        phone,
        pan_tax_id,
        address_line1,
        city,
        state,
        pincode,
        kyc_status,
        assigned_rep_id,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer profile not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Customer profile updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer
};
