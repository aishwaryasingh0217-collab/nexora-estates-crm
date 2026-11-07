/**
 * Project & inventory portal: projects, towers, floors, units, pricing, statuses, allocation,
 * ageing, documents — plus the property directory and recommendations every sales role uses.
 *
 * Unit status rules: inventory may set AVAILABLE, HOLD (manual reserve) or ARCHIVED. BOOKED and SOLD
 * come only from the booking workflow, and a unit reserved for a booking awaiting approval can't be
 * changed here — so inventory and sales never contradict each other.
 */
const crypto = require('crypto');
const { wrap, ok, httpError, page, num, pct, fullName, pool } = require('./common');
const audit = require('../../services/audit');
const { removeStored } = require('../../middleware/fileUpload');
const { can } = require('../../services/permissions');

const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK', 'PENTHOUSE', 'RETAIL', 'OFFICE', 'PLOT'];
const CATEGORIES = ['RESIDENTIAL', 'COMMERCIAL', 'PLOT'];
const FACINGS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST'];
const PROJECT_STATUSES = ['PRE_LAUNCH', 'NEW_LAUNCH', 'UNDER_CONSTRUCTION', 'READY_TO_MOVE', 'COMPLETED', 'ARCHIVED'];
const DOC_TYPES = ['BROCHURE', 'FLOOR_PLAN', 'PRICE_LIST', 'RERA_CERTIFICATE', 'APPROVAL', 'LEGAL', 'AGREEMENT_TEMPLATE', 'OTHER'];

const money = (v) => (v === undefined || v === null || v === '' ? null : Math.round(Number(v) * 100) / 100);

// ------------------------------------------------------------------------------------------- overview
const summary = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.city, p.status, p.project_type,
            COUNT(u.id) AS total,
            SUM(u.status = 'AVAILABLE') AS available, SUM(u.status = 'HOLD') AS reserved, SUM(u.status = 'BOOKED') AS booked,
            SUM(u.status = 'SOLD') AS sold, SUM(u.status = 'ARCHIVED') AS archived,
            COALESCE(SUM(CASE WHEN u.status = 'AVAILABLE' THEN u.base_price + COALESCE(u.plc_charges, 0) END), 0) AS available_value,
            AVG(CASE WHEN u.status = 'AVAILABLE' THEN DATEDIFF(CURDATE(), u.created_at) END) AS avg_age_days
       FROM projects p LEFT JOIN units u ON u.project_id = p.id
      GROUP BY p.id ORDER BY p.status = 'ARCHIVED', p.name`
  );
  const totals = rows.reduce((t, r) => {
    ['total', 'available', 'reserved', 'booked', 'sold', 'archived', 'available_value'].forEach((k) => { t[k] = (t[k] || 0) + num(r[k]); });
    return t;
  }, {});
  ok(res, {
    totals,
    projects: rows.map((r) => ({
      ...r, total: num(r.total), available: num(r.available), reserved: num(r.reserved), booked: num(r.booked), sold: num(r.sold), archived: num(r.archived),
      available_value: num(r.available_value), avg_age_days: r.avg_age_days == null ? null : Math.round(Number(r.avg_age_days)),
      soldPct: pct(num(r.booked) + num(r.sold), num(r.total) - num(r.archived))
    }))
  });
});

// ------------------------------------------------------------------------------------------- projects
const listProjects = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM buildings b WHERE b.project_id = p.id) AS towers,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id) AS units,
            (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'AVAILABLE') AS available,
            (SELECT COUNT(*) FROM project_documents d WHERE d.project_id = p.id) AS documents
       FROM projects p ${req.query.include_archived ? '' : "WHERE p.status <> 'ARCHIVED'"} ORDER BY p.name`
  );
  ok(res, rows);
});

