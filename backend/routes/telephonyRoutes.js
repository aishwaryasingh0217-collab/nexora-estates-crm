/**
 * Cloud telephony routes.
 *
 *   /api/suite/telephony/*                     signed-in staff (click-to-call, call history, outcomes, screen pop)
 *   /api/telephony/webhooks/:provider/status/:secret     provider → us (call status), no sign-in
 *   /api/telephony/webhooks/:provider/incoming/:secret   provider → us (incoming call, Passthru), no sign-in
 *
 * Webhooks are accepted only with the right secret in the URL (TELEPHONY_WEBHOOK_SECRET), optionally only
 * from TELEPHONY_ALLOWED_IPS, and always answer 200 quickly so the provider doesn't retry needlessly.
 */
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireCapability: need, can } = require('../services/permissions');
const tel = require('../services/telephony');
const pool = require('../config/db');

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (err) { next(err); } };
const ok = (res, data, message, status = 200) => res.status(status).json({ status: 'success', ...(message ? { message } : {}), data });

// ------------------------------------------------------------------ staff API (mounted at /api/suite/telephony)
const staff = express.Router();
staff.use(authenticateToken);

staff.get('/status', (req, res) => {
  const s = tel.status();
  const out = { ...s, canCall: can(req.user, 'calls.make') };
  if (can(req.user, 'settings.manage')) out.webhooks = tel.webhookUrls(); // shown to administrators for provider setup
  else delete out.missing;
  ok(res, out);
});

staff.post('/calls', need('calls.make'), wrap(async (req, res) => {
  const r = await tel.startCall(req.user, { leadId: req.body && req.body.lead_id, customerId: req.body && req.body.customer_id }, req);
  ok(res, r, r.message, 201);
}));

staff.get('/calls', wrap(async (req, res) => {
  ok(res, await tel.myCalls(req.user, { pendingOutcome: req.query.pending === '1', limit: Math.min(parseInt(req.query.limit, 10) || 50, 200) }));
}));

staff.get('/calls/:id', wrap(async (req, res) => {
  const call = await tel.loadCall(req.params.id);
  tel.assertCallAccess(req.user, call);
  ok(res, tel.shapeCall(call, req.user));
}));

staff.post('/calls/:id/outcome', need('calls.make'), wrap(async (req, res) => {
  ok(res, await tel.saveOutcome(req.user, req.params.id, req.body || {}, req), 'Call outcome saved.');
}));

staff.post('/calls/:id/create-lead', need('leads.create'), wrap(async (req, res) => {
  ok(res, await tel.createLeadFromCall(req.user, req.params.id, req.body || {}, req), 'Lead created from the call.', 201);
}));

/** Recordings only for the employee on the call and their managers; opened via the provider's link. */
staff.get('/calls/:id/recording', wrap(async (req, res) => {
  const call = await tel.loadCall(req.params.id);
  tel.assertCallAccess(req.user, call);
  if (!call.recording_url) return res.status(404).json({ status: 'error', message: 'This call has no recording.' });
  ok(res, { url: call.recording_url });
}));

staff.get('/live', wrap(async (req, res) => ok(res, await tel.liveIncoming(req.user))));

staff.get('/outcomes', (req, res) => ok(res, Object.entries(tel.OUTCOMES).map(([key, o]) => ({ key, label: o.label }))));

/** Look up who a number belongs to (screen pop / manual dial check). */
staff.get('/lookup', need('calls.make'), wrap(async (req, res) => {
  const who = await tel.identify(req.query.phone);
  const lead = who.lead ? { id: who.lead.id, name: [who.lead.first_name, who.lead.last_name].filter(Boolean).join(' '), stage: who.lead.stage, assigned_agent_id: who.lead.assigned_agent_id } : null;
  if (lead && ['INSIDE_SALES', 'OUTSIDE_SALES'].includes(req.user.role) && lead.assigned_agent_id !== req.user.id) {
    return ok(res, { lead: { id: null, name: lead.name, stage: lead.stage, ownedByAnother: true }, customer: null });
  }
  ok(res, { lead, customer: who.customer ? { id: who.customer.id, name: [who.customer.first_name, who.customer.last_name].filter(Boolean).join(' ') } : null });
}));

// ------------------------------------------------------------------ provider webhooks (mounted at /api/telephony)
const hooks = express.Router();
const fields = multer().none(); // Exotel may post multipart/form-data; JSON and url-encoded are parsed by the app

function secretOk(given) {
  const expected = tel.webhookSecret();
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ipOk(req) {
  const list = String(process.env.TELEPHONY_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  const ip = String(req.ip || '').replace(/^::ffff:/, '');
  return list.includes(ip);
}

function guard(req, res, next) {
  if (!secretOk(req.params.secret) || !ipOk(req)) {
    return res.status(404).send('Not found');
  }
  return next();
}

hooks.post('/webhooks/:provider/status/:secret', guard, fields, async (req, res) => {
  try {
    await tel.handleStatusCallback(req.params.provider, req.body || {});
  } catch (err) {
    console.error('[telephony] status callback failed:', err.message);
    await pool.query(
      "INSERT INTO telephony_events (id, provider, event_key, event_type, payload, processing_status, error) VALUES (?, ?, ?, 'status', ?, 'FAILED', ?)",
      [crypto.randomUUID(), req.params.provider, `failed:${crypto.randomUUID()}`, JSON.stringify(req.body || {}).slice(0, 60000), String(err.message).slice(0, 255)]
    ).catch(() => {});
  }
  res.status(200).send('OK');
});

const incoming = async (req, res) => {
  try {
    await tel.handleIncoming(req.params.provider, { ...(req.query || {}), ...(req.body || {}) });
  } catch (err) {
    console.error('[telephony] incoming call failed:', err.message);
  }
  // Empty 200: the call flow carries on to the next applet (e.g. Connect to the team)
  res.status(200).type('text/plain').send('');
};
hooks.get('/webhooks/:provider/incoming/:secret', guard, incoming);
hooks.post('/webhooks/:provider/incoming/:secret', guard, fields, incoming);

module.exports = { staff, hooks };
