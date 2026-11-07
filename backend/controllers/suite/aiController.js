/**
 * AI features in the Business Suite. Each works on real records and nothing changes data without the
 * person confirming it:
 *   chat                assistant answering from live data (tools), proposing confirmable actions
 *   extractBrochure     reads a project brochure PDF → project details to review and save
 *   parseLeads          turns pasted text / messy lists into lead rows, flagging duplicates
 *   leadAssist          next best action, talking points and a message draft for one lead
 *   distribution        data-driven owner suggestions for unassigned leads (works without the AI key)
 */
const multer = require('multer');
const { wrap, ok, httpError, pool, fullName } = require('./common');
const claude = require('../../services/ai/claude');
const assistant = require('../../services/ai/assistant');
const leadService = require('../../services/leadService');
const timeline = require('../../services/timelineService');
const audit = require('../../services/audit');
const { can } = require('../../services/permissions');
const { leadScope } = require('../../services/recordScope');
const { phoneKey, bucketSql } = require('../../services/salesWorkspace');

/** JSON Schema "this or null" in the form structured outputs supports (anyOf). */
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });

const pdfInMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } }).single('file');

const status = wrap(async (req, res) => ok(res, { configured: claude.configured(), model: claude.configured() ? claude.MODEL() : null, effort: claude.EFFORT() }));

const chat = wrap(async (req, res) => {
  ok(res, await assistant.chat(req.user, req.body && req.body.messages, req));
});

const confirmAction = wrap(async (req, res) => {
  const r = await assistant.confirmAction(req.user, req.params.id, req);
  ok(res, r, r.result);
});

const cancelAction = wrap(async (req, res) => ok(res, await assistant.cancelAction(req.user, req.params.id), 'Cancelled.'));

// ------------------------------------------------------------------ brochure → project details
const PROJECT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    builder_developer: nullable({ type: 'string' }),
    city: nullable({ type: 'string' }),
    location: nullable({ type: 'string', description: 'Locality / area' }),
    address: nullable({ type: 'string' }),
    project_type: { type: 'string', enum: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT'] },
    status: nullable({ type: 'string', enum: ['PRE_LAUNCH', 'NEW_LAUNCH', 'UNDER_CONSTRUCTION', 'READY_TO_MOVE', 'COMPLETED'] }),
    possession_date: nullable({ type: 'string' }),
    rera_number: nullable({ type: 'string' }),
    total_units: nullable({ type: 'integer' }),
    configurations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          unit_type: { type: 'string', enum: ['1BHK', '2BHK', '3BHK', '4BHK', 'PENTHOUSE', 'RETAIL', 'OFFICE', 'PLOT'] },
          carpet_area_sqft: nullable({ type: 'number' }),
          super_area_sqft: nullable({ type: 'number' }),
          price_from: nullable({ type: 'number', description: 'Rupees' }),
          price_to: nullable({ type: 'number', description: 'Rupees' })
        },
        required: ['unit_type', 'carpet_area_sqft', 'super_area_sqft', 'price_from', 'price_to'],
        additionalProperties: false
      }
    },
    amenities: { type: 'array', items: { type: 'string' } },
    highlights: { type: 'array', items: { type: 'string' } },
    not_found: { type: 'array', items: { type: 'string' }, description: 'Fields the brochure does not state' }
  },
  required: ['name', 'builder_developer', 'city', 'location', 'address', 'project_type', 'status', 'possession_date', 'rera_number', 'total_units', 'configurations', 'amenities', 'highlights', 'not_found'],
  additionalProperties: false
};

const extractBrochure = wrap(async (req, res) => {
  await new Promise((resolve, reject) => pdfInMemory(req, res, (err) => (err ? reject(Object.assign(new Error(err.code === 'LIMIT_FILE_SIZE' ? 'The PDF is larger than 20 MB.' : err.message), { statusCode: 400 })) : resolve())));
  if (!req.file) throw httpError(400, 'Choose the brochure PDF.');
  if (req.file.buffer.slice(0, 5).toString('latin1') !== '%PDF-') throw httpError(400, 'That file is not a PDF.');
  const { data } = await claude.extract({
    system: 'You read real-estate project brochures and copy out the project facts exactly as printed. Never guess: use null for anything the brochure does not state, and list those fields in not_found. Prices are in Indian rupees as plain numbers (1.25 Cr = 12500000).',
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: req.file.buffer.toString('base64') } },
      { type: 'text', text: 'Extract the project details from this brochure.' }
    ],
    schema: PROJECT_SCHEMA
  });
  await audit.record({ req, source: 'AI', action: 'AI_BROCHURE_EXTRACTED', entityType: 'AI', entityId: null, summary: `Brochure read: ${data.name || 'unnamed project'} (${(req.file.originalname || '').slice(0, 80)}) — details shown for review, nothing saved` });
  ok(res, data, 'Details extracted. Review them before saving the project.');
});

