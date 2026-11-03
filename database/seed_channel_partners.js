/**
 * Seed Script: Channel Partners (Brokers) & Commissions
 */
require('dotenv').config();
const pool = require('../backend/config/db');

async function seedChannelPartners() {
  console.log('[Seed] Seeding Channel Partners & Broker Commission records...');

  try {
    const cp1Id = 'cp100000-0000-4000-8000-000000000001';
    const cp2Id = 'cp200000-0000-4000-8000-000000000002';
    const cp3Id = 'cp300000-0000-4000-8000-000000000003';

    await pool.query(`
      INSERT INTO channel_partners (id, firm_name, contact_person, phone, email, rera_number, tier, commission_rate, pan_number, bank_name, bank_account_number, bank_ifsc_code, status)
      VALUES 
        (?, 'Square Yards Realty Partners', 'Vikramaditya Rao', '+91 9886012345', 'vikram@squareyards.sample', 'AG/KA/RERA/2026/0042', 'PLATINUM', 3.00, 'AAACS1234P', 'HDFC Bank', '50100234567890', 'HDFC0001234', 'ACTIVE'),
        (?, 'PropTiger Premium Advisory', 'Sunita Deshmukh', '+91 9820054321', 'sunita@proptiger.sample', 'AG/MH/RERA/2026/0189', 'GOLD', 2.50, 'BBBSD5678Q', 'ICICI Bank', '000405060708', 'ICIC0000004', 'ACTIVE'),
        (?, 'Elite Landmark Associates', 'Kiran Kumar Reddy', '+91 9440098765', 'kiran@elitelandmarks.sample', 'AG/TS/RERA/2026/0312', 'SILVER', 2.00, 'CCCRK9012R', 'State Bank of India', '302010908070', 'SBIN0004567', 'ACTIVE')
      ON DUPLICATE KEY UPDATE firm_name = VALUES(firm_name), commission_rate = VALUES(commission_rate)
    `, [cp1Id, cp2Id, cp3Id]);

    // Check if deals exist to attach commissions
    const [deals] = await pool.query('SELECT id, agreed_total_amount FROM deals LIMIT 2');
    if (deals.length > 0) {
      const comm1Id = 'bc100000-0000-4000-8000-000000000001';
      const dealAmount = Number(deals[0].agreed_total_amount || 8500000);
      const commRate = 3.00;
      const totalComm = (dealAmount * commRate) / 100;
      const paidComm = totalComm * 0.50; // 50% paid

      await pool.query(`
        INSERT INTO broker_commissions (id, partner_id, deal_id, deal_amount, commission_rate, total_commission, paid_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PARTIALLY_PAID')
        ON DUPLICATE KEY UPDATE total_commission = VALUES(total_commission)
      `, [comm1Id, cp1Id, deals[0].id, dealAmount, commRate, totalComm, paidComm]);
    }

    console.log('[Seed] Channel partners successfully seeded!');
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
}

module.exports = seedChannelPartners;

if (require.main === module) {
  seedChannelPartners().then(() => process.exit(0));
}
