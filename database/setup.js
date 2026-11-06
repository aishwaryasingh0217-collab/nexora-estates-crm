/**
 * One-command setup for a new customer install: prepares the database and creates the owner.
 *
 *   npm run setup                                   (asks the questions)
 *   npm run setup -- --company "Acme Realty" --name "Asha Rao" --email asha@acme.in \
 *                    --phone 9876543210 --username asha --password 'a strong password'
 *
 * Safe to re-run: migrations only apply once, and an existing owner account is left alone.
 */
require('dotenv').config({ quiet: true });
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { execFileSync } = require('child_process');

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}

async function ask(rl, question, { fallback = '', hidden = false } = {}) {
  if (!rl) return fallback;
  if (hidden && process.stdout.isTTY) {
    // Hide the password while it's typed
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => { if (/\r|\n/.test(s)) write.call(rl, s); else write.call(rl, '*'); };
    const answer = await new Promise((r) => rl.question(question, r));
    rl._writeToOutput = write;
    process.stdout.write('\n');
    return answer.trim() || fallback;
  }
  const answer = await new Promise((r) => rl.question(`${question}${fallback ? ` (${fallback})` : ''}: `, r));
  return answer.trim() || fallback;
}

(async () => {
  const a = args();
  const interactive = process.stdin.isTTY && !(a.company && a.email && a.password);
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  console.log('\n1/3  Preparing the database…');
  execFileSync(process.execPath, [path.join(__dirname, 'migrate.js')], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
  console.log('     ✓ tables are up to date');

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'realestate_crm'
  });
  try {
    const [[owner]] = await db.query(`SELECT u.username FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'SUPER_ADMIN' AND u.status = 'ACTIVE' LIMIT 1`);

    console.log('2/3  Company');
    const company = a.company || await ask(rl, '     Company name', { fallback: '' });
    if (company) {
      await db.query(
        `INSERT INTO company_settings (setting_key, setting_value) VALUES ('company_name', ?), ('short_name', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [company.slice(0, 80), (a.short || company.split(/\s+/)[0]).slice(0, 24)]
      );
      console.log(`     ✓ ${company}`);
    }

    console.log('3/3  Owner account (Super Admin)');
    if (owner && !a['add-owner']) {
      console.log(`     ✓ already set up (username: ${owner.username}) — pass --add-owner to create another`);
    } else {
      const name = a.name || await ask(rl, '     Your full name');
      const email = (a.email || await ask(rl, '     Email')).toLowerCase();
      const phone = a.phone || await ask(rl, '     Mobile', { fallback: '' });
      const username = a.username || await ask(rl, '     Username', { fallback: email.split('@')[0] });
      const password = a.password || await ask(rl, '     Password (min 10 characters): ', { hidden: true });
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A name and a valid email are required.');
      if (!password || password.length < 10) throw new Error('Choose a password of at least 10 characters.');
      const [[taken]] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
      if (taken) throw new Error('That username or email is already in use.');
      const [first, ...rest] = name.trim().split(/\s+/);
      await db.query(
        `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status)
         VALUES (?, (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'), ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [crypto.randomUUID(), username, email, await bcrypt.hash(password, 10), first, rest.join(' ') || '', phone || null]
      );
      console.log(`     ✓ created — sign in as "${username}"`);
    }

    console.log(`\nDone. Start the app with "npm start", sign in, then add your team under User Access Control.`);
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.log('⚠  Set a long random JWT_SECRET in .env before going live (e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`).');
    }
  } finally {
    await db.end();
    if (rl) rl.close();
  }
})().catch((err) => {
  console.error(`\nSetup stopped: ${err.message}`);
  process.exit(1);
});
