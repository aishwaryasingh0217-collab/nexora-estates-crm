/**
 * Loads the manual test checklists (backend/testing/testCases.js) into the test_cases table.
 *   - new cases are added as NOT_RUN
 *   - edited cases get their new steps/expected results; a recorded result is kept, and the
 *     tester sees that the case changed since they ran it
 *   - cases removed from the checklist are deleted only if nobody has run them yet
 * Results are only ever set by the tester in the Testing Center — never here.
 */
const crypto = require('crypto');

async function syncCases(pool) {
  const { CASES } = require('./testCases');
  const hashOf = (c) => crypto.createHash('sha1').update(JSON.stringify([c.title, c.role, c.login, c.page, c.steps, c.data, c.expected, c.verify])).digest('hex');
  const [rows] = await pool.query('SELECT id, definition_hash, status FROM test_cases');
  const existing = Object.fromEntries(rows.map((r) => [r.id, r]));
  let added = 0;
  let updated = 0;
  for (const [i, c] of CASES.entries()) {
    const h = hashOf(c);
    const values = [c.suite, c.portal, c.title, c.role, c.login || null, c.page || null, JSON.stringify(c.steps), c.data || null, c.expected, c.verify || null, c.cross ? 1 : 0, i, h];
    if (!existing[c.id]) {
      await pool.query(
        `INSERT INTO test_cases (suite, portal, title, role, login_account, page_location, steps, test_data, expected_result, verify_location, is_cross_portal, sort_order, definition_hash, id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...values, c.id]
      );
      added++;
    } else if (existing[c.id].definition_hash !== h) {
      await pool.query(
        `UPDATE test_cases SET suite = ?, portal = ?, title = ?, role = ?, login_account = ?, page_location = ?, steps = ?, test_data = ?, expected_result = ?,
                verify_location = ?, is_cross_portal = ?, sort_order = ?, definition_hash = ?,
                bug_remarks = IF(status <> 'NOT_RUN', CONCAT(COALESCE(bug_remarks, ''), '\n[Checklist updated after this result — please re-run]'), bug_remarks)
          WHERE id = ?`,
        [...values, c.id]
      );
      updated++;
    } else {
      await pool.query('UPDATE test_cases SET sort_order = ? WHERE id = ?', [i, c.id]);
    }
  }
  const keep = new Set(CASES.map((c) => c.id));
  const stale = rows.filter((r) => !keep.has(r.id) && r.status === 'NOT_RUN').map((r) => r.id);
  if (stale.length) await pool.query('DELETE FROM test_cases WHERE id IN (?)', [stale]);
  return { total: CASES.length, added, updated, removed: stale.length };
}

module.exports = { syncCases };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });
  const pool = require('../config/db');
  syncCases(pool)
    .then((r) => { console.log(`✓ Testing Center: ${r.total} test cases (${r.added} added, ${r.updated} updated, ${r.removed} removed)`); process.exit(0); })
    .catch((err) => { console.error('✗ Could not load test cases:', err.message); process.exit(1); });
}
