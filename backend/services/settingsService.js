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

module.exports = { getSettings, updateSettings, PUBLIC_FIELDS };
