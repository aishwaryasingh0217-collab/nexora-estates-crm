/**
 * Marketing portal: advertising channels, campaigns, budgets and spend, lead attribution,
 * conversion and ROI. Revenue is counted only from confirmed bookings of attributed leads, and
 * spend only from recorded spend entries — nothing here is estimated.
 */
const crypto = require('crypto');
const { wrap, ok, httpError, dateRange, num, pct, fullName, pool } = require('./common');
const audit = require('../../services/audit');
const { bucketSql } = require('../../services/salesWorkspace');

const BUCKET = bucketSql('l.stage');
const LIVE = "('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')";
const CHANNEL_TYPES = ['SOCIAL', 'SEARCH', 'PORTAL', 'WEBSITE', 'OFFLINE', 'REFERRAL', 'PARTNER', 'EMAIL_SMS', 'OTHER'];
const COST_MODELS = ['CPC', 'CPL', 'CPM', 'FIXED', 'FREE'];
const STATUSES = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'];

// ------------------------------------------------------------------------------------------- channels
const listChannels = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ch.*, (SELECT COUNT(*) FROM campaigns c WHERE c.channel_id = ch.id) AS campaigns,
            (SELECT COUNT(*) FROM leads l WHERE l.source = ch.lead_source) AS leads
       FROM ad_channels ch ORDER BY ch.is_active DESC, ch.name`
  );
  ok(res, rows.map((r) => ({ ...r, campaigns: num(r.campaigns), leads: num(r.leads) })));
});

function channelFields(b, creating) {
  const out = {};
  if (b.name !== undefined) out.name = String(b.name).trim().slice(0, 100);
  if (b.channel_type !== undefined) out.channel_type = CHANNEL_TYPES.includes(b.channel_type) ? b.channel_type : 'OTHER';
  if (b.lead_source !== undefined) out.lead_source = String(b.lead_source).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 60);
  if (b.cost_model !== undefined) out.cost_model = COST_MODELS.includes(b.cost_model) ? b.cost_model : 'FIXED';
  if (b.is_active !== undefined) out.is_active = b.is_active ? 1 : 0;
  if (b.notes !== undefined) out.notes = b.notes ? String(b.notes).slice(0, 255) : null;
  if (creating && (!out.name || !out.lead_source)) throw httpError(400, 'Enter the channel name and the lead source code its leads arrive with (e.g. FACEBOOK_ADS).');
  return out;
}

const createChannel = wrap(async (req, res) => {
  const f = channelFields(req.body || {}, true);
  const [[dup]] = await pool.query('SELECT id FROM ad_channels WHERE name = ?', [f.name]);
  if (dup) throw httpError(409, 'A channel with that name exists.');
  const id = crypto.randomUUID();
  const row = { id, channel_type: 'OTHER', cost_model: 'FIXED', ...f };
  const keys = Object.keys(row);
  await pool.query(`INSERT INTO ad_channels (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => row[k]));
  await audit.record({ req, action: 'CHANNEL_CREATED', entityType: 'CHANNEL', entityId: id, summary: f.name, after: row });
  ok(res, { id }, 'Channel added.', 201);
});

const updateChannel = wrap(async (req, res) => {
  const [[ch]] = await pool.query('SELECT * FROM ad_channels WHERE id = ?', [req.params.id]);
  if (!ch) throw httpError(404, 'Channel not found.');
  const f = channelFields(req.body || {}, false);
  const keys = Object.keys(f);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE ad_channels SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => f[k]), ch.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, ch[k]])), f);
  await audit.record({ req, action: 'CHANNEL_UPDATED', entityType: 'CHANNEL', entityId: ch.id, summary: `${ch.name} updated`, before: d.before, after: d.after });
  ok(res, null, 'Channel saved.');
});

// ------------------------------------------------------------------------------------------- campaigns
const CAMPAIGN_STATS = `
  (SELECT COALESCE(SUM(s.amount), 0) FROM campaign_spend s WHERE s.campaign_id = c.id) AS spend,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id) AS leads,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id AND (l.first_contacted_at IS NOT NULL OR l.last_contacted_at IS NOT NULL)) AS contacted,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id AND l.qualification_status = 'QUALIFIED') AS qualified,
  (SELECT COUNT(DISTINCT sv.lead_id) FROM site_visits sv JOIN leads l ON l.id = sv.lead_id WHERE l.campaign_id = c.id AND sv.status = 'COMPLETED') AS visited,
  (SELECT COUNT(*) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.campaign_id = c.id AND d.status IN ${LIVE}) AS bookings,
  (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN leads l ON l.id = d.lead_id WHERE l.campaign_id = c.id AND d.status IN ${LIVE}) AS revenue`;

