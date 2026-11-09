/**
 * Manual Testing Center — checklists, results, evidence and bug reports for the person testing the
 * app by hand. Available only in the testing environment (company setting environment = TEST, set by
 * the test-environment setup) or when TESTING_CENTER=true.
 *
 * Nothing here runs a test or decides a result: every status is set by the tester.
 */
const crypto = require('crypto');
const { wrap, ok, httpError, num, fullName, pool } = require('./common');
const audit = require('../../services/audit');
const { removeStored } = require('../../middleware/fileUpload');
const { ROLE_INFO } = require('../../services/permissions');
const settings = require('../../services/settingsService');

const STATUSES = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'];

async function enabled() {
  if (String(process.env.TESTING_CENTER || '').toLowerCase() === 'true') return true;
  if (String(process.env.TESTING_CENTER || '').toLowerCase() === 'false') return false;
  return String(await settings.getSetting('environment')) === 'TEST';
}

/** Route guard: 404 outside the testing environment. */
const requireTestingEnv = async (req, res, next) => {
  try {
    if (await enabled()) return next();
    return res.status(404).json({ status: 'error', code: 'NOT_TEST_ENVIRONMENT', message: 'The Testing Center is available in the testing environment only.' });
  } catch (err) {
    return next(err);
  }
};

const parseSteps = (t) => { try { return JSON.parse(t); } catch { return t ? [t] : []; } };

const summary = wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT suite, portal, status, is_cross_portal, COUNT(*) AS n FROM test_cases GROUP BY suite, portal, status, is_cross_portal');
  const suites = {};
  const totals = { NOT_RUN: 0, PASS: 0, FAIL: 0, BLOCKED: 0, total: 0 };
  for (const r of rows) {
    suites[r.suite] = suites[r.suite] || { suite: r.suite, portal: r.portal, cross: Boolean(r.is_cross_portal), NOT_RUN: 0, PASS: 0, FAIL: 0, BLOCKED: 0, total: 0 };
    suites[r.suite][r.status] += num(r.n);
    suites[r.suite].total += num(r.n);
    totals[r.status] += num(r.n);
    totals.total += num(r.n);
  }
  const [[bugs]] = await pool.query("SELECT COUNT(*) AS total, SUM(status IN ('OPEN', 'IN_PROGRESS')) AS open FROM test_bug_reports");
  const [[leads]] = await pool.query('SELECT COUNT(*) AS n FROM leads WHERE is_test_data = 1');
  const [order] = await pool.query('SELECT suite, MIN(sort_order) AS o FROM test_cases GROUP BY suite');
  const pos = Object.fromEntries(order.map((o) => [o.suite, num(o.o)]));
  ok(res, {
    totals,
    progressPct: totals.total ? Math.round(((totals.total - totals.NOT_RUN) / totals.total) * 100) : 0,
    suites: Object.values(suites).sort((a, b) => (pos[a.suite] || 0) - (pos[b.suite] || 0)),
    bugs: { total: num(bugs.total), open: num(bugs.open) },
    testLeads: num(leads.n),
    environment: (await settings.getSetting('environment')) || 'NOT SET'
  });
});

const listCases = wrap(async (req, res) => {
  const where = ['1 = 1'];
  const params = [];
  if (req.query.suite) { where.push('t.suite = ?'); params.push(req.query.suite); }
  if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.role) { where.push('t.role LIKE ?'); params.push(`%${req.query.role}%`); }
  if (req.query.q) { where.push('(t.id LIKE ? OR t.title LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const [rows] = await pool.query(
    `SELECT t.id, t.suite, t.portal, t.title, t.role, t.login_account, t.page_location, t.status, t.is_cross_portal, t.tested_at, t.sort_order,
            u.first_name, u.last_name, (SELECT COUNT(*) FROM test_case_evidence e WHERE e.test_case_id = t.id) AS evidence,
            (SELECT COUNT(*) FROM test_bug_reports b WHERE b.test_case_id = t.id AND b.status IN ('OPEN', 'IN_PROGRESS')) AS open_bugs
       FROM test_cases t LEFT JOIN users u ON u.id = t.tested_by
      WHERE ${where.join(' AND ')} ORDER BY t.sort_order`,
    params
  );
  ok(res, rows.map((r) => ({ ...r, tested_by_name: fullName(r.first_name, r.last_name) || null, evidence: num(r.evidence), open_bugs: num(r.open_bugs) })));
});

