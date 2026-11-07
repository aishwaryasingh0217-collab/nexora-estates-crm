/**
 * Database jobs the server runs by itself, for hosts without shell access (e.g. Hostinger Node.js apps):
 *
 *  - Public demo (NODE_ENV=production, DEMO_MODE=true): builds the demo on first start when the
 *    database is empty, then rebuilds it once a day after DEMO_RESET_HOUR (default 3 = 3 AM in
 *    APP_TIMEZONE). If the app was asleep at that hour, the rebuild happens when it next starts.
 *  - Any other install with AUTO_MIGRATE=true: applies new database migrations on start.
 *
 * Both run the same scripts as the command line (database/demo_reset.js, database/migrate.js)
 * in a child process, so the server keeps answering while they work.
 */
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../config/db');
const demoFingerprint = require('../../database/demoFingerprint');

const ROOT = path.join(__dirname, '../..');
const CHECK_EVERY_MS = 10 * 60 * 1000;
let running = null;

const isPublicDemo = () =>
  process.env.NODE_ENV === 'production' && String(process.env.DEMO_MODE).toLowerCase() === 'true';

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function runScript(file, args = []) {
  if (running) return running;
  running = new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'database', file), ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (b) => process.stdout.write(`[boot:${file}] ${b}`));
    child.stderr.on('data', (b) => process.stderr.write(`[boot:${file}] ${b}`));
    child.on('close', (code) => {
      running = null;
      if (code !== 0) console.error(`[boot] ${file} exited with code ${code}`);
      resolve(code === 0);
    });
  });
  return running;
}

async function demoState() {
  try {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
    if (Number(n) === 0) return { empty: true };
  } catch {
    return { empty: true }; // tables not created yet
  }
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN ('demo_last_reset', 'demo_fingerprint')`
    );
    const get = (k) => (rows.find((r) => r.setting_key === k) || {}).setting_value || null;
    return { empty: false, lastReset: get('demo_last_reset'), fingerprint: get('demo_fingerprint') };
  } catch {
    return { empty: false, lastReset: null, fingerprint: null };
  }
}

async function checkDemo() {
  if (running) return;
  const state = await demoState();
  const resetHour = Number.parseInt(process.env.DEMO_RESET_HOUR || '3', 10);
  const now = new Date();
  const changed = !state.empty && state.fingerprint !== demoFingerprint();
  const daily = now.getHours() >= resetHour && state.lastReset !== localDay(now);
  if (!state.empty && !changed && !daily) return;
  console.log(`[boot] ${state.empty ? 'Empty database: building the demo' : changed ? 'New demo data deployed: rebuilding the demo' : 'Daily demo rebuild'}…`);
  await runScript('demo_reset.js', ['--yes']);
}

function startBootTasks() {
  if (isPublicDemo()) {
    const tick = () => checkDemo().catch((err) => console.error('[boot] demo check failed:', err.message));
    tick();
    setInterval(tick, CHECK_EVERY_MS).unref();
  } else if (String(process.env.AUTO_MIGRATE).toLowerCase() === 'true') {
    runScript('migrate.js');
  }
}

module.exports = { startBootTasks, localDay };
