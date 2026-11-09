/**
 * Who may do what — the single source of truth for every portal.
 *
 * Roles map to people in the company:
 *   BUSINESS_OWNER       Business owner / CEO
 *   SUPER_ADMIN          Sales head (also the original platform administrator)
 *   ADMIN                Sales manager
 *   INSIDE_SALES         Sales agent / telecaller
 *   OUTSIDE_SALES        Field sales agent
 *   CHANNEL_PARTNER      Broker firm login
 *   FINANCE              Finance manager (job_level HEAD) / executive
 *   INVENTORY            Project manager (HEAD) / inventory executive
 *   MARKETING            Marketing manager (HEAD) / executive
 *   CUSTOMER_RELATIONS   Customer relationship manager (HEAD) / executive
 *
 * Every API checks a capability here on the server; hiding a button in the UI is only a convenience.
 * Record-level rules (an agent sees only their own leads, a partner only their firm's clients) are
 * applied in the services that load the records.
 */
const ROLES = {
  OWNER: 'BUSINESS_OWNER',
  SALES_HEAD: 'SUPER_ADMIN',
  SALES_MANAGER: 'ADMIN',
  INSIDE_SALES: 'INSIDE_SALES',
  FIELD_SALES: 'OUTSIDE_SALES',
  PARTNER: 'CHANNEL_PARTNER',
  FINANCE: 'FINANCE',
  INVENTORY: 'INVENTORY',
  MARKETING: 'MARKETING',
  CUSTOMER_RELATIONS: 'CUSTOMER_RELATIONS'
};
const R = ROLES;
const ALL_ROLES = Object.values(ROLES);
const STAFF_ROLES = ALL_ROLES.filter((r) => r !== R.PARTNER);
const SALES_LEADERS = [R.OWNER, R.SALES_HEAD, R.SALES_MANAGER];
const DEPARTMENT_ROLES = [R.FINANCE, R.INVENTORY, R.MARKETING, R.CUSTOMER_RELATIONS];

const ROLE_INFO = {
  [R.OWNER]: { label: 'Business owner', department: 'Management', portal: 'owner' },
  [R.SALES_HEAD]: { label: 'Sales head', department: 'Sales', portal: 'sales-head' },
  [R.SALES_MANAGER]: { label: 'Sales manager', department: 'Sales', portal: 'sales-manager' },
  [R.INSIDE_SALES]: { label: 'Inside sales (Telecaller)', department: 'Sales', portal: 'inside-sales' },
  [R.FIELD_SALES]: { label: 'Outside sales (Field agent)', department: 'Sales', portal: 'outside-sales' },
  [R.PARTNER]: { label: 'Channel partner', department: 'Partners', portal: 'channel-partner' },
  [R.FINANCE]: { label: 'Finance', department: 'Finance', portal: 'finance' },
  [R.INVENTORY]: { label: 'Projects & inventory', department: 'Projects', portal: 'inventory' },
  [R.MARKETING]: { label: 'Marketing', department: 'Marketing', portal: 'marketing' },
  [R.CUSTOMER_RELATIONS]: { label: 'Customer relationship', department: 'Customer care', portal: 'crm' }
};

/**
 * Capability → roles. A role listed with ':HEAD' needs job_level HEAD (managers, not executives).
 */
const CAPABILITIES = {
  // Leads & sales team
  'leads.view.all': SALES_LEADERS,
  'leads.view.own': [R.INSIDE_SALES, R.FIELD_SALES, R.PARTNER, ...SALES_LEADERS],
  'leads.view.attribution': [...SALES_LEADERS, R.MARKETING],
  'leads.assign': SALES_LEADERS,
  'leads.import': [...SALES_LEADERS, R.MARKETING],
  'leads.create': [...SALES_LEADERS, R.INSIDE_SALES, R.FIELD_SALES, R.PARTNER, R.MARKETING],
  'team.view': SALES_LEADERS,
  'team.manage': [R.OWNER, R.SALES_HEAD],
  'targets.view': [...SALES_LEADERS, R.INSIDE_SALES, R.FIELD_SALES],
  'targets.set': SALES_LEADERS,
  'visits.allocate': SALES_LEADERS,
  'visits.approve': SALES_LEADERS,
  'visits.schedule': [...SALES_LEADERS, R.INSIDE_SALES, R.FIELD_SALES, R.PARTNER],
  'visits.checkin': [...SALES_LEADERS, R.FIELD_SALES],
  'inside.queue': [R.INSIDE_SALES, ...SALES_LEADERS],
  'outside.visits': [R.FIELD_SALES, ...SALES_LEADERS],
  'partner.desk': [R.PARTNER, ...SALES_LEADERS],
  'partner.register': [...SALES_LEADERS, R.PARTNER],
  'bookings.initiate': [...SALES_LEADERS, R.INSIDE_SALES, R.FIELD_SALES],
  'bookings.approve': SALES_LEADERS,
  'bookings.view.all': [...SALES_LEADERS, R.FINANCE, R.CUSTOMER_RELATIONS],
  'escalations.manage': SALES_LEADERS,
  'reports.sales': SALES_LEADERS,

  // Finance
  'finance.view': [R.OWNER, R.FINANCE, R.SALES_HEAD],
  'finance.record': [R.FINANCE],
  'finance.verify': [R.FINANCE],
  'finance.invoice': [R.FINANCE],
  'finance.reconcile': [R.FINANCE],
  'finance.refund.request': [R.FINANCE, R.CUSTOMER_RELATIONS, R.SALES_HEAD, R.OWNER],
  'finance.refund.decide': [R.OWNER, `${R.FINANCE}:HEAD`],
  'finance.refund.process': [R.FINANCE],
  'finance.commission.pay': [R.FINANCE],

  // Projects & inventory
  'inventory.view': STAFF_ROLES,
  'inventory.directory': ALL_ROLES, // available units to sell (partners see partner-visible projects only)
  'inventory.manage': [R.INVENTORY, R.SALES_HEAD],
  'inventory.pricing': [`${R.INVENTORY}:HEAD`, R.SALES_HEAD, R.OWNER],
  'inventory.allocate': [R.INVENTORY, R.SALES_HEAD],
  'inventory.documents': [R.INVENTORY, R.SALES_HEAD],

  // Marketing
  'marketing.view': [R.OWNER, R.SALES_HEAD, R.MARKETING],
  'marketing.manage': [R.MARKETING],

  // Customer relationship
  'crm.view': [R.OWNER, R.SALES_HEAD, R.CUSTOMER_RELATIONS, R.FINANCE],
  'crm.manage': [R.CUSTOMER_RELATIONS],
  'crm.ticket.create': [R.CUSTOMER_RELATIONS, R.SALES_HEAD, R.SALES_MANAGER, R.FINANCE, R.OWNER],

  // Company-wide
  'owner.dashboard': [R.OWNER],
  'approvals.view': [R.OWNER, R.SALES_HEAD, R.SALES_MANAGER, `${R.FINANCE}:HEAD`],
  'audit.view.all': [R.OWNER],
  'audit.view.department': [R.SALES_HEAD, `${R.FINANCE}:HEAD`, `${R.INVENTORY}:HEAD`, `${R.MARKETING}:HEAD`, `${R.CUSTOMER_RELATIONS}:HEAD`, R.SALES_MANAGER],
  'users.manage': [R.OWNER, R.SALES_HEAD],
  'settings.manage': [R.OWNER, R.SALES_HEAD],
  'calls.make': [R.OWNER, R.SALES_HEAD, R.SALES_MANAGER, R.INSIDE_SALES, R.FIELD_SALES, R.CUSTOMER_RELATIONS, R.FINANCE],
  'calls.monitor': SALES_LEADERS,
  'ai.use': STAFF_ROLES,
  'testing.use': ALL_ROLES
};

