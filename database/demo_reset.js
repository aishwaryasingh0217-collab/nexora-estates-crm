/**
 * Rebuilds the public sales demo from scratch: wipes every table, re-runs the migrations and the
 * demo seeds (whose dates are relative to "now", so today's calls and visits are always today's),
 * and removes brochures that visitors uploaded. Push keys are kept so phone alerts keep working.
 *
 *   DEMO_MODE=true node database/demo_reset.js --yes            rebuild now
 *   DEMO_MODE=true node database/demo_reset.js --yes --if-due   rebuild only if due (what the server runs)
 *
 * Refuses to run unless DEMO_MODE=true is set explicitly — it must never touch a real company's data.
 * Hosts may run several copies of the app at once, so a database lock makes sure only one rebuild
 * runs at a time; the others step aside.
 *
 * On the demo server the app starts this as a detached process (backend/services/bootTasks.js), so it
 * finishes even if the host stops the web process. Its output goes to the temp folder, in
 * nexora-demo-rebuild-<database>.log, and the next app start prints the end of it.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { execFileSync } = require('child_process');
const { demoStatus, localDay, lockName } = require('./demoSchedule');
const demoFingerprint = require('./demoFingerprint');

const SEEDS = [
  'migrate.js',
  'seed_super_admin.js',
  'seed_demo_data.js',
  'seed_channel_partners.js',
  'seed_marketplace_data.js',
  'seed_sales_team.js',
  'seed_business_suite.js'
];
const KEEP_SETTINGS = ['vapid_public', 'vapid_private'];
const connect = () => mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function rebuild(db, dbName, started) {
  let kept = [];
  try {
    [kept] = await db.query('SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN (?)', [KEEP_SETTINGS]);
  } catch { kept = []; }

  const [objects] = await db.query(
    'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [dbName]
  );
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const o of objects) {
    await db.query(`DROP ${o.type === 'VIEW' ? 'VIEW' : 'TABLE'} IF EXISTS \`${o.name.replace(/`/g, '')}\``);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`[demo-reset] cleared ${objects.length} tables in ${dbName}`);

  for (const script of SEEDS) {
    execFileSync(process.execPath, [path.join(__dirname, script)], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'ignore', 'inherit']
    });
    console.log(`[demo-reset] ran ${script}`);
  }

  // Put the push keys back, and note the day and fingerprint so the server knows the demo is current
  const marks = [
    { setting_key: 'demo_last_reset', setting_value: localDay() },
    { setting_key: 'demo_fingerprint', setting_value: demoFingerprint() }
  ];
  for (const row of [...kept, ...marks]) {
    await db.query(
      `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [row.setting_key, row.setting_value]
    );
  }

  // Seeds don't use uploaded brochures, so on the demo server anything here was uploaded by a visitor.
  // A git checkout is a developer's copy, not the deployed demo, so its files are left alone.
  const uploads = path.join(__dirname, '../public/uploads/brochures');
  const isCheckout = fs.existsSync(path.join(__dirname, '../.git'));
  let removed = 0;
  if (isCheckout) {
    console.log('[demo-reset] git checkout detected: uploaded files left untouched');
  } else if (fs.existsSync(uploads)) {
    for (const f of fs.readdirSync(uploads)) {
      const p = path.join(uploads, f);
      if (fs.statSync(p).isFile()) { fs.unlinkSync(p); removed++; }
    }
  }
  console.log(`[demo-reset] removed ${removed} uploaded files; done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

(async () => {
  if (String(process.env.DEMO_MODE).toLowerCase() !== 'true' || !process.argv.includes('--yes')) {
    console.error('Refusing to reset: this wipes the whole database. Only for the demo server, with DEMO_MODE=true and --yes.');
    process.exit(1);
  }
  const started = Date.now();
  const db = await connect();
  try {
    const [[{ dbName }]] = await db.query('SELECT DATABASE() AS dbName');
    // Held by this connection until it closes, so a crash can't leave it stuck
    const [[{ got }]] = await db.query('SELECT GET_LOCK(?, 0) AS got', [lockName(dbName)]);
    if (Number(got) !== 1) {
      console.log('[demo-reset] another rebuild is running; skipped');
      return;
    }
    if (process.argv.includes('--if-due')) {
      const status = await demoStatus((sql) => db.query(sql).then(([rows]) => rows));
      if (!status.due) {
        console.log('[demo-reset] demo already up to date; skipped');
        return;
      }
      console.log(`[demo-reset] rebuilding (${status.reason})`);
    }
    await rebuild(db, dbName, started);
  } finally {
    await db.end();
  }
})().catch((err) => {
  console.error('[demo-reset] failed:', err.message);
  process.exit(1);
});
