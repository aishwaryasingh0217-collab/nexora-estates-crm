/**
 * Removes what the test suites create, then re-seeds the demo team so the next run starts clean.
 * Only touches test data: leads whose first name starts with "ZZ", tmp_* users, and the fixed
 * demo records that database/seed_sales_team.js restores. Refuses to run in production.
 *
 *   node tests/reset-demo.js
 */
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

if (process.env.NODE_ENV === 'production') {
  console.error('reset-demo: refusing to run with NODE_ENV=production');
  process.exit(1);
}

const mysql = require('mysql2/promise');
const DEMO_BOOKED_LEAD = 'd0000000-0000-4000-8000-000000000011'; // the API suite books this partner client
const DEMO_RECLAIMED_PHONE = '+91 90000 10008'; // the API suite re-introduces this lost lead as a partner

async function reset() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME
  });
  const q = async (sql, params) => (await c.query(sql, params))[0];
  try {
    const testLeads = (await q(`SELECT id, phone FROM leads WHERE first_name LIKE 'ZZ%'`));
    const leadIds = [...testLeads.map((l) => l.id), DEMO_BOOKED_LEAD];

    const deals = await q('SELECT id, unit_id FROM deals WHERE lead_id IN (?)', [leadIds]);
    if (deals.length) {
      const dealIds = deals.map((d) => d.id);
      await q('DELETE FROM broker_payout_records WHERE commission_id IN (SELECT id FROM broker_commissions WHERE deal_id IN (?))', [dealIds]);
      await q('DELETE FROM broker_commissions WHERE deal_id IN (?)', [dealIds]);
      await q('DELETE FROM payments WHERE deal_id IN (?)', [dealIds]).catch(() => {});
      await q('DELETE FROM payment_milestones WHERE deal_id IN (?)', [dealIds]);
      await q('DELETE FROM deals WHERE id IN (?)', [dealIds]);
      await q(`UPDATE units SET status = 'AVAILABLE' WHERE id IN (?)`, [deals.map((d) => d.unit_id)]);
    }
    await q('DELETE FROM customers WHERE lead_id IN (?)', [leadIds]);
    await q(`DELETE FROM site_visit_history WHERE site_visit_id IN (SELECT id FROM site_visits WHERE lead_id IN (?) AND id NOT LIKE 'd1000000-%')`, [leadIds]);
    await q(`DELETE FROM site_visits WHERE lead_id IN (?) AND id NOT LIKE 'd1000000-%'`, [leadIds]);
    await q('DELETE FROM notifications WHERE related_entity_id IN (?) OR title LIKE ? OR message LIKE ?', [leadIds, '%ZZ %', '%ZZ %']);
    await q(`DELETE FROM cp_lead_locks WHERE client_name LIKE 'ZZ%' OR client_phone = ?`, [DEMO_RECLAIMED_PHONE]);
    await q(`DELETE FROM priority_passes WHERE buyer_name LIKE 'ZZ%'`);
    // Marketplace: test pools (members cascade), test offers, and the demo deal room / pool back to seeded values
    await q(`DELETE FROM group_buying_pools WHERE pool_title LIKE 'ZZ%'`);
    await q(`DELETE FROM group_pool_members WHERE buyer_name LIKE 'ZZ%'`);
    await q(`DELETE FROM resale_bids WHERE bidder_name LIKE 'ZZ%'`);
    await q(`DELETE FROM push_subscriptions WHERE endpoint LIKE 'https://push.invalid/zz-%'`);
    await q(`UPDATE resale_deal_rooms SET current_highest_bid = 13450000, bid_count = 3, status = 'ACTIVE',
                    ends_at = GREATEST(ends_at, NOW() + INTERVAL 5 DAY) WHERE id = 'room-0001-4000-8000-000000000001'`);
    await q(`UPDATE group_buying_pools SET current_buyers = 4, status = 'OPEN', deadline = GREATEST(deadline, NOW() + INTERVAL 4 DAY)
              WHERE id = 'pool-0001-4000-8000-000000000001'`);
    if (testLeads.length) await q('DELETE FROM leads WHERE id IN (?)', [testLeads.map((l) => l.id)]);

    const tmpUsers = (await q(`SELECT id FROM users WHERE username LIKE 'tmp\\_agent\\_%' OR username LIKE 'tmp\\_cp\\_%'`)).map((r) => r.id);
    if (tmpUsers.length) {
      await q('DELETE FROM user_audit_logs WHERE target_user_id IN (?) OR performed_by IN (?)', [tmpUsers, tmpUsers]);
      await q('DELETE FROM users WHERE id IN (?)', [tmpUsers]);
    }
    console.log(`reset: removed ${testLeads.length} test leads, ${deals.length} deals, ${tmpUsers.length} temp users`);
  } finally {
    await c.end();
  }
  execFileSync(process.execPath, [path.join(root, 'database', 'seed_sales_team.js')], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('reset: demo team re-seeded');
}

module.exports = { reset };
if (require.main === module) reset().catch((e) => { console.error('reset failed:', e.message); process.exit(1); });
