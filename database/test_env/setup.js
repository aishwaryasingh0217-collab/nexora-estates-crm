/**
 * Builds the manual testing environment in its OWN database (never the live one):
 *   test accounts for every role, 3 sample projects with towers and units, 2 partner firms,
 *   2 campaigns, and exactly 50 fictional test leads covering every scenario in the checklists
 *   (sources, budgets, priorities, statuses, follow-ups, site visits, lost and duplicate cases).
 *
 * No bookings and no payments are created — the tester makes those during the workflow tests.
 *
 *   node scripts/testenv.js setup            (normal way: reads .env.testenv)
 *   node database/test_env/setup.js --yes    (uses the current environment's DB settings)
 *
 * Refuses to touch a database that holds real (non-test) records.
 */
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
const D = require('./data');

const ROOT = path.join(__dirname, '../..');
const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
function dayAt(offsetDays, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}
/** Follow-up hours from now, kept inside 9 am – 8 pm. */
function followUp(h) {
  const d = new Date(Date.now() + h * 3600000);
  if (d.getHours() < 9) d.setHours(10, 0, 0, 0);
  if (d.getHours() >= 20) d.setHours(18, 30, 0, 0);
  d.setSeconds(0, 0);
  return d;
}

async function connect() {
  const conn = await mysql.createConnection(DB);
  const mins = -new Date().getTimezoneOffset();
  await conn.query('SET time_zone = ?', [`${mins >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(mins) / 60)).padStart(2, '0')}:${String(Math.abs(mins) % 60).padStart(2, '0')}`]);
  return conn;
}

async function ensureDatabase() {
  const admin = await mysql.createConnection({ ...DB, database: undefined });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (err) {
    const [rows] = await admin.query('SHOW DATABASES LIKE ?', [DB.database]);
    if (!rows.length) {
      throw new Error(`Database "${DB.database}" doesn't exist and user "${DB.user}" can't create it.\n` +
        `Ask your database administrator to run:\n  CREATE DATABASE ${DB.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n  GRANT ALL ON ${DB.database}.* TO '${DB.user}'@'localhost';`);
    }
  } finally {
    await admin.end();
  }
}

async function register(conn, type, entityId, label) {
  await conn.query('INSERT IGNORE INTO test_data_registry (entity_type, entity_id, label) VALUES (?, ?, ?)', [type, entityId, label]);
}

