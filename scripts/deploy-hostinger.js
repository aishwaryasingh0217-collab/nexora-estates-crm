#!/usr/bin/env node
/**
 * Deploys Nexora to a Hostinger Node.js website through the Hostinger API — no SSH or hPanel clicks.
 *
 *   node scripts/deploy-hostinger.js --domain nexora.example.com --plan     look only: shows what would happen
 *   node scripts/deploy-hostinger.js --domain nexora.example.com --demo     create/update the public sales demo
 *   node scripts/deploy-hostinger.js --domain crm.example.com               create/update a real company install
 *
 * First run: creates the website on the same hosting plan as the domain's parent site, creates a
 * MySQL database, sets the app's settings, uploads the committed code (git HEAD) and builds it.
 * Later runs: upload + build only, with the same database and secrets.
 *
 * The API token is read from HOSTINGER_API_TOKEN or ~/.hostinger-token (create it at
 * https://hpanel.hostinger.com/profile/api). Generated secrets are kept in .env.hostinger.<domain>
 * (ignored by git). Only the named website is ever created or changed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const API = 'https://developers.hostinger.com';
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : undefined; };
const DOMAIN = String(arg('domain') || '').toLowerCase();
const PLAN = Boolean(arg('plan'));
const DEMO = Boolean(arg('demo'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(m);

function token() {
  if (process.env.HOSTINGER_API_TOKEN) return process.env.HOSTINGER_API_TOKEN.trim();
  const file = path.join(os.homedir(), '.hostinger-token');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  throw new Error('No Hostinger API token. Create one at https://hpanel.hostinger.com/profile/api and save it to ~/.hostinger-token');
}
let TOKEN = null;

async function api(method, p, body, { ok = [200, 201, 202, 204] } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(API + p, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'nexora-deploy' },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (res.status === 429 || (res.status === 409 && res.headers.get('retry-after'))) {
      await sleep(1000 * Number(res.headers.get('retry-after') || 10));
      continue;
    }
    if (!ok.includes(res.status)) {
      const err = new Error(`${method} ${p} → HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 400) : JSON.stringify(data).slice(0, 600)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  throw new Error(`${method} ${p}: still rate limited after several tries`);
}
const list = (d) => (Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []));

async function findWebsite(domain) {
  for (let page = 1; page <= 10; page++) {
    const rows = list(await api('GET', `/api/hosting/v1/websites?domain=${encodeURIComponent(domain)}&page=${page}&per_page=100`));
    const hit = rows.find((w) => (w.domain || '').toLowerCase() === domain);
    if (hit || rows.length < 100) return hit || null;
  }
  return null;
}

// The site that the new subdomain should share a hosting plan with: the parent domain, or any site under it
async function findParent(domain) {
  const parent = domain.split('.').slice(1).join('.');
  const exact = await findWebsite(parent);
  if (exact) return exact;
  const rows = list(await api('GET', `/api/hosting/v1/websites?domain=${encodeURIComponent(parent)}&per_page=100`));
  return rows.find((w) => (w.domain || '').toLowerCase().endsWith(`.${parent}`) && typeof w.username === 'string') || null;
}

function loadState() {
  const file = path.join(ROOT, `.env.hostinger.${DOMAIN}`);
  const state = { file };
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) state[m[1]] = m[2];
    }
  }
  return state;
}
function saveState(state) {
  const { file, ...values } = state;
  fs.writeFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
}
const strongPassword = () => `Nx${crypto.randomBytes(15).toString('base64').replace(/[^A-Za-z0-9]/g, '')}9a`;

function buildArchive() {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'backend', 'database', 'public', 'package.json', 'package-lock.json'], { cwd: ROOT }).toString().trim();
  if (dirty) say('  ! Uncommitted changes are NOT deployed — only the last commit is.');
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
  const name = `nexora-${commit}-${Date.now()}.zip`;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-deploy-')), name);
  execFileSync('git', ['archive', '--format=zip', '-o', out, 'HEAD', '--',
    'backend', 'database', 'public', 'package.json', 'package-lock.json', 'README.md',
    ':(exclude)public/uploads/brochures/*', ':(exclude)public/assets/*.mp4',
    ':(exclude)database/schema.sql', ':(exclude)backend/.env.example'], { cwd: ROOT });
  return { file: out, name, commit };
}

// Hostinger file storage speaks TUS 1.0.0: announce the file, then send it in chunks
async function upload(username, domain, file, name) {
  const creds = await api('POST', '/api/hosting/v1/files/upload-urls', { username, domain });
  const target = `${String(creds.url).replace(/\/$/, '')}/${encodeURIComponent(name)}?override=true`;
  const size = fs.statSync(file).size;
  const auth = { 'X-Auth': creds.auth_key, 'X-Auth-Rest': creds.rest_auth_key };
  let res = await fetch(target, { method: 'POST', headers: { ...auth, 'Tus-Resumable': '1.0.0', 'Upload-Length': String(size), 'Upload-Offset': '0', 'Upload-Metadata': `filename ${Buffer.from(name).toString('base64')}` } });
  if (res.status !== 201) throw new Error(`Upload could not start: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = fs.readFileSync(file);
  const CHUNK = 8 * 1024 * 1024;
  for (let offset = 0; offset < size;) {
    const part = data.subarray(offset, Math.min(offset + CHUNK, size));
    res = await fetch(target, { method: 'PATCH', headers: { ...auth, 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, body: part });
    if (res.status !== 204 && res.status !== 200) throw new Error(`Upload failed at ${offset} bytes: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    offset = Number(res.headers.get('upload-offset') || offset + part.length);
  }
}

function probe(domain, ip, p) {
  return new Promise((resolve) => {
    const req = https.get({ host: ip, servername: domain, path: p, headers: { Host: domain }, rejectUnauthorized: false, timeout: 20000 }, (res) => {
      let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}
async function resolveIp(host) {
  try { return (await require('dns').promises.resolve4(host))[0]; } catch { return null; }
}

(async () => {
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/.test(DOMAIN)) throw new Error('Pass the subdomain to deploy, e.g. --domain nexora.jattamkommerce.com');
  TOKEN = token();
  say(`\nNexora → ${DOMAIN}${DEMO ? ' (public sales demo)' : ''}${PLAN ? '   [plan only: nothing will be changed]' : ''}`);

  // 1. Website
  let site = await findWebsite(DOMAIN);
  const parent = site ? null : await findParent(DOMAIN);
  if (site) say(`1. Website exists (account ${site.username}, ${site.website_type || 'type unknown'})`);
  else if (!parent) throw new Error(`No website for ${DOMAIN.split('.').slice(1).join('.')} on this Hostinger account, so there is no plan to add the subdomain to.`);
  else say(`1. Will create the website on the same plan as ${parent.domain} (order ${parent.order_id}, account ${parent.username})`);
  const parentIp = await resolveIp(parent ? parent.domain : DOMAIN.split('.').slice(1).join('.')) || await resolveIp(DOMAIN);
  const state = loadState();
  say(`2. Database: ${state.DB_NAME ? `reuse ${state.DB_NAME}` : 'create a new one (name ends in _nexora)'}`);
  say(`3. Settings: NODE_ENV=production${DEMO ? ', DEMO_MODE=true' : ', AUTO_MIGRATE=true'}, database, app secret, timezone`);
  say('4. Upload the last commit and build it (Node 20, entry backend/server.js)');
  if (PLAN) { say('\nPlan only — run again without --plan to do it.'); return; }

  if (!site) {
    await api('POST', `/api/hosting/v1/orders/${parent.order_id}/onboardings`, { domain: DOMAIN });
    say('   website setup started…');
    for (let i = 0; i < 40; i++) {
      await sleep(15000);
      const setups = list(await api('GET', `/api/hosting/v1/onboardings?domain=${encodeURIComponent(DOMAIN)}`));
      const s = setups.find((x) => (x.domain || '').toLowerCase() === DOMAIN) || setups[0];
      if (s && s.status === 'failed') throw new Error(`Website setup failed: ${JSON.stringify(s).slice(0, 400)}`);
      if (s && s.status === 'completed') break;
    }
    site = await findWebsite(DOMAIN);
    if (!site) throw new Error('Website setup did not finish in 10 minutes; run the script again later.');
    say(`   ✓ website ready (account ${site.username})`);
  }
  const U = site.username;
  const base = `/api/hosting/v1/accounts/${U}/websites/${DOMAIN}`;

  // 2. Database
  if (!state.DB_NAME) {
    const password = strongPassword();
    await api('POST', `/api/hosting/v1/accounts/${U}/databases`, { name: 'nexora', user: 'nexora', password, website_domain: DOMAIN });
    const dbs = list(await api('GET', `/api/hosting/v1/accounts/${U}/databases?search=nexora&per_page=100`));
    const db = dbs.find((d) => /_nexora$/.test(d.name)) || dbs[0];
    if (!db) throw new Error('Database was created but could not be found in the list');
    Object.assign(state, { DB_NAME: db.name, DB_USER: db.user, DB_PASSWORD: password });
    saveState(state);
    say(`   ✓ database ${db.name} created (password saved in ${path.basename(state.file)})`);
  }
  if (!state.JWT_SECRET) { state.JWT_SECRET = crypto.randomBytes(48).toString('hex'); saveState(state); }

  const env = [
    ['NODE_ENV', 'production'], ['APP_TIMEZONE', 'Asia/Kolkata'],
    ['DB_HOST', state.DB_HOST || '127.0.0.1'], ['DB_PORT', '3306'],
    ['DB_NAME', state.DB_NAME], ['DB_USER', state.DB_USER], ['DB_PASSWORD', state.DB_PASSWORD],
    ['JWT_SECRET', state.JWT_SECRET],
    DEMO ? ['DEMO_MODE', 'true'] : ['AUTO_MIGRATE', 'true']
  ].map(([key, value]) => ({ key, value }));
  let envSet = false;
  try { await api('PUT', `${base}/nodejs/builds/settings/env`, { env_vars: env }); envSet = true; say('   ✓ settings saved'); } catch (e) { say(`   (settings will be saved after the first build: ${e.message.slice(0, 120)})`); }

  // 3. Upload + build
  const pkg = buildArchive();
  say(`   uploading commit ${pkg.commit} (${(fs.statSync(pkg.file).size / 1048576).toFixed(1)} MB)…`);
  await upload(U, DOMAIN, pkg.file, pkg.name);
  fs.rmSync(path.dirname(pkg.file), { recursive: true, force: true });
  say('   ✓ uploaded; building…');
  const build = await api('POST', `${base}/nodejs/builds`, {
    node_version: 20, app_type: 'express', root_directory: '.', output_directory: null, build_script: 'build',
    entry_file: 'backend/server.js', package_manager: 'npm', source_type: 'archive', source_options: { archive_path: pkg.name }
  });
  let state2 = build;
  for (let i = 0; i < 80 && !['completed', 'failed'].includes(state2.state); i++) {
    await sleep(8000);
    state2 = await api('GET', `${base}/nodejs/builds/${build.uuid}`);
  }
  if (state2.state !== 'completed') {
    const logs = await api('GET', `${base}/nodejs/builds/${build.uuid}/logs`).catch(() => ({}));
    say(String(logs.logs || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(-40).join('\n'));
    throw new Error(`Build ${state2.state || 'did not finish'}`);
  }
  say('   ✓ build completed');
  if (!envSet) {
    await api('PUT', `${base}/nodejs/builds/settings/env`, { env_vars: env });
    await api('POST', `${base}/nodejs/server/restart`);
    say('   ✓ settings saved and app restarted');
  }

  // 4. Check it — straight at the server, so it works even before DNS points here
  if (parentIp) {
    let health = { status: 0 };
    for (let i = 0; i < 20 && health.status !== 200; i++) { await sleep(6000); health = await probe(DOMAIN, parentIp, '/api/health'); }
    say(`\nHealth: ${health.status === 200 ? '✓ ' : '✗ '}${health.status} ${health.body.slice(0, 160)}`);
    if (DEMO) {
      let cfg = { status: 0, body: '' };
      for (let i = 0; i < 10 && !/demoLogins":true/.test(cfg.body); i++) { await sleep(5000); cfg = await probe(DOMAIN, parentIp, '/api/auth/config'); }
      say(`Demo logins on: ${/demoLogins":true/.test(cfg.body) ? '✓' : '✗ ' + cfg.body.slice(0, 120)}`);
    }
  }
  const logs = await api('GET', `${base}/nodejs/runtime-logs?period=1h&limit=40`).catch(() => null);
  if (logs && Array.isArray(logs.logs)) {
    say('\nRecent app log:');
    for (const l of logs.logs.slice(-15)) say(`  ${String(l.message || l.msg || JSON.stringify(l)).slice(0, 200)}`);
  }
  const live = await resolveIp(DOMAIN);
  say(live
    ? `\nDNS: ${DOMAIN} → ${live}${parentIp && live !== parentIp ? ` (expected ${parentIp})` : ' ✓'}`
    : `\nDNS: ${DOMAIN} does not resolve yet. Add an A record "${DOMAIN.split('.')[0]}" → ${parentIp || '(server IP from hPanel)'} where the domain's DNS is managed.`);
  say(`Done: https://${DOMAIN}`);
})().catch((err) => {
  console.error(`\nDeploy stopped: ${err.message}`);
  process.exit(1);
});
