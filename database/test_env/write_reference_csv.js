/**
 * Writes reference copies of the test data to docs/test-data/ straight from the definitions in data.js
 * (no database needed). Record IDs are fixed, so these match what `npm run testenv:setup` creates.
 * For the data as it is *now* in a running test environment, use `npm run testenv:export` instead.
 *
 *   node database/test_env/write_reference_csv.js
 */
const fs = require('fs');
const path = require('path');
const D = require('./data');

const OUT = path.join(__dirname, '../../docs/test-data');
const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => `﻿${[header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')}\r\n`;
const byRef = (list) => Object.fromEntries(list.map((x) => [x.ref, x]));
const user = byRef(D.USERS);
const firm = byRef(D.FIRMS);
const proj = byRef(D.PROJECTS);
const camp = byRef(D.CAMPAIGNS);
const followUp = (h) => (h == null ? '' : h < 0 ? `overdue by ${-h} h` : `in ${h} h`);

fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'test_leads.csv'), csv(
  ['Ref', 'Record ID', 'First name', 'Last name', 'Phone', 'Email', 'Source', 'Stage', 'Priority', 'Interest', 'Owner (username)', 'Partner firm', 'Project', 'Campaign', 'Budget from', 'Budget to', 'Configuration', 'Follow-up at setup', 'Visit at setup', 'Lost reason', 'Scenario', 'Test data'],
  D.LEADS.map((l) => [
    l.ref, l.id, l.first, l.last, l.phone, l.email, l.source, l.stage, l.priority || '', l.temp || '',
    l.owner ? user[l.owner].username : '', l.partner ? firm[l.partner].name : '', l.project ? proj[l.project].name : '',
    l.campaign ? camp[l.campaign].code : '', l.budget ? l.budget[0] : '', l.budget ? l.budget[1] : '', l.config || '',
    followUp(l.f), l.v || '', l.lost || '', l.scenario, 'TEST DATA'
  ])
));

fs.writeFileSync(path.join(OUT, 'test_accounts.csv'), csv(
  ['Ref', 'Record ID', 'Username', 'Password', 'Role', 'Level', 'Name', 'Phone', 'Reports to', 'Partner firm', 'Test data'],
  D.USERS.map((u) => [
    u.ref, u.id, u.username, `${D.PASSWORD} (unless TEST_ACCOUNT_PASSWORD is set)`, u.role, u.level, `${u.first} ${u.last}`, u.phone,
    u.manager ? user[u.manager].username : '', u.firm ? firm[u.firm].name : '', 'TEST DATA'
  ])
));

const units = D.units();
fs.writeFileSync(path.join(OUT, 'test_records.csv'), csv(
  ['Type', 'Ref', 'Record ID', 'Name / number', 'Details', 'Test data'],
  [
    ...D.FIRMS.map((f) => ['Partner firm', f.ref, f.id, f.name, `${f.tier}, commission ${f.rate}%, phone ${f.phone}`, 'TEST DATA']),
    ...D.PROJECTS.map((p) => ['Project', p.ref, p.id, p.name, `${p.type}, ${p.location}, ${p.status}`, 'TEST DATA']),
    ...D.TOWERS.map((t) => ['Tower', t.ref, t.id, t.name, `${proj[t.project].name}, ${t.floors} floors x ${t.perFloor} per floor`, 'TEST DATA']),
    ...units.map((u) => ['Unit', u.ref, u.id, u.number, `${proj[u.project].name}, ${u.type}, ₹${u.price}${u.status ? `, ${u.status}` : ''}`, 'TEST DATA']),
    ...D.CAMPAIGNS.map((c) => ['Campaign', c.ref, c.id, c.name, `${c.code}, ${c.source}, budget ₹${c.budget}`, 'TEST DATA'])
  ]
));

console.log(`✓ docs/test-data: ${D.LEADS.length} leads, ${D.USERS.length} accounts, ${D.FIRMS.length + D.PROJECTS.length + D.TOWERS.length + units.length + D.CAMPAIGNS.length} other records`);