// ------------------------------------------------------------------ pasted text → lead rows
const LEADS_SCHEMA = {
  type: 'object',
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: nullable({ type: 'string' }),
          email: nullable({ type: 'string' }),
          budget_min: nullable({ type: 'number' }),
          budget_max: nullable({ type: 'number' }),
          configuration: nullable({ type: 'string' }),
          location: nullable({ type: 'string' }),
          project: nullable({ type: 'string' }),
          source: nullable({ type: 'string', enum: ['WEBSITE', 'FACEBOOK_ADS', 'GOOGLE_ADS', 'WALK_IN', 'REFERRAL', 'CHANNEL_PARTNER', 'DIRECT_CALL', '99ACRES', 'MAGICBRICKS', 'HOUSING_COM', 'OTHER'] }),
          notes: nullable({ type: 'string' })
        },
        required: ['name', 'phone', 'email', 'budget_min', 'budget_max', 'configuration', 'location', 'project', 'source', 'notes'],
        additionalProperties: false
      }
    }
  },
  required: ['leads'],
  additionalProperties: false
};

const parseLeads = wrap(async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim();
  if (text.length < 10) throw httpError(400, 'Paste the enquiries (names, numbers, notes) to process.');
  if (text.length > 60000) throw httpError(400, 'Paste up to about 60,000 characters at a time.');
  const { data } = await claude.extract({
    system: 'You turn pasted enquiry lists (WhatsApp exports, emails, spreadsheets copied as text) into lead records for an Indian real-estate CRM. One record per distinct person. Copy phone numbers and emails exactly; never invent contact details — use null when missing. Budgets in rupees as plain numbers (80L = 8000000, 1.2 Cr = 12000000).',
    content: [{ type: 'text', text: `Extract the leads from this text:\n\n${text}` }],
    schema: LEADS_SCHEMA
  });
  const seen = new Set();
  const rows = [];
  for (const l of (data.leads || []).slice(0, 2000)) {
    const key = phoneKey(l.phone);
    const problems = [];
    if (key.length < 10) problems.push('No valid 10-digit mobile number');
    if (l.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email)) problems.push('Email looks wrong');
    let duplicate = null;
    if (key.length >= 10) {
      if (seen.has(key)) problems.push('Repeated in this list');
      seen.add(key);
      const d = await leadService.findDuplicates({ phone: l.phone, email: l.email });
      if (d.length) duplicate = { lead_id: can(req.user, 'leads.view.all') ? d[0].id : null, name: fullName(d[0].first_name, d[0].last_name), owner: d[0].agent_name };
    }
    rows.push({ ...l, problems, duplicate, importable: !problems.length && !duplicate });
  }
  await audit.record({ req, source: 'AI', action: 'AI_LEADS_PARSED', entityType: 'AI', entityId: null, summary: `${rows.length} lead(s) read from pasted text; ${rows.filter((r) => r.importable).length} ready to import, ${rows.filter((r) => r.duplicate).length} duplicates — nothing imported yet` });
  ok(res, { rows });
});

// ------------------------------------------------------------------ one lead: what to do next
const ASSIST_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentences on where this client stands' },
    next_best_action: { type: 'string' },
    suggested_follow_up: nullable({ type: 'string', description: 'ISO date-time, India time, inside 10:00–19:00' }),
    talking_points: { type: 'array', items: { type: 'string' } },
    whatsapp_draft: { type: 'string', description: 'Short, polite WhatsApp message the agent can send; no prices unless in the data' },
    risks: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'next_best_action', 'suggested_follow_up', 'talking_points', 'whatsapp_draft', 'risks'],
  additionalProperties: false
};

