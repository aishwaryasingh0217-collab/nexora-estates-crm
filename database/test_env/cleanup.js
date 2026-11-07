/**
 * Clears the manual testing environment so it can be rebuilt from scratch.
 *
 * Removes every business record in the TEST database: the 50 test leads, test accounts, projects,
 * units, campaigns, partner firms and everything testers created during testing (bookings, payments,
 * visits, tickets, calls, notifications…). Kept:
 *   - the audit history (append-only — never deleted)
 *   - the Testing Center results, evidence and bug reports (unless --results)
 *   - roles, migrations and settings
 *
 * Only runs on a database marked as the testing environment (company setting environment = TEST).
 *   node scripts/testenv.js cleanup            (keep test results)
 *   node scripts/testenv.js cleanup --results  (also clear results, evidence and bug reports)
 *   node scripts/testenv.js reset              (cleanup, then load fresh test data)
 */
const mysql = require('mysql2/promise');
const { removeStored } = require('../../backend/middleware/fileUpload');

const KEEP = new Set(['roles', 'schema_migrations', 'company_settings', 'audit_events', 'ad_channels', 'notification_preferences']);
const RESULT_TABLES = ['test_case_evidence', 'test_bug_reports'];

async function cleanup({ results = false } = {}) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    const [[env]] = await conn.query("SELECT setting_value AS v FROM company_settings WHERE setting_key = 'environment'");
    if (!env || env.v !== 'TEST') throw new Error(`"${process.env.DB_NAME}" is not marked as the testing environment — nothing was deleted.`);

    const [tables] = await conn.query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    const files = [];
    const [docRows] = await conn.query('SELECT file_url FROM project_documents UNION ALL SELECT file_url FROM customer_documents WHERE file_url IS NOT NULL').catch(() => [[]]);
    docRows.forEach((r) => files.push(r.file_url));
    if (results) {
      const [ev] = await conn.query('SELECT file_url FROM test_case_evidence');
      ev.forEach((r) => files.push(r.file_url));
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    let cleared = 0;
    for (const { t } of tables) {
      if (KEEP.has(t)) continue;
      if (t === 'test_cases') {
        // The checklist stays; with --results its recorded results are cleared
        if (results) await conn.query("UPDATE test_cases SET status = 'NOT_RUN', actual_result = NULL, bug_remarks = NULL, tested_by = NULL, tested_at = NULL");
        continue;
      }
      if (RESULT_TABLES.includes(t) && !results) continue;
      await conn.query(`DELETE FROM \`${t}\``);
      cleared++;
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    // Settings the test run may have changed go back to the test defaults
    await conn.query("DELETE FROM company_settings WHERE setting_key NOT IN ('environment', 'vapid_public', 'vapid_private', 'company_name', 'short_name')");
    files.forEach(removeStored);
    console.log(`✓ Testing environment cleared (${cleared} tables emptied${results ? ', results cleared' : ', test results kept'}; audit history kept).`);
  } finally {
    await conn.end();
  }
}

module.exports = { cleanup };