function roleMatches(entry, role, jobLevel) {
  const [r, level] = entry.split(':');
  if (r !== role) return false;
  return !level || level === jobLevel;
}

/** True when the user (needs .role and, for HEAD-only rules, .jobLevel) has the capability. */
function can(user, capability) {
  if (!user || !user.role) return false;
  const allowed = CAPABILITIES[capability];
  if (!allowed) throw new Error(`Unknown capability: ${capability}`);
  return allowed.some((entry) => roleMatches(entry, user.role, user.jobLevel));
}

/** Express middleware: 403 unless the signed-in user has every listed capability. */
function requireCapability(...capabilities) {
  return (req, res, next) => {
    const missing = capabilities.find((cap) => !can(req.user, cap));
    if (!missing) return next();
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'Your role does not allow this action.'
    });
  };
}

/** Express middleware: allow if the user has ANY of the listed capabilities. */
function requireAnyCapability(...capabilities) {
  return (req, res, next) => {
    if (capabilities.some((cap) => can(req.user, cap))) return next();
    return res.status(403).json({ status: 'error', code: 'FORBIDDEN', message: 'Your role does not allow this action.' });
  };
}

/** Everything the UI needs to draw the right menus (the server still checks each call). */
function capabilitiesFor(user) {
  return Object.keys(CAPABILITIES).filter((cap) => can(user, cap));
}

/** Which portals a role may open. The owner may look into every department's portal. */
function portalsFor(user) {
  const own = ROLE_INFO[user.role] ? ROLE_INFO[user.role].portal : null;
  const portals = new Set(own ? [own] : []);
  if (user.role === R.OWNER) ['sales-head', 'sales-manager', 'inside-sales', 'outside-sales', 'channel-partner', 'finance', 'inventory', 'marketing', 'crm'].forEach((p) => portals.add(p));
  if (user.role === R.SALES_HEAD) ['sales-manager', 'inside-sales', 'outside-sales', 'channel-partner', 'inventory'].forEach((p) => portals.add(p));
  if (user.role === R.SALES_MANAGER) ['inside-sales', 'outside-sales', 'channel-partner'].forEach((p) => portals.add(p));
  if (STAFF_ROLES.includes(user.role)) portals.add('testing');
  if (user.role === R.PARTNER) portals.add('testing');
  return [...portals];
}

/** Roles whose audit events a department head may see on the organisation timeline. */
function auditRolesVisibleTo(user) {
  if (can(user, 'audit.view.all')) return null; // everything
  if (user.role === R.SALES_HEAD) return [R.SALES_HEAD, R.SALES_MANAGER, R.INSIDE_SALES, R.FIELD_SALES, R.PARTNER];
  if (user.role === R.SALES_MANAGER) return [R.SALES_MANAGER, R.INSIDE_SALES, R.FIELD_SALES, R.PARTNER];
  if (user.jobLevel === 'HEAD' && DEPARTMENT_ROLES.includes(user.role)) return [user.role];
  return []; // own actions only
}

module.exports = {
  ROLES,
  ALL_ROLES,
  STAFF_ROLES,
  SALES_LEADERS,
  DEPARTMENT_ROLES,
  ROLE_INFO,
  CAPABILITIES,
  can,
  requireCapability,
  requireAnyCapability,
  capabilitiesFor,
  portalsFor,
  auditRolesVisibleTo
};