const leadAssist = wrap(async (req, res) => {
  const s = can(req.user, 'leads.view.all') ? null : leadScope(req.user, 'l');
  const [[lead]] = await pool.query(
    `SELECT l.*, ${bucketSql('l.stage')} AS bucket, p.name AS project FROM leads l LEFT JOIN projects p ON p.id = l.preferred_project_id
      WHERE l.id = ?${s ? ` AND ${s.sql}` : ''}`,
    [req.params.id, ...(s ? s.params : [])]
  );
  if (!lead) throw httpError(404, 'Lead not found.');
  const history = (await timeline.leadTimeline(lead.id)).slice(0, 25).map((i) => `${new Date(i.at).toLocaleString('en-IN')} · ${i.type}${i.outcome ? `/${i.outcome}` : ''}: ${i.text || ''}`);
  const [units] = await pool.query(
    `SELECT p.name AS project, u.unit_number, u.unit_type, u.super_area_sqft, u.base_price + COALESCE(u.plc_charges, 0) AS price
       FROM units u JOIN projects p ON p.id = u.project_id WHERE u.status = 'AVAILABLE' AND (u.project_id = ? OR ? IS NULL)
      ORDER BY ABS((u.base_price + COALESCE(u.plc_charges, 0)) - ?) LIMIT 5`,
    [lead.preferred_project_id, lead.preferred_project_id, Number(lead.budget_max || lead.budget_min || 0)]
  );
  const facts = {
    client: fullName(lead.first_name, lead.last_name), stage: lead.stage, bucket: lead.bucket, temperature: lead.temperature, priority: lead.priority,
    budget: [lead.budget_min, lead.budget_max], configuration: lead.configuration, location: lead.preferred_location, purpose: lead.purpose,
    timeline: lead.purchase_timeline, loan_required: lead.loan_required, project: lead.project, next_follow_up_at: lead.next_follow_up_at,
    nearest_available_units: units, history
  };
  const { data } = await claude.extract({
    system: 'You coach real-estate sales agents. Base everything only on the facts given; do not invent prices, offers or availability. Keep advice specific and short.',
    content: [{ type: 'text', text: `Facts about this lead (JSON):\n${JSON.stringify(facts)}\n\nNow: ${new Date().toLocaleString('en-IN')}. What should the agent do next?` }],
    schema: ASSIST_SCHEMA,
    max_tokens: 4000
  });
  await audit.record({ req, source: 'AI', action: 'AI_LEAD_ASSIST', entityType: 'LEAD', entityId: lead.id, summary: `Follow-up suggestions for ${facts.client} (read-only)` });
  ok(res, data);
});

// ------------------------------------------------------------------ smart distribution
const suggestDistribution = wrap(async (req, res) => {
  const sales = require('./salesController');
  const ids = Array.isArray(req.body && req.body.lead_ids) ? req.body.lead_ids : null;
  ok(res, await leadService.suggestDistribution({ leadIds: ids, team: await sales.teamOf(req.user), limit: 200 }));
});

const applyDistribution = wrap(async (req, res) => {
  const sales = require('./salesController');
  const team = await sales.teamOf(req.user);
  const proposals = Array.isArray(req.body && req.body.proposals) ? req.body.proposals.slice(0, 500) : [];
  if (!proposals.length) throw httpError(400, 'Choose the suggestions to apply.');
  const out = { assigned: 0, unchanged: 0, failed: [] };
  for (const p of proposals) {
    try {
      if (team && !team.includes(p.to_user_id)) throw new Error('Not in your team.');
      const r = await leadService.assignLead(p.lead_id, p.to_user_id, { by: { id: req.user.id, name: req.user.name, role: req.user.role }, method: 'AI', reason: 'Smart distribution (data-driven suggestion, confirmed by manager)', req, source: 'AI' });
      if (r.changed) out.assigned++; else out.unchanged++;
    } catch (err) {
      out.failed.push({ lead_id: p.lead_id, error: err.message });
    }
  }
  ok(res, out, `${out.assigned} lead${out.assigned === 1 ? '' : 's'} assigned${out.failed.length ? `, ${out.failed.length} failed` : ''}.`);
});

module.exports = { status, chat, confirmAction, cancelAction, extractBrochure, parseLeads, leadAssist, suggestDistribution, applyDistribution };
