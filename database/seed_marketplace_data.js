/**
 * Real Estate CRM - Marketplace & Growth Features Seed Script
 * Populates Rental, Resale, Priority Passes, Group Pools, Resale Deal Rooms, and CP Lead Locks
 */

require('dotenv').config();
const crypto = require('crypto');
const pool = require('../backend/config/db');

async function seedMarketplaceData() {
  console.log('[Seed Marketplace] Seeding Multi-Segment & "Must-Buy" growth data...');

  try {
    const p1Id = 'p1000000-0000-4000-8000-000000000001'; // Greenfield Heights
    const p2Id = 'p2000000-0000-4000-8000-000000000002'; // Grand Horizon Plaza
    const b1Id = 'b1000000-0000-4000-8000-000000000001';

    // 1. Enrich existing units & add Rental + Resale Units
    const uRentalId = 'u-rental-0000-4000-8000-000000000001';
    const uResaleId = 'u-resale-0000-4000-8000-000000000002';

    await pool.query(`
      INSERT INTO units (
        id, project_id, building_id, unit_number, floor_number, asset_category, unit_type,
        carpet_area_sqft, super_area_sqft, base_price, status, listing_type,
        rental_monthly_rent, rental_deposit, furnishing_status, owner_seller_name, owner_seller_phone, is_verified_listing
      ) VALUES 
        (?, ?, ?, '304-R', 3, 'RESIDENTIAL', '2BHK', 1050.00, 1350.00, 0.00, 'AVAILABLE', 'RENTAL', 42000.00, 150000.00, 'FULLY_FURNISHED', 'Kavita Menon', '+919845012345', 1),
        (?, ?, ?, '702-S', 7, 'RESIDENTIAL', '3BHK', 1480.00, 1920.00, 13500000.00, 'AVAILABLE', 'RESALE', NULL, NULL, 'SEMI_FURNISHED', 'Rajesh K. Singhania', '+919820098765', 1)
      ON DUPLICATE KEY UPDATE listing_type = VALUES(listing_type)
    `, [uRentalId, p1Id, b1Id, uResaleId, p1Id, b1Id]).catch(err => console.log('[Warning: Units Insert]', err.message));

    // Update existing units to NEW_LAUNCH
    await pool.query(`
      UPDATE units SET listing_type = 'NEW_LAUNCH' WHERE listing_type IS NULL;
    `).catch(() => {});

    // 2. Seed Priority Passes (Pre-Launch FOMO EOI)
    const pass1 = 'pass-0001-4000-8000-000000000001';
    const pass2 = 'pass-0002-4000-8000-000000000002';
    const pass3 = 'pass-0003-4000-8000-000000000003';

    await pool.query(`
      INSERT INTO priority_passes (
        id, project_id, pass_number, buyer_name, buyer_phone, buyer_email, token_amount,
        discount_benefit_text, priority_rank, status, expires_at
      ) VALUES
        (?, ?, 'NX-PASS-GFH-0001', 'Arjun Kapoor', '+919920112233', 'arjun.k@example.com', 21000.00, '₹500/sq.ft off Day-1 Launch Price', 1, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 5 DAY)),
        (?, ?, 'NX-PASS-GFH-0002', 'Sunita Reddy', '+919840223344', 'sunita.r@example.com', 21000.00, '₹500/sq.ft off Day-1 Launch Price', 2, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 5 DAY)),
        (?, ?, 'NX-PASS-GFH-0003', 'Manish Goel', '+919811334455', 'manish.g@example.com', 21000.00, '₹500/sq.ft off Day-1 Launch Price', 3, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 5 DAY))
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `, [pass1, p1Id, pass2, p1Id, pass3, p1Id]).catch(err => console.log('[Warning: Passes Insert]', err.message));

    // 3. Seed Group Buying Pools ("Pool & Save")
    const pool1 = 'pool-0001-4000-8000-000000000001';
    const pool2 = 'pool-0002-4000-8000-000000000002';

    await pool.query(`
      INSERT INTO group_buying_pools (
        id, project_id, pool_title, target_buyers, current_buyers, discount_percentage,
        flat_discount_amount, token_commitment, deadline, status, share_code
      ) VALUES
        (?, ?, 'Whitefield Techies 3BHK Group - Greenfield Heights', 5, 4, 6.00, 500000.00, 25000.00, DATE_ADD(NOW(), INTERVAL 4 DAY), 'OPEN', 'POOL-WFTECH'),
        (?, ?, 'BKC Corporates Bulk Investor Pool - Grand Horizon Plaza', 6, 6, 7.50, 750000.00, 50000.00, DATE_ADD(NOW(), INTERVAL 10 DAY), 'DISCOUNT_UNLOCKED', 'POOL-BKCCORP')
      ON DUPLICATE KEY UPDATE current_buyers = VALUES(current_buyers)
    `, [pool1, p1Id, pool2, p2Id]).catch(err => console.log('[Warning: Pools Insert]', err.message));

    // Seed pool members for pool 1
    await pool.query(`
      INSERT INTO group_pool_members (id, pool_id, buyer_name, buyer_phone, buyer_email, unit_type_preference, commitment_status)
      VALUES
        (UUID(), ?, 'Rohan Verma', '+919871122334', 'rohan.v@example.com', '3BHK', 'JOINED'),
        (UUID(), ?, 'Neha Agarwal', '+919810998877', 'neha.a@example.com', '3BHK', 'JOINED'),
        (UUID(), ?, 'Sameer Joshi', '+919765432109', 'sameer.j@example.com', '3BHK', 'JOINED'),
        (UUID(), ?, 'Deepak Chawla', '+919999888877', 'deepak.c@example.com', '3BHK', 'JOINED')
    `, [pool1, pool1, pool1, pool1]).catch(err => console.log('[Warning: Pool Members Insert]', err.message));

    // 4. Seed Resale Deal Room
    const dealRoom1 = 'room-0001-4000-8000-000000000001';
    await pool.query(`
      INSERT INTO resale_deal_rooms (
        id, unit_id, seller_name, seller_phone, reserve_price, current_highest_bid,
        bid_count, starts_at, ends_at, status
      ) VALUES
        (?, ?, 'Rajesh K. Singhania', '+919820098765', 13000000.00, 13450000.00, 3, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 'ACTIVE')
      ON DUPLICATE KEY UPDATE current_highest_bid = VALUES(current_highest_bid)
    `, [dealRoom1, uResaleId]).catch(err => console.log('[Warning: Deal Room Insert]', err.message));

    console.log('[Seed Marketplace] Completed successfully!');
  } catch (error) {
    console.error('[Seed Marketplace Error]', error.message);
  }
}

if (require.main === module) {
  seedMarketplaceData().then(() => process.exit(0));
}

module.exports = seedMarketplaceData;
