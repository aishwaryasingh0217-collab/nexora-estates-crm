/**
 * Organisation-wide audit history (append-only).
 *
 * Every important action in every portal is written here with who did it, their role, what changed
 * (before/after), where it came from (a person, the AI assistant, the system, or an integration such
 * as the telephony provider) and whether it worked.
 *
 * Append-only in three layers:
 *   1. The app has no API that edits or deletes audit events.
 *   2. Where the database allows it, triggers refuse UPDATE/DELETE on the table (migration 024).
 *   3. Each event stores a SHA-256 hash of its content plus the previous event's hash. verifyChain()
 *      recomputes the chain, so an event changed or removed directly in the database is detected.
 */
const crypto = require('crypto');
const pool = require('../config/db');

const SOURCES = ['HUMAN', 'AI', 'SYSTEM', 'INTEGRATION'];
const RESULTS = ['SUCCESS', 'FAILED', 'PENDING'];
const LOCK = 'nexora_audit_chain';
const MAX_BLOB = 60000;

const serialize = (value) => {
  if (value === undefined || value === null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_BLOB ? `${text.slice(0, MAX_BLOB)}…` : text;
};

/** Removes secrets before anything is stored (password hashes, tokens, keys). */
function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [k, v] of Object.entries(value)) {
    if (/password|token|secret|api_key|auth_key|p256dh|bank_account/i.test(k)) out[k] = v == null ? v : '[hidden]';
    else out[k] = v && typeof v === 'object' && !(v instanceof Date) ? redact(v) : v;
  }
  return out;
}

function hashEvent(e, prevHash) {
  const canonical = JSON.stringify([
    e.id, e.actor_user_id, e.actor_name, e.actor_role, e.action, e.entity_type, e.entity_id, e.summary,
    e.before_data, e.after_data, e.source, e.result, e.ip_address, new Date(e.created_at).toISOString()
  ]);
  return crypto.createHash('sha256').update(`${prevHash || ''}|${canonical}`).digest('hex');
}

/** Who did it, taken from an Express request (or pass actor explicitly). */
function actorFrom(req) {
  if (!req || !req.user) return { id: null, name: 'System', role: null, ip: null };
  return {
    id: req.user.id,
    name: req.user.name || req.user.username || null,
    role: req.user.role || null,
    ip: req.ip || null
  };
}

/**
 * Writes one audit event. Never throws: a failed audit write is logged, the business action goes on.
 * @param {object} p
 * @param {object} [p.req]        Express request (gives the actor)
 * @param {object} [p.actor]      { id, name, role } when there is no request (system jobs, webhooks)
 * @param {string} p.action       e.g. LEAD_ASSIGNED, BOOKING_APPROVED, PAYMENT_VERIFIED
 * @param {string} [p.entityType] e.g. LEAD, DEAL, PAYMENT
 * @param {string} [p.entityId]
 * @param {string} [p.summary]    one readable sentence
 * @param {*} [p.before] [p.after] previous / updated values
 * @param {string} [p.source]     HUMAN | AI | SYSTEM | INTEGRATION
 * @param {string} [p.result]     SUCCESS | FAILED | PENDING
 */
async function record(p) {
  const actor = p.actor || actorFrom(p.req);
  const event = {
    id: crypto.randomUUID(),
    actor_user_id: actor.id || null,
    actor_name: actor.name ? String(actor.name).slice(0, 150) : (actor.id ? null : 'System'),
    actor_role: actor.role || null,
    action: String(p.action || 'UNKNOWN').toUpperCase().slice(0, 80),
    entity_type: p.entityType ? String(p.entityType).toUpperCase().slice(0, 40) : null,
    entity_id: p.entityId ? String(p.entityId).slice(0, 64) : null,
    summary: p.summary ? String(p.summary).slice(0, 500) : null,
    before_data: serialize(redact(p.before)),
    after_data: serialize(redact(p.after)),
    source: SOURCES.includes(p.source) ? p.source : (p.req ? 'HUMAN' : 'SYSTEM'),
    result: RESULTS.includes(p.result) ? p.result : 'SUCCESS',
    ip_address: actor.ip || null,
    created_at: new Date()
  };

  let conn;
  try {
    conn = await pool.getConnection();
    const [[{ got }]] = await conn.query('SELECT GET_LOCK(?, 10) AS got', [LOCK]);
    if (Number(got) !== 1) throw new Error('audit chain is busy');
    try {
      const [[last]] = await conn.query('SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1');
      const prevHash = last ? last.hash : null;
      event.hash = hashEvent(event, prevHash);
      await conn.query(
        `INSERT INTO audit_events (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, summary,
                                   before_data, after_data, source, result, ip_address, prev_hash, hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [event.id, event.actor_user_id, event.actor_name, event.actor_role, event.action, event.entity_type, event.entity_id,
          event.summary, event.before_data, event.after_data, event.source, event.result, event.ip_address, prevHash, event.hash, event.created_at]
      );
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK]).catch(() => {});
    }
    return event.id;
  } catch (err) {
    console.error('[audit] could not record', event.action, err.message);
    return null;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Recomputes the hash chain. Returns { ok, checked, brokenAt } — brokenAt is the first event whose
 * content or link no longer matches (edited or a predecessor deleted).
 */
async function verifyChain({ limit = 100000 } = {}) {
  const [rows] = await pool.query(
    `SELECT seq, id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, summary,
            before_data, after_data, source, result, ip_address, prev_hash, hash, created_at
       FROM audit_events ORDER BY seq ASC LIMIT ?`,
    [limit]
  );
  let prev = null;
  for (const row of rows) {
    if ((row.prev_hash || null) !== prev || hashEvent(row, prev) !== row.hash) {
      return { ok: false, checked: rows.length, brokenAt: { seq: row.seq, id: row.id, action: row.action, created_at: row.created_at } };
    }
    prev = row.hash;
  }
  return { ok: true, checked: rows.length, brokenAt: null };
}

/** Compact before/after: only the fields that changed. */
function diff(before, after) {
  const b = {};
  const a = {};
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    const x = before ? before[key] : undefined;
    const y = after ? after[key] : undefined;
    const same = (x instanceof Date || y instanceof Date)
      ? new Date(x || 0).getTime() === new Date(y || 0).getTime()
      : JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
    if (!same) { b[key] = x ?? null; a[key] = y ?? null; }
  }
  return { before: b, after: a };
}

module.exports = { record, verifyChain, diff, actorFrom, redact };
