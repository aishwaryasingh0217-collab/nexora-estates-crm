/**
 * Database jobs the server runs by itself, for hosts without shell access (e.g. Hostinger Node.js apps):
 *
 *  - Public demo (NODE_ENV=production, DEMO_MODE=true): builds the demo on first start when the
 *    database is empty, rebuilds it when a deploy changes the migrations or seeds, and once a day
 *    after DEMO_RESET_HOUR (default 3 = 3 AM in APP_TIMEZONE). If the app was asleep at that hour,
 *    the rebuild happens when it next starts.
 *  - Any other install with AUTO_MIGRATE=true: applies new database migrations on start.
 *
 * Hosts like Hostinger start several copies of the app and stop idle ones within seconds, so the demo
 * rebuild runs as its own detached process (it finishes even if the web process that started it is
 * stopped) and takes a database lock (only one rebuild at a time). Its output goes to a log file in
 * the temp folder; the next start prints the end of it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../config/db');
const { demoStatus, localDay, lockName } = require('../../database/demoSchedule');

const ROOT = path.join(__dirname, '../..');
const CHECK_EVERY_MS = 10 * 60 * 1000;
const REBUILD_LOG = path.join(os.tmpdir(), `nexora-demo-rebuild-${String(process.env.DB_NAME || 'db').replace(/[^\w-]/g, '')}.log`);

const isPublicDemo = () =>
  process.env.NODE_ENV === 'production' && String(process.env.DEMO_MODE).toLowerCase() === 'true';
const query = (sql, params) => pool.query(sql, params).then(([rows]) => rows);

function startDetachedRebuild() {
  try {
    if (fs.existsSync(REBUILD_LOG) && fs.statSync(REBUILD_LOG).size > 256 * 1024) fs.truncateSync(REBUILD_LOG, 0);
  } catch { /* log housekeeping only */ }
  const fd = fs.openSync(REBUILD_LOG, 'a');
  fs.writeSync(fd, `\n=== ${new Date().toISOString()} started by pid ${process.pid}\n`);
  const child = spawn(process.execPath, [path.join(ROOT, 'database', 'demo_reset.js'), '--yes', '--if-due'], {
    cwd: ROOT,
    env: process.env,
    detached: true,
    stdio: ['ignore', fd, fd]
  });
  child.unref();
  fs.closeSync(fd);
  console.log(`[boot] demo rebuild running in the background (pid ${child.pid})`);
}

function printLastRebuild() {
  try {
    const lines = fs.readFileSync(REBUILD_LOG, 'utf8').trim().split('\n');
    const start = lines.map((l) => l.startsWith('===')).lastIndexOf(true);
    const last = lines.slice(Math.max(start, 0)).filter((l) => /===|done in|skipped|failed|rebuilding/.test(l));
    if (last.length) console.log(`[boot] last demo rebuild: ${last.join(' | ').replace(/\{"timestamp":"[^"]+","level":"\w+","message":"|"\}/g, '')}`);
  } catch { /* no rebuild yet */ }
}

let lastStart = 0;
async function checkDemo() {
  const status = await demoStatus(query);
  if (!status.due) return;
  const [[{ held }]] = await pool.query('SELECT IS_USED_LOCK(?) AS held', [lockName(process.env.DB_NAME)]);
  if (held || Date.now() - lastStart < 60 * 1000) return; // one is already running
  const why = { empty: 'Empty database: building the demo', changed: 'New demo data deployed: rebuilding the demo', daily: 'Daily demo rebuild' };
  console.log(`[boot] ${why[status.reason]}…`);
  lastStart = Date.now();
  startDetachedRebuild();
}

// For /api/health on the demo server: is the demo ready, or being rebuilt?
async function demoHealth() {
  if (!isPublicDemo()) return null;
  try {
    const [[{ held }]] = await pool.query('SELECT IS_USED_LOCK(?) AS held', [lockName(process.env.DB_NAME)]);
    const status = await demoStatus(query);
    return { ready: !held && !status.due, rebuilding: Boolean(held), lastRebuild: (await query(`SELECT setting_value v FROM company_settings WHERE setting_key = 'demo_last_reset'`).catch(() => []))[0]?.v || null };
  } catch {
    return { ready: false, rebuilding: false, lastRebuild: null };
  }
}

function runMigrations() {
  const child = spawn(process.execPath, [path.join(ROOT, 'database', 'migrate.js')], { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (b) => process.stdout.write(`[boot:migrate.js] ${b}`));
  child.stderr.on('data', (b) => process.stderr.write(`[boot:migrate.js] ${b}`));
  child.on('close', (code) => { if (code !== 0) console.error(`[boot] migrate.js exited with code ${code}`); });
}

function startBootTasks() {
  if (isPublicDemo()) {
    printLastRebuild();
    const tick = () => checkDemo().catch((err) => console.error('[boot] demo check failed:', err.message));
    tick();
    setInterval(tick, CHECK_EVERY_MS).unref();
  } else if (String(process.env.AUTO_MIGRATE).toLowerCase() === 'true') {
    runMigrations();
  }
}

module.exports = { startBootTasks, demoHealth, localDay, REBUILD_LOG };