function projectFields(b, creating) {
  const out = {};
  const text = (k, max) => { if (b[k] !== undefined) out[k] = b[k] === '' || b[k] === null ? null : String(b[k]).trim().slice(0, max); };
  text('name', 150); text('code', 30); text('builder_developer', 150); text('location', 255); text('city', 100); text('address', 255);
  text('possession_date', 100); text('rera_number', 100); text('hero_image_url', 500);
  if (b.project_type !== undefined) out.project_type = CATEGORIES.includes(String(b.project_type).toUpperCase()) ? String(b.project_type).toUpperCase() : 'RESIDENTIAL';
  if (b.status !== undefined) {
    const s = String(b.status).toUpperCase();
    if (!PROJECT_STATUSES.includes(s)) throw httpError(400, `Status must be one of ${PROJECT_STATUSES.join(', ')}.`);
    out.status = s;
  }
  for (const k of ['latitude', 'longitude']) {
    if (b[k] !== undefined) {
      const v = b[k] === '' || b[k] === null ? null : Number(b[k]);
      if (v !== null && (!Number.isFinite(v) || Math.abs(v) > (k === 'latitude' ? 90 : 180))) throw httpError(400, `Enter a valid ${k}.`);
      out[k] = v;
    }
  }
  if (b.partner_visible !== undefined) out.partner_visible = b.partner_visible ? 1 : 0;
  if (b.total_units !== undefined) out.total_units = Math.max(0, parseInt(b.total_units, 10) || 0);
  if (creating) {
    if (!out.name) throw httpError(400, 'Enter the project name.');
    if (!out.location) throw httpError(400, 'Enter the project location.');
    if (!out.city) throw httpError(400, 'Enter the city.');
    if (!out.code) out.code = out.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + String(Math.floor(Math.random() * 900) + 100);
  }
  return out;
}