function shapeCampaign(c) {
  const spend = num(c.spend);
  const leads = num(c.leads);
  const bookings = num(c.bookings);
  const revenue = num(c.revenue);
  return {
    ...c, budget: num(c.budget), spend, leads, contacted: num(c.contacted), qualified: num(c.qualified), visited: num(c.visited), bookings, revenue,
    budgetUsedPct: pct(spend, c.budget), costPerLead: leads ? Math.round(spend / leads) : null, costPerBooking: bookings ? Math.round(spend / bookings) : null,
    conversionPct: pct(bookings, leads), roiPct: spend ? Math.round(((revenue - spend) / spend) * 1000) / 10 : null
  };
}

const listCampaigns = wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, ch.name AS channel_name, ch.lead_source, p.name AS project_name, ${CAMPAIGN_STATS}
       FROM campaigns c LEFT JOIN ad_channels ch ON ch.id = c.channel_id LEFT JOIN projects p ON p.id = c.project_id
      ${req.query.status ? 'WHERE c.status = ?' : ''} ORDER BY c.status = 'ACTIVE' DESC, c.created_at DESC`,
    req.query.status ? [req.query.status] : []
  );
  ok(res, rows.map(shapeCampaign));
});

function campaignFields(b, creating) {
  const out = {};
  const text = (k, max) => { if (b[k] !== undefined) out[k] = b[k] === '' || b[k] === null ? null : String(b[k]).trim().slice(0, max); };
  text('name', 150); text('objective', 255); text('landing_url', 500); text('notes', 4000);
  text('utm_source', 100); text('utm_medium', 100); text('utm_campaign', 100);
  if (b.code !== undefined) out.code = String(b.code).trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').slice(0, 60);
  if (b.channel_id !== undefined) out.channel_id = b.channel_id || null;
  if (b.project_id !== undefined) out.project_id = b.project_id || null;
  if (b.budget !== undefined) {
    const v = Number(b.budget);
    if (!Number.isFinite(v) || v < 0) throw httpError(400, 'Budget must be zero or more.');
    out.budget = v;
  }
  for (const k of ['start_date', 'end_date']) if (b[k] !== undefined) out[k] = b[k] ? new Date(b[k]) : null;
  if (out.start_date && out.end_date && out.end_date < out.start_date) throw httpError(400, 'The campaign can’t end before it starts.');
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw httpError(400, `Status must be one of ${STATUSES.join(', ')}.`);
    out.status = b.status;
  }
  if (out.landing_url && !/^https?:\/\//i.test(out.landing_url)) throw httpError(400, 'The landing page must start with https://');
  if (creating && !out.name) throw httpError(400, 'Name the campaign.');
  return out;
}

const createCampaign = wrap(async (req, res) => {
  const f = campaignFields(req.body || {}, true);
  if (f.channel_id) {
    const [[ch]] = await pool.query('SELECT id, lead_source FROM ad_channels WHERE id = ?', [f.channel_id]);
    if (!ch) throw httpError(400, 'That channel no longer exists.');
    f.utm_source = f.utm_source || ch.lead_source.toLowerCase();
  }
  f.code = f.code || `${f.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${String(Date.now()).slice(-4)}`;
  f.utm_campaign = f.utm_campaign || f.code.toLowerCase();
  f.utm_medium = f.utm_medium || 'paid';
  const [[dup]] = await pool.query('SELECT id FROM campaigns WHERE code = ?', [f.code]);
  if (dup) throw httpError(409, 'That campaign code is in use.');
  const id = crypto.randomUUID();
  const row = { id, created_by: req.user.id, status: 'PLANNED', budget: 0, ...f };
  const keys = Object.keys(row);
  await pool.query(`INSERT INTO campaigns (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => row[k]));
  await audit.record({ req, action: 'CAMPAIGN_CREATED', entityType: 'CAMPAIGN', entityId: id, summary: `${row.name} (${row.code}), budget ₹${Number(row.budget).toLocaleString('en-IN')}`, after: row });
  ok(res, { id, code: row.code, utm_campaign: row.utm_campaign }, 'Campaign created.', 201);
});

