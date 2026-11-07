/**
 * When does the public demo need rebuilding? Shared by the server's check (backend/services/bootTasks.js)
 * and by demo_reset.js, which re-checks after taking the rebuild lock.
 *
 *  - empty:   no users yet (first start, or tables missing)
 *  - changed: a deploy changed the migrations or seed scripts
 *  - daily:   it's past DEMO_RESET_HOUR (default 3, in APP_TIMEZONE) and today's rebuild hasn't run
 *
 * query(sql) must resolve to an array of rows. Times use the process clock, so set TZ first.
 */
const demoFingerprint = require('./demoFingerprint');

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// MySQL named locks are server-wide (shared with other databases on the same host), so include the database
const lockName = (dbName) => `nexora_demo_rebuild:${dbName}`.slice(0, 64);

async function demoStatus(query) {
  try {
    const [row] = await query('SELECT COUNT(*) AS n FROM users');
    if (!Number(row.n)) return { due: true, reason: 'empty' };
  } catch {
    return { due: true, reason: 'empty' };
  }
  let rows = [];
  try {
    rows = await query(`SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN ('demo_last_reset', 'demo_fingerprint')`);
  } catch { /* settings table missing → treated as changed below */ }
  const get = (k) => (rows.find((r) => r.setting_key === k) || {}).setting_value || null;
  if (get('demo_fingerprint') !== demoFingerprint()) return { due: true, reason: 'changed' };
  const now = new Date();
  const resetHour = Number.parseInt(process.env.DEMO_RESET_HOUR || '3', 10);
  if (now.getHours() >= resetHour && get('demo_last_reset') !== localDay(now)) return { due: true, reason: 'daily' };
  return { due: false };
}

module.exports = { demoStatus, localDay, lockName };