const createProject = wrap(async (req, res) => {
  const f = projectFields(req.body || {}, true);
  const [[dup]] = await pool.query('SELECT id FROM projects WHERE name = ? OR code = ?', [f.name, f.code]);
  if (dup) throw httpError(409, 'A project with that name or code already exists.');
  const id = crypto.randomUUID();
  f.id = id;
  f.created_by = req.user.id;
  f.status = f.status || 'UNDER_CONSTRUCTION';
  f.project_type = f.project_type || 'RESIDENTIAL';
  f.total_units = f.total_units || 0;
  const keys = Object.keys(f);
  await pool.query(`INSERT INTO projects (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => f[k]));
  await audit.record({ req, action: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: id, summary: `${f.name} (${f.city})`, after: f });
  ok(res, { id }, 'Project created.', 201);
});

const updateProject = wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!p) throw httpError(404, 'Project not found.');
  const f = projectFields(req.body || {}, false);
  const keys = Object.keys(f);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  if (f.status === 'ARCHIVED') {
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM units WHERE project_id = ? AND status IN ('HOLD', 'BOOKED')", [p.id]);
    if (num(n)) throw httpError(409, `${n} unit(s) are reserved or booked — the project can't be archived yet.`);
  }
  await pool.query(`UPDATE projects SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => f[k]), p.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, p[k]])), f);
  await audit.record({ req, action: 'PROJECT_UPDATED', entityType: 'PROJECT', entityId: p.id, summary: `${p.name} updated`, before: d.before, after: d.after });
  ok(res, null, 'Project saved.');
});

const getProject = wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!p) throw httpError(404, 'Project not found.');
  const [towers] = await pool.query(
    `SELECT b.*, COUNT(u.id) AS units, SUM(u.status = 'AVAILABLE') AS available, SUM(u.status IN ('BOOKED', 'SOLD')) AS sold
       FROM buildings b LEFT JOIN units u ON u.building_id = b.id WHERE b.project_id = ? GROUP BY b.id ORDER BY b.name`,
    [p.id]
  );
  const [docs] = await pool.query(
    `SELECT d.*, u.first_name, u.last_name FROM project_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.project_id = ? ORDER BY d.created_at DESC`,
    [p.id]
  );
  const [statusCounts] = await pool.query('SELECT status, COUNT(*) AS n FROM units WHERE project_id = ? GROUP BY status', [p.id]);
  ok(res, {
    project: p,
    towers: towers.map((t) => ({ ...t, units: num(t.units), available: num(t.available), sold: num(t.sold) })),
    documents: docs.map((d) => ({ ...d, uploaded_by_name: fullName(d.first_name, d.last_name) || null })),
    unitStatus: Object.fromEntries(statusCounts.map((s) => [s.status, num(s.n)]))
  });
});

// ------------------------------------------------------------------------------------------- towers
const createTower = wrap(async (req, res) => {
  const b = req.body || {};
  const [[p]] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [req.params.id]);
  if (!p) throw httpError(404, 'Project not found.');
  const name = String(b.name || '').trim().slice(0, 100);
  if (!name) throw httpError(400, 'Enter the tower name.');
  const [[dup]] = await pool.query('SELECT id FROM buildings WHERE project_id = ? AND name = ?', [p.id, name]);
  if (dup) throw httpError(409, `${name} already exists in ${p.name}.`);
  const id = crypto.randomUUID();
  const floors = Math.max(0, parseInt(b.total_floors, 10) || 0);
  const perFloor = Math.max(0, parseInt(b.units_per_floor, 10) || 0);
  await pool.query("INSERT INTO buildings (id, project_id, name, total_floors, units_per_floor, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')", [id, p.id, name, floors, perFloor]);
  await audit.record({ req, action: 'TOWER_CREATED', entityType: 'BUILDING', entityId: id, summary: `${name} in ${p.name} (${floors} floors × ${perFloor})`, after: { project_id: p.id, name, total_floors: floors, units_per_floor: perFloor } });
  ok(res, { id }, 'Tower added.', 201);
});

const updateTower = wrap(async (req, res) => {
  const [[t]] = await pool.query('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
  if (!t) throw httpError(404, 'Tower not found.');
  const b = req.body || {};
  const sets = {};
  if (b.name !== undefined) sets.name = String(b.name).trim().slice(0, 100);
  if (b.total_floors !== undefined) sets.total_floors = Math.max(0, parseInt(b.total_floors, 10) || 0);
  if (b.units_per_floor !== undefined) sets.units_per_floor = Math.max(0, parseInt(b.units_per_floor, 10) || 0);
  if (b.status !== undefined) sets.status = ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(b.status) ? b.status : t.status;
  const keys = Object.keys(sets);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE buildings SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => sets[k]), t.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, t[k]])), sets);
  await audit.record({ req, action: 'TOWER_UPDATED', entityType: 'BUILDING', entityId: t.id, summary: `${t.name} updated`, before: d.before, after: d.after });
  ok(res, null, 'Tower saved.');
});

// ------------------------------------------------------------------------------------------- units
const listUnits = wrap(async (req, res) => {
  const q = req.query;
  const where = ['1 = 1'];
  const params = [];
  if (q.project_id) { where.push('u.project_id = ?'); params.push(q.project_id); }
  if (q.building_id) { where.push('u.building_id = ?'); params.push(q.building_id); }
  if (q.status) { where.push('u.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.unit_type) { where.push('u.unit_type = ?'); params.push(q.unit_type); }
  if (q.floor !== undefined && q.floor !== '') { where.push('u.floor_number = ?'); params.push(parseInt(q.floor, 10)); }
  if (q.q) { where.push('u.unit_number LIKE ?'); params.push(`%${q.q}%`); }
  const { limit, offset } = page(q, 2000);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM units u WHERE ${where.join(' AND ')}`, params);
  const [rows] = await pool.query(
    `SELECT u.*, p.name AS project_name, b.name AS building_name, cp.firm_name AS allocated_partner, au.first_name AS alloc_first, au.last_name AS alloc_last,
            DATEDIFF(CURDATE(), u.created_at) AS age_days,
            (SELECT d.deal_number FROM deals d WHERE d.unit_id = u.id AND d.status NOT IN ('CANCELLED', 'REJECTED') ORDER BY d.created_at DESC LIMIT 1) AS deal_number
       FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN buildings b ON b.id = u.building_id
       LEFT JOIN channel_partners cp ON cp.id = u.allocated_partner_id LEFT JOIN users au ON au.id = u.allocated_user_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.name, b.name, u.floor_number, u.unit_number LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  ok(res, { total: num(total), limit, offset, rows: rows.map((r) => ({ ...r, allocated_user: fullName(r.alloc_first, r.alloc_last) || null, age_days: num(r.age_days) })) });
});

function unitFields(b) {
  const out = {};
  if (b.unit_number !== undefined) out.unit_number = String(b.unit_number).trim().slice(0, 30);
  if (b.floor_number !== undefined) out.floor_number = b.floor_number === '' || b.floor_number === null ? null : parseInt(b.floor_number, 10);
  if (b.asset_category !== undefined) out.asset_category = CATEGORIES.includes(b.asset_category) ? b.asset_category : 'RESIDENTIAL';
  if (b.unit_type !== undefined) {
    if (!UNIT_TYPES.includes(b.unit_type)) throw httpError(400, `Unit type must be one of ${UNIT_TYPES.join(', ')}.`);
    out.unit_type = b.unit_type;
  }
  for (const k of ['carpet_area_sqft', 'super_area_sqft', 'plot_area_sqft']) if (b[k] !== undefined) out[k] = money(b[k]);
  if (b.plot_dimensions !== undefined) out.plot_dimensions = b.plot_dimensions ? String(b.plot_dimensions).slice(0, 50) : null;
  if (b.facing !== undefined) out.facing = FACINGS.includes(b.facing) ? b.facing : null;
  if (b.is_corner !== undefined) out.is_corner = b.is_corner ? 1 : 0;
  if (b.building_id !== undefined) out.building_id = b.building_id || null;
  return out;
}

const createUnit = wrap(async (req, res) => {
  const b = req.body || {};
  const [[p]] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [b.project_id]);
  if (!p) throw httpError(400, 'Choose the project.');
  const f = unitFields(b);
  if (!f.unit_number) throw httpError(400, 'Enter the unit number.');
  if (!f.unit_type) throw httpError(400, 'Choose the unit type.');
  const price = money(b.base_price);
  if (!(price > 0)) throw httpError(400, 'Enter the unit price.');
  if (!can(req.user, 'inventory.pricing') && !can(req.user, 'inventory.manage')) throw httpError(403, 'Your role can’t set prices.');
  const [[dup]] = await pool.query('SELECT id FROM units WHERE project_id = ? AND unit_number = ? AND (building_id <=> ?)', [p.id, f.unit_number, f.building_id || null]);
  if (dup) throw httpError(409, `Unit ${f.unit_number} already exists in ${p.name}.`);
  const id = crypto.randomUUID();
  const row = { id, project_id: p.id, ...f, base_price: price, plc_charges: money(b.plc_charges) || 0, status: 'AVAILABLE', asset_category: f.asset_category || 'RESIDENTIAL', listing_type: 'NEW_LAUNCH', status_changed_at: new Date() };
  const keys = Object.keys(row);
  await pool.query(`INSERT INTO units (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => row[k]));
  await audit.record({ req, action: 'UNIT_CREATED', entityType: 'UNIT', entityId: id, summary: `${p.name} — unit ${f.unit_number} (${f.unit_type}) at ₹${Number(price).toLocaleString('en-IN')}`, after: row });
  ok(res, { id }, 'Unit added.', 201);
});