const updateCampaign = wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  if (!c) throw httpError(404, 'Campaign not found.');
  const f = campaignFields(req.body || {}, false);
  delete f.code; // the tracking code is fixed once links are out
  const keys = Object.keys(f);
  if (!keys.length) throw httpError(400, 'Nothing to update.');
  await pool.query(`UPDATE campaigns SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => f[k]), c.id]);
  const d = audit.diff(Object.fromEntries(keys.map((k) => [k, c[k]])), f);
  await audit.record({ req, action: 'CAMPAIGN_UPDATED', entityType: 'CAMPAIGN', entityId: c.id, summary: `${c.name} updated`, before: d.before, after: d.after });
  ok(res, null, 'Campaign saved.');
});

const getCampaign = wrap(async (req, res) => {
  const [[c]] = await pool.query(
    `SELECT c.*, ch.name AS channel_name, ch.lead_source, p.name AS project_name, ${CAMPAIGN_STATS}
       FROM campaigns c LEFT JOIN ad_channels ch ON ch.id = c.channel_id LEFT JOIN projects p ON p.id = c.project_id WHERE c.id = ?`,
    [req.params.id]
  );
  if (!c) throw httpError(404, 'Campaign not found.');
  const [spend] = await pool.query(
    'SELECT s.*, u.first_name, u.last_name FROM campaign_spend s LEFT JOIN users u ON u.id = s.recorded_by WHERE s.campaign_id = ? ORDER BY s.spend_date DESC',
    [c.id]
  );
  const [leads] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.stage, ${BUCKET} AS bucket, l.created_at, l.utm_source, l.utm_medium,
            ag.first_name AS ag_first, ag.last_name AS ag_last
       FROM leads l LEFT JOIN users ag ON ag.id = l.assigned_agent_id WHERE l.campaign_id = ? ORDER BY l.created_at DESC LIMIT 300`,
    [c.id]
  );
  ok(res, {
    campaign: shapeCampaign(c),
    spend: spend.map((s) => ({ ...s, amount: num(s.amount), recorded_by_name: fullName(s.first_name, s.last_name) || null })),
    leads: leads.map((l) => ({ ...l, client_name: fullName(l.first_name, l.last_name), agent_name: fullName(l.ag_first, l.ag_last) || null }))
  });
});

const addSpend = wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT id, name, budget FROM campaigns WHERE id = ?', [req.params.id]);
  if (!c) throw httpError(404, 'Campaign not found.');
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!(amount > 0)) throw httpError(400, 'Enter the amount spent.');
  const date = b.spend_date ? new Date(b.spend_date) : new Date();
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000) throw httpError(400, 'Spend date can’t be in the future.');
  const id = crypto.randomUUID();
  await pool.query('INSERT INTO campaign_spend (id, campaign_id, spend_date, amount, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)', [id, c.id, date, amount, b.note ? String(b.note).slice(0, 255) : null, req.user.id]);
  const [[{ total }]] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM campaign_spend WHERE campaign_id = ?', [c.id]);
  await audit.record({ req, action: 'CAMPAIGN_SPEND_RECORDED', entityType: 'CAMPAIGN', entityId: c.id, summary: `₹${amount.toLocaleString('en-IN')} spent on ${c.name} (total ₹${num(total).toLocaleString('en-IN')} of ₹${num(c.budget).toLocaleString('en-IN')})`, after: { amount, spend_date: date, total: num(total) } });
  ok(res, { id, total: num(total), overBudget: num(c.budget) > 0 && num(total) > num(c.budget) }, num(c.budget) > 0 && num(total) > num(c.budget) ? 'Spend recorded — this campaign is now over budget.' : 'Spend recorded.', 201);
});

