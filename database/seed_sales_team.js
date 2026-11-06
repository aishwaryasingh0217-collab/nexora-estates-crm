/**
 * Seeds a realistic sales team + one working day of activity so every portal can be tried
 * end-to-end. Safe to re-run: fixed ids, and all dates are refreshed relative to "now".
 *
 *   node database/seed_sales_team.js      (or: npm run seed:workspace)
 *
 * Logins (match the 1-click buttons on the sign-in page):
 *   admin_ops  / AdminPassword123!   Sales Manager
 *   telecaller / Telecaller123!      Sales Agent (inside sales)
 *   siteagent  / Siteagent123!       Field Agent (site visits)
 *   partner    / Partner123!         Channel Partner (Square Yards Realty Partners)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const ID = {
  manager: 'a1b2c3d4-0000-4000-8000-000000000002',
  telecaller: 'a1b2c3d4-0000-4000-8000-000000000003',
  siteagent: 'a1b2c3d4-0000-4000-8000-000000000004',
  partnerUser: 'a1b2c3d4-0000-4000-8000-000000000005',
  partnerFirm: 'cp100000-0000-4000-8000-000000000001',
  greenfield: 'p1000000-0000-4000-8000-000000000001',
  horizon: 'p2000000-0000-4000-8000-000000000002',
  palm: 'p3000000-0000-4000-8000-000000000003'
};

const TEAM = [
  { id: ID.manager, role: 'ADMIN', username: 'admin_ops', email: 'ops@realestatecrm.com', pass: 'AdminPassword123!', first: 'Neha', last: 'Kapoor', phone: '+91 98765 43211' },
  { id: ID.telecaller, role: 'INSIDE_SALES', username: 'telecaller', email: 'telecaller@realestatecrm.com', pass: 'Telecaller123!', first: 'Pooja', last: 'Sharma', phone: '+91 98765 43212' },
  { id: ID.siteagent, role: 'OUTSIDE_SALES', username: 'siteagent', email: 'siteagent@realestatecrm.com', pass: 'Siteagent123!', first: 'Vikram', last: 'Rathore', phone: '+91 98765 43213' },
  { id: ID.partnerUser, role: 'CHANNEL_PARTNER', username: 'partner', email: 'partner@realestatecrm.com', pass: 'Partner123!', first: 'Rahul', last: 'Mehta', phone: '+91 98765 43214', firm: ID.partnerFirm }
];

const UNITS = [
  ['d2000000-0000-4000-8000-000000000001', ID.greenfield, 'A-1101', 11, 'RESIDENTIAL', '3BHK', 1450, 1850, 'EAST', 14500000, 350000],
  ['d2000000-0000-4000-8000-000000000002', ID.greenfield, 'A-1204', 12, 'RESIDENTIAL', '2BHK', 1050, 1340, 'NORTH_EAST', 10200000, 250000],
  ['d2000000-0000-4000-8000-000000000003', ID.greenfield, 'B-0803', 8, 'RESIDENTIAL', '3BHK', 1480, 1890, 'NORTH', 13900000, 200000],
  ['d2000000-0000-4000-8000-000000000004', ID.greenfield, 'B-1502', 15, 'RESIDENTIAL', '4BHK', 2100, 2650, 'EAST', 21500000, 500000],
  ['d2000000-0000-4000-8000-000000000005', ID.palm, 'PLOT-58', null, 'PLOT', 'PLOT', null, null, 'EAST', 8800000, 0],
  ['d2000000-0000-4000-8000-000000000006', ID.palm, 'PLOT-61', null, 'PLOT', 'PLOT', null, null, 'NORTH_EAST', 9400000, 300000]
];

const now = Date.now();
const H = 3600 * 1000;
const at = (offsetHours) => new Date(now + offsetHours * H);
const todayAt = (hour, minute = 0) => { const d = new Date(); d.setHours(hour, minute, 0, 0); return d; };
const tomorrowAt = (hour) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hour, 0, 0, 0); return d; };
// A visit "later today" that still lands inside the working day even when seeding in the evening
const laterToday = (hoursAhead) => { const t = at(hoursAhead); const end = todayAt(21); return t < end ? t : new Date(Math.max(now + 15 * 60000, end.getTime() - 30 * 60000)); };

// [id, first, last, phone, source, stage, project, agent, partner, created, nextFollowUp, lastContacted, temp, notes, lostReason]
const LEADS = [
  // Pooja — telecaller: fresh enquiries to call first, overdue follow-ups, later today
  ['d0000000-0000-4000-8000-000000000001', 'Arjun', 'Nair', '+91 90000 10001', 'WEBSITE', 'Fresh Lead', ID.greenfield, ID.telecaller, null, at(-0.7), at(-0.7), null, 'HOT', 'Wants a 3BHK, east facing, ready by 2027'],
  ['d0000000-0000-4000-8000-000000000002', 'Sneha', 'Iyer', '+91 90000 10002', 'FACEBOOK_ADS', 'Fresh Lead', ID.horizon, ID.telecaller, null, at(-2.2), at(-2.2), null, null, null],
  ['d0000000-0000-4000-8000-000000000003', 'Rohan', 'Gupta', '+91 90000 10003', '99ACRES', 'Fresh Lead', ID.greenfield, ID.telecaller, null, at(-5), at(-5), null, null, null],
  ['d0000000-0000-4000-8000-000000000004', 'Kavya', 'Reddy', '+91 90000 10004', 'WEBSITE', 'Contacted', ID.greenfield, ID.telecaller, null, at(-50), at(-2), at(-26), 'WARM', null],
  ['d0000000-0000-4000-8000-000000000005', 'Imran', 'Sheikh', '+91 90000 10005', 'GOOGLE_ADS', 'Not Answered', ID.palm, ID.telecaller, null, at(-30), at(-19), at(-22), null, null],
  ['d0000000-0000-4000-8000-000000000006', 'Meera', 'Joshi', '+91 90000 10006', 'REFERRAL', 'Contacted', ID.palm, ID.telecaller, null, at(-72), laterToday(3), at(-24), 'WARM', null],
  ['d0000000-0000-4000-8000-000000000007', 'Aditya', 'Verma', '+91 90000 10007', 'WEBSITE', 'Site Visit Scheduled', ID.greenfield, ID.telecaller, null, at(-96), null, at(-20), 'HOT', null],
  ['d0000000-0000-4000-8000-000000000008', 'Sanjay', 'Patil', '+91 90000 10008', 'WALK_IN', 'Lost', ID.horizon, ID.telecaller, null, at(-240), null, at(-120), 'COLD', null, 'Bought a resale flat elsewhere'],
  ['d0000000-0000-4000-8000-000000000009', 'Karthik', 'Subramanian', '+91 90000 10009', 'CHANNEL_PARTNER', 'Contacted', ID.greenfield, ID.telecaller, ID.partnerFirm, at(-74), tomorrowAt(11), at(-48), 'WARM', null],
  // Vikram — field agent: today's site visits + post-visit follow-ups
  ['d0000000-0000-4000-8000-000000000010', 'Nikhil', 'Rao', '+91 90000 10010', 'WEBSITE', 'Site Visit Scheduled', ID.greenfield, ID.siteagent, null, at(-120), null, at(-30), 'WARM', null],
  ['d0000000-0000-4000-8000-000000000011', 'Farah', 'Khan', '+91 90000 10011', 'CHANNEL_PARTNER', 'Site Visit Scheduled', ID.palm, ID.siteagent, ID.partnerFirm, at(-50), null, at(-27), 'HOT', null],
  ['d0000000-0000-4000-8000-000000000012', 'Deepak', 'Menon', '+91 90000 10012', 'REFERRAL', 'Site Visit Done', ID.greenfield, ID.siteagent, null, at(-200), laterToday(1), at(-20), 'HOT', null],
  ['d0000000-0000-4000-8000-000000000013', 'Ananya', 'Das', '+91 90000 10013', 'WEBSITE', 'In Negotiation', ID.greenfield, ID.siteagent, null, at(-300), tomorrowAt(12), at(-6), 'HOT', null],
  // Partner pipeline (Square Yards): one waiting for a call
  ['d0000000-0000-4000-8000-000000000014', 'Priya', 'Malhotra', '+91 90000 10014', 'CHANNEL_PARTNER', 'Fresh Lead', ID.palm, ID.siteagent, ID.partnerFirm, at(-1.5), at(-1.5), null, null, 'Looking for a corner plot, budget ~₹95L'],
  // …and one already booked, so the partner's Earnings page shows a real commission and payout
  ['d0000000-0000-4000-8000-000000000015', 'Rakesh', 'Bansal', '+91 90000 10015', 'CHANNEL_PARTNER', 'Booking Done', ID.palm, ID.siteagent, ID.partnerFirm, at(-26 * 24), null, at(-12 * 24), 'HOT', 'Booked PLOT-44 (east facing corner)']
];

// [leadId, userId, type, outcome, note, hoursAgo]
const ACTIVITIES = [
  ['d0000000-0000-4000-8000-000000000004', ID.telecaller, 'CALL', 'INTERESTED', 'Asked for 3BHK price list. Wants to discuss with spouse — call back.', 26],
  ['d0000000-0000-4000-8000-000000000004', ID.telecaller, 'WHATSAPP', 'WHATSAPP_SENT', 'Sent Greenfield brochure + price sheet', 25.8],
  ['d0000000-0000-4000-8000-000000000005', ID.telecaller, 'CALL', 'NO_ANSWER', null, 22],
  ['d0000000-0000-4000-8000-000000000006', ID.telecaller, 'CALL', 'INTERESTED', 'Retired couple, prefers plotted development. Visit possible this weekend.', 24],
  ['d0000000-0000-4000-8000-000000000007', ID.telecaller, 'CALL', 'INTERESTED', 'Very keen. Coming with parents.', 20],
  ['d0000000-0000-4000-8000-000000000008', ID.telecaller, 'STAGE', 'LOST', 'Follow-up → Lost (Bought a resale flat elsewhere)', 120],
  ['d0000000-0000-4000-8000-000000000009', ID.partnerUser, 'SYSTEM', 'CREATED', 'Registered by Square Yards Realty Partners — NRI client, prefers video calls after 7pm IST', 74],
  ['d0000000-0000-4000-8000-000000000009', ID.telecaller, 'CALL', 'INTERESTED', 'Spoke on video. Shortlisted A-1101.', 48],
  ['d0000000-0000-4000-8000-000000000011', ID.partnerUser, 'SYSTEM', 'CREATED', 'Registered by Square Yards Realty Partners', 50],
  ['d0000000-0000-4000-8000-000000000011', ID.siteagent, 'CALL', 'INTERESTED', 'Wants east-facing plot. Will visit with husband.', 27],
  ['d0000000-0000-4000-8000-000000000012', ID.siteagent, 'VISIT', 'COMPLETE', 'Visit done at Greenfield Heights — client is hot: loved the clubhouse, worried about loan EMI', 20],
  ['d0000000-0000-4000-8000-000000000013', ID.siteagent, 'CALL', 'NEGOTIATING', 'Asking ₹3L off on B-1502. Manager approval needed.', 6],
  ['d0000000-0000-4000-8000-000000000014', ID.partnerUser, 'SYSTEM', 'CREATED', 'Registered by Square Yards Realty Partners — Looking for a corner plot, budget ~₹95L', 1.5],
  ['d0000000-0000-4000-8000-000000000015', ID.partnerUser, 'SYSTEM', 'CREATED', 'Registered by Square Yards Realty Partners', 26 * 24],
  ['d0000000-0000-4000-8000-000000000015', ID.siteagent, 'VISIT', 'COMPLETE', 'Visit done at Palm Springs Estates — liked the corner plots near the clubhouse', 16 * 24],
  ['d0000000-0000-4000-8000-000000000015', ID.siteagent, 'BOOKING', 'BOOKED', 'Booked PLOT-44 at ₹92 L. Token ₹9.2 L received.', 12 * 24]
];

// A partner-sourced sale that has closed: plot booked, 3% commission earned, first half paid out
const SALE = {
  lead: 'd0000000-0000-4000-8000-000000000015',
  unit: 'd2000000-0000-4000-8000-000000000007',
  customer: 'c2000000-0000-4000-8000-000000000002',
  deal: 'd4000000-0000-4000-8000-000000000001',
  commission: 'd5000000-0000-4000-8000-000000000001',
  payout: 'd6000000-0000-4000-8000-000000000001',
  price: 9200000,
  rate: 3
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'realestate_crm'
  });

  const [[roleCheck]] = await conn.query(`SELECT COUNT(*) AS n FROM roles WHERE name IN ('INSIDE_SALES','OUTSIDE_SALES','CHANNEL_PARTNER')`);
  if (Number(roleCheck.n) < 3) throw new Error('Field roles missing — run `npm run migrate` first.');

  const [[firm]] = await conn.query('SELECT id FROM channel_partners WHERE id = ?', [ID.partnerFirm]);
  if (!firm) {
    await conn.query(
      `INSERT INTO channel_partners (id, firm_name, contact_person, phone, email, tier, commission_rate, status)
       VALUES (?, 'Square Yards Realty Partners', 'Vikramaditya Rao', '+91 9886012345', 'vikram@squareyards.sample', 'PLATINUM', 3.00, 'ACTIVE')`,
      [ID.partnerFirm]
    );
  }
  const [projects] = await conn.query('SELECT id FROM projects WHERE id IN (?, ?, ?)', [ID.greenfield, ID.horizon, ID.palm]);
  if (projects.length < 3) throw new Error('Demo projects missing — run `npm run seed` (seed_demo_data.js) first.');

  // 1. Team logins
  for (const m of TEAM) {
    const [[role]] = await conn.query('SELECT id FROM roles WHERE name = ?', [m.role]);
    const hash = await bcrypt.hash(m.pass, 10);
    const [[existing]] = await conn.query('SELECT id FROM users WHERE username = ? OR id = ?', [m.username, m.id]);
    if (existing && existing.id !== m.id) {
      console.log(`  ! username "${m.username}" already used by another account — skipped`);
      continue;
    }
    await conn.query(
      `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status, channel_partner_id, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 1)
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), password_hash = VALUES(password_hash), status = 'ACTIVE',
         first_name = VALUES(first_name), last_name = VALUES(last_name), phone = VALUES(phone),
         channel_partner_id = VALUES(channel_partner_id), is_available = 1`,
      [m.id, role.id, m.username, m.email, hash, m.first, m.last, m.phone, m.firm || null]
    );
    console.log(`  ✓ ${m.role.padEnd(16)} ${m.username} / ${m.pass}`);
  }

  // 2. Some sellable inventory (also shows up on the public website)
  for (const u of UNITS) {
    await conn.query(
      `INSERT INTO units (id, project_id, unit_number, floor_number, asset_category, unit_type, carpet_area_sqft, super_area_sqft, facing, base_price, plc_charges, status, listing_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'NEW_LAUNCH')
       ON DUPLICATE KEY UPDATE base_price = VALUES(base_price)`,
      u
    );
  }

  // 3. Leads with dates relative to now
  for (const [id, first, last, phone, source, stage, project, agent, partner, created, next, contacted, temp, notes, lostReason] of LEADS) {
    await conn.query(
      `INSERT INTO leads (id, first_name, last_name, phone, source, stage, preferred_project_id, assigned_agent_id, channel_partner_id,
                          registered_by, cp_protected_until, created_at, next_follow_up_at, last_contacted_at, temperature, notes, lost_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stage = VALUES(stage), source = VALUES(source), registered_by = VALUES(registered_by),
         preferred_project_id = VALUES(preferred_project_id), assigned_agent_id = VALUES(assigned_agent_id), channel_partner_id = VALUES(channel_partner_id),
         created_at = VALUES(created_at), next_follow_up_at = VALUES(next_follow_up_at), last_contacted_at = VALUES(last_contacted_at),
         temperature = VALUES(temperature), cp_protected_until = VALUES(cp_protected_until), lost_reason = VALUES(lost_reason)`,
      [id, first, last, phone, source, stage, project, agent, partner, partner ? ID.partnerUser : agent,
        partner ? new Date(created.getTime() + 60 * 24 * H) : null, created, next, contacted, temp, notes, lostReason || null]
    );
  }

  // 4. Timeline (rebuilt each run)
  const leadIds = LEADS.map((l) => l[0]);
  await conn.query('DELETE FROM lead_activities WHERE lead_id IN (?)', [leadIds]);
  for (const [leadId, userId, type, outcome, note, hoursAgo] of ACTIVITIES) {
    await conn.query(
      'INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), leadId, userId, type, outcome, note, at(-hoursAgo)]
    );
  }

  // 5. Site visits: today for both agents, plus yesterday's completed one
  const VISITS = [
    ['d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007', ID.greenfield, ID.telecaller, laterToday(4), 'SCHEDULED', null],
    ['d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000010', ID.greenfield, ID.siteagent, laterToday(1.5), 'SCHEDULED', null],
    ['d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000011', ID.palm, ID.siteagent, laterToday(4), 'SCHEDULED', null],
    ['d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000012', ID.greenfield, ID.siteagent, at(-20), 'COMPLETED', 'Loved the clubhouse, worried about loan EMI']
  ];
  for (const [id, leadId, project, agent, when, status, feedback] of VISITS) {
    await conn.query(
      `INSERT INTO site_visits (id, lead_id, project_id, assigned_agent_id, scheduled_time, status, client_feedback, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE scheduled_time = VALUES(scheduled_time), status = VALUES(status), client_feedback = VALUES(client_feedback)`,
      [id, leadId, project, agent, when, status, feedback, status === 'COMPLETED' ? 5 : null]
    );
  }

  // 5b. The closed partner sale (unit, customer, deal, commission, payout)
  const commissionTotal = Math.round(SALE.price * SALE.rate) / 100;
  const bookedOn = at(-12 * 24);
  await conn.query(
    `INSERT INTO units (id, project_id, unit_number, asset_category, unit_type, plot_area_sqft, plot_dimensions, facing, is_corner, base_price, plc_charges, status, listing_type)
     VALUES (?, ?, 'PLOT-44', 'PLOT', 'PLOT', 2400, '40x60', 'EAST', 1, ?, 0, 'BOOKED', 'NEW_LAUNCH')
     ON DUPLICATE KEY UPDATE status = 'BOOKED', base_price = VALUES(base_price)`,
    [SALE.unit, ID.palm, SALE.price]
  );
  await conn.query(
    `INSERT INTO customers (id, lead_id, first_name, last_name, phone, kyc_status, assigned_rep_id)
     VALUES (?, ?, 'Rakesh', 'Bansal', '+91 90000 10015', 'VERIFIED', ?)
     ON DUPLICATE KEY UPDATE lead_id = VALUES(lead_id)`,
    [SALE.customer, SALE.lead, ID.siteagent]
  );
  await conn.query(
    `INSERT INTO deals (id, deal_number, customer_id, lead_id, unit_id, base_price, agreed_total_amount, booking_token_amount, status, created_by, closing_date, channel_partner_id, created_at)
     VALUES (?, 'DEAL-260417', ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'BOOKED', closing_date = VALUES(closing_date), created_at = VALUES(created_at)`,
    [SALE.deal, SALE.customer, SALE.lead, SALE.unit, SALE.price, SALE.price, SALE.price / 10, ID.siteagent, bookedOn, ID.partnerFirm, bookedOn]
  );
  await conn.query(
    `INSERT INTO broker_commissions (id, partner_id, deal_id, deal_amount, commission_rate, total_commission, paid_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PARTIALLY_PAID', ?)
     ON DUPLICATE KEY UPDATE total_commission = VALUES(total_commission), paid_amount = VALUES(paid_amount), status = VALUES(status), created_at = VALUES(created_at)`,
    [SALE.commission, ID.partnerFirm, SALE.deal, SALE.price, SALE.rate, commissionTotal, commissionTotal / 2, bookedOn]
  );
  await conn.query(
    `INSERT INTO broker_payout_records (id, commission_id, partner_id, payout_amount, payment_mode, transaction_reference, payout_date, notes)
     VALUES (?, ?, ?, ?, 'NEFT', 'NEFT-HDFC-260417', ?, 'First half, released on agreement signing')
     ON DUPLICATE KEY UPDATE payout_amount = VALUES(payout_amount), payout_date = VALUES(payout_date)`,
    [SALE.payout, SALE.commission, ID.partnerFirm, commissionTotal / 2, at(-5 * 24)]
  );

  // 6. A couple of unread notifications so the bell isn't empty on first login
  const notes = [
    ['d3000000-0000-4000-8000-000000000001', ID.telecaller, 'SUCCESS', '🔥 New lead: Arjun Nair', 'Fresh enquiry from WEBSITE. Call within 2 hours: +91 90000 10001', 'd0000000-0000-4000-8000-000000000001'],
    ['d3000000-0000-4000-8000-000000000002', ID.siteagent, 'SUCCESS', '🤝 Partner client: Priya Malhotra', 'Square Yards Realty Partners registered a client. Coordinate with Rahul Mehta (+91 98765 43214) before calling.', 'd0000000-0000-4000-8000-000000000014'],
    ['d3000000-0000-4000-8000-000000000003', ID.partnerUser, 'REMINDER', 'Visit fixed for Farah Khan', 'Palm Springs Estates, today.', 'd0000000-0000-4000-8000-000000000011']
  ];
  for (const [id, user, type, title, message, leadId] of notes) {
    await conn.query(
      `INSERT INTO notifications (id, recipient_user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 'LEAD', ?, FALSE, NOW())
       ON DUPLICATE KEY UPDATE is_read = FALSE, read_at = NULL, created_at = NOW()`,
      [id, user, type, title, message, leadId]
    );
  }

  await conn.end();
  console.log(`  ✓ ${LEADS.length} demo leads, ${ACTIVITIES.length} activities, ${VISITS.length} visits, ${UNITS.length} available units`);
}

main().catch((err) => {
  console.error('[Seed Error]', err.message);
  process.exit(1);
});