/**
 * Generates a tower's units floor by floor: unit numbers like 101, 102 … 1204.
 * { project_id, building_id, floor_from, floor_to, units_per_floor, unit_type, carpet_area_sqft, super_area_sqft,
 *   base_price | rate_per_sqft, plc_charges, floor_rise_per_floor, facing_cycle: ['EAST','WEST'] }
 */
const bulkCreateUnits = wrap(async (req, res) => {
  const b = req.body || {};
  const [[p]] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [b.project_id]);
  if (!p) throw httpError(400, 'Choose the project.');
  let tower = null;
  if (b.building_id) {
    [[tower]] = await pool.query('SELECT id, name FROM buildings WHERE id = ? AND project_id = ?', [b.building_id, p.id]);
    if (!tower) throw httpError(400, 'That tower is not in this project.');
  }
  const from = parseInt(b.floor_from, 10);
  const to = parseInt(b.floor_to, 10);
  const perFloor = parseInt(b.units_per_floor, 10);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from > 120) throw httpError(400, 'Enter a valid floor range (up to 120 floors).');
  if (!(perFloor >= 1 && perFloor <= 50)) throw httpError(400, 'Units per floor must be between 1 and 50.');
  if (!UNIT_TYPES.includes(b.unit_type)) throw httpError(400, 'Choose the unit type.');
  const area = money(b.super_area_sqft) || money(b.carpet_area_sqft) || 0;
  const rate = money(b.rate_per_sqft);
  const fixed = money(b.base_price);
  if (!(fixed > 0) && !(rate > 0 && area > 0)) throw httpError(400, 'Enter a price, or a rate per sq ft with the area.');
  const rise = money(b.floor_rise_per_floor) || 0;
  const facings = Array.isArray(b.facing_cycle) ? b.facing_cycle.filter((f) => FACINGS.includes(f)) : [];
  const total = (to - from + 1) * perFloor;
  if (total > 2000) throw httpError(400, 'Create up to 2,000 units at a time.');
  const conn = await pool.getConnection();
  let created = 0;
  let skipped = 0;
  try {
    await conn.beginTransaction();
    for (let floor = from; floor <= to; floor++) {
      for (let n = 1; n <= perFloor; n++) {
        const unitNumber = `${b.prefix ? String(b.prefix).slice(0, 6) : ''}${floor}${String(n).padStart(2, '0')}`;
        const [[dup]] = await conn.query('SELECT id FROM units WHERE project_id = ? AND unit_number = ? AND (building_id <=> ?)', [p.id, unitNumber, tower ? tower.id : null]);
        if (dup) { skipped++; continue; }
        const base = (fixed > 0 ? fixed : rate * area) + rise * Math.max(floor - from, 0);
        await conn.query(
          `INSERT INTO units (id, project_id, building_id, unit_number, floor_number, asset_category, unit_type, carpet_area_sqft, super_area_sqft,
                              facing, base_price, plc_charges, status, listing_type, status_changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'NEW_LAUNCH', NOW())`,
          [crypto.randomUUID(), p.id, tower ? tower.id : null, unitNumber, floor, ['RETAIL', 'OFFICE'].includes(b.unit_type) ? 'COMMERCIAL' : b.unit_type === 'PLOT' ? 'PLOT' : 'RESIDENTIAL',
            b.unit_type, money(b.carpet_area_sqft), money(b.super_area_sqft), facings.length ? facings[(n - 1) % facings.length] : null, Math.round(base), money(b.plc_charges) || 0]
        );
        created++;
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await audit.record({ req, action: 'UNITS_GENERATED', entityType: 'PROJECT', entityId: p.id, summary: `${created} units created in ${p.name}${tower ? ` / ${tower.name}` : ''} (floors ${from}–${to}, ${perFloor} per floor)${skipped ? `; ${skipped} existing skipped` : ''}`, after: { created, skipped, unit_type: b.unit_type } });
  ok(res, { created, skipped }, `${created} unit${created === 1 ? '' : 's'} created${skipped ? `, ${skipped} already existed` : ''}.`, 201);
});

async function loadUnit(id) {
  const [[u]] = await pool.query('SELECT u.*, p.name AS project_name FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id = ?', [id]);
  if (!u) throw httpError(404, 'Unit not found.');
  return u;
}

const updateUnit = wrap(async (req, res) => {
  const u = await loadUnit(req.params.id);
  const f = unitFields(req.body || {});
  const keys = Object.keys(f);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE units SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => f[k]), u.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, u[k]])), f);
  await audit.record({ req, action: 'UNIT_UPDATED', entityType: 'UNIT', entityId: u.id, summary: `${u.project_name} — unit ${u.unit_number} details`, before: d.before, after: d.after });
  ok(res, null, 'Unit saved.');
});