const getCase = wrap(async (req, res) => {
  const [[t]] = await pool.query(
    'SELECT t.*, u.first_name, u.last_name FROM test_cases t LEFT JOIN users u ON u.id = t.tested_by WHERE t.id = ?',
    [req.params.id]
  );
  if (!t) throw httpError(404, 'Test case not found.');
  const [evidence] = await pool.query(
    'SELECT e.*, u.first_name, u.last_name FROM test_case_evidence e LEFT JOIN users u ON u.id = e.uploaded_by WHERE e.test_case_id = ? ORDER BY e.created_at DESC',
    [t.id]
  );
  const [bugs] = await pool.query('SELECT * FROM test_bug_reports WHERE test_case_id = ? ORDER BY created_at DESC', [t.id]);
  ok(res, {
    ...t, steps: parseSteps(t.steps), tested_by_name: fullName(t.first_name, t.last_name) || null,
    evidence: evidence.map((e) => ({ ...e, uploaded_by_name: fullName(e.first_name, e.last_name) || null })),
    bugs
  });
});

const recordResult = wrap(async (req, res) => {
  const [[t]] = await pool.query('SELECT * FROM test_cases WHERE id = ?', [req.params.id]);
  if (!t) throw httpError(404, 'Test case not found.');
  const b = req.body || {};
  const sets = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw httpError(400, 'Status must be Not run, Pass, Fail or Blocked.');
    if (['FAIL', 'BLOCKED'].includes(b.status) && !(b.actual_result || t.actual_result) && !(b.bug_remarks || t.bug_remarks)) {
      throw httpError(400, 'Describe what actually happened before marking it failed or blocked.');
    }
    sets.status = b.status;
    sets.tested_by = b.status === 'NOT_RUN' ? null : req.user.id;
    sets.tested_at = b.status === 'NOT_RUN' ? null : new Date();
  }
  if (b.actual_result !== undefined) sets.actual_result = b.actual_result ? String(b.actual_result).slice(0, 10000) : null;
  if (b.bug_remarks !== undefined) sets.bug_remarks = b.bug_remarks ? String(b.bug_remarks).slice(0, 10000) : null;
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to save.');
  await pool.query(`UPDATE test_cases SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), t.id]);
  await audit.record({
    req, action: 'TEST_RESULT_RECORDED', entityType: 'TEST_CASE', entityId: t.id,
    summary: `${t.id} ${t.title}: ${sets.status || t.status}`, before: { status: t.status }, after: { status: sets.status || t.status, actual_result: sets.actual_result }
  });
  ok(res, null, 'Result saved.');
});

const addEvidence = wrap(async (req, res) => {
  const caseId = req.params.id || null;
  const bugId = req.params.bugId || null;
  if (caseId) {
    const [[t]] = await pool.query('SELECT id FROM test_cases WHERE id = ?', [caseId]);
    if (!t) { removeStored(req.savedFile.url); throw httpError(404, 'Test case not found.'); }
  }
  if (bugId) {
    const [[bug]] = await pool.query('SELECT id FROM test_bug_reports WHERE id = ?', [bugId]);
    if (!bug) { removeStored(req.savedFile.url); throw httpError(404, 'Bug report not found.'); }
  }
  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO test_case_evidence (id, test_case_id, bug_report_id, file_url, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
    [id, caseId, bugId, req.savedFile.url, req.savedFile.originalName, req.user.id]
  );
  ok(res, { id, url: req.savedFile.url }, 'Screenshot attached.', 201);
});

const deleteEvidence = wrap(async (req, res) => {
  const [[e]] = await pool.query('SELECT * FROM test_case_evidence WHERE id = ?', [req.params.evidenceId]);
  if (!e) throw httpError(404, 'Attachment not found.');
  if (e.uploaded_by !== req.user.id) throw httpError(403, 'Only the person who attached it can remove it.');
  await pool.query('DELETE FROM test_case_evidence WHERE id = ?', [e.id]);
  removeStored(e.file_url);
  ok(res, null, 'Attachment removed.');
});

// ------------------------------------------------------------------------------------------- bugs
const listBugs = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, u.first_name, u.last_name, (SELECT COUNT(*) FROM test_case_evidence e WHERE e.bug_report_id = b.id) AS attachments
       FROM test_bug_reports b LEFT JOIN users u ON u.id = b.reported_by
      ${req.query.status ? 'WHERE b.status = ?' : ''} ORDER BY b.status IN ('OPEN', 'IN_PROGRESS') DESC, FIELD(b.severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), b.created_at DESC`,
    req.query.status ? [req.query.status] : []
  );
  ok(res, rows.map((r) => ({ ...r, reported_by_name: fullName(r.first_name, r.last_name) || null, attachments: num(r.attachments) })));
});

