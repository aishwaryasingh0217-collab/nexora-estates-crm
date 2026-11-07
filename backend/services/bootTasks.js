/**
 * Database jobs the server runs by itself, for hosts without shell access (e.g. Hostinger Node.js apps):
 *
 *  - Public demo (NODE_ENV=production, DEMO_MODE=true): builds the demo on first start when the
 *    database is empty, rebuilds it when a deploy changes the migrations or seeds, and once a day
 *    after DEMO_RESET_HOUR (default 3 = 3 AM in APP_TIMEZONE). If the app was asleep at that hour,
 *    the rebuild happens when it next starts.
 *  - Any other install with AUTO_MIGRATE=true: applies new database migrations on start.
 *
 * Both run the command-line scripts (database/demo_reset.js, database/migrate.js) in a child process,
 * so the server keeps answering while they work. Hosts can run several copies of the app at once;
 * demo_reset.js takes a database lock and re-checks, so only one copy ever rebuilds.
 */
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../config/db');
const { demoStatus, localDay } = require('../../database/demoSchedule');

const ROOT = path.join(__dirname, '../..');
const CHECK_EVERY_MS = 10 * 60 * 1000;
let running = null;

const isPublicDemo = () =>
  process.env.NODE_ENV === 'production' && String(process.env.DEMO_MODE).toLowerCase() === 'true';

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

async function checkDemo() {
  if (running) return;
  const status = await demoStatus((sql) => pool.query(sql).then(([rows]) => rows));
  if (!status.due) return;
  const why = { empty: 'Empty database: building the demo', changed: 'New demo data deployed: rebuilding the demo', daily: 'Daily demo rebuild' };
  console.log(`[boot] ${why[status.reason]}…`);
  await runScript('demo_reset.js', ['--yes', '--if-due']);
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
