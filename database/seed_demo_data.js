/**
 * Real Estate CRM - Full Demo Data Seeder Script
 * Seeds realistic sample projects, buildings, units, leads, customers, site visits, deals, and payments.
 */

require('dotenv').config();
const crypto = require('crypto');
const pool = require('../backend/config/db');

async function seedDemoData() {
  console.log('[Seed] Seeding Real Estate CRM demo datasets...');

  try {
    const superAdminId = 'a1b2c3d4-0000-4000-8000-000000000001';

    // 1. Projects
    const p1Id = 'p1000000-0000-4000-8000-000000000001';
    const p2Id = 'p2000000-0000-4000-8000-000000000002';
    const p3Id = 'p3000000-0000-4000-8000-000000000003';

    await pool.query(`
      INSERT INTO projects (id, name, code, project_type, location, city, status, total_units, created_by)
      VALUES 
        (?, 'Greenfield Heights', 'GFH-BLR', 'RESIDENTIAL', 'Whitefield Main Road', 'Bangalore', 'UNDER_CONSTRUCTION', 120, ?),
        (?, 'Grand Horizon Plaza', 'GHP-MUM', 'COMMERCIAL', 'BKC Corporate Zone', 'Mumbai', 'UNDER_CONSTRUCTION', 45, ?),
        (?, 'Palm Springs Estates', 'PSE-HYD', 'PLOTTED', 'Gachibowli Outer Ring Road', 'Hyderabad', 'READY_TO_MOVE', 80, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, [p1Id, superAdminId, p2Id, superAdminId, p3Id, superAdminId]);

    // 2. Buildings / Towers
    const b1Id = 'b1000000-0000-4000-8000-000000000001';
    const b2Id = 'b2000000-0000-4000-8000-000000000002';

    await pool.query(`
      INSERT INTO buildings (id, project_id, name, total_floors, units_per_floor, status)
      VALUES 
        (?, ?, 'Tower A - Emerald', 15, 4, 'ACTIVE'),
        (?, ?, 'Tower B - Sapphire', 15, 4, 'ACTIVE')
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, [b1Id, p1Id, b2Id, p1Id]);

    // 3. Units Inventory
    const u1Id = 'u1000000-0000-4000-8000-000000000001';
    const u2Id = 'u2000000-0000-4000-8000-000000000002';
    const u3Id = 'u3000000-0000-4000-8000-000000000003';
    const u4Id = 'u4000000-0000-4000-8000-000000000004';

    await pool.query(`
      INSERT INTO units (
        id, project_id, building_id, unit_number, floor_number, asset_category, unit_type,
        carpet_area_sqft, super_area_sqft, plot_area_sqft, plot_dimensions, facing, is_corner,
        base_price, plc_charges, status
      ) VALUES 
        (?, ?, ?, '101', 1, 'RESIDENTIAL', '2BHK', 950.00, 1250.00, NULL, NULL, 'EAST', 1, 8500000.00, 250000.00, 'AVAILABLE'),
        (?, ?, ?, '102', 1, 'RESIDENTIAL', '3BHK', 1350.00, 1750.00, NULL, NULL, 'NORTH_EAST', 0, 12000000.00, 300000.00, 'AVAILABLE'),
        (?, ?, ?, '201', 2, 'RESIDENTIAL', '3BHK', 1400.00, 1800.00, NULL, NULL, 'WEST', 1, 12500000.00, 350000.00, 'HOLD'),
        (?, ?, NULL, 'PLOT-42', NULL, 'PLOT', 'PLOT', NULL, NULL, 2400.00, '40x60', 'EAST', 1, 9600000.00, 400000.00, 'AVAILABLE')
      ON DUPLICATE KEY UPDATE unit_number = VALUES(unit_number)
    `, [u1Id, p1Id, b1Id, u2Id, p1Id, b1Id, u3Id, p1Id, b1Id, u4Id, p3Id]);

    // 4. Leads
    const l1Id = 'l1000000-0000-4000-8000-000000000001';
    const l2Id = 'l2000000-0000-4000-8000-000000000002';
    const l3Id = 'l3000000-0000-4000-8000-000000000003';

    await pool.query(`
      INSERT INTO leads (
        id, first_name, last_name, email, phone, source, stage,
        budget_min, budget_max, preferred_project_id, assigned_agent_id, sla_due_date, notes
      ) VALUES 
        (?, 'Vikram', 'Sharma', 'vikram.sharma@example.com', '+919876543210', 'WEBSITE_FORM', 'CONTACTED', 8000000.00, 10000000.00, ?, ?, CURDATE(), 'Looking for a 2BHK facing East.'),
        (?, 'Priya', 'Nair', 'priya.nair@example.com', '+919812345678', 'FACEBOOK_ADS', 'VISIT_SCHEDULED', 11000000.00, 13000000.00, ?, ?, DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Scheduled site visit for Sunday afternoon.'),
        (?, 'Amit', 'Patel', 'amit.patel@example.com', '+919988776655', 'WALK_IN', 'WON', 12000000.00, 15000000.00, ?, ?, CURDATE(), 'Converted customer.')
      ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)
    `, [l1Id, p1Id, superAdminId, l2Id, p1Id, superAdminId, l3Id, p1Id, superAdminId]);

    // 5. Customers
    const c1Id = 'c1000000-0000-4000-8000-000000000001';
    await pool.query(`
      INSERT INTO customers (id, lead_id, first_name, last_name, email, phone, pan_tax_id, address_line1, city, state, pincode, kyc_status, assigned_rep_id)
      VALUES (?, ?, 'Amit', 'Patel', 'amit.patel@example.com', '+919988776655', 'ABCDE1234F', 'Flat 402, Lotus Apartments', 'Bangalore', 'Karnataka', '560066', 'VERIFIED', ?)
      ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)
    `, [c1Id, l3Id, superAdminId]);

    // 6. Site Visits
    const sv1Id = 'sv100000-0000-4000-8000-000000000001';
    await pool.query(`
      INSERT INTO site_visits (id, lead_id, customer_id, project_id, assigned_agent_id, scheduled_time, status, client_feedback, rating)
      VALUES (?, ?, NULL, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'SCHEDULED', 'Client interested in Tower A 2BHK layout.', 5)
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `, [sv1Id, l2Id, p1Id, superAdminId]);

    console.log('[Seed] All demo datasets successfully seeded into realestate_crm!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]: Failed to seed demo datasets:', error.message);
    process.exit(1);
  }
}

seedDemoData();
