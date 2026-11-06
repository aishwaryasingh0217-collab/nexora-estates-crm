/**
 * End-to-end API checks across every portal: website → CRM, telecaller, site agent, channel partner,
 * sales manager and super admin. Runs against a live server on demo data.
 *
 *   npm test                      (resets demo data, runs this, resets again)
 *   TEST_BASE_URL=http://localhost:5005 node tests/api.test.js
 *
 * Everything this suite creates is named "ZZ …" so tests/reset-demo.js can remove it.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const BASE = `${process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5001}`}/api`;
const P1 = 'p1000000-0000-4000-8000-000000000001'; // Greenfield Heights
const P2 = 'p2000000-0000-4000-8000-000000000002';
const P3 = 'p3000000-0000-4000-8000-000000000003'; // Palm Springs (plots)
const CP1 = 'cp100000-0000-4000-8000-000000000001';

let pass = 0;
let failN = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { failN++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
};
async function call(token, method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}
const login = async (u, p) => (await call(null, 'POST', '/auth/login', { identifier: u, password: p })).data;
const uniquePhone = (lead) => `${lead}${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
const pad = (n) => String(n).padStart(2, '0');
const localSlot = (daysAhead, hh, mm = 0) => {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 30; i++) { try { await fetch(`${BASE}/health`); break; } catch { await sleep(300); } }

  console.log('LOGIN');
  const A = await login('telecaller', 'Telecaller123!');
  const F = await login('siteagent', 'Siteagent123!');
  const P = await login('partner', 'Partner123!');
  const M = await login('admin_ops', 'AdminPassword123!');
  const S = await login('admin', 'AdminPassword123!');
  ok(A.token && A.user.role === 'INSIDE_SALES', 'telecaller logs in as INSIDE_SALES');
  ok(F.token && F.user.role === 'OUTSIDE_SALES', 'siteagent logs in as OUTSIDE_SALES');
  ok(P.token && P.user.role === 'CHANNEL_PARTNER', 'partner logs in as CHANNEL_PARTNER');
  ok(M.token && M.user.role === 'ADMIN', 'admin_ops logs in as ADMIN (manager)');
  ok(S.token && S.user.role === 'SUPER_ADMIN', 'super admin logs in');
  ok((await call(A.token, 'GET', '/auth/me')).status === 200, 'agent session survives /auth/me');
  const cfg = await call(null, 'GET', '/auth/config');
  ok(cfg.status === 200 && typeof cfg.data.data.demoLogins === 'boolean', 'sign-in page can ask whether demo logins are on', cfg.data);

  console.log('ACCESS GATE');
  for (const p of ['/leads', '/deals', '/payments', '/users', '/channel-partners', '/reports/executive-analytics', '/customers']) {
    ok((await call(P.token, 'GET', p)).status === 403, `partner blocked from ${p}`);
  }
  ok((await call(A.token, 'GET', '/payments')).status === 403, 'agent blocked from /payments');
  ok((await call(A.token, 'GET', '/projects')).status === 200, 'agent can still read public /projects');
  ok((await call(M.token, 'GET', '/leads')).status === 200, 'manager can use legacy /leads');
  ok((await call(null, 'GET', '/marketplace/cp-lead-locks')).status === 401, 'cp-lead-locks not public');
  for (const p of ['/workspace/team', '/workspace/activity', '/workspace/reports']) {
    ok((await call(A.token, 'GET', p)).status === 403, `agent cannot open manager view ${p}`);
  }

  console.log('AGENT TODAY');
  let t = await call(A.token, 'GET', '/workspace/today');
  ok(t.status === 200, 'today loads');
  const d = t.data.data;
  ok(d.fresh.length >= 3, 'agent has fresh leads to call', d.fresh.length);
  ok(d.overdue.length >= 2, 'agent has overdue follow-ups', d.overdue.length);
  ok(d.visits.length >= 1 && d.visits.every((v) => v.ics), 'agent has a visit today, with an add-to-calendar link');
  ok(!d.fresh.concat(d.overdue, d.later).some((l) => l.assigned_agent_id !== A.user.id), 'today only contains own leads');

  console.log('AGENT LEADS');
  let L = await call(A.token, 'GET', '/workspace/leads');
  ok(L.status === 200 && L.data.data.every((l) => l.assigned_agent_id === A.user.id), 'agent list is scoped to own leads');
  const farah = 'd0000000-0000-4000-8000-000000000011';
  ok((await call(A.token, 'GET', `/workspace/leads/${farah}`)).status === 404, "agent can't open another agent's lead");
  const arjun = 'd0000000-0000-4000-8000-000000000001';
  let r = await call(A.token, 'POST', `/workspace/leads/${arjun}/activities`, { outcome: 'NO_ANSWER' });
  ok(r.status === 201 && r.data.data.bucket === 'CONTACTED', 'log No answer → stage moves out of New', r.data);
  const nf = new Date(r.data.data.next_follow_up_at);
  ok(nf.getHours() >= 9 && nf.getHours() < 20, 'next follow-up lands inside working hours', r.data.data.next_follow_up_at);
  t = await call(A.token, 'GET', '/workspace/today');
  ok(!t.data.data.fresh.some((l) => l.id === arjun), 'Arjun leaves the "call first" list');
  ok(t.data.data.stats.doneToday >= 1, 'done-today counter increments');
  r = await call(A.token, 'POST', '/workspace/leads', { first_name: 'ZZ Dup', phone: '+91 90000 10003', source: 'WALK_IN' });
  ok(r.status === 409 && r.data.code === 'DUPLICATE', 'duplicate phone is caught (Rohan Gupta)', r.data);
  r = await call(A.token, 'POST', '/workspace/leads', { first_name: 'ZZ Walk', last_name: 'In', phone: uniquePhone(9), source: 'WALK_IN', preferred_project_id: P1 });
  ok(r.status === 201, 'agent adds own walk-in lead', r.data);
  const walkin = r.data.data.id;

  console.log('TELECALLER → SITE AGENT HANDOFF');
  const noon = localSlot(2, 12);
  r = await call(A.token, 'POST', `/workspace/leads/${walkin}/visits`, { project_id: P1, scheduled_time: noon });
  ok(r.status === 201 && /Vikram/.test(r.data.data.agent || ''), 'telecaller fixes a visit → a free site agent conducts it', r.data);
  let fCal = await call(F.token, 'GET', `/workspace/calendar?from=${noon.slice(0, 10)}&to=${localSlot(3, 0).slice(0, 10)}`);
  const handed = fCal.data.data.visits.find((v) => v.lead_id === walkin);
  ok(Boolean(handed), "visit is on the site agent's calendar");
  ok((await call(F.token, 'GET', `/workspace/leads/${walkin}`)).status === 200, 'site agent can open the client they will meet');
  const aCal = await call(A.token, 'GET', `/workspace/calendar?from=${noon.slice(0, 10)}&to=${localSlot(3, 0).slice(0, 10)}`);
  ok(aCal.data.data.visits.some((v) => v.lead_id === walkin), "visit also stays on the telecaller's calendar");
  const clash = await call(A.token, 'POST', '/workspace/leads', { first_name: 'ZZ Clash', phone: uniquePhone(8), source: 'DIRECT_CALL' });
  r = await call(A.token, 'POST', `/workspace/leads/${clash.data.data.id}/visits`, { project_id: P1, scheduled_time: localSlot(2, 12, 30) });
  ok(r.status === 201 && /Pooja/.test(r.data.data.agent || ''), 'site agent busy → visit falls back to the lead owner', r.data);
  const clash2 = await call(A.token, 'POST', '/workspace/leads', { first_name: 'ZZ Clash2', phone: uniquePhone(8), source: 'DIRECT_CALL' });
  r = await call(A.token, 'POST', `/workspace/leads/${clash2.data.data.id}/visits`, { project_id: P1, scheduled_time: localSlot(2, 12, 15) });
  ok(r.status === 409, 'everyone busy within the hour → the clash is refused', r.data);
  r = await call(F.token, 'PATCH', `/workspace/visits/${handed.id}`, { action: 'complete', temperature: 'HOT', feedback: 'Loved A-1101' });
  ok(r.status === 200, 'site agent marks the visit done', r.data);
  let lead = await call(A.token, 'GET', `/workspace/leads/${walkin}`);
  ok(lead.data.data.bucket === 'VISITED' && lead.data.data.temperature === 'HOT', 'telecaller sees Visited + HOT straight away', lead.data.data.bucket);
  const aNotes = await call(A.token, 'GET', '/notifications?limit=10');
  ok((aNotes.data.data || []).some((n) => /site visit done/.test(n.title)), 'telecaller is notified the visit happened');
  const units = await call(A.token, 'GET', `/workspace/projects/${P1}/units`);
  const unit = units.data.data.find((u) => u.unit_number === 'A-1204');
  ok(Boolean(unit), 'project units listed');
  r = await call(A.token, 'POST', `/workspace/leads/${walkin}/book`, { unit_id: unit.id, booking_token_amount: 200000 });
  ok(r.status === 201, 'agent books unit A-1204', r.data);
  r = await call(A.token, 'POST', `/workspace/leads/${clash.data.data.id}/book`, { unit_id: unit.id });
  ok(r.status === 409, 'same unit cannot be booked twice (409, not 500)', r.data);

  console.log('WEBSITE → CRM');
  const before = (await call(A.token, 'GET', '/workspace/pulse')).data.data;
  const webPhone = uniquePhone(6);
  const web = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Meera Iyer', phone: webPhone, project_id: P1, visit_at: localSlot(3, 11, 30), source: 'WEBSITE', company_website: '' });
  ok(web.status === 201 && web.data.visitBooked === true, 'website visitor books a site visit', web.data);
  ok(/Pooja/.test(web.data.message) && /11:30/.test(web.data.message), 'visitor is told who will call and when the visit is', web.data.message);
  const webLead = await call(M.token, 'GET', `/workspace/leads/${web.data.leadId}`);
  ok(webLead.data.data.agent_name === 'Pooja Sharma', 'new enquiry goes to the telecaller (inside sales)', webLead.data.data.agent_name);
  ok(webLead.data.data.visits.length === 1 && webLead.data.data.visits[0].agent_name === 'Vikram Rathore', 'the booked visit goes to the free site agent');
  ok(webLead.data.data.bucket === 'VISIT', 'lead stage is Visit fixed');
  await sleep(1100);
  const after = (await call(A.token, 'GET', '/workspace/pulse')).data.data;
  ok(after.v !== before.v && after.unread > before.unread, "telecaller's screen sees the change (live pulse + notification)", [before, after]);
  for (const [who, tok] of [['sales manager', M.token], ['super admin', S.token]]) {
    const n = await call(tok, 'GET', '/notifications?limit=10');
    ok((n.data.data || []).some((x) => /ZZ Meera/.test(x.title)), `${who} is notified of the website visit`);
  }
  ok((await call(P.token, 'GET', `/workspace/leads/${web.data.leadId}`)).status === 404, "partner can't see an enquiry that isn't theirs");
  const again = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Meera Iyer', phone: webPhone, message: 'Can we move it?' });
  ok(again.status === 200 && again.data.action === 'DUPLICATE_UPDATED', 'repeat enquiry warms the same lead, no duplicate');
  const late = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Late Night', phone: uniquePhone(6), project_id: P1, visit_at: localSlot(1, 22) });
  ok(late.status === 201 && late.data.visitBooked === false, 'visit outside visiting hours is not booked (lead still saved)', late.data);
  const hp = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Bot', phone: uniquePhone(6), company_website: 'http://spam.example' });
  const bot = await call(M.token, 'GET', '/workspace/leads?q=ZZ%20Bot');
  ok(hp.status === 201 && bot.data.results === 0, 'bot that fills the hidden field is ignored');
  const spamPhone = uniquePhone(6);
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Spammer', phone: spamPhone })).status);
  ok(codes[4] === 429 && codes[0] === 201, 'the same number is rate-limited after 4 tries in 10 minutes', codes);
  ok((await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ No Phone' })).status === 400, 'enquiry without a phone is rejected');
  const inj = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ X', phone: '+91 90000 10002', source: "WEB', notes='pwned" });
  ok(inj.status === 200, 'quote in source does not break SQL (re-enquiry path)', inj.data);
  const pass1 = await call(null, 'POST', '/marketplace/priority-passes', { project_id: P1, buyer_name: 'ZZ Pass Buyer', buyer_phone: uniquePhone(6) });
  await sleep(400);
  const passLead = await call(M.token, 'GET', '/workspace/leads?q=ZZ%20Pass%20Buyer');
  ok(pass1.status === 201 && passLead.data.results === 1 && passLead.data.data[0].temperature === 'HOT', 'priority-pass buyer becomes a HOT lead');

  console.log('CALENDAR SYNC (.ics)');
  const me = await call(F.token, 'GET', '/workspace/me');
  const feed = await fetch(BASE + me.data.data.calendarFeed);
  const feedText = await feed.text();
  ok(feed.status === 200 && /text\/calendar/.test(feed.headers.get('content-type')) && feedText.includes(`visit-${webLead.data.data.visits[0].id}@nexora`), "site agent's calendar feed includes the website-booked visit");
  ok((await fetch(BASE + me.data.data.calendarFeed.replace(/sig=[0-9a-f]+/, 'sig=0000'))).status === 404, 'tampered calendar link is refused');
  const one = await fetch(BASE + handed.ics);
  ok(one.status === 200 && /BEGIN:VEVENT[\s\S]*DTSTART:\d{8}T\d{6}Z/.test(await one.text()), 'single-visit .ics opens in any calendar app');

  console.log('PARTNER');
  t = await call(P.token, 'GET', '/workspace/today');
  ok(t.status === 200 && t.data.data.stats.activeClients >= 3, 'partner dashboard');
  ok(!t.data.data.updates.some((u) => u.note && /spouse|EMI/.test(u.note)), 'agent call notes hidden from partner feed');
  L = await call(P.token, 'GET', '/workspace/leads');
  ok(L.data.data.every((l) => l.channel_partner_id === CP1), 'partner sees only own firm clients');
  ok(L.data.data.every((l) => l.last_note === undefined), 'partner list has no internal notes');
  const pCal = await call(P.token, 'GET', '/workspace/calendar');
  ok(pCal.status === 200 && pCal.data.data.followups.length === 0, "partner calendar shows visits only, not the team's call plan");
  r = await call(P.token, 'POST', '/workspace/leads', { first_name: 'ZZ Kavya', phone: '+91 90000 10004', preferred_project_id: P1 });
  ok(r.status === 409 && r.data.code === 'ALREADY_REGISTERED', "partner can't claim an active in-house lead", r.data);
  r = await call(P.token, 'POST', '/workspace/leads', { first_name: 'Sanjay', phone: '+91 90000 10008', preferred_project_id: P2 });
  ok(r.status === 201 && r.data.data.reclaimed, 'partner can re-introduce a LOST lead', r.data);
  const fresh = uniquePhone(7);
  r = await call(P.token, 'POST', '/workspace/leads', { first_name: 'ZZ Neel', last_name: 'Shah', phone: fresh, preferred_project_id: P3, note: 'Wants corner plot' });
  ok(r.status === 201 && r.data.data.assigned_to === 'Pooja Sharma', 'partner registers a client → telecaller is the relationship manager', r.data);
  const neel = r.data.data.id;
  r = await call(P.token, 'POST', '/workspace/leads', { first_name: 'ZZ Neel', phone: fresh, preferred_project_id: P3 });
  ok(r.status === 409 && r.data.code === 'ALREADY_YOURS', 'registering same client twice is caught');
  ok((await call(P.token, 'POST', `/workspace/leads/${neel}/activities`, { outcome: 'NO_ANSWER' })).status === 403, 'partner cannot log call outcomes');
  ok((await call(P.token, 'POST', `/workspace/leads/${neel}/activities`, { outcome: 'NOTE', note: 'Client free Sunday morning' })).status === 201, 'partner can leave a note for the agent');
  r = await call(P.token, 'POST', `/workspace/leads/${neel}/visits`, { scheduled_time: localSlot(4, 10, 30) });
  ok(r.status === 201, 'partner requests a site visit', r.data);
  const pVisits = await call(P.token, 'GET', '/workspace/visits');
  const pv = pVisits.data.data.find((v) => v.lead_id === neel);
  ok(pv && (await call(P.token, 'PATCH', `/workspace/visits/${pv.id}`, { action: 'complete' })).status === 403, 'partner cannot mark a visit done');
  const earn = await call(P.token, 'GET', '/workspace/earnings');
  ok(earn.status === 200 && earn.data.data.totals.earned > 0, 'partner earnings visible');
  ok((await call(A.token, 'GET', '/workspace/earnings')).status === 403, 'agent cannot read partner earnings');

  console.log('PARTNER BOOKING → COMMISSION');
  const farahLead = await call(F.token, 'GET', `/workspace/leads/${farah}`);
  ok(farahLead.status === 200 && farahLead.data.data.partner_firm, 'field agent sees partner firm on lead');
  const plot = (await call(F.token, 'GET', `/workspace/projects/${P3}/units`)).data.data.find((u) => u.unit_number === 'PLOT-58');
  r = await call(F.token, 'POST', `/workspace/leads/${farah}/book`, { unit_id: plot.id });
  ok(r.status === 201, 'field agent books plot for partner client', r.data);
  const earn2 = await call(P.token, 'GET', '/workspace/earnings');
  ok(earn2.data.data.totals.earned > earn.data.data.totals.earned, 'commission auto-created for partner');

  console.log('MARKETPLACE (saved, not just in memory)');
  const newPool = await call(null, 'POST', '/marketplace/group-pools', { project_id: P1, pool_title: 'ZZ Test Pool', target_buyers: 3 });
  const pools = await call(null, 'GET', '/marketplace/group-pools');
  const zzPool = (pools.data.data || []).find((x) => x.pool_title === 'ZZ Test Pool');
  ok(newPool.status === 201 && Boolean(zzPool), 'a new group-buy pool appears in the list');
  const joinPhone = uniquePhone(6);
  const j1 = await call(null, 'POST', `/marketplace/group-pools/${zzPool.id}/join`, { buyer_name: 'ZZ Pool Buyer', buyer_phone: joinPhone });
  const j2 = await call(null, 'POST', `/marketplace/group-pools/${zzPool.id}/join`, { buyer_name: 'ZZ Pool Buyer', buyer_phone: joinPhone });
  const after1 = (await call(null, 'GET', '/marketplace/group-pools')).data.data.find((x) => x.id === zzPool.id);
  ok(j1.status === 201 && j2.status === 200 && Number(after1.current_buyers) === 2, 'joining is saved, and the same buyer only counts once', [j1.status, j2.status, after1.current_buyers]);
  await sleep(400);
  ok((await call(M.token, 'GET', '/workspace/leads?q=ZZ%20Pool%20Buyer')).data.data.some((l) => l.source === 'GROUP_BUY'), 'pool buyer becomes a lead');
  const rooms = (await call(null, 'GET', '/marketplace/deal-rooms')).data.data;
  const room = rooms[0];
  const low = await call(null, 'POST', `/marketplace/deal-rooms/${room.id}/bid`, { bidder_name: 'ZZ Low Bidder', bidder_phone: uniquePhone(6), bid_amount: 1000 });
  ok(low.status === 400, 'an offer below the top offer is refused');
  const top = Number(room.current_highest_bid) + 50000;
  const hi = await call(null, 'POST', `/marketplace/deal-rooms/${room.id}/bid`, { bidder_name: 'ZZ Top Bidder', bidder_phone: uniquePhone(6), bid_amount: top });
  const roomAfter = (await call(null, 'GET', '/marketplace/deal-rooms')).data.data.find((x) => x.id === room.id);
  ok(hi.status === 201 && Number(roomAfter.current_highest_bid) === top, 'a higher offer is saved and becomes the top offer', [hi.status, roomAfter.current_highest_bid]);

  console.log('IMPORT / EXPORT');
  const imp = await call(M.token, 'POST', '/workspace/leads/import', {
    file_name: 'zz-test.xlsx', assign_to: 'auto',
    rows: [
      { name: 'ZZ Import One', phone: uniquePhone(9), project: 'greenfield', budget: '95 L', source: 'Facebook ads' },
      { name: 'ZZ Import Two', phone: uniquePhone(9), stage: 'Site visit done', notes: '=HYPERLINK("http://evil.example")' },
      { name: 'ZZ Import Dup', phone: '+91 90000 10003' },
      { name: 'ZZ Import Bad', phone: '123' }
    ]
  });
  ok(imp.status === 201 && imp.data.data.created === 2 && imp.data.data.duplicates === 1 && imp.data.data.invalid === 1, 'import: 2 added, duplicate and bad number skipped', imp.data.data);
  const impOne = (await call(M.token, 'GET', '/workspace/leads?q=ZZ%20Import%20One')).data.data[0];
  ok(impOne && impOne.project_name === 'Greenfield Heights' && Number(impOne.budget_min) === 9500000 && impOne.agent_name === 'Pooja Sharma', 'import matches the project, reads "95 L", and gives it to the telecaller', impOne);
  const impTwo = (await call(M.token, 'GET', '/workspace/leads?q=ZZ%20Import%20Two')).data.data[0];
  ok(impTwo && impTwo.bucket === 'VISITED', 'import keeps the stage from the file');
  ok((await call(A.token, 'POST', '/workspace/leads/import', { rows: [{ name: 'ZZ x', phone: uniquePhone(9) }] })).status === 403, 'only managers can import');
  const csvRes = await fetch(`${BASE}/workspace/leads/export?q=ZZ%20Import`, { headers: { Authorization: `Bearer ${M.token}` } });
  const csv = await csvRes.text();
  ok(csvRes.status === 200 && csv.includes('ZZ Import One') && csv.includes(`"'=HYPERLINK`), 'export opens in Excel and neutralises formulas', csv.slice(0, 200));
  const pCsv = await (await fetch(`${BASE}/workspace/leads/export`, { headers: { Authorization: `Bearer ${P.token}` } })).text();
  ok(!/,Notes\r\n/.test(pCsv.split('\r\n')[0] + '\r\n') && !pCsv.includes('ZZ Import'), "partner export has only their clients and no internal notes");

  console.log('BRANDING');
  const original = (await call(null, 'GET', '/settings/public')).data.data;
  ok(Boolean(original.company_name), 'public branding is available to the website');
  ok((await call(M.token, 'PUT', '/workspace/settings', { company_name: 'ZZ Brand' })).status === 403, 'sales manager cannot change branding');
  const setB = await call(S.token, 'PUT', '/workspace/settings', { company_name: 'ZZ Brand Realty', support_phone: '+91 80 0000 0000' });
  ok(setB.status === 200 && (await call(null, 'GET', '/settings/public')).data.data.company_name === 'ZZ Brand Realty', 'owner changes the brand and it is live immediately');
  ok((await call(S.token, 'PUT', '/workspace/settings', { logo_url: 'javascript:alert(1)' })).status === 400, 'logo must be a real https link');
  await call(S.token, 'PUT', '/workspace/settings', { company_name: original.company_name, short_name: original.short_name, support_phone: original.support_phone || '' });

  console.log('PHONE ALERTS');
  const pk = await call(A.token, 'GET', '/workspace/push/key');
  ok(pk.status === 200 && pk.data.data.publicKey.length > 60, 'push key available');
  ok((await call(A.token, 'POST', '/workspace/push/subscribe', { subscription: { endpoint: 'http://not-secure.example/x', keys: { p256dh: 'a', auth: 'b' } } })).status === 400, 'insecure push endpoint is refused');
  ok((await call(A.token, 'POST', '/workspace/push/test')).status === 409, 'test alert explains when no device is set up');
  const fakeEndpoint = `https://push.invalid/zz-${Date.now()}`;
  const subR = await call(A.token, 'POST', '/workspace/push/subscribe', { subscription: { endpoint: fakeEndpoint, keys: { p256dh: 'BOr8m1YxP0d8yYk3j3s4h5b6n7m8k9l0p1o2i3u4y5t6r7e8w9q0a1s2d3f4g5h6j7k8l9z0x1c2v3b4n5m6', auth: 'zz-auth-secret' } } });
  ok(subR.status === 201 && subR.data.data.devices >= 1, 'device subscription is saved');
  ok((await call(A.token, 'POST', '/workspace/push/unsubscribe', { endpoint: fakeEndpoint })).data.data.devices === 0, 'turning alerts off removes the device');

  console.log('MANAGER');
  const team = await call(M.token, 'GET', '/workspace/team');
  ok(team.status === 200 && team.data.data.agents.length >= 2, 'team board loads');
  const act = await call(M.token, 'GET', '/workspace/activity?limit=50');
  ok(act.status === 200 && act.data.data.some((a) => a.by_name === 'Automatic') && act.data.data.some((a) => a.by_name === 'Pooja Sharma'),
    'live activity shows website (automatic) and team actions', act.data.data.slice(0, 5).map((a) => a.by_name));
  const rep = await call(M.token, 'GET', '/workspace/reports?days=30');
  ok(rep.status === 200 && rep.data.data.funnel.leads > 0 && rep.data.data.sources.some((x) => x.source === 'WEBSITE'), 'reports: funnel and sources');
  const mCal = await call(M.token, 'GET', `/workspace/calendar?agent_id=${F.user.id}&from=${noon.slice(0, 10)}&to=${localSlot(4, 0).slice(0, 10)}`);
  ok(mCal.status === 200 && mCal.data.data.visits.every((v) => v.assigned_agent_id === F.user.id || v.agent_name), 'manager filters the calendar by agent');
  ok((await call(F.token, 'PATCH', '/workspace/me/availability', { is_available: false })).status === 200, 'field agent goes on leave');
  const onLeave = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Leave Test', phone: uniquePhone(6), project_id: P1, visit_at: localSlot(5, 15) });
  const leaveLead = await call(M.token, 'GET', `/workspace/leads/${onLeave.data.leadId}`);
  ok(leaveLead.data.data.visits[0] && leaveLead.data.data.visits[0].agent_name !== 'Vikram Rathore', 'agent on leave gets no new visits');
  await call(F.token, 'PATCH', '/workspace/me/availability', { is_available: true });
  const refLead = await call(null, 'POST', '/leads/webhook', { full_name: 'ZZ Ref Client', phone: uniquePhone(5), source: 'WEBSITE', project_id: P1, ref: P.user.id });
  ok(refLead.status === 201 && (await call(P.token, 'GET', `/workspace/leads/${refLead.data.leadId}`)).status === 200, "partner's share link credits the partner");
  r = await call(M.token, 'POST', `/workspace/leads/${clash2.data.data.id}/assign`, { agent_id: F.user.id });
  ok(r.status === 200, 'manager reassigns a lead', r.data);
  const usersR = await call(S.token, 'POST', '/users', { username: `tmp_agent_${Date.now()}`, email: `tmp${Date.now()}@example.com`, password: 'Pass12345!', first_name: 'Tmp', last_name: 'Agent', role: 'AGENT' });
  ok(usersR.status === 201 && usersR.data.data.role === 'INSIDE_SALES', 'Add User "AGENT" creates a real agent', usersR.data);
  const cpUser = await call(S.token, 'POST', '/users', { username: `tmp_cp_${Date.now()}`, email: `tmpcp${Date.now()}@example.com`, password: 'Pass12345!', first_name: 'Tmp', last_name: 'Broker', role: 'CHANNEL_PARTNER' });
  ok(cpUser.status === 400, 'partner login requires a firm', cpUser.data);

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(2); });
