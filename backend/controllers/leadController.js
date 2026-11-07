const crypto = require('crypto');
const pool = require('../config/db');
const { createNotification, broadcastToAdmins } = require('../services/notificationService');
const { captureEnquiry, EnquiryError } = require('../services/enquiryService');
const { logActivity, notifyPartner } = require('../services/salesWorkspace');

/**
 * GET /api/leads
 * List leads with stage, source, assigned agent, and SLA filters
 */
const getLeads = async (req, res, next) => {
  try {
    const { stage, source, agent_id, search, overdue } = req.query;

    let query = `
      SELECT l.*, p.name AS preferred_project_name,
             u.first_name AS agent_first_name, u.last_name AS agent_last_name
      FROM leads l
      LEFT JOIN projects p ON l.preferred_project_id = p.id
      LEFT JOIN users u ON l.assigned_agent_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (stage) {
      query += ` AND l.stage = ?`;
      params.push(stage);
    }
    if (source) {
      query += ` AND l.source = ?`;
      params.push(source.toUpperCase());
    }
    if (agent_id) {
      query += ` AND l.assigned_agent_id = ?`;
      params.push(agent_id);
    }
    if (overdue === 'true') {
      query += ` AND l.sla_due_date < CURDATE() AND l.stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST')`;
    }
    if (search) {
      query += ` AND (l.first_name LIKE ? OR l.last_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY l.created_at DESC`;

    const [leads] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: leads.length,
      data: leads
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leads/:id
 */
const getLeadById = async (req, res, next) => {
  try {
    const [leads] = await pool.query(
      `SELECT l.*, p.name AS preferred_project_name,
              u.first_name AS agent_first_name, u.last_name AS agent_last_name
       FROM leads l
       LEFT JOIN projects p ON l.preferred_project_id = p.id
       LEFT JOIN users u ON l.assigned_agent_id = u.id
       WHERE l.id = ?`,
      [req.params.id]
    );

    if (leads.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Lead not found.'
      });
    }

    const [siteVisits] = await pool.query(
      `SELECT sv.*, p.name AS project_name, u.first_name AS agent_first_name
       FROM site_visits sv
       JOIN projects p ON sv.project_id = p.id
       JOIN users u ON sv.assigned_agent_id = u.id
       WHERE sv.lead_id = ?
       ORDER BY sv.scheduled_time DESC`,
      [req.params.id]
    );

    const [deals] = await pool.query(
      `SELECT d.*, un.unit_number, un.unit_type, p.name AS project_name
       FROM deals d
       JOIN units un ON d.unit_id = un.id
       JOIN projects p ON un.project_id = p.id
       WHERE d.lead_id = ?`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...leads[0],
        siteVisits,
        deals
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leads
 * SUPER_ADMIN only: Ingest / register new lead
 */
const createLead = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      source,
      stage,
      budget_min,
      budget_max,
      preferred_project_id,
      assigned_agent_id,
      sla_due_date,
      notes
    } = req.body;

    if (!first_name || !phone || !source) {
      return res.status(400).json({
        status: 'error',
        message: 'First name, mobile phone number, and acquisition source are required.'
      });
    }

    const leadId = crypto.randomUUID();
    const finalStage = stage ? stage : 'Fresh Lead';

    await pool.query(
      `INSERT INTO leads (id, first_name, last_name, email, phone, source, stage, budget_min, budget_max, preferred_project_id, assigned_agent_id, sla_due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadId,
        first_name,
        last_name || null,
        email || null,
        phone,
        source.toUpperCase(),
        finalStage,
        budget_min || null,
        budget_max || null,
        preferred_project_id || null,
        assigned_agent_id || null,
        sla_due_date || null,
        notes || null
      ]
    );

    // Trigger notification
    if (assigned_agent_id) {
      await createNotification({
        recipientUserId: assigned_agent_id,
        type: 'INFO',
        title: 'New Lead Assigned',
        message: `Lead ${first_name} ${last_name || ''} has been assigned to you.`,
        relatedEntityType: 'LEAD',
        relatedEntityId: leadId
      });
    }
    await broadcastToAdmins({
      type: 'INFO',
      title: 'New Lead Created',
      message: `Lead ${first_name} ${last_name || ''} was added from source ${source.toUpperCase()}.`,
      relatedEntityType: 'LEAD',
      relatedEntityId: leadId
    });

    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully.',
      data: {
        id: leadId,
        first_name,
        last_name,
        phone,
        source: source.toUpperCase(),
        stage: finalStage
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Executes an ACID transaction to book a unit for a lead
 */
async function executeLeadBooking({
  leadId,
  unitId,
  projectId,
  basePrice,
  plcCharges = 0,
  parkingCharges = 0,
  taxesAmount = 0,
  discountAmount = 0,
  maintenanceDeposit = 0,
  agreedTotalAmount,
  bookingTokenAmount,
  closingDate = null,
  userId
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch & lock lead
    const [leads] = await connection.query('SELECT * FROM leads WHERE id = ? FOR UPDATE', [leadId]);
    if (leads.length === 0) {
      throw new Error('Lead not found.');
    }
    const lead = leads[0];

    // 2. Lock unit & verify availability
    const [units] = await connection.query('SELECT * FROM units WHERE id = ? FOR UPDATE', [unitId]);
    if (units.length === 0) {
      throw new Error('Selected property unit not found.');
    }
    const unit = units[0];

    if (unit.status !== 'AVAILABLE' && unit.status !== 'HOLD') {
      const err = new Error(`Unit ${unit.unit_number} is currently ${unit.status} and cannot be booked.`);
      err.statusCode = 409;
      throw err;
    }
    if (unit.status === 'HOLD' && unit.hold_deal_id) {
      const err = new Error(`Unit ${unit.unit_number} is reserved for a booking that is waiting for approval.`);
      err.statusCode = 409;
      throw err;
    }

    // 3. Find or create Customer profile for this Lead
    const [existingCust] = await connection.query('SELECT id FROM customers WHERE lead_id = ? OR email = ? OR phone = ? LIMIT 1', [lead.id, lead.email || '', lead.phone]);
    let customerId;
    if (existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      customerId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO customers (id, lead_id, first_name, last_name, email, phone, kyc_status, assigned_rep_id)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [customerId, lead.id, lead.first_name, lead.last_name, lead.email, lead.phone, lead.assigned_agent_id || userId]
      );
    }

    // 4. Create Deal Record
    const dealId = crypto.randomUUID();
    const dealNumber = `DEAL-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalBasePrice = Number(basePrice) || Number(unit.base_price);
    const finalTotal = Number(agreedTotalAmount) || (finalBasePrice + Number(plcCharges) + Number(parkingCharges) + Number(taxesAmount) - Number(discountAmount) + Number(maintenanceDeposit));
    const finalToken = Number(bookingTokenAmount) || Math.round(finalTotal * 0.1);

    await connection.query(
      `INSERT INTO deals (id, deal_number, customer_id, lead_id, unit_id, base_price, plc_charges, parking_charges, taxes_amount, discount_amount, maintenance_deposit, agreed_total_amount, booking_token_amount, status, created_by, closing_date, channel_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?, ?)`,
      [
        dealId,
        dealNumber,
        customerId,
        lead.id,
        unit.id,
        finalBasePrice,
        Number(plcCharges),
        Number(parkingCharges),
        Number(taxesAmount),
        Number(discountAmount),
        Number(maintenanceDeposit),
        finalTotal,
        finalToken,
        userId,
        closingDate,
        lead.channel_partner_id || null
      ]
    );

    // 4b. Partner-sourced lead → commission is earned at booking, at the partner's agreed rate
    let commission = null;
    if (lead.channel_partner_id) {
      const [partners] = await connection.query(
        'SELECT commission_rate FROM channel_partners WHERE id = ?',
        [lead.channel_partner_id]
      );
      if (partners.length > 0) {
        const rate = Number(partners[0].commission_rate) || 0;
        commission = {
          id: crypto.randomUUID(),
          rate,
          amount: Math.round(finalTotal * rate) / 100
        };
        await connection.query(
          `INSERT INTO broker_commissions (id, partner_id, deal_id, deal_amount, commission_rate, total_commission, paid_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'PENDING')`,
          [commission.id, lead.channel_partner_id, dealId, finalTotal, rate, commission.amount]
        );
      }
    }

    // 5. Update Unit Status to BOOKED
    await connection.query(`UPDATE units SET status = 'BOOKED' WHERE id = ?`, [unit.id]);

    // 6. Update Lead Stage to Booking Done
    const targetProjId = projectId || unit.project_id;
    await connection.query(
      `UPDATE leads SET stage = 'Booking Done', preferred_project_id = ?, next_follow_up_at = NULL WHERE id = ?`,
      [targetProjId, lead.id]
    );
    await logActivity({
      leadId: lead.id,
      userId,
      type: 'BOOKING',
      outcome: 'BOOKED',
      note: `Unit ${unit.unit_number} booked — Deal #${dealNumber}, ₹${finalTotal.toLocaleString('en-IN')}`
    }, connection);

    // 7. Commit Transaction
    await connection.commit();

    // Payment schedule, partner commission check, customer onboarding, finance / care hand-off
    try {
      await require('../services/bookingService').afterBooked(dealId, { id: userId, name: null, role: null });
    } catch (hookErr) {
      console.error('[booking] post-booking steps failed for', dealId, hookErr.message);
    }

    if (lead.channel_partner_id) {
      await notifyPartner(lead.channel_partner_id, {
        type: 'SUCCESS',
        title: `🎉 Booking confirmed: ${lead.first_name} ${lead.last_name || ''}`.trim(),
        message: commission
          ? `Unit ${unit.unit_number} booked. Your commission of ₹${commission.amount.toLocaleString('en-IN')} (${commission.rate}%) is now in your earnings.`
          : `Unit ${unit.unit_number} has been booked for your client.`,
        leadId: lead.id
      });
    }

    // 8. Trigger Notifications
    const notifMsg = `Booking completed for Unit ${unit.unit_number} (${lead.first_name} ${lead.last_name || ''}) - Deal #${dealNumber} (₹${finalTotal.toLocaleString()}).`;
    if (lead.assigned_agent_id) {
      await createNotification({
        recipientUserId: lead.assigned_agent_id,
        type: 'SUCCESS',
        title: 'Unit Booking Confirmed',
        message: notifMsg,
        relatedEntityType: 'DEAL',
        relatedEntityId: dealId
      });
    }
    await broadcastToAdmins({
      type: 'SUCCESS',
      title: 'New Property Booking',
      message: notifMsg,
      relatedEntityType: 'DEAL',
      relatedEntityId: dealId
    });

    return {
      dealId,
      dealNumber,
      customerId,
      unitId: unit.id,
      unitNumber: unit.unit_number,
      agreedTotal: finalTotal
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/leads/:id
 * SUPER_ADMIN only: Update lead details / stage
 */
const updateLead = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      source,
      stage,
      lost_reason,
      budget_min,
      budget_max,
      preferred_project_id,
      assigned_agent_id,
      sla_due_date,
      notes,
      unit_id,
      base_price,
      agreed_total_amount,
      booking_token_amount
    } = req.body;

    const [currentLeads] = await pool.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (currentLeads.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Lead not found.' });
    }
    const currentLead = currentLeads[0];

    // Check if stage is changing to Booking Done
    const isBookingStage = stage === 'Booking Done' || stage === 'BOOKING DONE' || stage === 'WON';
    if (isBookingStage && currentLead.stage !== 'Booking Done' && currentLead.stage !== 'WON') {
      if (!unit_id && !preferred_project_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Booking cannot be completed yet. Please select the Project and Unit.'
        });
      }

      if (unit_id) {
        const bookingResult = await executeLeadBooking({
          leadId: req.params.id,
          unitId: unit_id,
          projectId: preferred_project_id,
          basePrice,
          agreedTotalAmount: agreed_total_amount,
          bookingTokenAmount: booking_token_amount,
          userId: req.user.id
        });

        return res.status(200).json({
          status: 'success',
          message: 'Lead successfully transitioned to Booking Done with Deal created.',
          data: bookingResult
        });
      }
    }

    const [result] = await pool.query(
      `UPDATE leads
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           source = COALESCE(?, source),
           stage = COALESCE(?, stage),
           lost_reason = COALESCE(?, lost_reason),
           budget_min = COALESCE(?, budget_min),
           budget_max = COALESCE(?, budget_max),
           preferred_project_id = COALESCE(?, preferred_project_id),
           assigned_agent_id = COALESCE(?, assigned_agent_id),
           sla_due_date = COALESCE(?, sla_due_date),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        first_name,
        last_name,
        email,
        phone,
        source ? source.toUpperCase() : null,
        stage,
        lost_reason,
        budget_min,
        budget_max,
        preferred_project_id,
        assigned_agent_id,
        sla_due_date,
        notes,
        req.params.id
      ]
    );

    // Notification on reassignment
    if (assigned_agent_id && assigned_agent_id !== currentLead.assigned_agent_id) {
      await createNotification({
        recipientUserId: assigned_agent_id,
        type: 'INFO',
        title: 'Lead Reassigned',
        message: `Lead ${first_name || currentLead.first_name} has been reassigned to you.`,
        relatedEntityType: 'LEAD',
        relatedEntityId: req.params.id
      });
    }

    // Notification on stage change
    if (stage && stage !== currentLead.stage) {
      const notifType = (stage === 'Lost' || stage === 'LOST') ? 'WARNING' : 'INFO';
      await broadcastToAdmins({
        type: notifType,
        title: 'Lead Stage Updated',
        message: `Lead ${first_name || currentLead.first_name} moved from ${currentLead.stage} to ${stage}.`,
        relatedEntityType: 'LEAD',
        relatedEntityId: req.params.id
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Lead updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leads/:id/book
 * Dedicated transactional booking endpoint from lead details view
 */
const bookLead = async (req, res, next) => {
  try {
    const {
      unit_id,
      project_id,
      base_price,
      plc_charges,
      parking_charges,
      taxes_amount,
      discount_amount,
      maintenance_deposit,
      agreed_total_amount,
      booking_token_amount,
      closing_date
    } = req.body;

    if (!unit_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking cannot be completed yet. Please select the Project and Unit.'
      });
    }

    const bookingResult = await executeLeadBooking({
      leadId: req.params.id,
      unitId: unit_id,
      projectId: project_id,
      basePrice: base_price,
      plcCharges: plc_charges,
      parkingCharges: parking_charges,
      taxesAmount: taxes_amount,
      discountAmount: discount_amount,
      maintenanceDeposit: maintenance_deposit,
      agreedTotalAmount: agreed_total_amount,
      bookingTokenAmount: booking_token_amount,
      closingDate: closing_date,
      userId: req.user.id
    });

    res.status(201).json({
      status: 'success',
      message: 'Lead successfully booked and Deal record created.',
      data: bookingResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leads/:id/convert
 * Convert lead into customer profile
 */
const convertLeadToCustomer = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [leads] = await connection.query('SELECT * FROM leads WHERE id = ? FOR UPDATE', [req.params.id]);

    if (leads.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Lead not found.'
      });
    }

    const lead = leads[0];

    const [existingCustomer] = await connection.query('SELECT id FROM customers WHERE lead_id = ?', [lead.id]);
    if (existingCustomer.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        message: 'Lead has already been converted to a customer profile.',
        customerId: existingCustomer[0].id
      });
    }

    const customerId = crypto.randomUUID();
    const { pan_tax_id, address_line1, city, state, pincode } = req.body;

    await connection.query(
      `INSERT INTO customers (id, lead_id, first_name, last_name, email, phone, pan_tax_id, address_line1, city, state, pincode, kyc_status, assigned_rep_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        customerId,
        lead.id,
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.phone,
        pan_tax_id || null,
        address_line1 || null,
        city || null,
        state || null,
        pincode || null,
        lead.assigned_agent_id || req.user.id
      ]
    );

    await connection.query(`UPDATE leads SET stage = 'Booking Done' WHERE id = ?`, [lead.id]);

    await connection.commit();

    await broadcastToAdmins({
      type: 'SUCCESS',
      title: 'Lead Converted to Customer',
      message: `Lead ${lead.first_name} ${lead.last_name || ''} has been registered as an official Customer.`,
      relatedEntityType: 'CUSTOMER',
      relatedEntityId: customerId
    });

    res.status(201).json({
      status: 'success',
      message: 'Lead converted to customer profile successfully.',
      data: {
        customerId,
        leadId: lead.id,
        firstName: lead.first_name,
        lastName: lead.last_name
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
 * POST /api/leads/webhook — public intake for website forms and ad platforms (Meta, Google, 99acres…).
 * All the rules (dedupe, routing, visit booking, notifications) live in services/enquiryService.js.
 */
const handleLeadWebhook = async (req, res, next) => {
  try {
    const result = await captureEnquiry(req.body || {});
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof EnquiryError) {
      return res.status(error.statusCode).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  bookLead,
  convertLeadToCustomer,
  handleLeadWebhook,
  executeLeadBooking
};