// ------------------------------------------------------------------------------------------- analytics
const analytics = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 90);
  const [bySource] = await pool.query(
    `SELECT COALESCE(NULLIF(l.source, ''), 'OTHER') AS source, COUNT(*) AS leads,
            SUM(l.first_contacted_at IS NOT NULL OR l.last_contacted_at IS NOT NULL) AS contacted,
            SUM(l.qualification_status = 'QUALIFIED') AS qualified,
            SUM(EXISTS (SELECT 1 FROM site_visits sv WHERE sv.lead_id = l.id AND sv.status = 'COMPLETED')) AS visited,
            SUM(EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = l.id AND d.status IN ${LIVE})) AS bookings,
            (SELECT COALESCE(SUM(d.agreed_total_amount), 0) FROM deals d JOIN leads l2 ON l2.id = d.lead_id
              WHERE d.status IN ${LIVE} AND COALESCE(NULLIF(l2.source, ''), 'OTHER') = COALESCE(NULLIF(l.source, ''), 'OTHER') AND l2.created_at >= ? AND l2.created_at < ?) AS revenue
       FROM leads l WHERE l.created_at >= ? AND l.created_at < ?
      GROUP BY source ORDER BY leads DESC`,
    [from, to, from, to]
  );
  const [spendBySource] = await pool.query(
    `SELECT ch.lead_source AS source, COALESCE(SUM(s.amount), 0) AS spend FROM campaign_spend s JOIN campaigns c ON c.id = s.campaign_id
       JOIN ad_channels ch ON ch.id = c.channel_id WHERE s.spend_date >= ? AND s.spend_date < ? GROUP BY ch.lead_source`,
    [from, to]
  );
  const spendMap = Object.fromEntries(spendBySource.map((s) => [s.source, num(s.spend)]));
  const [byMonth] = await pool.query(
    `SELECT DATE_FORMAT(l.created_at, '%Y-%m') AS month, COUNT(*) AS leads, SUM(l.campaign_id IS NOT NULL) AS campaign_leads
       FROM leads l WHERE l.created_at >= ? AND l.created_at < ? GROUP BY month ORDER BY month`,
    [from, to]
  );
  const [[spendTotal]] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS spend FROM campaign_spend WHERE spend_date >= ? AND spend_date < ?', [from, to]);
  const sources = bySource.map((s) => {
    const spend = spendMap[s.source] || 0;
    return {
      source: s.source, leads: num(s.leads), contacted: num(s.contacted), qualified: num(s.qualified), visited: num(s.visited), bookings: num(s.bookings),
      revenue: num(s.revenue), spend, conversionPct: pct(s.bookings, s.leads), costPerLead: spend && num(s.leads) ? Math.round(spend / num(s.leads)) : null,
      roiPct: spend ? Math.round(((num(s.revenue) - spend) / spend) * 1000) / 10 : null
    };
  });
  const totals = sources.reduce((t, s) => ({ leads: t.leads + s.leads, bookings: t.bookings + s.bookings, revenue: t.revenue + s.revenue }), { leads: 0, bookings: 0, revenue: 0 });
  totals.spend = num(spendTotal.spend);
  totals.costPerLead = totals.leads && totals.spend ? Math.round(totals.spend / totals.leads) : null;
  totals.conversionPct = pct(totals.bookings, totals.leads);
  totals.roiPct = totals.spend ? Math.round(((totals.revenue - totals.spend) / totals.spend) * 1000) / 10 : null;
  ok(res, { range: { from, to }, totals, sources, byMonth: byMonth.map((m) => ({ month: m.month, leads: num(m.leads), campaignLeads: num(m.campaign_leads) })) });
});

/** Lead-level attribution report for a period: source, campaign, UTM tags, and how far each lead got. */
const attribution = wrap(async (req, res) => {
  const { from, to } = dateRange(req.query, 30);
  const where = ['l.created_at >= ?', 'l.created_at < ?'];
  const params = [from, to];
  if (req.query.campaign_id) { where.push('l.campaign_id = ?'); params.push(req.query.campaign_id); }
  if (req.query.source) { where.push('l.source = ?'); params.push(req.query.source); }
  const [rows] = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.source, l.utm_source, l.utm_medium, l.utm_campaign, l.created_at, l.stage, ${BUCKET} AS bucket,
            c.name AS campaign_name, c.code AS campaign_code, p.name AS project_name,
            (SELECT d.agreed_total_amount FROM deals d WHERE d.lead_id = l.id AND d.status IN ${LIVE} ORDER BY d.created_at DESC LIMIT 1) AS booked_value
       FROM leads l LEFT JOIN campaigns c ON c.id = l.campaign_id LEFT JOIN projects p ON p.id = l.preferred_project_id
      WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 2000`,
    params
  );
  ok(res, { range: { from, to }, rows: rows.map((r) => ({ ...r, client_name: fullName(r.first_name, r.last_name), booked_value: r.booked_value == null ? null : num(r.booked_value) })) });
});

const options = wrap(async (req, res) => {
  const [channels] = await pool.query('SELECT id, name, lead_source FROM ad_channels WHERE is_active = 1 ORDER BY name');
  const [projects] = await pool.query("SELECT id, name FROM projects WHERE status <> 'ARCHIVED' ORDER BY name");
  const [campaigns] = await pool.query("SELECT id, name, code FROM campaigns WHERE status IN ('PLANNED', 'ACTIVE', 'PAUSED') ORDER BY name");
  ok(res, { channelTypes: CHANNEL_TYPES, costModels: COST_MODELS, statuses: STATUSES, channels, projects, campaigns });
});

module.exports = { listChannels, createChannel, updateChannel, listCampaigns, createCampaign, updateCampaign, getCampaign, addSpend, analytics, attribution, options };
