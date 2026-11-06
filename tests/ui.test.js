/**
 * Browser checks for every portal at phone and desktop sizes: no script errors, no sideways
 * scrolling, and the main flow of each role works.
 *
 *   npm run test:ui               (needs Google Chrome; set CHROME_PATH if it isn't found)
 *   SHOTS=./shots npm run test:ui (also saves screenshots)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const puppeteer = require('puppeteer-core');

const BASE = `${process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5001}`}/`;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find((p) => fs.existsSync(p));

let pass = 0;
let failN = 0;
const errors = [];
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { failN++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, width, height, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, isMobile: !!mobile, hasTouch: !!mobile });
  page.on('pageerror', (e) => errors.push(`[pageerror ${width}px] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4(09|29)/.test(m.text())) errors.push(`[console ${width}px] ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`[${r.status()}] ${r.url()}`); });
  return page;
}
const shot = async (page, name, full = false) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full }); };
const click = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error(`missing ${s}`); el.click(); }, sel);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function signIn(page, role, ready = '.ws-main') {
  await page.goto(`${BASE}#/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.NX_DEMO_LOGINS === true, { timeout: 6000 });
  // Typing a breached demo password into the visible field makes headless Chrome show a
  // password-leak dialog that swallows input, so sign in without filling that field.
  await page.evaluate((r) => { const pw = document.getElementById('login-password'); if (pw) pw.remove(); return quickLoginAs(r); }, role);
  await page.waitForSelector(ready, { timeout: 10000 });
  await sleep(1000);
}

(async () => {
  if (!CHROME) { console.error('Google Chrome not found — set CHROME_PATH.'); process.exit(2); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

  console.log('WEBSITE (phone)');
  let p = await open(browser, 360, 780, true);
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(600);
  ok(await p.evaluate(() => { const b = document.getElementById('nxq-launch'); return !!b && !b.hidden; }), 'Enquire button on the website');
  ok(await p.evaluate(() => !!document.querySelector('link[rel="manifest"]') && !!document.querySelector('link[rel="apple-touch-icon"]')), 'installable: manifest + iPhone icon');
  await click(p, '#nxq-launch');
  await p.waitForSelector('.nxq-form select option:nth-child(2)', { timeout: 6000 });
  await click(p, '.nxq-seg input[value="SITE_VISIT"]');
  await p.type('.nxq-form input[name="full_name"]', 'ZZ Browser Visitor');
  await p.type('.nxq-form input[name="phone"]', `6${String(Date.now()).slice(-9)}`);
  await p.evaluate(() => { const s = document.querySelector('.nxq-form select'); s.value = s.options[1].value; document.querySelectorAll('.nxq-form input[name="day"]')[1].click(); });
  await shot(p, 'web_enquiry');
  await click(p, '.nxq-submit');
  await p.waitForSelector('.nxq-done', { timeout: 8000 });
  ok(/visit request/i.test(await p.$eval('.nxq-done', (e) => e.textContent)), 'visitor books a site visit from the website');
  ok(await noSideScroll(p), 'website: no sideways scroll at 360px');
  await p.close();

  for (const width of [360, 390]) {
    console.log(`TELECALLER (phone ${width}px)`);
    p = await open(browser, width, 820, true);
    await signIn(p, 'INSIDE_SALES');
    ok((await p.$$('.ws-section')).length >= 2, 'Today shows the call queue');
    await click(p, '.ws-section [data-action="log"]');
    await p.waitForSelector('form[data-form="log"]', { timeout: 6000 });
    await click(p, 'input[name="outcome"][value="NO_ANSWER"]');
    await click(p, 'form[data-form="log"] button[type="submit"]');
    await sleep(1200);
    ok(/logged/i.test(await p.$eval('#ws-toast', (e) => e.textContent)), 'one-tap call outcome is logged');
    await click(p, '.ws-tab[data-tab="calendar"]');
    await p.waitForSelector('.ws-week-strip', { timeout: 6000 });
    ok(await noSideScroll(p), `agent screens: no sideways scroll at ${width}px`);
    await shot(p, `agent_calendar_${width}`);
    await p.close();
  }

  console.log('SITE AGENT (phone)');
  p = await open(browser, 390, 844, true);
  await signIn(p, 'OUTSIDE_SALES');
  await click(p, '.ws-tab[data-tab="calendar"]');
  await p.waitForSelector('.ws-week-strip', { timeout: 6000 });
  await click(p, '[data-action="sync-calendar"]');
  await p.waitForSelector('.ws-choice', { timeout: 4000 });
  ok(await p.evaluate(() => [...document.querySelectorAll('.ws-choice')].some((a) => a.href.startsWith('webcal:'))), 'one-tap calendar subscription for iPhone/Mac');
  await shot(p, 'agent_sync');
  await p.close();

  console.log('CHANNEL PARTNER (phone)');
  p = await open(browser, 390, 844, true);
  await signIn(p, 'CHANNEL_PARTNER');
  ok(JSON.stringify(await p.$$eval('.ws-tab span', (e) => e.map((x) => x.textContent))) === JSON.stringify(['Home', 'Clients', 'Calendar', 'Projects', 'Earnings']), 'partner tabs: Home, Clients, Calendar, Projects, Earnings');
  await click(p, '.ws-fab');
  await p.waitForSelector('form[data-form="register"]', { timeout: 6000 });
  ok(true, 'register-client form opens');
  await click(p, '.ws-sheet [data-action="close-sheet"]');
  await click(p, '.ws-tab[data-tab="earnings"]');
  await sleep(900);
  ok(await noSideScroll(p), 'partner screens: no sideways scroll');
  await shot(p, 'partner_earnings');
  await p.close();

  console.log('SALES MANAGER (desktop)');
  p = await open(browser, 1366, 900);
  await signIn(p, 'ADMIN');
  ok(Boolean(await p.$('#ws-activity .ws-feed, #ws-activity .ws-muted-box')), 'Team tab has the live activity feed');
  await click(p, '.ws-tab[data-tab="calendar"]');
  await p.waitForSelector('.ws-week-grid', { timeout: 6000 });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ws-cal-desktop')).display !== 'none'), 'desktop shows the week grid');
  await shot(p, 'manager_calendar');
  await click(p, '.ws-tab[data-tab="reports"]');
  await p.waitForSelector('.ws-hbars', { timeout: 6000 });
  ok((await p.$$('.ws-hbar')).length >= 5, 'reports: lead-to-booking funnel');
  await shot(p, 'manager_reports', true);
  await click(p, '.ws-tab[data-tab="leads"]');
  await p.waitForSelector('[data-action="import-leads"]', { timeout: 6000 });
  await click(p, '[data-action="import-leads"]');
  await p.waitForSelector('form[data-form="import"] input[type="file"]', { timeout: 6000 });
  await p.evaluate((n) => {
    const csv = `Name,Mobile,Project,Budget\r\nZZ UI Import A,9${n}1,Greenfield Heights,1.1 Cr\r\nZZ UI Import B,9${n}2,,80 L\r\n`;
    const dt = new DataTransfer();
    dt.items.add(new File([csv], 'zz-ui.csv', { type: 'text/csv' }));
    const input = document.querySelector('form[data-form="import"] input[type="file"]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(Date.now()).slice(-8));
  await p.waitForSelector('.ws-import-ok', { timeout: 6000 });
  ok(/2 leads found/.test(await p.$eval('.ws-import-ok', (e) => e.textContent)), 'import screen reads the spreadsheet and previews it');
  await shot(p, 'manager_import_preview');
  await click(p, 'form[data-form="import"] button[type="submit"]');
  await p.waitForFunction(() => /Import finished/.test((document.querySelector('.ws-sheet h2') || {}).textContent || ''), { timeout: 8000 });
  ok(await p.evaluate(() => /2\s*Added/.test(document.querySelector('.ws-sheet').innerText.replace(/\n/g, ' '))), 'import adds the leads and shows a summary');
  await shot(p, 'manager_import_done');
  await p.close();

  console.log('SUPER ADMIN (desktop)');
  p = await open(browser, 1366, 900);
  await signIn(p, 'SUPER_ADMIN', '.sidebar');
  ok(Boolean(await p.$('.sidebar')), 'super admin lands in the full CRM');
  ok(await p.evaluate(() => [...document.querySelectorAll('.nav-item')].some((a) => /Sales Workspace/.test(a.textContent))), 'one click to the Sales Workspace');
  await p.evaluate(() => openWorkspace());
  await p.waitForSelector('.ws-main', { timeout: 8000 });
  await click(p, '[data-action="toggle-menu"]');
  ok(await p.evaluate(() => Boolean(document.querySelector('#ws-menu [data-action="company-settings"]'))), 'owner has Company & branding in the app menu');
  ok(await p.evaluate(() => Boolean(document.querySelector('#ws-menu .ws-alerts-item'))), 'every user can turn on phone alerts from the menu');
  await p.close();

  console.log('SUPER ADMIN (phone)');
  p = await open(browser, 390, 844, true);
  await signIn(p, 'SUPER_ADMIN', '.sidebar');
  await p.evaluate(() => switchView('leads'));
  await sleep(1200);
  ok(await p.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0), 'CRM menu is tucked away on a phone');
  await click(p, '.nx-menu-btn');
  await sleep(350);
  ok(await p.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().left === 0), 'menu button slides the CRM menu in');
  await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav-item')].find((a) => /Calendar/.test(a.textContent)).click());
  await sleep(1200);
  ok(!(await p.evaluate(() => document.body.classList.contains('nx-nav-open'))), 'menu closes after choosing a page');
  ok(await noSideScroll(p), 'CRM: no sideways scroll at 390px');
  await shot(p, 'crm_phone');
  await p.close();

  await browser.close();
  ok(errors.length === 0, 'no script errors on any screen', errors);
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error('UI TEST CRASH', e); console.log(errors.join('\n')); process.exit(2); });