const setPrice = wrap(async (req, res) => {
  const u = await loadUnit(req.params.id);
  const b = req.body || {};
  const base = money(b.base_price);
  const plc = b.plc_charges === undefined ? Number(u.plc_charges || 0) : money(b.plc_charges) || 0;
  if (!(base > 0)) throw httpError(400, 'Enter the new price.');
  if (['BOOKED', 'SOLD'].includes(u.status) || u.hold_deal_id) throw httpError(409, 'The price of a reserved, booked or sold unit is fixed by its booking.');
  if (!b.reason || String(b.reason).trim().length < 3) throw httpError(400, 'Give a reason for the price change.');
  await pool.query('UPDATE units SET base_price = ?, plc_charges = ? WHERE id = ?', [base, plc, u.id]);
  await audit.record({ req, action: 'UNIT_PRICE_CHANGED', entityType: 'UNIT', entityId: u.id, summary: `${u.project_name} — unit ${u.unit_number}: ₹${Number(u.base_price).toLocaleString('en-IN')} → ₹${base.toLocaleString('en-IN')} (${b.reason})`, before: { base_price: Number(u.base_price), plc_charges: Number(u.plc_charges || 0) }, after: { base_price: base, plc_charges: plc, reason: b.reason } });
  ok(res, null, 'Price updated.');
});

