/**
 * Migration 024: the connected CRM.
 *
 * Adds the departments (Business Owner, Finance, Project & Inventory, Marketing, Customer Relations),
 * the lead-to-booking workflow (assignment history, visit lifecycle, booking approvals, payment
 * verification), marketing attribution, after-sales care, cloud telephony, an append-only audit trail,
 * notification preferences, sessions, and the Manual Testing Center.
 *
 * Every step checks what is already there, so it is safe on fresh installs and on live databases.
 */
const { ensureBookingGuard } = require('../integrity');

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

async function columnInfo(c, table, column) {
  const [rows] = await c.query(
    `SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS def
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0] || null;
}

async function addColumn(c, table, column, definition) {
  if (await columnInfo(c, table, column)) return;
  await c.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function addIndex(c, table, name, columns, unique = false) {
  const [rows] = await c.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, name]
  );
  if (rows.length) return;
  await c.query(`ALTER TABLE \`${table}\` ADD ${unique ? 'UNIQUE ' : ''}INDEX \`${name}\` (${columns})`);
}

/** Adds values to an ENUM column, keeping its existing values, nullability and default. */
async function extendEnum(c, table, column, values) {
  const info = await columnInfo(c, table, column);
  if (!info) return;
  const current = info.type.replace(/^enum\(/i, '').replace(/\)$/, '').split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
  const merged = [...current, ...values.filter((v) => !current.includes(v))];
  if (merged.length === current.length) return;
  const def = info.def == null ? (info.nullable === 'YES' ? 'DEFAULT NULL' : '') : `DEFAULT ${c.escape(info.def)}`;
  await c.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${merged.map((v) => c.escape(v)).join(', ')}) ${info.nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${def}`
  );
}

/** Millisecond precision for event times, so things done in the same second keep their order. Type is kept. */
async function addPrecision(c, table, column) {
  const info = await columnInfo(c, table, column);
  if (!info || /\(3\)/.test(info.type)) return;
  const type = info.type.toLowerCase().startsWith('timestamp') ? 'TIMESTAMP(3)' : 'DATETIME(3)';
  await c.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${type} ${info.nullable === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT CURRENT_TIMESTAMP(3)`);
}

