/**
 * Record-level limits for the older CRM endpoints (/api/leads, /deals, /site-visits, /support,
 * /channel-partners). Those screens were written for managers and return company-wide data; agents
 * and partners can open them too, so every read is narrowed here to the caller's own records:
 *   agents   → leads they own or have a site visit for, and what hangs off those leads
 *   partners → their firm's clients only
 * Managers and other roles are not limited (null).
 */
const AGENT_ROLES = ['INSIDE_SALES', 'OUTSIDE_SALES'];
const PARTNER = 'CHANNEL_PARTNER';

const isField = (user) => Boolean(user && (AGENT_ROLES.includes(user.role) || user.role === PARTNER));

/** WHERE fragment for leads aliased `alias`, or null when the caller isn't limited. */
function leadScope(user, alias = 'l') {
  if (!user) return { sql: '1 = 0', params: [] };
  if (AGENT_ROLES.includes(user.role)) {
    return {
      sql: `(${alias}.assigned_agent_id = ? OR EXISTS (SELECT 1 FROM site_visits rs_sv WHERE rs_sv.lead_id = ${alias}.id AND rs_sv.assigned_agent_id = ?))`,
      params: [user.id, user.id]
    };
  }
  if (user.role === PARTNER) return { sql: `${alias}.channel_partner_id = ?`, params: [user.channelPartnerId || '__none__'] };
  return null;
}

/** Same rule expressed as "lead id column belongs to an allowed lead". */
function leadIdScope(user, column) {
  const s = leadScope(user, 'rs_l');
  if (!s) return null;
  return { sql: `${column} IN (SELECT rs_l.id FROM leads rs_l WHERE ${s.sql})`, params: s.params };
}

const BANK_FIELDS = ['bank_name', 'bank_account_number', 'bank_ifsc_code', 'pan_number', 'gst_number'];
/** Bank and tax details are for managers and finance only. */
function stripBankDetails(user, row) {
  if (!row || !user || ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_OWNER', 'FINANCE'].includes(user.role)) return row;
  const out = { ...row };
  BANK_FIELDS.forEach((k) => { if (k in out) delete out[k]; });
  return out;
}

/** Route guard: company-wide screens (dashboards, partner league tables, legacy AI) are for managers. */
function denyFieldRoles(message = 'This section is available to managers only. Use your workspace instead.') {
  return (req, res, next) => (isField(req.user) ? res.status(403).json({ status: 'error', message }) : next());
}

module.exports = { isField, leadScope, leadIdScope, stripBankDetails, denyFieldRoles, AGENT_ROLES, PARTNER };
