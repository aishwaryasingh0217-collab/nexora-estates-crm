/**
 * Company branding & contact details, editable by the owner (Super Admin) in the app.
 * Lets the same product be sold to many builders / partner firms under their own name.
 */
const pool = require('../config/db');

const PUBLIC_FIELDS = {
  company_name: { max: 80, fallback: 'Nexora Estates' },
  short_name: { max: 24, fallback: 'Nexora' },
  logo_url: { max: 500, fallback: '' },
  support_phone: { max: 20, fallback: '' },
  support_email: { max: 120, fallback: '' },
  website_url: { max: 200, fallback: '' }
};

let cache = null;
let cachedAt = 0;

async function getSettings() {
  if (cache && Date.now() - cachedAt < 30000) return cache;
  const out = Object.fromEntries(Object.entries(PUBLIC_FIELDS).map(([k, f]) => [k, f.fallback]));
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN (?)', [Object.keys(PUBLIC_FIELDS)]);
    rows.forEach((r) => { if (r.setting_value) out[r.setting_key] = r.setting_value; });
  } catch (err) {
    // Table missing on an un-migrated install: fall back to defaults rather than break every page
    console.warn('[Settings]', err.message);
  }
  cache = out;
  cachedAt = Date.now();
  return out;
}

/** Validates and stores the given fields. Unknown keys are ignored. */
async function updateSettings(values, userId) {
  const clean = {};
  for (const [key, field] of Object.entries(PUBLIC_FIELDS)) {
    if (values[key] === undefined) continue;
    const v = String(values[key] || '').trim().slice(0, field.max);
    if (key === 'company_name' && !v) {
      const err = new Error('Company name cannot be empty.');
      err.statusCode = 400;
      throw err;
    }
    if ((key === 'logo_url' || key === 'website_url') && v && !/^(https?:\/\/|\/)/i.test(v)) {
      const err = new Error(`${key === 'logo_url' ? 'Logo' : 'Website'} must be a full link starting with https://`);
      err.statusCode = 400;
      throw err;
    }
    clean[key] = v;
  }
  if (clean.company_name && values.short_name === undefined) clean.short_name = clean.company_name.split(/\s+/)[0].slice(0, 24);
  for (const [k, v] of Object.entries(clean)) {
    await pool.query(
      `INSERT INTO company_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [k, v, userId]
    );
  }
  cache = null;
  return getSettings();
}

// ---------------------------------------------------------------------------
// Workflow rules (owner / sales head): booking approvals, reservations, visit approvals, alerts
// ---------------------------------------------------------------------------
const WORKFLOW_FIELDS = {
  booking_approval_mode: { values: ['ALWAYS', 'DISCOUNT_ONLY', 'NEVER'], fallback: 'DISCOUNT_ONLY', label: 'When bookings need approval' },
  booking_discount_threshold_pct: { min: 0, max: 50, fallback: '2', label: 'Discount (%) above which a booking needs approval' },
  reservation_hold_hours: { min: 1, max: 720, fallback: '48', label: 'Hours a unit stays reserved while a booking awaits approval' },
  visit_approval_required: { values: ['0', '1'], fallback: '0', label: 'Visits requested by agents/partners need manager approval' },
  followup_escalation_hours: { min: 1, max: 168, fallback: '24', label: 'Hours overdue before a follow-up is escalated' },
  untouched_lead_minutes: { min: 5, max: 1440, fallback: '30', label: 'Minutes before an uncontacted new lead alerts the manager' }
};

let wfCache = null;
let wfCachedAt = 0;

async function getWorkflowSettings() {
  if (wfCache && Date.now() - wfCachedAt < 15000) return wfCache;
  const out = Object.fromEntries(Object.entries(WORKFLOW_FIELDS).map(([k, f]) => [k, f.fallback]));
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN (?)', [Object.keys(WORKFLOW_FIELDS)]);
    rows.forEach((r) => { if (r.setting_value != null && r.setting_value !== '') out[r.setting_key] = String(r.setting_value); });
  } catch (err) {
    console.warn('[Settings]', err.message);
  }
  wfCache = out;
  wfCachedAt = Date.now();
  return out;
}

async function getSetting(key) {
  if (WORKFLOW_FIELDS[key]) return (await getWorkflowSettings())[key];
  if (PUBLIC_FIELDS[key]) return (await getSettings())[key];
  const [rows] = await pool.query('SELECT setting_value FROM company_settings WHERE setting_key = ?', [key]);
  return rows[0] ? rows[0].setting_value : null;
}

async function updateWorkflowSettings(values, userId) {
  const clean = {};
  for (const [key, field] of Object.entries(WORKFLOW_FIELDS)) {
    if (values[key] === undefined) continue;
    const v = String(values[key]).trim();
    if (field.values) {
      const pick = field.values.find((x) => x.toUpperCase() === v.toUpperCase());
      if (!pick) throw Object.assign(new Error(`${field.label}: choose one of ${field.values.join(', ')}.`), { statusCode: 400 });
      clean[key] = pick;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < field.min || n > field.max) {
        throw Object.assign(new Error(`${field.label}: enter a number from ${field.min} to ${field.max}.`), { statusCode: 400 });
      }
      clean[key] = String(n);
    }
  }
  for (const [k, v] of Object.entries(clean)) {
    await pool.query(
      `INSERT INTO company_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [k, v, userId]
    );
  }
  wfCache = null;
  return getWorkflowSettings();
}

module.exports = {
  getSettings, updateSettings, PUBLIC_FIELDS,
  WORKFLOW_FIELDS, getWorkflowSettings, getSetting, updateWorkflowSettings
};
