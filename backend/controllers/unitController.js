const crypto = require('crypto');
const pool = require('../config/db');

/**
 * GET /api/units
 * List units with flexible filtering by project_id, building_id, status, asset_category, unit_type
 */
const getUnits = async (req, res, next) => {
  try {
    const { project_id, building_id, status, asset_category, unit_type, search } = req.query;

    let query = `
      SELECT u.*, p.name AS project_name, p.code AS project_code, b.name AS building_name
      FROM units u
      JOIN projects p ON u.project_id = p.id
      LEFT JOIN buildings b ON u.building_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      query += ` AND u.project_id = ?`;
      params.push(project_id);
    }
    if (building_id) {
      query += ` AND u.building_id = ?`;
      params.push(building_id);
    }
    if (status) {
      query += ` AND u.status = ?`;
      params.push(status.toUpperCase());
    }
    if (asset_category) {
      query += ` AND u.asset_category = ?`;
      params.push(asset_category.toUpperCase());
    }
    if (unit_type) {
      query += ` AND u.unit_type = ?`;
      params.push(unit_type.toUpperCase());
    }
    if (search) {
      query += ` AND (u.unit_number LIKE ? OR p.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY u.floor_number ASC, u.unit_number ASC`;

    const [units] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: units.length,
      data: units
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/units/:id
 * Get unit detail with deal history
 */
const getUnitById = async (req, res, next) => {
  try {
    const [units] = await pool.query(
      `SELECT u.*, p.name AS project_name, p.code AS project_code, b.name AS building_name
       FROM units u
       JOIN projects p ON u.project_id = p.id
       LEFT JOIN buildings b ON u.building_id = b.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (units.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found.'
      });
    }

    // Fetch historical deals associated with unit (1 unit -> N historical deals)
    const [historicalDeals] = await pool.query(
      `SELECT d.id, d.deal_number, d.agreed_total_amount, d.status, d.created_at, d.cancelled_at, d.cancellation_reason,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       WHERE d.unit_id = ?
       ORDER BY d.created_at DESC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...units[0],
        historicalDeals
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/units
 * SUPER_ADMIN only: Create unit inventory
 */
const createUnit = async (req, res, next) => {
  try {
    const {
      project_id,
      building_id,
      unit_number,
      floor_number,
      asset_category,
      unit_type,
      carpet_area_sqft,
      super_area_sqft,
      plot_area_sqft,
      plot_dimensions,
      facing,
      is_corner,
      base_price,
      plc_charges,
      status
    } = req.body;

    if (!project_id || !unit_number || !asset_category || !unit_type || !base_price) {
      return res.status(400).json({
        status: 'error',
        message: 'project_id, unit_number, asset_category, unit_type, and base_price are required.'
      });
    }

    const normalizedCategory = asset_category.toUpperCase();

    // Asset validation
    if (normalizedCategory === 'PLOT') {
      if (!plot_area_sqft) {
        return res.status(400).json({
          status: 'error',
          message: 'plot_area_sqft is required for PLOT asset category.'
        });
      }
    }

    // Check unique location (project_id, building_id, unit_number)
    const [existing] = await pool.query(
      'SELECT id FROM units WHERE project_id = ? AND (building_id = ? OR (building_id IS NULL AND ? IS NULL)) AND unit_number = ?',
      [project_id, building_id || null, building_id || null, unit_number.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: `Unit '${unit_number}' already exists in this location.`
      });
    }

    const unitId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO units (
        id, project_id, building_id, unit_number, floor_number, asset_category, unit_type,
        carpet_area_sqft, super_area_sqft, plot_area_sqft, plot_dimensions, facing, is_corner,
        base_price, plc_charges, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unitId,
        project_id,
        building_id || null,
        unit_number.trim(),
        floor_number || null,
        normalizedCategory,
        unit_type.toUpperCase(),
        carpet_area_sqft || null,
        super_area_sqft || null,
        plot_area_sqft || null,
        plot_dimensions || null,
        facing || null,
        is_corner ? true : false,
        base_price,
        plc_charges || 0.00,
        status || 'AVAILABLE'
      ]
    );

    res.status(201).json({
      status: 'success',
      message: 'Unit inventory record created successfully.',
      data: {
        id: unitId,
        project_id,
        building_id: building_id || null,
        unit_number: unit_number.trim(),
        asset_category: normalizedCategory,
        unit_type: unit_type.toUpperCase(),
        status: status || 'AVAILABLE'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/units/:id
 * SUPER_ADMIN only: Update unit details
 */
const updateUnit = async (req, res, next) => {
  try {
    const {
      unit_number,
      floor_number,
      carpet_area_sqft,
      super_area_sqft,
      plot_area_sqft,
      plot_dimensions,
      facing,
      is_corner,
      base_price,
      plc_charges,
      status
    } = req.body;

    const [result] = await pool.query(
      `UPDATE units
       SET unit_number = COALESCE(?, unit_number),
           floor_number = COALESCE(?, floor_number),
           carpet_area_sqft = COALESCE(?, carpet_area_sqft),
           super_area_sqft = COALESCE(?, super_area_sqft),
           plot_area_sqft = COALESCE(?, plot_area_sqft),
           plot_dimensions = COALESCE(?, plot_dimensions),
           facing = COALESCE(?, facing),
           is_corner = COALESCE(?, is_corner),
           base_price = COALESCE(?, base_price),
           plc_charges = COALESCE(?, plc_charges),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [
        unit_number,
        floor_number,
        carpet_area_sqft,
        super_area_sqft,
        plot_area_sqft,
        plot_dimensions,
        facing,
        is_corner,
        base_price,
        plc_charges,
        status,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Unit inventory record updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/units/:id/hold
 * SUPER_ADMIN only: Reserve inventory on temporary HOLD status with 24-hour expiration timer
 */
const holdUnit = async (req, res, next) => {
  try {
    const [units] = await pool.query('SELECT id, status FROM units WHERE id = ?', [req.params.id]);

    if (units.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found.'
      });
    }

    if (units[0].status !== 'AVAILABLE') {
      return res.status(409).json({
        status: 'error',
        message: `Cannot hold unit. Current status is '${units[0].status}'.`
      });
    }

    // Set hold_expires_at to 24 hours from NOW()
    await pool.query(
      `UPDATE units 
       SET status = 'HOLD', hold_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) 
       WHERE id = ?`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Unit placed on temporary 24-hour HOLD reservation.',
      data: {
        unitId: req.params.id,
        status: 'HOLD',
        holdExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/units/:id/cost-sheet
 * Smart Real Estate CPQ: Computes granular cost sheet, statutory taxes, and construction payment milestones
 */
const generateUnitCostSheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      client_name = 'Prospective Buyer',
      client_phone = '',
      client_email = '',
      plan_type = 'CONSTRUCTION_LINKED', // 'CONSTRUCTION_LINKED' | 'DOWN_PAYMENT' | 'TIME_LINKED'
      discount_percent = 0,
      custom_notes = ''
    } = req.body || {};

    const [units] = await pool.query(`
      SELECT u.*, p.name AS project_name, p.code AS project_code, p.location AS project_location, p.city AS project_city,
             b.name AS building_name
      FROM units u
      JOIN projects p ON u.project_id = p.id
      LEFT JOIN buildings b ON u.building_id = b.id
      WHERE u.id = ?
    `, [id]);

    if (units.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Unit not found.'
      });
    }

    const unit = units[0];
    const superArea = Number(unit.super_area_sqft || unit.plot_area_sqft || 1200);
    const carpetArea = Number(unit.carpet_area_sqft || (superArea * 0.75));
    const floorNum = Number(unit.floor_number || 1);

    // 1. Component Pricing
    const basePrice = Number(unit.base_price || 7500000);
    const plcCharges = Number(unit.plc_charges || (unit.is_corner ? 250000 : 0));
    const floorRiseRate = 50; // ₹50 per sqft per floor above ground floor
    const floorRiseTotal = floorNum > 1 ? (floorNum - 1) * floorRiseRate * superArea : 0;
    const clubhouseCharges = 250000;
    const parkingCharges = 300000;

    // Gross Basic Consideration
    const grossBasic = basePrice + plcCharges + floorRiseTotal + clubhouseCharges + parkingCharges;
    const discountAmount = (grossBasic * Number(discount_percent || 0)) / 100;
    const netAgreementValue = grossBasic - discountAmount;

    // 2. Statutory Taxes & Government Charges
    const gstRate = 5.0; // 5% GST for standard residential
    const gstAmount = Math.round((netAgreementValue * gstRate) / 100);
    const stampDutyRate = 5.6; // 5.6% standard Stamp Duty
    const stampDutyAmount = Math.round((netAgreementValue * stampDutyRate) / 100);
    const registrationRate = 1.0; // 1% Registration
    const registrationAmount = Math.round((netAgreementValue * registrationRate) / 100);
    const totalGovernmentCharges = gstAmount + stampDutyAmount + registrationAmount;

    // 3. Maintenance & Possession Deposits
    const maintenanceDeposit = Math.round(superArea * 48); // ₹48/sqft (2-year advance)
    const legalDocCharges = 35000;
    const totalPossessionDeposits = maintenanceDeposit + legalDocCharges;

    // 4. Grand Total
    const grandTotal = netAgreementValue + totalGovernmentCharges + totalPossessionDeposits;

    // 5. Payment Milestone Schedule
    let milestones = [];
    if (plan_type === 'DOWN_PAYMENT') {
      milestones = [
        { milestone: 'Booking Token / Expression of Interest', percentage: 10, amount: Math.round(netAgreementValue * 0.10), timeline: 'Immediate' },
        { milestone: 'Down Payment (within 45 Days) [5% Upfront Incentive Applied]', percentage: 80, amount: Math.round(netAgreementValue * 0.80), timeline: 'Within 45 Days of Booking' },
        { milestone: 'On Intimation of Possession & Handover', percentage: 10, amount: Math.round(netAgreementValue * 0.10) + totalGovernmentCharges + totalPossessionDeposits, timeline: 'Upon Final Handover Notice' }
      ];
    } else if (plan_type === 'TIME_LINKED') {
      milestones = [
        { milestone: '1st Installment (Booking Advance)', percentage: 20, amount: Math.round(netAgreementValue * 0.20), timeline: 'At Booking' },
        { milestone: '2nd Installment (Month 3)', percentage: 20, amount: Math.round(netAgreementValue * 0.20), timeline: '90 Days Post Booking' },
        { milestone: '3rd Installment (Month 6)', percentage: 20, amount: Math.round(netAgreementValue * 0.20), timeline: '180 Days Post Booking' },
        { milestone: '4th Installment (Month 9)', percentage: 20, amount: Math.round(netAgreementValue * 0.20), timeline: '270 Days Post Booking' },
        { milestone: '5th Final Installment & Possession', percentage: 20, amount: Math.round(netAgreementValue * 0.20) + totalGovernmentCharges + totalPossessionDeposits, timeline: 'On Key Handover' }
      ];
    } else {
      // Construction-Linked Plan (Standard)
      milestones = [
        { milestone: '1. Booking Advance / Token', percentage: 10, amount: Math.round(netAgreementValue * 0.10), timeline: 'Immediate upon reservation' },
        { milestone: '2. Execution of Agreement for Sale', percentage: 10, amount: Math.round(netAgreementValue * 0.10), timeline: 'Within 30 days of booking' },
        { milestone: '3. Completion of Plinth / Foundation', percentage: 15, amount: Math.round(netAgreementValue * 0.15), timeline: 'On Foundation completion' },
        { milestone: '4. Completion of 5th Floor Slab', percentage: 15, amount: Math.round(netAgreementValue * 0.15), timeline: 'On 5th Floor Casting' },
        { milestone: '5. Completion of Top Terrace Slab', percentage: 15, amount: Math.round(netAgreementValue * 0.15), timeline: 'On Superstructure completion' },
        { milestone: '6. Completion of Internal Plaster & Flooring', percentage: 15, amount: Math.round(netAgreementValue * 0.15), timeline: 'On Finishing stage' },
        { milestone: '7. Completion of Elevators, MEP & Facade', percentage: 15, amount: Math.round(netAgreementValue * 0.15), timeline: 'On External MEP works' },
        { milestone: '8. On Intimation of Possession / Handover', percentage: 5, amount: Math.round(netAgreementValue * 0.05) + totalGovernmentCharges + totalPossessionDeposits, timeline: 'On Key Handover & Registration' }
      ];
    }

    const shareSummaryText = `🏢 *${unit.project_name}* - Unit ${unit.unit_number} (${unit.unit_type})
📍 *Location:* ${unit.project_location || ''}, ${unit.project_city || ''}
📐 *Super Area:* ${superArea} sq.ft | *Carpet Area:* ${carpetArea} sq.ft | *Facing:* ${unit.facing || 'East'}

💰 *OFFICIAL COST SHEET ESTIMATE:*
• Agreement Value: ₹${netAgreementValue.toLocaleString('en-IN')}
• Taxes & Govt Charges (GST + Stamp Duty + Reg): ₹${totalGovernmentCharges.toLocaleString('en-IN')}
• Maintenance & Possession Charges: ₹${totalPossessionDeposits.toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━
⭐ *GRAND TOTAL ALL-INCLUSIVE:* ₹${grandTotal.toLocaleString('en-IN')}

📋 *Payment Plan:* ${plan_type.replace(/_/g, ' ')}
Generated by Nexora Estates CRM`;

    const cleanPhone = String(client_phone || '').replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const whatsappShareUrl = `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(shareSummaryText)}`;

    res.status(200).json({
      status: 'success',
      data: {
        unit: {
          id: unit.id,
          unitNumber: unit.unit_number,
          unitType: unit.unit_type,
          floorNumber: unit.floor_number,
          facing: unit.facing,
          carpetAreaSqft: carpetArea,
          superAreaSqft: superArea,
          status: unit.status,
          projectName: unit.project_name,
          buildingName: unit.building_name || 'Tower A',
          projectLocation: unit.project_location,
          projectCity: unit.project_city
        },
        client: {
          name: client_name,
          phone: client_phone,
          email: client_email
        },
        planType: plan_type,
        pricing: {
          basePrice,
          plcCharges,
          floorRiseTotal,
          clubhouseCharges,
          parkingCharges,
          discountAmount,
          netAgreementValue,
          gstAmount,
          stampDutyAmount,
          registrationAmount,
          totalGovernmentCharges,
          maintenanceDeposit,
          legalDocCharges,
          totalPossessionDeposits,
          grandTotal
        },
        milestones,
        shareSummaryText,
        whatsappShareUrl,
        customNotes: custom_notes
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  holdUnit,
  generateUnitCostSheet
};