async function seed(conn) {
  const ref = {};
  const roleId = {};
  const [roles] = await conn.query('SELECT id, name FROM roles');
  roles.forEach((r) => { roleId[r.name] = r.id; });

  // Company identity for the test environment
  for (const [k, v] of [['company_name', 'Nexora Test Environment'], ['short_name', 'Nexora Test'], ['environment', 'TEST'], ['booking_approval_mode', 'DISCOUNT_ONLY'], ['booking_discount_threshold_pct', '2']]) {
    await conn.query('INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [k, v]);
  }

  // Partner firms
  for (const f of D.FIRMS) {
    await conn.query(
      `INSERT INTO channel_partners (id, firm_name, contact_person, phone, email, rera_number, tier, commission_rate, status, notes, is_test_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'TEST DATA', 1)`,
      [f.id, f.name, f.contact, f.phone, `${f.ref.toLowerCase()}@example.test`, `TEST-RERA-${f.ref}`, f.tier, f.rate]
    );
    ref[f.ref] = f.id;
    await register(conn, 'CHANNEL_PARTNER', f.id, `${f.ref} ${f.name}`);
  }

  // Accounts
  const hash = await bcrypt.hash(D.PASSWORD, 10);
  for (const u of D.USERS) ref[u.ref] = u.id;
  for (const u of D.USERS) {
    await conn.query(
      `INSERT INTO users (id, role_id, job_level, username, email, password_hash, first_name, last_name, phone, status, channel_partner_id, manager_id, is_available, is_test_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 1, 1)`,
      [u.id, roleId[u.role], u.level, u.username, `${u.username}@example.test`, hash, u.first, u.last, u.phone, u.firm ? ref[u.firm] : null, u.manager ? ref[u.manager] : null]
    );
    await register(conn, 'USER', u.id, `${u.ref} ${u.username}`);
  }

  // Projects, towers, units
  for (const p of D.PROJECTS) {
    await conn.query(
      `INSERT INTO projects (id, name, code, project_type, builder_developer, location, city, address, latitude, longitude, status, possession_date, rera_number, total_units, created_by, partner_visible, is_test_data)
       VALUES (?, ?, ?, ?, 'Nexora Test Developers', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      [p.id, p.name, p.code, p.type, p.location, p.city, `${p.location} (TEST ADDRESS)`, p.lat, p.lng, p.status, p.possession, p.rera, ref['TU-INVENTORY'], p.partner]
    );
    ref[p.ref] = p.id;
    await register(conn, 'PROJECT', p.id, `${p.ref} ${p.name}`);
  }
  for (const t of D.TOWERS) {
    await conn.query("INSERT INTO buildings (id, project_id, name, total_floors, units_per_floor, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')", [t.id, ref[t.project], t.name, t.floors, t.perFloor]);
    ref[t.ref] = t.id;
    await register(conn, 'BUILDING', t.id, `${t.ref} ${t.name}`);
  }
  const units = D.units();
  for (const u of units) {
    await conn.query(
      `INSERT INTO units (id, project_id, building_id, unit_number, floor_number, asset_category, unit_type, carpet_area_sqft, super_area_sqft, plot_area_sqft,
                          facing, is_corner, base_price, plc_charges, status, hold_expires_at, listing_type, status_changed_at, allocation_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW_LAUNCH', NOW(), ?, ?)`,
      [u.id, ref[u.project], u.tower ? ref[u.tower] : null, u.number, u.floor, u.category, u.type, u.carpet || null, u.superArea || null, u.plot || null,
        u.facing, u.corner ? 1 : 0, u.price, u.plc || 0, u.status || 'AVAILABLE', u.status === 'HOLD' ? dayAt(5, 18) : null, u.holdNote || null,
        hoursAgo(24 * (10 + (Number(u.ref.slice(4)) % 120)))]
    );
    await register(conn, 'UNIT', u.id, `${u.ref} ${u.number}`);
  }
  for (const p of D.PROJECTS) await conn.query('UPDATE projects SET total_units = (SELECT COUNT(*) FROM units WHERE project_id = ?) WHERE id = ?', [p.id, p.id]);

  // Campaigns (spend entries are marketing records, not payments)
  for (const c of D.CAMPAIGNS) {
    const [[ch]] = await conn.query('SELECT id FROM ad_channels WHERE lead_source = ? LIMIT 1', [c.source]);
    await conn.query(
      `INSERT INTO campaigns (id, name, code, channel_id, project_id, objective, start_date, budget, status, utm_source, utm_medium, utm_campaign, created_by, is_test_data, notes)
       VALUES (?, ?, ?, ?, ?, 'Site visits for Aurora Residences (TEST)', ?, ?, 'ACTIVE', ?, 'paid', ?, ?, 1, 'TEST DATA')`,
      [c.id, c.name, c.code, ch ? ch.id : null, ref[c.project], dayAt(-25, 9), c.budget, c.source.toLowerCase(), c.code.toLowerCase(), ref['TU-MARKETING']]
    );
    for (const [d, amount] of c.spend) {
      await conn.query('INSERT INTO campaign_spend (id, campaign_id, spend_date, amount, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), c.id, dayAt(d, 12), amount, 'TEST DATA — ad invoice', ref['TU-MARKETING']]);
    }
    ref[c.ref] = c.id;
    await register(conn, 'CAMPAIGN', c.id, `${c.ref} ${c.name}`);
  }

  // Leads
  const { scorePriority } = require('../../backend/services/leadService');
  const unitByNumber = Object.fromEntries(units.map((u) => [u.number, u]));
  let slotDay = 1;
  const visitPlan = {
    ASSIGNED: () => ({ agent: 'TU-FIELD1', when: dayAt(1, 11), status: 'ASSIGNED', steps: ['ASSIGNED'] }),
    SCHEDULED: () => ({ agent: 'TU-FIELD1', when: dayAt(++slotDay, 15), status: 'SCHEDULED', steps: ['ASSIGNED', 'SCHEDULED'] }),
    SCHEDULED_F2: () => ({ agent: 'TU-FIELD2', when: dayAt(3, 11), status: 'SCHEDULED', steps: ['ASSIGNED', 'SCHEDULED'] }),
    REQUESTED: () => ({ agent: null, when: dayAt(2, 16), status: 'REQUESTED', steps: ['REQUESTED'] }),
    MISSED: () => ({ agent: 'TU-FIELD1', when: dayAt(-1, 11), status: 'MISSED', steps: ['ASSIGNED', 'SCHEDULED', 'MISSED'] }),
    COMPLETED: () => ({ agent: 'TU-FIELD1', when: dayAt(-3, 12), status: 'COMPLETED', steps: ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'], feedback: 'Liked the layout and amenities (TEST)' }),
    COMPLETED_MER: () => ({ agent: 'TU-FIELD2', when: dayAt(-4, 11), status: 'COMPLETED', steps: ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'], project: 'TPR-MERIDIAN', feedback: 'Wants a north-facing office (TEST)' }),
    COMPLETED_CEDAR: () => ({ agent: 'TU-FIELD2', when: dayAt(-5, 11), status: 'COMPLETED', steps: ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'], project: 'TPR-CEDAR', feedback: 'Prefers the corner villa (TEST)' }),
    CANCELLED: () => ({ agent: 'TU-FIELD1', when: dayAt(-2, 12), status: 'CANCELLED', steps: ['ASSIGNED', 'SCHEDULED', 'CANCELLED'], feedback: 'Client travelling (TEST)' }),
    VISITED: () => ({ agent: 'TU-FIELD2', when: dayAt(-7, 11), status: 'COMPLETED', steps: ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'], feedback: 'Shortlisted a unit; discussing price (TEST)' })
  };

  for (const [i, l] of D.LEADS.entries()) {
    const created = l.createdHoursAgo ? hoursAgo(l.createdHoursAgo) : hoursAgo(24 * (20 - (i % 18)) + (i % 7));
    const owner = l.owner ? ref[l.owner] : null;
    const reqs = { temperature: l.temp || null, budget_max: l.budget[1], budget_min: l.budget[0], source: l.source, created_at: created, purchase_timeline: l.timeline || null, qualification_status: l.qualified ? 'QUALIFIED' : l.notQualified ? 'NOT_QUALIFIED' : 'PENDING' };
    const priority = l.priority || scorePriority(reqs);
    const fu = l.f === undefined || l.f === null ? null : followUp(l.f);
    const contactedAt = l.contacted ? new Date(created.getTime() + 2 * 3600000) : null;
    const lostAt = l.lost ? new Date(created.getTime() + 5 * 86400000) : null;
    await conn.query(
      `INSERT INTO leads (id, first_name, last_name, email, phone, source, stage, lost_reason, budget_min, budget_max, preferred_project_id, assigned_agent_id,
                          notes, created_at, channel_partner_id, next_follow_up_at, last_contacted_at, first_contacted_at, registered_by, cp_protected_until, temperature,
                          priority, campaign_id, utm_source, utm_medium, utm_campaign, property_type, configuration, preferred_location, purpose, purchase_timeline,
                          qualification_status, qualified_at, duplicate_of_lead_id, lost_at, is_test_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [l.id, l.first, l.last, l.email, l.phone, l.source, l.stage, l.lost || null, l.budget[0], l.budget[1], ref[l.project], owner,
        `TEST DATA · ${l.ref} · ${l.scenario}`, created, l.partner ? ref[l.partner] : null, l.lost ? null : fu, contactedAt, contactedAt,
        l.partner ? D.USERS.find((u) => u.firm === l.partner).id : ref['TU-SALESHEAD'],
        l.partner ? (l.protectionExpired ? hoursAgo(24) : new Date(created.getTime() + 60 * 86400000)) : null, l.temp || null,
        priority, l.campaign ? ref[l.campaign] : null, l.campaign ? l.source.toLowerCase() : null, l.campaign ? 'paid' : null,
        l.campaign ? D.CAMPAIGNS.find((c) => c.ref === l.campaign).code.toLowerCase() : null, l.property || (l.config === 'Plot' ? 'PLOT' : 'RESIDENTIAL'),
        l.config, l.location || null, l.config === 'Office' || l.config === 'Retail' ? 'INVESTMENT' : 'SELF_USE', l.timeline || '3_MONTHS',
        reqs.qualification_status, l.qualified || l.notQualified ? contactedAt : null, l.duplicateOf ? D.LEADS.find((x) => x.ref === l.duplicateOf).id : null, lostAt]
    );
    ref[l.ref] = l.id;
    await register(conn, 'LEAD', l.id, `${l.ref} ${l.first} ${l.last}`);

    const act = (type, outcome, note, at, userRef) => conn.query(
      'INSERT INTO lead_activities (id, lead_id, user_id, type, outcome, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), l.id, userRef ? ref[userRef] : owner, type, outcome, note, at]
    );
    await act('SYSTEM', 'CREATED', `TEST DATA — ${l.scenario}`, created, l.partner ? D.USERS.find((u) => u.firm === l.partner).ref : 'TU-SALESHEAD');
    if (owner) {
      await conn.query(
        "INSERT INTO lead_assignments (id, lead_id, from_user_id, to_user_id, assigned_by, method, reason, created_at) VALUES (?, ?, NULL, ?, ?, 'AUTO', 'Initial assignment (test data)', ?)",
        [crypto.randomUUID(), l.id, owner, ref['TU-MANAGER'], new Date(created.getTime() + 60000)]
      );
      await act('ASSIGN', 'AUTO', 'Assigned (test data)', new Date(created.getTime() + 60000), 'TU-MANAGER');
    }
    if (contactedAt) await act('CALL', 'INTERESTED', 'Spoke to client — requirement noted (test data)', contactedAt);
    if (l.qualified) await act('QUALIFY', 'QUALIFIED', 'Qualified as a genuine buyer (test data)', new Date(contactedAt.getTime() + 60000));
    if (l.lost) await act('STAGE', 'LOST', `Closed as lost: ${l.lost}`, lostAt);

    const plans = [];
    if (l.v) plans.push(visitPlan[l.v]());
    if (l.visited) plans.push(visitPlan.VISITED());
    for (const v of plans) {
      const visitId = crypto.randomUUID();
      const projectId = ref[v.project || l.project];
      await conn.query(
        `INSERT INTO site_visits (id, lead_id, project_id, assigned_agent_id, scheduled_time, status, client_feedback, rating, requested_by, client_confirmed,
                                  accepted_at, check_in_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [visitId, l.id, projectId, v.agent ? ref[v.agent] : null, v.when, v.status, v.feedback || null, v.status === 'COMPLETED' ? 4 : null,
          owner || ref['TU-SALESHEAD'], v.steps.includes('SCHEDULED') ? new Date(v.when.getTime() - 86400000) : null,
          v.status === 'COMPLETED' ? new Date(v.when.getTime() + 5 * 60000) : null, v.status === 'COMPLETED' ? new Date(v.when.getTime() + 75 * 60000) : null,
          new Date(Math.min(v.when.getTime() - 2 * 86400000, Date.now() - 3600000))]
      );
      let prev = null;
      let t = new Date(Math.min(v.when.getTime() - 2 * 86400000, Date.now() - 3600000));
      for (const s of v.steps) {
        t = s === 'COMPLETED' ? new Date(v.when.getTime() + 75 * 60000) : s === 'IN_PROGRESS' ? new Date(v.when.getTime() + 5 * 60000) : s === 'MISSED' || s === 'CANCELLED' ? new Date(v.when.getTime() + 30 * 60000) : new Date(t.getTime() + 3600000);
        await conn.query(
          'INSERT INTO site_visit_history (id, site_visit_id, action, performed_by, previous_status, new_status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), visitId, prev ? s : 'CREATED', s === 'ASSIGNED' || s === 'REQUESTED' ? owner : (v.agent ? ref[v.agent] : owner), prev, s, 'test data', t]
        );
        prev = s;
      }
      await act('VISIT', v.status, `Site visit ${v.status.toLowerCase().replace('_', ' ')} (test data)`, t);
      await register(conn, 'SITE_VISIT', visitId, `${l.ref} visit (${v.status})`);
    }
  }
  return { units: units.length, unitByNumber };
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Run through "node scripts/testenv.js setup" (or add --yes to use the current DB settings).');
    process.exit(1);
  }
  if (!DB.database || !DB.user) throw new Error('DB_NAME and DB_USER must be set.');
  await ensureDatabase();
  execFileSync(process.execPath, [path.join(ROOT, 'database/migrate.js')], { env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });

  const conn = await connect();
  try {
    const [[env]] = await conn.query("SELECT setting_value AS v FROM company_settings WHERE setting_key = 'environment'");
    const [[{ realLeads }]] = await conn.query('SELECT COUNT(*) AS realLeads FROM leads WHERE is_test_data = 0');
    if ((!env || env.v !== 'TEST') && Number(realLeads) > 0) {
      throw new Error(`"${DB.database}" holds ${realLeads} real lead(s). The testing environment must use its own empty database.`);
    }
    const [[already]] = await conn.query('SELECT COUNT(*) AS n FROM users WHERE id = ?', [D.USERS[0].id]);
    if (Number(already.n)) throw new Error('Test data is already loaded. Run "node scripts/testenv.js reset" to start over.');

    await conn.beginTransaction();
    const r = await seed(conn);
    await conn.commit();

    const [[{ leads }]] = await conn.query('SELECT COUNT(*) AS leads FROM leads WHERE is_test_data = 1');
    console.log(`✓ Test environment ready in "${DB.database}": ${D.USERS.length} accounts, ${D.PROJECTS.length} projects, ${r.units} units, ${D.FIRMS.length} partner firms, ${D.CAMPAIGNS.length} campaigns, ${leads} test leads.`);
    console.log(`  All accounts use the password: ${D.PASSWORD}`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.end();
  }
  // Load the manual test checklists into the Testing Center
  execFileSync(process.execPath, [path.join(ROOT, 'backend/testing/syncCases.js')], { env: process.env, stdio: 'inherit' });
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { DB };