const createBug = wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || String(b.title).trim().length < 4) throw httpError(400, 'Give the bug a short title.');
  let portal = b.portal || null;
  if (b.test_case_id) {
    const [[t]] = await pool.query('SELECT portal FROM test_cases WHERE id = ?', [b.test_case_id]);
    if (!t) throw httpError(400, 'That test case does not exist.');
    portal = portal || t.portal;
  }
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM test_bug_reports');
  const id = crypto.randomUUID();
  const number = `BUG-${String(num(n) + 1).padStart(3, '0')}`;
  await pool.query(
    `INSERT INTO test_bug_reports (id, bug_number, test_case_id, portal, title, severity, description, steps_to_reproduce, expected, actual, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, number, b.test_case_id || null, portal, String(b.title).slice(0, 255), SEVERITIES.includes(b.severity) ? b.severity : 'MEDIUM',
      b.description || null, b.steps_to_reproduce || null, b.expected || null, b.actual || null, req.user.id]
  );
  await audit.record({ req, action: 'BUG_REPORTED', entityType: 'BUG', entityId: id, summary: `${number}: ${b.title}` });
  ok(res, { id, bugNumber: number }, `${number} reported.`, 201);
});

const updateBug = wrap(async (req, res) => {
  const [[bug]] = await pool.query('SELECT * FROM test_bug_reports WHERE id = ?', [req.params.bugId]);
  if (!bug) throw httpError(404, 'Bug report not found.');
  const b = req.body || {};
  const sets = {};
  if (b.status !== undefined) { if (!BUG_STATUSES.includes(b.status)) throw httpError(400, 'Unknown status.'); sets.status = b.status; }
  if (b.severity !== undefined) { if (!SEVERITIES.includes(b.severity)) throw httpError(400, 'Unknown severity.'); sets.severity = b.severity; }
  for (const k of ['title', 'description', 'steps_to_reproduce', 'expected', 'actual']) if (b[k] !== undefined) sets[k] = b[k] ? String(b[k]).slice(0, k === 'title' ? 255 : 10000) : null;
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to save.');
  await pool.query(`UPDATE test_bug_reports SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), bug.id]);
  await audit.record({ req, action: 'BUG_UPDATED', entityType: 'BUG', entityId: bug.id, summary: `${bug.bug_number}: ${sets.status ? `${bug.status} → ${sets.status}` : 'updated'}` });
  ok(res, null, 'Bug report saved.');
});

const getBug = wrap(async (req, res) => {
  const [[bug]] = await pool.query('SELECT * FROM test_bug_reports WHERE id = ?', [req.params.bugId]);
  if (!bug) throw httpError(404, 'Bug report not found.');
  const [evidence] = await pool.query('SELECT * FROM test_case_evidence WHERE bug_report_id = ? ORDER BY created_at DESC', [bug.id]);
  ok(res, { ...bug, evidence });
});