const setStatus = wrap(async (req, res) => {
  const u = await loadUnit(req.params.id);
  const b = req.body || {};
  const status = String(b.status || '').toUpperCase();
  if (!['AVAILABLE', 'HOLD', 'ARCHIVED'].includes(status)) throw httpError(400, 'Inventory can set a unit Available, Reserved (hold) or Archived. Booked and sold come from bookings.');
  if (['BOOKED', 'SOLD'].includes(u.status)) throw httpError(409, `Unit ${u.unit_number} is ${u.status.toLowerCase()} — change it through its booking.`);
  if (u.hold_deal_id) throw httpError(409, `Unit ${u.unit_number} is reserved for a booking awaiting approval.`);
  if (!b.reason || String(b.reason).trim().length < 3) throw httpError(400, 'Give a reason.');
  const holdUntil = status === 'HOLD' ? (b.hold_until ? new Date(b.hold_until) : new Date(Date.now() + 72 * 3600000)) : null;
  await pool.query('UPDATE units SET status = ?, hold_expires_at = ?, status_changed_at = NOW() WHERE id = ?', [status, holdUntil, u.id]);
  await audit.record({ req, action: 'UNIT_STATUS_CHANGED', entityType: 'UNIT', entityId: u.id, summary: `${u.project_name} — unit ${u.unit_number}: ${u.status} → ${status} (${b.reason})`, before: { status: u.status }, after: { status, hold_expires_at: holdUntil, reason: b.reason } });
  ok(res, null, `Unit ${u.unit_number} is now ${status === 'HOLD' ? 'reserved' : status.toLowerCase()}.`);
});

const allocate = wrap(async (req, res) => {
  const u = await loadUnit(req.params.id);
  const b = req.body || {};
  let partner = null;
  let agent = null;
  if (b.partner_id) {
    [[partner]] = await pool.query("SELECT id, firm_name FROM channel_partners WHERE id = ? AND status = 'ACTIVE'", [b.partner_id]);
    if (!partner) throw httpError(400, 'Choose an active partner firm.');
  }
  if (b.user_id) {
    [[agent]] = await pool.query("SELECT u.id, u.first_name, u.last_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.status = 'ACTIVE' AND r.name IN ('INSIDE_SALES', 'OUTSIDE_SALES', 'ADMIN')", [b.user_id]);
    if (!agent) throw httpError(400, 'Choose an active sales team member.');
  }
  await pool.query('UPDATE units SET allocated_partner_id = ?, allocated_user_id = ?, allocation_note = ? WHERE id = ?', [partner ? partner.id : null, agent ? agent.id : null, b.note ? String(b.note).slice(0, 255) : null, u.id]);
  const to = [partner && partner.firm_name, agent && fullName(agent.first_name, agent.last_name)].filter(Boolean).join(' & ') || 'open sale';
  await audit.record({ req, action: 'UNIT_ALLOCATED', entityType: 'UNIT', entityId: u.id, summary: `${u.project_name} — unit ${u.unit_number} allocated to ${to}`, before: { allocated_partner_id: u.allocated_partner_id, allocated_user_id: u.allocated_user_id }, after: { allocated_partner_id: partner ? partner.id : null, allocated_user_id: agent ? agent.id : null } });
  ok(res, null, `Unit ${u.unit_number} allocated to ${to}.`);
});

