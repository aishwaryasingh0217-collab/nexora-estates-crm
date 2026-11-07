/**
 * Company-wide controls: approvals, escalations, audit history, record timelines, workflow rules,
 * people (create, role changes, activation, sessions) and "me".
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { wrap, ok, httpError, page, num, fullName, pool } = require('./common');
const approvals = require('../../services/approvalService');
const escalations = require('../../services/escalationService');
const audit = require('../../services/audit');
const timeline = require('../../services/timelineService');
const settings = require('../../services/settingsService');
const notifications = require('../../services/notificationService');
const { can, capabilitiesFor, portalsFor, auditRolesVisibleTo, ROLE_INFO, ALL_ROLES, ROLES } = require('../../services/permissions');
const { DEMO_ACCOUNT_IDS, isDemoMode } = require('../../services/demoMode');

// ------------------------------------------------------------------------------------------- me
const me = wrap(async (req, res) => {
  const [[u]] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.job_level, u.is_available, u.channel_partner_id, u.last_login,
            r.name AS role, m.first_name AS mgr_first, m.last_name AS mgr_last
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN users m ON m.id = u.manager_id WHERE u.id = ?`,
    [req.user.id]
  );
  const user = { ...req.user, jobLevel: u.job_level };
  const pendingApprovals = can(user, 'approvals.view') ? await approvals.pendingCountFor(user) : 0;
  const openEscalations = (await escalations.list(user, { status: 'OPEN', limit: 500 })).length;
  ok(res, {
    id: u.id, username: u.username, email: u.email, name: fullName(u.first_name, u.last_name), firstName: u.first_name, lastName: u.last_name,
    phone: u.phone, role: u.role, roleLabel: (ROLE_INFO[u.role] || {}).label || u.role, department: (ROLE_INFO[u.role] || {}).department || null,
    jobLevel: u.job_level, isAvailable: Boolean(u.is_available), managerName: fullName(u.mgr_first, u.mgr_last) || null,
    capabilities: capabilitiesFor(user), portals: portalsFor(user), homePortal: (ROLE_INFO[u.role] || {}).portal || 'workspace',
    counts: { unreadNotifications: await notifications.getUnreadCount(u.id), pendingApprovals, openEscalations },
    company: await settings.getSettings(),
    testingCenter: String(process.env.TESTING_CENTER || '').toLowerCase() !== 'false'
  });
});

const changePassword = wrap(async (req, res) => {
  const { current_password: current, new_password: next } = req.body || {};
  if (!next || String(next).length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) throw httpError(400, 'Use at least 8 characters with letters and numbers.');
  if (isDemoMode() && DEMO_ACCOUNT_IDS.has(req.user.id)) throw httpError(403, 'Demo logins can’t change their password.');
  const [[u]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), u.password_hash))) throw httpError(400, 'Your current password is incorrect.');
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(next), 10), req.user.id]);
  await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL', [req.user.id, req.user.id, req.user.sessionId || '']);
  await audit.record({ req, action: 'PASSWORD_CHANGED', entityType: 'USER', entityId: req.user.id, summary: 'Changed own password; other devices signed out' });
  ok(res, null, 'Password changed. Your other devices were signed out.');
});

async function sessionsOf(userId, currentSessionId = null) {
  const [rows] = await pool.query(
    `SELECT id, ip_address, user_agent, created_at, last_seen_at, expires_at, revoked_at FROM user_sessions
      WHERE user_id = ? AND (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT 50`,
    [userId]
  );
  return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

const mySessions = wrap(async (req, res) => ok(res, await sessionsOf(req.user.id, req.user.sessionId)));

const revokeMySession = wrap(async (req, res) => {
  const which = req.params.id;
  if (which === 'others') {
    const [r] = await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL', [req.user.id, req.user.id, req.user.sessionId || '']);
    await audit.record({ req, action: 'SESSIONS_REVOKED', entityType: 'USER', entityId: req.user.id, summary: `Signed out ${r.affectedRows} other device(s)` });
    return ok(res, { revoked: r.affectedRows }, `Signed out of ${r.affectedRows} other device${r.affectedRows === 1 ? '' : 's'}.`);
  }
  const [r] = await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL', [req.user.id, which, req.user.id]);
  if (!r.affectedRows) throw httpError(404, 'Session not found.');
  await audit.record({ req, action: 'SESSION_REVOKED', entityType: 'USER', entityId: req.user.id, summary: 'Signed out one device' });
  ok(res, { revoked: 1 }, 'Device signed out.');
});

// ------------------------------------------------------------------------------------------- approvals
const listApprovals = wrap(async (req, res) => {
  ok(res, await approvals.listApprovals(req.user, { status: req.query.status || 'PENDING', type: req.query.type || null }));
});

const decideApproval = wrap(async (req, res) => {
  const b = req.body || {};
  const r = await approvals.decide(req.user, req.params.id, b.decision, b.note || null, req);
  ok(res, r, r.status === 'APPROVED' ? 'Approved.' : 'Rejected.');
});

// ------------------------------------------------------------------------------------------- escalations
const listEscalations = wrap(async (req, res) => ok(res, await escalations.list(req.user, { status: req.query.status || 'OPEN' })));

const raiseEscalation = wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title) throw httpError(400, 'Give the escalation a short title.');
  const toRole = ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'CUSTOMER_RELATIONS', 'BUSINESS_OWNER'].includes(b.to_role) ? b.to_role : 'ADMIN';
  const id = await escalations.raise({
    entityType: b.entity_type || (b.lead_id ? 'LEAD' : 'OTHER'), entityId: b.entity_id || b.lead_id || crypto.randomUUID(), leadId: b.lead_id || null,
    title: b.title, reason: b.reason || null, severity: b.severity, raisedBy: req.user.id, source: 'HUMAN', toRole, req
  });
  ok(res, { id }, 'Escalated.', 201);
});

const updateEscalation = wrap(async (req, res) => {
  const b = req.body || {};
  ok(res, await escalations.update(req.user, req.params.id, b.action, b.note, req), b.action === 'resolve' ? 'Resolved.' : 'Acknowledged.');
});

// ------------------------------------------------------------------------------------------- audit
const listAudit = wrap(async (req, res) => {
  const q = req.query;
  const where = ['1 = 1'];
  const params = [];
  const visible = auditRolesVisibleTo(req.user);
  if (visible) {
    if (visible.length) { where.push('(a.actor_role IN (?) OR a.actor_user_id = ?)'); params.push(visible, req.user.id); }
    else { where.push('a.actor_user_id = ?'); params.push(req.user.id); }
  }
  if (q.from) { where.push('a.created_at >= ?'); params.push(new Date(q.from)); }
  if (q.to) { where.push('a.created_at < ? + INTERVAL 1 DAY'); params.push(new Date(q.to)); }
  if (q.actor_id) { where.push('a.actor_user_id = ?'); params.push(q.actor_id); }
  if (q.role) { where.push('a.actor_role = ?'); params.push(q.role); }
  if (q.action) { where.push('a.action LIKE ?'); params.push(`%${String(q.action).toUpperCase()}%`); }
  if (q.entity_type) { where.push('a.entity_type = ?'); params.push(String(q.entity_type).toUpperCase()); }
  if (q.entity_id) { where.push('a.entity_id = ?'); params.push(q.entity_id); }
  if (q.source) { where.push('a.source = ?'); params.push(String(q.source).toUpperCase()); }
  if (q.result) { where.push('a.result = ?'); params.push(String(q.result).toUpperCase()); }
  if (q.q) { where.push('(a.summary LIKE ? OR a.actor_name LIKE ?)'); params.push(`%${q.q}%`, `%${q.q}%`); }
  const { limit, offset } = page(q, 500);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_events a WHERE ${where.join(' AND ')}`, params);
  const [rows] = await pool.query(
    `SELECT a.seq, a.id, a.actor_user_id, a.actor_name, a.actor_role, a.action, a.entity_type, a.entity_id, a.summary,
            a.before_data, a.after_data, a.source, a.result, a.ip_address, a.created_at
       FROM audit_events a WHERE ${where.join(' AND ')} ORDER BY a.seq DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return t; } };
  ok(res, { total: num(total), limit, offset, scope: visible ? (visible.length ? 'department' : 'own') : 'all', rows: rows.map((r) => ({ ...r, before_data: parse(r.before_data), after_data: parse(r.after_data) })) });
});

const verifyAudit = wrap(async (req, res) => {
  const result = await audit.verifyChain();
  ok(res, result, result.ok ? `All ${result.checked} audit events are intact.` : 'Audit history has been altered — see brokenAt.');
});

const recordTimeline = wrap(async (req, res) => {
  const type = String(req.params.type).toUpperCase();
  if (type === 'LEAD') {
    if (!can(req.user, 'leads.view.all')) throw httpError(403, 'Your role does not allow this action.');
    return ok(res, await timeline.leadTimeline(req.params.id));
  }
  const visible = auditRolesVisibleTo(req.user);
  if (visible && !visible.length && !can(req.user, 'crm.view') && !can(req.user, 'finance.view') && !can(req.user, 'inventory.manage')) {
    throw httpError(403, 'Your role does not allow this action.');
  }
  ok(res, await timeline.recordTimeline(type, req.params.id));
});

// ------------------------------------------------------------------------------------------- workflow settings
const getWorkflow = wrap(async (req, res) => {
  const values = await settings.getWorkflowSettings();
  ok(res, Object.entries(settings.WORKFLOW_FIELDS).map(([key, f]) => ({ key, label: f.label, value: values[key], options: f.values || null, min: f.min, max: f.max })));
});

const setWorkflow = wrap(async (req, res) => {
  const before = await settings.getWorkflowSettings();
  const after = await settings.updateWorkflowSettings(req.body || {}, req.user.id);
  const d = audit.diff(before, after);
  if (Object.keys(d.after).length) await audit.record({ req, action: 'WORKFLOW_RULES_CHANGED', entityType: 'SETTINGS', entityId: 'workflow', summary: `Changed: ${Object.keys(d.after).join(', ')}`, before: d.before, after: d.after });
  ok(res, after, 'Workflow rules saved.');
});

// ------------------------------------------------------------------------------------------- people
const ASSIGNABLE_BY = {
  BUSINESS_OWNER: ALL_ROLES,
  SUPER_ADMIN: ALL_ROLES.filter((r) => ![ROLES.OWNER, ROLES.SALES_HEAD].includes(r))
};

function assertCanManage(actor, targetRole) {
  const allowed = ASSIGNABLE_BY[actor.role] || [];
  if (!allowed.includes(targetRole)) throw httpError(403, `Your role can't manage ${(ROLE_INFO[targetRole] || {}).label || targetRole} accounts.`);
}

const listUsers = wrap(async (req, res) => {
  const where = ['1 = 1'];
  const params = [];
  if (req.query.role) { where.push('r.name = ?'); params.push(req.query.role); }
  if (req.query.status) { where.push('u.status = ?'); params.push(req.query.status); }
  if (req.query.q) { where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)'); params.push(...Array(4).fill(`%${req.query.q}%`)); }
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.job_level, u.manager_id, u.is_available, u.last_login,
            u.created_at, u.channel_partner_id, u.is_test_data, r.name AS role, m.first_name AS mgr_first, m.last_name AS mgr_last, cp.firm_name,
            (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS active_sessions,
            (SELECT COUNT(*) FROM leads l WHERE l.assigned_agent_id = u.id AND l.stage NOT IN ('Booking Done', 'WON', 'Closed Won', 'Lost', 'LOST', 'Junk', 'Duplicate')) AS open_leads
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN users m ON m.id = u.manager_id LEFT JOIN channel_partners cp ON cp.id = u.channel_partner_id
      WHERE ${where.join(' AND ')} ORDER BY u.status = 'ACTIVE' DESC, r.name, u.first_name`,
    params
  );
  ok(res, {
    roles: ALL_ROLES.map((r) => ({ role: r, label: ROLE_INFO[r].label, department: ROLE_INFO[r].department, assignable: (ASSIGNABLE_BY[req.user.role] || []).includes(r) })),
    rows: rows.map((r) => ({ ...r, name: fullName(r.first_name, r.last_name), manager_name: fullName(r.mgr_first, r.mgr_last) || null, roleLabel: (ROLE_INFO[r.role] || {}).label || r.role, active_sessions: num(r.active_sessions), open_leads: num(r.open_leads) }))
  });
});

function tempPassword() {
  return `Nx-${crypto.randomBytes(4).toString('hex')}${Math.floor(10 + Math.random() * 89)}`;
}

const createUser = wrap(async (req, res) => {
  const b = req.body || {};
  const role = String(b.role || '').toUpperCase();
  if (!ALL_ROLES.includes(role)) throw httpError(400, 'Choose a role.');
  assertCanManage(req.user, role);
  const username = String(b.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw httpError(400, 'Username: 3–40 letters, numbers, dots, dashes or underscores.');
  if (!b.first_name) throw httpError(400, 'Enter the person’s name.');
  const email = b.email ? String(b.email).trim().toLowerCase() : `${username}@users.local`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.');
  const [[dup]] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (dup) throw httpError(409, 'That username or email is already in use.');
  if (role === ROLES.PARTNER && !b.channel_partner_id) throw httpError(400, 'Choose the partner firm this login belongs to.');
  const [[roleRow]] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
  const password = b.password && String(b.password).length >= 8 ? String(b.password) : tempPassword();
  const id = crypto.randomUUID();
  const jobLevel = b.job_level === 'HEAD' ? 'HEAD' : 'EXECUTIVE';
  await pool.query(
    `INSERT INTO users (id, role_id, job_level, username, email, password_hash, first_name, last_name, phone, status, created_by, channel_partner_id, manager_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    [id, roleRow.id, jobLevel, username, email, await bcrypt.hash(password, 10), String(b.first_name).trim().slice(0, 100), b.last_name ? String(b.last_name).trim().slice(0, 100) : null,
      b.phone ? String(b.phone).trim().slice(0, 20) : null, req.user.id, role === ROLES.PARTNER ? b.channel_partner_id : null, b.manager_id || null]
  );
  await audit.record({ req, action: 'USER_CREATED', entityType: 'USER', entityId: id, summary: `${fullName(b.first_name, b.last_name)} (${username}) created as ${ROLE_INFO[role].label}${jobLevel === 'HEAD' ? ' — head' : ''}`, after: { username, email, role, job_level: jobLevel, manager_id: b.manager_id || null } });
  ok(res, { id, username, temporaryPassword: b.password ? null : password }, b.password ? 'User created.' : 'User created. Share the temporary password securely — it is shown only once.', 201);
});

async function loadTarget(id) {
  const [[u]] = await pool.query('SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [id]);
  if (!u) throw httpError(404, 'User not found.');
  return u;
}

function protectDemo(id) {
  if (isDemoMode() && process.env.NODE_ENV === 'production' && DEMO_ACCOUNT_IDS.has(id)) throw httpError(403, 'Demo logins can’t be changed on the public demo.');
}

const updateUser = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  assertCanManage(req.user, u.role);
  protectDemo(u.id);
  const b = req.body || {};
  const sets = {};
  for (const k of ['first_name', 'last_name', 'phone', 'email', 'manager_id']) if (b[k] !== undefined) sets[k] = b[k] === '' ? null : String(b[k]).trim();
  if (b.job_level !== undefined) sets.job_level = b.job_level === 'HEAD' ? 'HEAD' : 'EXECUTIVE';
  if (sets.manager_id && sets.manager_id === u.id) throw httpError(400, 'Someone can’t be their own manager.');
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), u.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, u[k]])), sets);
  await audit.record({ req, action: 'USER_UPDATED', entityType: 'USER', entityId: u.id, summary: `${fullName(u.first_name, u.last_name)} updated`, before: d.before, after: d.after });
  ok(res, null, 'Saved.');
});

const changeRole = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  const role = String((req.body && req.body.role) || '').toUpperCase();
  const reason = req.body && req.body.reason;
  if (!ALL_ROLES.includes(role)) throw httpError(400, 'Choose a role.');
  if (u.id === req.user.id) throw httpError(403, 'You can’t change your own role.');
  assertCanManage(req.user, u.role);
  assertCanManage(req.user, role);
  protectDemo(u.id);
  if (!reason || String(reason).trim().length < 3) throw httpError(400, 'Give a reason for the role change (kept in the audit history).');
  if (role === u.role) return ok(res, null, 'No change.');
  const [[roleRow]] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
  await pool.query('UPDATE users SET role_id = ?, channel_partner_id = IF(? = \'CHANNEL_PARTNER\', channel_partner_id, NULL) WHERE id = ?', [roleRow.id, role, u.id]);
  // A new role means new permissions: sign them out everywhere so they start fresh
  await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND revoked_at IS NULL', [req.user.id, u.id]);
  await audit.record({ req, action: 'ROLE_CHANGED', entityType: 'USER', entityId: u.id, summary: `${fullName(u.first_name, u.last_name)}: ${ROLE_INFO[u.role].label} → ${ROLE_INFO[role].label} (${reason})`, before: { role: u.role }, after: { role, reason } });
  await notifications.createNotification({ recipientUserId: u.id, type: 'INFO', title: 'Your role changed', message: `You are now ${ROLE_INFO[role].label}. Please sign in again.`, category: 'SYSTEM' });
  ok(res, null, `Role changed to ${ROLE_INFO[role].label}. They’ve been signed out and must sign in again.`);
});

const setStatus = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  const status = String((req.body && req.body.status) || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw httpError(400, 'Status must be ACTIVE or INACTIVE.');
  if (u.id === req.user.id) throw httpError(403, 'You can’t deactivate yourself.');
  assertCanManage(req.user, u.role);
  protectDemo(u.id);
  if (status === u.status) return ok(res, null, 'No change.');
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, u.id]);
  let openLeads = 0;
  if (status === 'INACTIVE') {
    await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND revoked_at IS NULL', [req.user.id, u.id]);
    [[{ n: openLeads }]] = await pool.query("SELECT COUNT(*) AS n FROM leads WHERE assigned_agent_id = ? AND stage NOT IN ('Booking Done', 'WON', 'Closed Won', 'Lost', 'LOST', 'Junk', 'Duplicate')", [u.id]);
  }
  await audit.record({ req, action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'USER', entityId: u.id, summary: `${fullName(u.first_name, u.last_name)} ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`, before: { status: u.status }, after: { status } });
  ok(res, { openLeads: num(openLeads) }, status === 'ACTIVE' ? 'Account activated.' : `Account deactivated and signed out.${num(openLeads) ? ` They still own ${num(openLeads)} open lead(s) — reassign them from Leads.` : ''}`);
});

const resetPassword = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  assertCanManage(req.user, u.role);
  protectDemo(u.id);
  const password = tempPassword();
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), u.id]);
  await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND revoked_at IS NULL', [req.user.id, u.id]);
  await audit.record({ req, action: 'PASSWORD_RESET', entityType: 'USER', entityId: u.id, summary: `Password reset for ${fullName(u.first_name, u.last_name)}; all sessions ended` });
  ok(res, { temporaryPassword: password }, 'Temporary password created — shown only once. They’ve been signed out everywhere.');
});

const userSessions = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  assertCanManage(req.user, u.role);
  ok(res, await sessionsOf(u.id));
});

const revokeUserSessions = wrap(async (req, res) => {
  const u = await loadTarget(req.params.id);
  assertCanManage(req.user, u.role);
  const [r] = await pool.query('UPDATE user_sessions SET revoked_at = NOW(), revoked_by = ? WHERE user_id = ? AND revoked_at IS NULL', [req.user.id, u.id]);
  await audit.record({ req, action: 'SESSIONS_REVOKED', entityType: 'USER', entityId: u.id, summary: `Signed ${fullName(u.first_name, u.last_name)} out of ${r.affectedRows} device(s)` });
  ok(res, { revoked: r.affectedRows }, `Signed out of ${r.affectedRows} device${r.affectedRows === 1 ? '' : 's'}.`);
});

const partnerFirms = wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT id, firm_name, tier, status FROM channel_partners ORDER BY firm_name");
  ok(res, rows);
});

module.exports = {
  me, changePassword, mySessions, revokeMySession,
  listApprovals, decideApproval, listEscalations, raiseEscalation, updateEscalation,
  listAudit, verifyAudit, recordTimeline, getWorkflow, setWorkflow,
  listUsers, createUser, updateUser, changeRole, setStatus, resetPassword, userSessions, revokeUserSessions, partnerFirms
};