// ------------------------------------------------------------------------------------------- environment data
const accounts = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r2.label, u.id, u.username, u.first_name, u.last_name, u.phone, u.job_level, u.status, ro.name AS role, cp.firm_name
       FROM test_data_registry r2 JOIN users u ON u.id = r2.entity_id JOIN roles ro ON ro.id = u.role_id LEFT JOIN channel_partners cp ON cp.id = u.channel_partner_id
      WHERE r2.entity_type = 'USER' ORDER BY r2.label`
  );
  ok(res, {
    password: process.env.TEST_ACCOUNT_PASSWORD || 'Test@Nexora2026',
    rows: rows.map((r) => ({ ref: r.label.split(' ')[0], id: r.id, username: r.username, name: fullName(r.first_name, r.last_name), phone: r.phone, role: r.role, roleLabel: (ROLE_INFO[r.role] || {}).label || r.role, jobLevel: r.job_level, status: r.status, firm: r.firm_name }))
  });
});

const testLeads = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r2.label, l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.stage, l.priority, l.temperature, l.next_follow_up_at, l.notes,
            l.budget_min, l.budget_max, l.configuration, ag.username AS owner, cp.firm_name, p.name AS project_name, c.code AS campaign
       FROM test_data_registry r2 JOIN leads l ON l.id = r2.entity_id LEFT JOIN users ag ON ag.id = l.assigned_agent_id
       LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id LEFT JOIN projects p ON p.id = l.preferred_project_id LEFT JOIN campaigns c ON c.id = l.campaign_id
      WHERE r2.entity_type = 'LEAD' ORDER BY r2.label`
  );
  ok(res, rows.map((r) => ({ ...r, ref: r.label.split(' ')[0], name: fullName(r.first_name, r.last_name), scenario: String(r.notes || '').split(' · ').slice(2).join(' · ') })));
});

/** Every notification sent in the testing environment (to verify who was told what). */
const notifications = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.type, n.category, n.title, n.message, n.is_read, n.created_at, n.related_entity_type, n.related_entity_id, u.username, r.name AS role
       FROM notifications n JOIN users u ON u.id = n.recipient_user_id JOIN roles r ON r.id = u.role_id
      ${req.query.username ? 'WHERE u.username = ?' : ''} ORDER BY n.created_at DESC LIMIT 500`,
    req.query.username ? [req.query.username] : []
  );
  ok(res, rows);
});

/** Activity (audit) history for the testing environment, newest first. */
const activity = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT seq, action, entity_type, entity_id, summary, actor_name, actor_role, source, result, created_at
       FROM audit_events ${req.query.q ? 'WHERE summary LIKE ? OR action LIKE ?' : ''} ORDER BY seq DESC LIMIT 500`,
    req.query.q ? [`%${req.query.q}%`, `%${String(req.query.q).toUpperCase()}%`] : []
  );
  ok(res, rows);
});

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportResults = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.portal, t.title, t.role, t.login_account, t.status, t.actual_result, t.bug_remarks, t.tested_at, u.username AS tested_by,
            (SELECT COUNT(*) FROM test_case_evidence e WHERE e.test_case_id = t.id) AS evidence
       FROM test_cases t LEFT JOIN users u ON u.id = t.tested_by ORDER BY t.sort_order`
  );
  const header = ['Test ID', 'Portal', 'Title', 'Role', 'Login', 'Status', 'Actual result', 'Bug remarks', 'Tested at', 'Tested by', 'Evidence files'];
  const lines = [header.join(','), ...rows.map((r) => [r.id, r.portal, r.title, r.role, r.login_account, r.status, r.actual_result, r.bug_remarks, r.tested_at, r.tested_by, r.evidence].map(csvCell).join(','))];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="nexora-test-results-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${lines.join('\r\n')}`);
});

module.exports = {
  requireTestingEnv, enabled, summary, listCases, getCase, recordResult, addEvidence, deleteEvidence,
  listBugs, createBug, updateBug, getBug, accounts, testLeads, notifications, activity, exportResults
};
