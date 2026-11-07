/**
 * Calendar files (RFC 5545) so site visits live in the calendar people already use —
 * iPhone/Mac Calendar, Google Calendar, Outlook on Windows.
 *
 *   GET /api/ics/visit/:id?sig=…   one visit (an "Add to calendar" button)
 *   GET /api/ics/feed/:userId?sig=… a live subscription: every visit this person should know about
 *
 * Calendar apps can't send a login token, so the links carry an HMAC signature instead.
 * Deactivated users' feeds stop working immediately.
 */
const crypto = require('crypto');
const pool = require('../config/db');
const { AGENT_ROLES, PARTNER_ROLE, fullName } = require('../services/salesWorkspace');
const { getSettings } = require('../services/settingsService');

const secret = () => process.env.JWT_SECRET || 'super_secret_jwt_key_realestate_crm_2026';
const sign = (kind, id) => crypto.createHmac('sha256', secret()).update(`${kind}:${id}`).digest('hex').slice(0, 32);
const verify = (kind, id, sig) => {
  const expected = sign(kind, id);
  return typeof sig === 'string' && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
};

/** Paths relative to the API base (the client prefixes /api or /nexora-crm/api). */
const visitIcsPath = (visitId) => `/ics/visit/${visitId}?sig=${sign('visit', visitId)}`;
const feedIcsPath = (userId) => `/ics/feed/${userId}?sig=${sign('feed', userId)}`;

const icsEscape = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Lines longer than 75 octets must be folded (continuation lines start with a space). */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function visitEvent(v, brand) {
  const start = new Date(v.scheduled_time);
  const end = new Date(start.getTime() + 60 * 60000);
  const client = fullName(v.first_name, v.last_name) || 'Client';
  const agent = fullName(v.agent_first_name, v.agent_last_name);
  const where = [v.project_name, v.location, v.city].filter(Boolean).join(', ');
  const status = { CANCELLED: 'CANCELLED', NO_SHOW: 'CANCELLED' }[v.status] || 'CONFIRMED';
  const prefix = v.status === 'COMPLETED' ? '✓ ' : v.status === 'CANCELLED' || v.status === 'NO_SHOW' ? '✗ ' : '';
  const description = [
    `Client: ${client}${v.phone ? ` (${v.phone})` : ''}`,
    agent ? `Site agent: ${agent}${v.agent_phone ? ` (${v.agent_phone})` : ''}` : null,
    v.partner_firm ? `Channel partner: ${v.partner_firm}` : null,
    v.status && v.status !== 'SCHEDULED' ? `Status: ${v.status.replace('_', ' ').toLowerCase()}` : null,
    `— ${brand}`
  ].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:visit-${v.id}@nexora`,
    `DTSTAMP:${icsDate(v.updated_at || v.created_at || new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`${prefix}Site visit: ${client} — ${v.project_name}`)}`,
    where ? `LOCATION:${icsEscape(where)}` : null,
    `DESCRIPTION:${icsEscape(description)}`,
    `STATUS:${status}`
  ];
  if (status === 'CONFIRMED' && v.status === 'SCHEDULED') {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(`Site visit with ${client} in 1 hour`)}`, 'TRIGGER:-PT60M', 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines.filter(Boolean);
}

function calendar(name, events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Real Estate Sales Workspace//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`,
    'X-PUBLISHED-TTL:PT30M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    ...events.flat(),
    'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n';
}

const VISIT_SELECT = `
  SELECT sv.id, sv.scheduled_time, sv.status, sv.created_at, sv.updated_at,
         l.first_name, l.last_name, l.phone, cp.firm_name AS partner_firm,
         p.name AS project_name, p.location, p.city,
         ag.first_name AS agent_first_name, ag.last_name AS agent_last_name, ag.phone AS agent_phone
    FROM site_visits sv
    JOIN projects p ON p.id = sv.project_id
    LEFT JOIN leads l ON l.id = sv.lead_id
    LEFT JOIN channel_partners cp ON cp.id = l.channel_partner_id
    LEFT JOIN users ag ON ag.id = sv.assigned_agent_id`;

function send(res, filename, body) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');
  res.send(body);
}

const visitIcs = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!verify('visit', id, req.query.sig)) return res.status(404).send('Not found');
    const [rows] = await pool.query(`${VISIT_SELECT} WHERE sv.id = ?`, [id]);
    if (!rows[0]) return res.status(404).send('Not found');
    const { company_name: brand } = await getSettings();
    send(res, 'site-visit.ics', calendar(`${brand} site visit`, [visitEvent(rows[0], brand)]));
  } catch (err) {
    next(err);
  }
};

const userFeed = async (req, res, next) => {
  try {
    const userId = String(req.params.userId || '').replace(/\.ics$/, '');
    if (!verify('feed', userId, req.query.sig)) return res.status(404).send('Not found');
    const [[user]] = await pool.query(
      `SELECT u.id, u.first_name, u.channel_partner_id, u.status, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [userId]
    );
    if (!user || user.status !== 'ACTIVE') return res.status(404).send('Not found');

    const where = [`sv.scheduled_time >= NOW() - INTERVAL 30 DAY`, `sv.scheduled_time < NOW() + INTERVAL 120 DAY`];
    const params = [];
    if (AGENT_ROLES.includes(user.role)) {
      where.push('(sv.assigned_agent_id = ? OR l.assigned_agent_id = ?)');
      params.push(user.id, user.id);
    } else if (user.role === PARTNER_ROLE) {
      where.push('l.channel_partner_id = ?');
      params.push(user.channel_partner_id || '');
    }
    const [rows] = await pool.query(`${VISIT_SELECT} WHERE ${where.join(' AND ')} ORDER BY sv.scheduled_time LIMIT 1000`, params);
    const { company_name: brand, short_name: short } = await getSettings();
    const name = `${short} — ${user.role === PARTNER_ROLE ? 'client visits' : AGENT_ROLES.includes(user.role) ? 'my site visits' : 'team site visits'}`;
    send(res, 'site-visits.ics', calendar(name, rows.map((v) => visitEvent(v, brand))));
  } catch (err) {
    next(err);
  }
};

module.exports = { visitIcs, userFeed, visitIcsPath, feedIcsPath };
