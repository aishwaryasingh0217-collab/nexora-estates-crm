#!/usr/bin/env node
/**
 * Manual testing environment — one command for everything. Uses its own settings file, .env.testenv,
 * so it always works on the separate test database and never on the live one.
 *
 *   node scripts/testenv.js init               create .env.testenv from .env (test DB name, port 5050)
 *   node scripts/testenv.js setup              create the test database, run migrations, load test data
 *   node scripts/testenv.js start              run the app on the test database (http://localhost:5050)
 *   node scripts/testenv.js export [folder]    write test_leads.csv, test_accounts.csv, test_records.csv
 *   node scripts/testenv.js cleanup [--results]remove all test data (keeps results unless --results)
 *   node scripts/testenv.js reset              cleanup + setup (fresh 50 leads; results kept)
 *   node scripts/testenv.js status             what's in the test database
 *
 * npm shortcuts: npm run testenv:setup | testenv:start | testenv:export | testenv:cleanup | testenv:reset
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.testenv');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function init() {
  if (fs.existsSync(ENV_FILE)) return console.log(`.env.testenv already exists — edit it to change the test database settings.`);
  const base = fs.existsSync(path.join(ROOT, '.env')) ? parseEnv(fs.readFileSync(path.join(ROOT, '.env'), 'utf8')) : {};
  const lines = [
    '# Manual testing environment (separate database). Never point this at the live database.',
    `DB_HOST=${base.DB_HOST || '127.0.0.1'}`,
    `DB_PORT=${base.DB_PORT || '3306'}`,
    `DB_USER=${base.DB_USER || 'realestate_app'}`,
    `DB_PASSWORD=${base.DB_PASSWORD || ''}`,
    `DB_NAME=${(base.DB_NAME || 'realestate_crm')}_testing`,
    `JWT_SECRET=testenv-${require('crypto').randomBytes(24).toString('hex')}`,
    'PORT=5050',
    'NODE_ENV=development',
    'DEMO_MODE=false',
    'TESTING_CENTER=true',
    'TEST_ACCOUNT_PASSWORD=Test@Nexora2026',
    '# Leave calendar/WhatsApp integrations off in the test environment',
    'GOOGLE_CLIENT_ID=',
    'GOOGLE_CLIENT_SECRET=',
    'GOOGLE_REFRESH_TOKEN=',
    '# Cloud calling (optional): fill these to test real calls with your own phone numbers',
    'TELEPHONY_PROVIDER=exotel',
    'EXOTEL_ACCOUNT_SID=',
    'EXOTEL_API_KEY=',
    'EXOTEL_API_TOKEN=',
    'EXOTEL_CALLER_ID=',
    'EXOTEL_SUBDOMAIN=api.exotel.com',
    'TELEPHONY_WEBHOOK_SECRET=',
    'PUBLIC_BASE_URL=',
    '# AI assistant (optional)',
    'ANTHROPIC_API_KEY='
  ];
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { mode: 0o600 });
  console.log(`✓ Created .env.testenv (database ${lines[5].split('=')[1]}, port 5050). It is private and ignored by git.`);
}

function testEnv() {
  if (!fs.existsSync(ENV_FILE)) init();
  const env = parseEnv(fs.readFileSync(ENV_FILE, 'utf8'));
  const live = fs.existsSync(path.join(ROOT, '.env')) ? parseEnv(fs.readFileSync(path.join(ROOT, '.env'), 'utf8')) : {};
  if (live.DB_NAME && env.DB_NAME === live.DB_NAME && (env.DB_HOST || '') === (live.DB_HOST || '')) {
    console.error('✗ .env.testenv points at the same database as .env. Use a separate test database.');
    process.exit(1);
  }
  // Values from .env.testenv win over anything inherited (including blanks, which switch integrations off)
  return { ...process.env, ...env };
}

function run(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { env: testEnv(), stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) process.exit(r.status || 1);
}

async function main() {
  const [cmd = 'help', ...rest] = process.argv.slice(2);
  if (cmd === 'init') return init();
  if (cmd === 'setup') return run('database/test_env/setup.js', ['--yes']);
  if (cmd === 'start') {
    const env = testEnv();
    console.log(`Testing environment on http://localhost:${env.PORT || 5050} (database ${env.DB_NAME})`);
    const child = spawn(process.execPath, [path.join(ROOT, 'backend/server.js')], { env, stdio: 'inherit', cwd: ROOT });
    child.on('exit', (code) => process.exit(code || 0));
    return;
  }
  if (cmd === 'export' || cmd === 'cleanup' || cmd === 'status') {
    Object.assign(process.env, testEnv());
    if (cmd === 'export') return require('../database/test_env/export').exportCsv(path.resolve(rest[0] || path.join(ROOT, 'test-env-output')));
    if (cmd === 'cleanup') return require('../database/test_env/cleanup').cleanup({ results: rest.includes('--results') });
    const mysql = require('mysql2/promise');
    const c = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    const [[s]] = await c.query(`SELECT (SELECT COUNT(*) FROM leads WHERE is_test_data = 1) AS test_leads, (SELECT COUNT(*) FROM leads) AS all_leads,
      (SELECT COUNT(*) FROM users WHERE is_test_data = 1) AS accounts, (SELECT COUNT(*) FROM deals) AS bookings, (SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COUNT(*) FROM test_cases) AS cases, (SELECT COUNT(*) FROM test_cases WHERE status <> 'NOT_RUN') AS run`);
    await c.end();
    return console.log(`Test database ${process.env.DB_NAME}: ${s.test_leads} test leads (${s.all_leads} leads in total), ${s.accounts} test accounts, ${s.bookings} bookings, ${s.payments} payments; ${s.run} of ${s.cases} test cases run.`);
  }
  if (cmd === 'reset') {
    Object.assign(process.env, testEnv());
    await require('../database/test_env/cleanup').cleanup({ results: rest.includes('--results') });
    return run('database/test_env/setup.js', ['--yes']);
  }
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
