/**
 * Demo seed for the Business Suite: one login per department, sales teams, two marketing campaigns
 * with recorded spend, and post-booking records (payment schedule, one verified and one pending
 * payment, onboarding checklist, a customer complaint) for the demo bookings.
 *
 * Runs after seed_sales_team.js on the public demo (database/demo_reset.js). Safe to run again.
 *   node database/seed_business_suite.js
 *
 * Not used by the manual testing environment (database/test_env/), which holds only test data.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const PEOPLE = [
  { id: 'a3b2c3d4-0000-4000-8000-000000000001', role: 'BUSINESS_OWNER', level: 'HEAD', username: 'owner', pass: 'Owner123!', first: 'Rajiv', last: 'Malhotra', phone: '+91 9810011001' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000002', role: 'FINANCE', level: 'HEAD', username: 'finance', pass: 'Finance123!', first: 'Kavita', last: 'Iyer', phone: '+91 9810011002' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000003', role: 'FINANCE', level: 'EXECUTIVE', username: 'accounts', pass: 'Accounts123!', first: 'Rohit', last: 'Bansal', phone: '+91 9810011003' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000004', role: 'INVENTORY', level: 'HEAD', username: 'inventory', pass: 'Inventory123!', first: 'Suresh', last: 'Nair', phone: '+91 9810011004' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000005', role: 'MARKETING', level: 'HEAD', username: 'marketing', pass: 'Marketing123!', first: 'Ananya', last: 'Desai', phone: '+91 9810011005' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000006', role: 'CUSTOMER_RELATIONS', level: 'HEAD', username: 'care', pass: 'Care123!', first: 'Meera', last: 'Pillai', phone: '+91 9810011006' },
  { id: 'a3b2c3d4-0000-4000-8000-000000000007', role: 'CUSTOMER_RELATIONS', level: 'EXECUTIVE', username: 'careexec', pass: 'Careexec123!', first: 'Arjun', last: 'Shetty', phone: '+91 9810011007' }
];
const SALES_MANAGER = 'a1b2c3d4-0000-4000-8000-000000000002';
const TEAM = ['a1b2c3d4-0000-4000-8000-000000000003', 'a1b2c3d4-0000-4000-8000-000000000004'];
const CAMPAIGNS = [
  { id: 'a4000000-0000-4000-8000-000000000001', name: 'Festive season — Facebook leads', code: 'FESTIVE-FB', source: 'FACEBOOK_ADS', budget: 150000, spend: [[-20, 42000], [-10, 38500]] },
  { id: 'a4000000-0000-4000-8000-000000000002', name: 'Google search — 3 BHK', code: 'GSEARCH-3BHK', source: 'GOOGLE_ADS', budget: 100000, spend: [[-15, 27500]] }
];
const DOCS = [
  ['KYC_PAN', 'PAN card', 'VERIFIED'], ['KYC_ID', 'Aadhaar / passport (identity proof)', 'VERIFIED'], ['KYC_ADDRESS', 'Address proof', 'SUBMITTED'],
  ['PHOTO', 'Passport-size photographs', 'PENDING'], ['BOOKING_FORM', 'Signed booking application form', 'VERIFIED'],
  ['ALLOTMENT_LETTER', 'Allotment letter (issued by company)', 'PENDING'], ['AGREEMENT_FOR_SALE', 'Agreement for sale', 'PENDING'],
  ['LOAN_SANCTION', 'Home loan sanction letter (if financing)', 'PENDING']
];
const daysFromNow = (d) => new Date(Date.now() + d * 86400000);

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'realestate_crm'
  });
  const mins = -new Date().getTimezoneOffset();
  await conn.query('SET time_zone = ?', [`${mins >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(mins) / 60)).padStart(2, '0')}:${String(Math.abs(mins) % 60).padStart(2, '0')}`]);

  // 1. Department logins
  for (const p of PEOPLE) {
    const [[role]] = await conn.query('SELECT id FROM roles WHERE name = ?', [p.role]);
    if (!role) throw new Error(`Role ${p.role} missing — run the migrations first.`);
    const [[clash]] = await conn.query('SELECT id FROM users WHERE username = ? AND id <> ?', [p.username, p.id]);
    if (clash) { console.log(`  ! username "${p.username}" already used — skipped`); continue; }
    await conn.query(
      `INSERT INTO users (id, role_id, job_level, username, email, password_hash, first_name, last_name, phone, status, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), job_level = VALUES(job_level), password_hash = VALUES(password_hash), status = 'ACTIVE'`,
      [p.id, role.id, p.level, p.username, `${p.username}@nexora-demo.local`, await bcrypt.hash(p.pass, 10), p.first, p.last, p.phone]
    );
    console.log(`  ✓ ${p.role.padEnd(18)} ${p.username} / ${p.pass}`);
  }

  // 2. Sales team structure: the telecaller and field agent report to the sales manager
  await conn.query('UPDATE users SET manager_id = ? WHERE id IN (?) AND manager_id IS NULL', [SALES_MANAGER, TEAM]);

  // 3. Campaigns with recorded spend; existing Facebook / Google leads are attributed to them
  for (const c of CAMPAIGNS) {
    const [[channel]] = await conn.query('SELECT id FROM ad_channels WHERE lead_source = ? LIMIT 1', [c.source]);
    await conn.query(
      `INSERT INTO campaigns (id, name, code, channel_id, objective, start_date, budget, status, utm_source, utm_medium, utm_campaign, created_by)
       VALUES (?, ?, ?, ?, 'Site visits for ready inventory', ?, ?, 'ACTIVE', ?, 'paid', ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [c.id, c.name, c.code, channel ? channel.id : null, daysFromNow(-30), c.budget, c.source.toLowerCase(), c.code.toLowerCase(), PEOPLE[4].id]
    );
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM campaign_spend WHERE campaign_id = ?', [c.id]);
    if (!Number(n)) {
      for (const [d, amount] of c.spend) {
        await conn.query('INSERT INTO campaign_spend (id, campaign_id, spend_date, amount, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), c.id, daysFromNow(d), amount, 'Ad platform invoice', PEOPLE[4].id]);
      }
    }
    await conn.query('UPDATE leads SET campaign_id = ?, utm_source = ?, utm_medium = \'paid\', utm_campaign = ? WHERE source = ? AND campaign_id IS NULL',
      [c.id, c.source.toLowerCase(), c.code.toLowerCase(), c.source]);
  }

  // 4. After-sales records for the demo bookings
  const [deals] = await conn.query(
    `SELECT d.id, d.deal_number, d.customer_id, d.agreed_total_amount, d.booking_token_amount, d.created_at, l.first_name
       FROM deals d LEFT JOIN leads l ON l.id = d.lead_id WHERE d.status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON') ORDER BY d.created_at`
  );
  let i = 0;
  for (const d of deals) {
    const total = Number(d.agreed_total_amount);
    const [[{ n: hasPlan }]] = await conn.query('SELECT COUNT(*) AS n FROM payment_milestones WHERE deal_id = ?', [d.id]);
    if (!Number(hasPlan)) {
      const token = Math.min(Number(d.booking_token_amount) || Math.round(total * 0.1), total);
      const plan = [['Booking amount', token, -12], ['On agreement for sale', Math.max(Math.round(total * 0.2) - token, 0), -2], ['Construction-linked instalments', Math.round(total * 0.7), 150], ['On possession', total - token - Math.max(Math.round(total * 0.2) - token, 0) - Math.round(total * 0.7), 330]];
      let first = true;
      for (const [name, amount, due] of plan) {
        if (amount <= 0) continue;
        const mId = crypto.randomUUID();
        await conn.query(
          "INSERT INTO payment_milestones (id, deal_id, milestone_name, due_percentage, due_amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [mId, d.id, name, Math.round((amount / total) * 10000) / 100, amount, daysFromNow(due), first ? 'PAID' : due < 0 ? 'OVERDUE' : 'PENDING']
        );
        if (first) {
          // Booking amount: recorded by the accounts executive, verified by the finance head
          await conn.query(
            `INSERT INTO payments (id, payment_number, deal_id, milestone_id, amount_received, payment_date, payment_mode, reference_number, received_by, notes,
                                   verification_status, verified_by, verified_at, receipt_number, payer_name)
             VALUES (?, ?, ?, ?, ?, ?, 'NEFT', ?, ?, 'Booking amount', 'VERIFIED', ?, ?, ?, ?)`,
            [crypto.randomUUID(), `PAY-DEMO-${String(++i).padStart(3, '0')}`, d.id, mId, amount, daysFromNow(-11), `UTR${String(908877600 + i)}`,
              PEOPLE[2].id, PEOPLE[1].id, daysFromNow(-10), `RCPT-DEMO-${String(i).padStart(3, '0')}`, d.first_name]
          );
          first = false;
        }
      }
      // One cheque waiting for verification on the most recent booking
      if (d === deals[deals.length - 1]) {
        const [[{ n: hasPendingPay }]] = await conn.query("SELECT COUNT(*) AS n FROM payments WHERE deal_id = ? AND verification_status = 'PENDING'", [d.id]);
        if (!Number(hasPendingPay)) {
          await conn.query(
            `INSERT INTO payments (id, payment_number, deal_id, amount_received, payment_date, payment_mode, reference_number, received_by, notes, verification_status, payer_name)
             VALUES (?, ?, ?, ?, ?, 'CHEQUE', ?, ?, 'Part payment towards agreement', 'PENDING', ?)`,
            [crypto.randomUUID(), `PAY-DEMO-${String(++i).padStart(3, '0')}`, d.id, 250000, daysFromNow(-1), `CHQ-${400100 + i}`, PEOPLE[2].id, d.first_name]
          );
        }
      }
    }
    if (d.customer_id) {
      await conn.query(
        "UPDATE customers SET relationship_manager_id = COALESCE(relationship_manager_id, ?), onboarding_status = IF(onboarding_status = 'NOT_STARTED', 'IN_PROGRESS', onboarding_status) WHERE id = ?",
        [PEOPLE[6].id, d.customer_id]
      );
      const [[{ n: hasDocs }]] = await conn.query('SELECT COUNT(*) AS n FROM customer_documents WHERE customer_id = ? AND deal_id = ?', [d.customer_id, d.id]);
      if (!Number(hasDocs)) {
        for (const [type, title, status] of DOCS) {
          await conn.query('INSERT INTO customer_documents (id, customer_id, deal_id, doc_type, title, status, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), d.customer_id, d.id, type, title, status, status === 'PENDING' ? null : PEOPLE[6].id]);
        }
        await conn.query(
          "INSERT INTO customer_communications (id, customer_id, deal_id, channel, direction, subject, summary, user_id, created_at) VALUES (?, ?, ?, 'CALL', 'OUTBOUND', 'Welcome call', ?, ?, ?)",
          [crypto.randomUUID(), d.customer_id, d.id, `Welcome call for ${d.deal_number}: explained the payment schedule and the document checklist.`, PEOPLE[6].id, daysFromNow(-9)]
        );
      }
    }
  }

  // 5. One open complaint on the first booking
  if (deals[0] && deals[0].customer_id) {
    const [[c]] = await conn.query('SELECT * FROM customers WHERE id = ?', [deals[0].customer_id]);
    const [[exists]] = await conn.query("SELECT id FROM support_tickets WHERE ticket_number = 'TKT-DEMO-001'");
    if (c && !exists) {
      await conn.query(
        `INSERT INTO support_tickets (id, ticket_number, customer_id, lead_id, full_name, phone, email, subject, description, status, priority, assigned_to,
                                      category, channel, deal_id, created_by, due_at, created_at)
         VALUES (?, 'TKT-DEMO-001', ?, ?, ?, ?, ?, 'Allotment letter not received', 'Customer says the allotment letter promised within a week hasn''t arrived.',
                 'OPEN', 'HIGH', ?, 'COMPLAINT', 'PHONE', ?, ?, ?, ?)`,
        [crypto.randomUUID(), c.id, c.lead_id, [c.first_name, c.last_name].filter(Boolean).join(' '), c.phone || '', c.email || '', PEOPLE[6].id, deals[0].id, PEOPLE[6].id, daysFromNow(0.5), daysFromNow(-0.5)]
      );
    }
  }

  await conn.end();
  console.log(`✓ Business suite demo data ready (${deals.length} booking(s) with after-sales records)`);
}

main().catch((err) => {
  console.error('seed_business_suite failed:', err.message);
  process.exit(1);
});