async function up(c) {
  // ---------------------------------------------------------------- roles & people
  await c.query(
    `INSERT IGNORE INTO roles (name, description) VALUES
      ('BUSINESS_OWNER', 'Business owner / CEO: company-wide visibility, approvals and reports'),
      ('FINANCE', 'Finance & accounts: payments, verification, receipts, invoices, refunds, commissions'),
      ('INVENTORY', 'Projects & inventory: projects, towers, units, pricing, allocation, documents'),
      ('MARKETING', 'Marketing: campaigns, channels, budgets, lead attribution and ROI'),
      ('CUSTOMER_RELATIONS', 'Customer relationship: post-booking care, service requests, documents, possession')`
  );
  await addColumn(c, 'users', 'job_level', "ENUM('HEAD','EXECUTIVE') NOT NULL DEFAULT 'EXECUTIVE' AFTER role_id");
  await addColumn(c, 'users', 'manager_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'users', 'is_test_data', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addIndex(c, 'users', 'idx_users_manager', 'manager_id');

  await c.query(`CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NULL,
    expires_at DATETIME NULL,
    revoked_at DATETIME NULL,
    revoked_by VARCHAR(36) NULL,
    INDEX idx_sessions_user (user_id, revoked_at)
  ) ${T}`);

  // ---------------------------------------------------------------- leads
  await addColumn(c, 'leads', 'priority', "ENUM('URGENT','HIGH','MEDIUM','LOW') NULL");
  await addColumn(c, 'leads', 'campaign_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'leads', 'utm_source', 'VARCHAR(100) NULL');
  await addColumn(c, 'leads', 'utm_medium', 'VARCHAR(100) NULL');
  await addColumn(c, 'leads', 'utm_campaign', 'VARCHAR(100) NULL');
  await addColumn(c, 'leads', 'property_type', 'VARCHAR(30) NULL');
  await addColumn(c, 'leads', 'configuration', 'VARCHAR(60) NULL');
  await addColumn(c, 'leads', 'preferred_location', 'VARCHAR(150) NULL');
  await addColumn(c, 'leads', 'purpose', "ENUM('SELF_USE','INVESTMENT','RENTAL_INCOME') NULL");
  await addColumn(c, 'leads', 'purchase_timeline', "ENUM('IMMEDIATE','3_MONTHS','6_MONTHS','12_MONTHS','EXPLORING') NULL");
  await addColumn(c, 'leads', 'loan_required', 'TINYINT(1) NULL');
  await addColumn(c, 'leads', 'qualification_status', "ENUM('PENDING','QUALIFIED','NOT_QUALIFIED') NOT NULL DEFAULT 'PENDING'");
  await addColumn(c, 'leads', 'qualified_at', 'DATETIME NULL');
  await addColumn(c, 'leads', 'first_contacted_at', 'DATETIME NULL');
  await addColumn(c, 'leads', 'duplicate_of_lead_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'leads', 'converted_at', 'DATETIME NULL');
  await addColumn(c, 'leads', 'lost_at', 'DATETIME NULL');
  await addColumn(c, 'leads', 'is_test_data', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addIndex(c, 'leads', 'idx_leads_campaign', 'campaign_id');
  await addIndex(c, 'leads', 'idx_leads_test', 'is_test_data');
  await addIndex(c, 'leads', 'idx_leads_owner_stage', 'assigned_agent_id, stage');
  // Leads someone has already worked count as contacted
  await c.query(
    `UPDATE leads SET first_contacted_at = COALESCE(last_contacted_at, updated_at)
      WHERE first_contacted_at IS NULL AND (last_contacted_at IS NOT NULL OR stage NOT IN ('Fresh Lead', 'New Lead', 'INCOMING', 'NEW'))`
  );
  await extendEnum(c, 'lead_activities', 'type', ['EMAIL', 'SMS', 'QUALIFY', 'PAYMENT', 'ESCALATION', 'APPROVAL', 'AI']);
  await addPrecision(c, 'lead_activities', 'created_at');
  await addPrecision(c, 'site_visit_history', 'created_at');

  await c.query(`CREATE TABLE IF NOT EXISTS lead_assignments (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NOT NULL,
    from_user_id VARCHAR(36) NULL,
    to_user_id VARCHAR(36) NULL,
    assigned_by VARCHAR(36) NULL,
    method ENUM('MANUAL','AUTO','BULK','IMPORT','AI','REASSIGN','SYSTEM') NOT NULL DEFAULT 'MANUAL',
    reason VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_assign_lead (lead_id, created_at),
    INDEX idx_assign_to (to_user_id),
    CONSTRAINT fk_assign_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
  ) ${T}`);
  await addPrecision(c, 'lead_assignments', 'created_at');

  // ---------------------------------------------------------------- site visits
  await extendEnum(c, 'site_visits', 'status',
    ['REQUESTED', 'PENDING_APPROVAL', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'RESCHEDULED', 'MISSED']);
  // A requested visit has no field agent yet (and a rejected one goes back to having none)
  const agentCol = await columnInfo(c, 'site_visits', 'assigned_agent_id');
  if (agentCol && agentCol.nullable === 'NO') {
    await c.query(`ALTER TABLE site_visits MODIFY COLUMN assigned_agent_id ${agentCol.type} NULL`);
  }
  await addColumn(c, 'site_visits', 'requested_by', 'VARCHAR(36) NULL');
  await addColumn(c, 'site_visits', 'client_confirmed', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn(c, 'site_visits', 'approved_by', 'VARCHAR(36) NULL');
  await addColumn(c, 'site_visits', 'accepted_at', 'DATETIME NULL');
  await addColumn(c, 'site_visits', 'rejection_reason', 'VARCHAR(255) NULL');
  await addColumn(c, 'site_visits', 'check_in_at', 'DATETIME NULL');
  await addColumn(c, 'site_visits', 'check_in_lat', 'DECIMAL(10,7) NULL');
  await addColumn(c, 'site_visits', 'check_in_lng', 'DECIMAL(10,7) NULL');
  await addColumn(c, 'site_visits', 'check_in_distance_m', 'INT NULL');
  await addColumn(c, 'site_visits', 'completed_at', 'DATETIME NULL');
  await addColumn(c, 'site_visits', 'reschedule_count', 'INT NOT NULL DEFAULT 0');
  // Visits fixed before this release were agreed with the client when they were booked
  await c.query("UPDATE site_visits SET client_confirmed = 1 WHERE status IN ('SCHEDULED', 'COMPLETED') AND client_confirmed = 0");
  await addIndex(c, 'site_visits', 'idx_visits_agent_time', 'assigned_agent_id, scheduled_time');

  // ---------------------------------------------------------------- projects & inventory
  await addColumn(c, 'projects', 'latitude', 'DECIMAL(10,7) NULL');
  await addColumn(c, 'projects', 'longitude', 'DECIMAL(10,7) NULL');
  await addColumn(c, 'projects', 'address', 'VARCHAR(255) NULL');
  await addColumn(c, 'projects', 'partner_visible', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn(c, 'projects', 'is_test_data', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn(c, 'units', 'allocated_partner_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'units', 'allocated_user_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'units', 'allocation_note', 'VARCHAR(255) NULL');
  await addColumn(c, 'units', 'hold_deal_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'units', 'status_changed_at', 'DATETIME NULL');
  await c.query('UPDATE units SET status_changed_at = COALESCE(updated_at, created_at) WHERE status_changed_at IS NULL');

  await c.query(`CREATE TABLE IF NOT EXISTS project_documents (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    doc_type ENUM('BROCHURE','FLOOR_PLAN','PRICE_LIST','RERA_CERTIFICATE','APPROVAL','LEGAL','AGREEMENT_TEMPLATE','OTHER') NOT NULL DEFAULT 'OTHER',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NULL,
    file_size INT NULL,
    partner_visible TINYINT(1) NOT NULL DEFAULT 0,
    uploaded_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_projdocs_project (project_id),
    CONSTRAINT fk_projdocs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  ) ${T}`);

  // ---------------------------------------------------------------- bookings, approvals, escalations, targets
  await extendEnum(c, 'deals', 'status', ['PENDING_APPROVAL', 'REJECTED']);
  await addColumn(c, 'deals', 'approved_by', 'VARCHAR(36) NULL');
  await addColumn(c, 'deals', 'approved_at', 'DATETIME NULL');
  await addColumn(c, 'deals', 'rejection_reason', 'VARCHAR(255) NULL');
  await addColumn(c, 'deals', 'booking_channel', 'VARCHAR(30) NULL');

  await c.query(`CREATE TABLE IF NOT EXISTS approval_requests (
    id VARCHAR(36) PRIMARY KEY,
    request_type ENUM('BOOKING','DISCOUNT','REFUND','VISIT','COMMISSION_PAYOUT','PRICE_CHANGE','OTHER') NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    details TEXT NULL,
    amount DECIMAL(15,2) NULL,
    requested_by VARCHAR(36) NULL,
    approver_roles VARCHAR(200) NOT NULL,
    status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    decided_by VARCHAR(36) NULL,
    decided_at DATETIME NULL,
    decision_note VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_approvals_status (status, request_type),
    INDEX idx_approvals_entity (entity_type, entity_id)
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS escalations (
    id VARCHAR(36) PRIMARY KEY,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    lead_id VARCHAR(36) NULL,
    title VARCHAR(255) NOT NULL,
    reason TEXT NULL,
    severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    raised_by VARCHAR(36) NULL,
    source ENUM('HUMAN','SYSTEM') NOT NULL DEFAULT 'HUMAN',
    escalated_to_role VARCHAR(40) NOT NULL DEFAULT 'ADMIN',
    assigned_to VARCHAR(36) NULL,
    status ENUM('OPEN','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'OPEN',
    resolution TEXT NULL,
    resolved_by VARCHAR(36) NULL,
    resolved_at DATETIME NULL,
    dedupe_key VARCHAR(120) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_esc_status (status, escalated_to_role),
    INDEX idx_esc_lead (lead_id),
    UNIQUE KEY uq_esc_dedupe (dedupe_key)
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS sales_targets (
    id VARCHAR(36) PRIMARY KEY,
    scope_key VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    period CHAR(7) NOT NULL,
    target_bookings INT NOT NULL DEFAULT 0,
    target_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    target_site_visits INT NOT NULL DEFAULT 0,
    target_calls INT NOT NULL DEFAULT 0,
    set_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_target_scope_period (scope_key, period)
  ) ${T}`);

  // ---------------------------------------------------------------- finance
  await extendEnum(c, 'payments', 'payment_mode', ['UPI', 'NEFT', 'RTGS', 'IMPS', 'CASH', 'DEMAND_DRAFT', 'CARD']);
  const hadVerification = Boolean(await columnInfo(c, 'payments', 'verification_status'));
  await addColumn(c, 'payments', 'verification_status', "ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING'");
  await addColumn(c, 'payments', 'verified_by', 'VARCHAR(36) NULL');
  await addColumn(c, 'payments', 'verified_at', 'DATETIME NULL');
  await addColumn(c, 'payments', 'verification_note', 'VARCHAR(255) NULL');
  await addColumn(c, 'payments', 'receipt_number', 'VARCHAR(40) NULL');
  await addColumn(c, 'payments', 'payer_name', 'VARCHAR(150) NULL');
  await addColumn(c, 'payments', 'bank_line_id', 'VARCHAR(36) NULL');
  await addIndex(c, 'payments', 'uq_payments_receipt', 'receipt_number', true);
  await addIndex(c, 'payments', 'idx_payments_verification', 'verification_status');
  if (!hadVerification) {
    // Payments recorded before verification existed were already counted as received; say so plainly
    await c.query(
      `UPDATE payments SET verification_status = 'VERIFIED', verified_at = created_at,
              verification_note = 'Recorded before payment verification existed'`
    );
  }

  await c.query(`CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(36) PRIMARY KEY,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    deal_id VARCHAR(36) NOT NULL,
    milestone_id VARCHAR(36) NULL,
    customer_id VARCHAR(36) NULL,
    description VARCHAR(255) NULL,
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NULL,
    status ENUM('ISSUED','PARTIALLY_PAID','PAID','CANCELLED') NOT NULL DEFAULT 'ISSUED',
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoices_deal (deal_id),
    CONSTRAINT fk_invoices_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS refunds (
    id VARCHAR(36) PRIMARY KEY,
    refund_number VARCHAR(40) NOT NULL UNIQUE,
    deal_id VARCHAR(36) NOT NULL,
    payment_id VARCHAR(36) NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status ENUM('REQUESTED','APPROVED','REJECTED','PROCESSED') NOT NULL DEFAULT 'REQUESTED',
    requested_by VARCHAR(36) NULL,
    decided_by VARCHAR(36) NULL,
    decided_at DATETIME NULL,
    decision_note VARCHAR(500) NULL,
    processed_by VARCHAR(36) NULL,
    processed_at DATETIME NULL,
    transaction_reference VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_refunds_status (status),
    CONSTRAINT fk_refunds_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id VARCHAR(36) PRIMARY KEY,
    import_batch VARCHAR(36) NOT NULL,
    txn_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    direction ENUM('CREDIT','DEBIT') NOT NULL DEFAULT 'CREDIT',
    reference VARCHAR(120) NULL,
    description VARCHAR(255) NULL,
    match_status ENUM('UNMATCHED','MATCHED','IGNORED') NOT NULL DEFAULT 'UNMATCHED',
    matched_payment_id VARCHAR(36) NULL,
    matched_by VARCHAR(36) NULL,
    matched_at DATETIME NULL,
    imported_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bank_status (match_status),
    INDEX idx_bank_reference (reference)
  ) ${T}`);

  // ---------------------------------------------------------------- marketing
  await c.query(`CREATE TABLE IF NOT EXISTS ad_channels (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    channel_type ENUM('SOCIAL','SEARCH','PORTAL','WEBSITE','OFFLINE','REFERRAL','PARTNER','EMAIL_SMS','OTHER') NOT NULL DEFAULT 'OTHER',
    lead_source VARCHAR(60) NOT NULL,
    cost_model ENUM('CPC','CPL','CPM','FIXED','FREE') NOT NULL DEFAULT 'FIXED',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ${T}`);
  await c.query(
    `INSERT IGNORE INTO ad_channels (id, name, channel_type, lead_source, cost_model) VALUES
      (UUID(), 'Facebook & Instagram Ads', 'SOCIAL', 'FACEBOOK_ADS', 'CPL'),
      (UUID(), 'Google Ads', 'SEARCH', 'GOOGLE_ADS', 'CPC'),
      (UUID(), 'Company website', 'WEBSITE', 'WEBSITE', 'FREE'),
      (UUID(), '99acres', 'PORTAL', '99ACRES', 'FIXED'),
      (UUID(), 'MagicBricks', 'PORTAL', 'MAGICBRICKS', 'FIXED'),
      (UUID(), 'Housing.com', 'PORTAL', 'HOUSING_COM', 'FIXED'),
      (UUID(), 'Walk-in / site office', 'OFFLINE', 'WALK_IN', 'FREE'),
      (UUID(), 'Customer referrals', 'REFERRAL', 'REFERRAL', 'FREE'),
      (UUID(), 'Channel partners', 'PARTNER', 'CHANNEL_PARTNER', 'FREE')`
  );

  await c.query(`CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(60) NOT NULL UNIQUE,
    channel_id VARCHAR(36) NULL,
    project_id VARCHAR(36) NULL,
    objective VARCHAR(255) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    budget DECIMAL(15,2) NOT NULL DEFAULT 0,
    status ENUM('PLANNED','ACTIVE','PAUSED','COMPLETED') NOT NULL DEFAULT 'PLANNED',
    utm_source VARCHAR(100) NULL,
    utm_medium VARCHAR(100) NULL,
    utm_campaign VARCHAR(100) NULL,
    landing_url VARCHAR(500) NULL,
    notes TEXT NULL,
    created_by VARCHAR(36) NULL,
    is_test_data TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_campaigns_status (status),
    INDEX idx_campaigns_utm (utm_campaign)
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS campaign_spend (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL,
    spend_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    note VARCHAR(255) NULL,
    recorded_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_spend_campaign (campaign_id, spend_date),
    CONSTRAINT fk_spend_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  ) ${T}`);

  // ---------------------------------------------------------------- customer relationship
  await addColumn(c, 'customers', 'relationship_manager_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'customers', 'onboarding_status', "ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED'");
  await addColumn(c, 'customers', 'onboarded_at', 'DATETIME NULL');
  await addColumn(c, 'customers', 'is_test_data', 'TINYINT(1) NOT NULL DEFAULT 0');

  await addColumn(c, 'support_tickets', 'category', "ENUM('COMPLAINT','SERVICE_REQUEST','DOCUMENTATION','POSSESSION','PAYMENT_QUERY','GENERAL') NOT NULL DEFAULT 'GENERAL'");
  await addColumn(c, 'support_tickets', 'channel', "ENUM('PHONE','EMAIL','WHATSAPP','WALK_IN','PORTAL','OTHER') NOT NULL DEFAULT 'PHONE'");
  await addColumn(c, 'support_tickets', 'deal_id', 'VARCHAR(36) NULL');
  await addColumn(c, 'support_tickets', 'created_by', 'VARCHAR(36) NULL');
  await addColumn(c, 'support_tickets', 'due_at', 'DATETIME NULL');
  await addColumn(c, 'support_tickets', 'resolved_at', 'DATETIME NULL');
  await addColumn(c, 'support_tickets', 'feedback_rating', 'TINYINT NULL');
  await addColumn(c, 'support_tickets', 'feedback_comment', 'VARCHAR(500) NULL');

  await c.query(`CREATE TABLE IF NOT EXISTS customer_documents (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    deal_id VARCHAR(36) NULL,
    doc_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    status ENUM('PENDING','SUBMITTED','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
    file_url VARCHAR(500) NULL,
    notes VARCHAR(255) NULL,
    updated_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_custdocs_customer (customer_id),
    CONSTRAINT fk_custdocs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS possession_updates (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NULL,
    deal_id VARCHAR(36) NULL,
    stage ENUM('CONSTRUCTION','FINISHING','OC_RECEIVED','HANDOVER_SCHEDULED','HANDED_OVER','OTHER') NOT NULL DEFAULT 'CONSTRUCTION',
    title VARCHAR(200) NOT NULL,
    message TEXT NULL,
    expected_date DATE NULL,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_possession_project (project_id),
    INDEX idx_possession_deal (deal_id)
  ) ${T}`);

  await c.query(`CREATE TABLE IF NOT EXISTS customer_communications (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    deal_id VARCHAR(36) NULL,
    channel ENUM('CALL','EMAIL','WHATSAPP','SMS','MEETING','LETTER','NOTE') NOT NULL DEFAULT 'NOTE',
    direction ENUM('INBOUND','OUTBOUND','INTERNAL') NOT NULL DEFAULT 'OUTBOUND',
    subject VARCHAR(200) NULL,
    summary TEXT NOT NULL,
    user_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_comms_customer (customer_id, created_at),
    CONSTRAINT fk_comms_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  ) ${T}`);

  // ---------------------------------------------------------------- cloud telephony
  await c.query(`CREATE TABLE IF NOT EXISTS call_logs (
    id VARCHAR(36) PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    provider_call_id VARCHAR(100) NULL,
    direction ENUM('OUTBOUND','INBOUND') NOT NULL,
    agent_user_id VARCHAR(36) NULL,
    agent_phone VARCHAR(20) NULL,
    customer_phone VARCHAR(20) NULL,
    virtual_number VARCHAR(20) NULL,
    lead_id VARCHAR(36) NULL,
    customer_id VARCHAR(36) NULL,
    status ENUM('INITIATED','RINGING_AGENT','AGENT_ANSWERED','RINGING_CUSTOMER','CONNECTED','COMPLETED','MISSED','REJECTED','FAILED','BUSY') NOT NULL DEFAULT 'INITIATED',
    initiated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    answered_at DATETIME NULL,
    connected_at DATETIME NULL,
    ended_at DATETIME NULL,
    duration_sec INT NULL,
    recording_url VARCHAR(500) NULL,
    failure_reason VARCHAR(255) NULL,
    outcome VARCHAR(40) NULL,
    remarks TEXT NULL,
    outcome_by VARCHAR(36) NULL,
    outcome_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_call_provider_id (provider, provider_call_id),
    INDEX idx_calls_agent (agent_user_id, initiated_at),
    INDEX idx_calls_lead (lead_id),
    INDEX idx_calls_status (status)
  ) ${T}`);
  await addPrecision(c, 'call_logs', 'initiated_at');

  await c.query(`CREATE TABLE IF NOT EXISTS telephony_events (
    id VARCHAR(36) PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    event_key VARCHAR(191) NOT NULL UNIQUE,
    call_log_id VARCHAR(36) NULL,
    event_type VARCHAR(60) NULL,
    payload MEDIUMTEXT NULL,
    processing_status ENUM('PROCESSED','IGNORED','FAILED') NOT NULL DEFAULT 'PROCESSED',
    error VARCHAR(255) NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tel_events_call (call_log_id)
  ) ${T}`);

  // ---------------------------------------------------------------- audit trail (append-only)
  await c.query(`CREATE TABLE IF NOT EXISTS audit_events (
    seq BIGINT AUTO_INCREMENT PRIMARY KEY,
    id VARCHAR(36) NOT NULL UNIQUE,
    actor_user_id VARCHAR(36) NULL,
    actor_name VARCHAR(150) NULL,
    actor_role VARCHAR(40) NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(40) NULL,
    entity_id VARCHAR(64) NULL,
    summary VARCHAR(500) NULL,
    before_data MEDIUMTEXT NULL,
    after_data MEDIUMTEXT NULL,
    source ENUM('HUMAN','AI','SYSTEM','INTEGRATION') NOT NULL DEFAULT 'HUMAN',
    result ENUM('SUCCESS','FAILED','PENDING') NOT NULL DEFAULT 'SUCCESS',
    ip_address VARCHAR(64) NULL,
    prev_hash CHAR(64) NULL,
    hash CHAR(64) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_actor (actor_user_id, created_at),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
  ) ${T}`);
  // The app never updates or deletes audit rows; these triggers make the database refuse it too.
  // Some hosts don't let app users create triggers; the hash chain still exposes any tampering.
  let triggerError = null;
  for (const [name, timing] of [['audit_events_no_update', 'BEFORE UPDATE'], ['audit_events_no_delete', 'BEFORE DELETE']]) {
    try {
      const [exists] = await c.query('SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?', [name]);
      if (!exists.length) {
        await c.query(`CREATE TRIGGER ${name} ${timing} ON audit_events FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit history is append-only'`);
      }
    } catch (err) {
      triggerError = err.message;
    }
  }
  if (triggerError) {
    console.warn(`[Migration 024] The database user can't create triggers here, so audit history is protected by its hash chain only (${triggerError.slice(0, 80)}).`);
  }

  // ---------------------------------------------------------------- notifications
  await addColumn(c, 'notifications', 'category', 'VARCHAR(40) NULL');
  await addIndex(c, 'notifications', 'idx_notif_recipient_created', 'recipient_user_id, created_at');
  await c.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(36) NOT NULL,
    category VARCHAR(40) NOT NULL,
    in_app TINYINT(1) NOT NULL DEFAULT 1,
    push TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, category)
  ) ${T}`);

  // Background reminders/escalations remember what they already sent, so nobody is alerted twice
  await c.query(`CREATE TABLE IF NOT EXISTS workflow_job_marks (
    mark_key VARCHAR(191) PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_marks_created (created_at)
  ) ${T}`);

  // ---------------------------------------------------------------- workflow settings (owner can change them)
  await c.query(
    `INSERT IGNORE INTO company_settings (setting_key, setting_value) VALUES
      ('booking_approval_mode', 'ALWAYS'),
      ('booking_discount_threshold_pct', '2'),
      ('reservation_hold_hours', '48'),
      ('visit_approval_required', '0'),
      ('followup_escalation_hours', '24'),
      ('untouched_lead_minutes', '30')`
  );

  // ---------------------------------------------------------------- manual testing center
  await c.query(`CREATE TABLE IF NOT EXISTS test_cases (
    id VARCHAR(20) PRIMARY KEY,
    suite VARCHAR(40) NOT NULL,
    portal VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    role VARCHAR(60) NOT NULL,
    login_account VARCHAR(80) NULL,
    page_location VARCHAR(255) NULL,
    steps MEDIUMTEXT NOT NULL,
    test_data TEXT NULL,
    expected_result TEXT NOT NULL,
    verify_location TEXT NULL,
    is_cross_portal TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    status ENUM('NOT_RUN','PASS','FAIL','BLOCKED') NOT NULL DEFAULT 'NOT_RUN',
    actual_result TEXT NULL,
    bug_remarks TEXT NULL,
    tested_by VARCHAR(36) NULL,
    tested_at DATETIME NULL,
    definition_hash CHAR(40) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tests_suite (suite, sort_order)
  ) ${T}`);
  await c.query(`CREATE TABLE IF NOT EXISTS test_case_evidence (
    id VARCHAR(36) PRIMARY KEY,
    test_case_id VARCHAR(20) NULL,
    bug_report_id VARCHAR(36) NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NULL,
    uploaded_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evidence_test (test_case_id),
    INDEX idx_evidence_bug (bug_report_id)
  ) ${T}`);
  await c.query(`CREATE TABLE IF NOT EXISTS test_bug_reports (
    id VARCHAR(36) PRIMARY KEY,
    bug_number VARCHAR(20) NOT NULL UNIQUE,
    test_case_id VARCHAR(20) NULL,
    portal VARCHAR(80) NULL,
    title VARCHAR(255) NOT NULL,
    severity ENUM('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    description TEXT NULL,
    steps_to_reproduce TEXT NULL,
    expected TEXT NULL,
    actual TEXT NULL,
    status ENUM('OPEN','IN_PROGRESS','FIXED','WONT_FIX','CLOSED') NOT NULL DEFAULT 'OPEN',
    reported_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bugs_status (status)
  ) ${T}`);
  await c.query(`CREATE TABLE IF NOT EXISTS test_data_registry (
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    label VARCHAR(200) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_type, entity_id)
  ) ${T}`);

  await addColumn(c, 'channel_partners', 'is_test_data', 'TINYINT(1) NOT NULL DEFAULT 0');

  // ---------------------------------------------------------------- one active booking per unit
  await ensureBookingGuard(c);
}

module.exports = { up };