const ageing = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.unit_number, u.unit_type, u.base_price, u.plc_charges, u.floor_number, u.status, p.name AS project_name, b.name AS building_name,
            DATEDIFF(CURDATE(), COALESCE(u.created_at, u.status_changed_at)) AS age_days
       FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN buildings b ON b.id = u.building_id
      WHERE u.status = 'AVAILABLE' ${req.query.project_id ? 'AND u.project_id = ?' : ''}
      ORDER BY age_days DESC LIMIT 1000`,
    req.query.project_id ? [req.query.project_id] : []
  );
  const buckets = { '0-30': 0, '31-90': 0, '91-180': 0, '181-365': 0, '365+': 0 };
  const value = { ...buckets };
  for (const r of rows) {
    const d = num(r.age_days);
    const k = d <= 30 ? '0-30' : d <= 90 ? '31-90' : d <= 180 ? '91-180' : d <= 365 ? '181-365' : '365+';
    buckets[k]++;
    value[k] += num(r.base_price) + num(r.plc_charges);
  }
  ok(res, { buckets, value, rows: rows.map((r) => ({ ...r, age_days: num(r.age_days) })) });
});

// ------------------------------------------------------------------------------------------- documents
const uploadDocument = wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [req.params.id]);
  if (!p) { removeStored(req.savedFile && req.savedFile.url); throw httpError(404, 'Project not found.'); }
  const b = req.body || {};
  const type = DOC_TYPES.includes(String(b.doc_type).toUpperCase()) ? String(b.doc_type).toUpperCase() : 'OTHER';
  const id = crypto.randomUUID();
  const title = String(b.title || req.savedFile.originalName || type).slice(0, 200);
  await pool.query(
    'INSERT INTO project_documents (id, project_id, title, doc_type, file_url, file_name, file_size, partner_visible, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, p.id, title, type, req.savedFile.url, req.savedFile.originalName, req.savedFile.size, b.partner_visible === 'true' || b.partner_visible === '1' ? 1 : 0, req.user.id]
  );
  await audit.record({ req, action: 'PROJECT_DOCUMENT_UPLOADED', entityType: 'PROJECT', entityId: p.id, summary: `${type.replace(/_/g, ' ').toLowerCase()} "${title}" added to ${p.name}`, after: { document_id: id, file: req.savedFile.originalName, size: req.savedFile.size } });
  ok(res, { id, url: req.savedFile.url }, 'Document uploaded.', 201);
});

const deleteDocument = wrap(async (req, res) => {
  const [[d]] = await pool.query('SELECT d.*, p.name AS project_name FROM project_documents d JOIN projects p ON p.id = d.project_id WHERE d.id = ?', [req.params.docId]);
  if (!d) throw httpError(404, 'Document not found.');
  await pool.query('DELETE FROM project_documents WHERE id = ?', [d.id]);
  removeStored(d.file_url);
  await audit.record({ req, action: 'PROJECT_DOCUMENT_DELETED', entityType: 'PROJECT', entityId: d.project_id, summary: `"${d.title}" removed from ${d.project_name}`, before: { document_id: d.id, title: d.title, doc_type: d.doc_type } });
  ok(res, null, 'Document removed.');
});

// ------------------------------------------------------------------------------------------- directory & recommendations (all sales roles)
const directory = wrap(async (req, res) => {
  const q = req.query;
  const where = ["u.status = 'AVAILABLE'", "p.status <> 'ARCHIVED'"];
  const params = [];
  if (req.user.role === 'CHANNEL_PARTNER') where.push('p.partner_visible = 1');
  if (q.q) { where.push('(p.name LIKE ? OR p.location LIKE ? OR p.city LIKE ? OR u.unit_number LIKE ?)'); params.push(...Array(4).fill(`%${q.q}%`)); }
  if (q.city) { where.push('p.city = ?'); params.push(q.city); }
  if (q.project_id) { where.push('p.id = ?'); params.push(q.project_id); }
  if (q.unit_type) { where.push('u.unit_type IN (?)'); params.push(String(q.unit_type).split(',')); }
  if (q.min_price) { where.push('u.base_price + COALESCE(u.plc_charges, 0) >= ?'); params.push(Number(q.min_price)); }
  if (q.max_price) { where.push('u.base_price + COALESCE(u.plc_charges, 0) <= ?'); params.push(Number(q.max_price)); }
  if (q.facing) { where.push('u.facing = ?'); params.push(q.facing); }
  const [rows] = await pool.query(
    `SELECT u.id, u.unit_number, u.floor_number, u.unit_type, u.asset_category, u.carpet_area_sqft, u.super_area_sqft, u.plot_area_sqft,
            u.facing, u.is_corner, u.base_price, u.plc_charges, p.id AS project_id, p.name AS project_name, p.location, p.city, p.status AS project_status,
            p.possession_date, p.rera_number, b.name AS building_name
       FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN buildings b ON b.id = u.building_id
      WHERE ${where.join(' AND ')}
      ORDER BY u.base_price ASC LIMIT 300`,
    params
  );
  const [cities] = await pool.query("SELECT DISTINCT city FROM projects WHERE status <> 'ARCHIVED' AND city IS NOT NULL ORDER BY city");
  ok(res, { cities: cities.map((c) => c.city), rows });
});

/** Units that fit a lead: their budget (±15%), configuration, preferred project and location. */
const recommend = wrap(async (req, res) => {
  const [[lead]] = await pool.query('SELECT * FROM leads WHERE id = ?', [req.params.leadId]);
  if (!lead) throw httpError(404, 'Lead not found.');
  if (req.user.role === 'CHANNEL_PARTNER' && lead.channel_partner_id !== req.user.channelPartnerId) throw httpError(404, 'Lead not found.');
  if (['INSIDE_SALES', 'OUTSIDE_SALES'].includes(req.user.role) && lead.assigned_agent_id !== req.user.id) {
    const [[visit]] = await pool.query('SELECT 1 FROM site_visits WHERE lead_id = ? AND assigned_agent_id = ? LIMIT 1', [lead.id, req.user.id]);
    if (!visit) throw httpError(404, 'Lead not found.');
  }
  const min = Number(lead.budget_min) || 0;
  const max = Number(lead.budget_max) || Number(lead.budget_min) || 0;
  const types = String(lead.configuration || '').toUpperCase().match(/[1-4]\s*BHK|PENTHOUSE|PLOT|OFFICE|RETAIL/g) || [];
  const wantTypes = types.map((t) => t.replace(/\s+/g, ''));
  const [units] = await pool.query(
    `SELECT u.id, u.unit_number, u.floor_number, u.unit_type, u.super_area_sqft, u.carpet_area_sqft, u.facing, u.base_price, u.plc_charges,
            p.id AS project_id, p.name AS project_name, p.location, p.city, b.name AS building_name
       FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN buildings b ON b.id = u.building_id
      WHERE u.status = 'AVAILABLE' AND p.status <> 'ARCHIVED' ${req.user.role === 'CHANNEL_PARTNER' ? 'AND p.partner_visible = 1' : ''}
      LIMIT 2000`
  );
  const loc = String(lead.preferred_location || '').toLowerCase();
  const scored = units.map((u) => {
    const price = Number(u.base_price) + Number(u.plc_charges || 0);
    let score = 0;
    const reasons = [];
    if (max > 0) {
      if (price >= min * 0.85 && price <= max * 1.15) { score += 40; reasons.push('within budget'); } else if (price <= max * 1.3) { score += 10; }
      else score -= 30;
    }
    if (wantTypes.length && wantTypes.includes(u.unit_type)) { score += 30; reasons.push(u.unit_type); }
    if (lead.preferred_project_id && u.project_id === lead.preferred_project_id) { score += 20; reasons.push('preferred project'); }
    if (loc && (`${u.location} ${u.city}`.toLowerCase().includes(loc) || loc.includes(String(u.city || '').toLowerCase()))) { score += 15; reasons.push('preferred location'); }
    return { ...u, price, score, reasons };
  }).filter((u) => u.score > 0).sort((a, b) => b.score - a.score || a.price - b.price).slice(0, 12);
  ok(res, { lead: { id: lead.id, budget_min: lead.budget_min, budget_max: lead.budget_max, configuration: lead.configuration, preferred_location: lead.preferred_location }, rows: scored });
});

const options = wrap(async (req, res) => ok(res, { unitTypes: UNIT_TYPES, categories: CATEGORIES, facings: FACINGS, projectStatuses: PROJECT_STATUSES, docTypes: DOC_TYPES }));

module.exports = {
  summary, listProjects, createProject, updateProject, getProject, createTower, updateTower,
  listUnits, createUnit, bulkCreateUnits, updateUnit, setPrice, setStatus, allocate, ageing,
  uploadDocument, deleteDocument, directory, recommend, options
};
