/**
 * Writes the test data as CSV files (open in Excel / Google Sheets):
 *   test_leads.csv     the 50 test leads with record IDs, contact details and scenario, as they are now
 *   test_accounts.csv  one login per role (all share the test password)
 *   test_records.csv   every registered test record (projects, units, firms, campaigns, visits …)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const D = require('./data');

const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toLocaleString('en-IN') : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => `﻿${[header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')}\r\n`;

async function exportCsv(outDir) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const [leads] = await conn.query(
      `SELECT r.label, l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.stage, l.priority, l.temperature, l.qualification_status,
              l.budget_min, l.budget_max, l.configuration, l.preferred_location, l.next_follow_up_at, l.notes, l.created_at,
              ag.username AS owner, cp.firm_name, p.name AS project, c.code AS campaign
         FROM test_data_registry r JOIN leads l ON l.id = r.entity_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
         LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id LEFT JOIN projects p ON p.id = l.preferred_project_id
         LEFT JOIN campaigns c ON c.id = l.campaign_id
        WHERE r.entity_type = 'LEAD' ORDER BY r.label`
    );
    fs.writeFileSync(path.join(outDir, 'test_leads.csv'), toCsv(
      ['Record ID', 'Lead UUID', 'First name', 'Last name', 'Phone', 'Email', 'Source', 'Campaign', 'Stage', 'Priority', 'Temperature', 'Qualification',
        'Budget min', 'Budget max', 'Configuration', 'Location', 'Project', 'Assigned to', 'Partner firm', 'Next follow-up', 'Created', 'Scenario'],
      leads.map((l) => [l.label.split(' ')[0], l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.campaign, l.stage, l.priority, l.temperature, l.qualification_status,
        l.budget_min, l.budget_max, l.configuration, l.preferred_location, l.project, l.owner, l.firm_name, l.next_follow_up_at, l.created_at,
        String(l.notes || '').split(' · ').slice(2).join(' · ')])
    ));
    const [users] = await conn.query(
      `SELECT r.label, u.username, u.first_name, u.last_name, u.phone, u.job_level, ro.name AS role, cp.firm_name
         FROM test_data_registry r JOIN users u ON u.id = r.entity_id JOIN roles ro ON ro.id = u.role_id LEFT JOIN channel_partners cp ON cp.id = u.channel_partner_id
        WHERE r.entity_type = 'USER' ORDER BY r.label`
    );
    fs.writeFileSync(path.join(outDir, 'test_accounts.csv'), toCsv(
      ['Record ID', 'Username', 'Password', 'Role', 'Level', 'Name', 'Phone (fictional)', 'Partner firm'],
      users.map((u) => [u.label.split(' ')[0], u.username, D.PASSWORD, u.role, u.job_level, `${u.first_name} ${u.last_name}`, u.phone, u.firm_name])
    ));
    const [records] = await conn.query('SELECT entity_type, label, entity_id FROM test_data_registry ORDER BY entity_type, label');
    fs.writeFileSync(path.join(outDir, 'test_records.csv'), toCsv(['Type', 'Record', 'Database ID'], records.map((r) => [r.entity_type, r.label, r.entity_id])));
    console.log(`✓ CSV files written to ${outDir} (${leads.length} leads, ${users.length} accounts, ${records.length} records)`);
    return { leads: leads.length, users: users.length, records: records.length };
  } finally {
    await conn.end();
  }
}

module.exports = { exportCsv };
