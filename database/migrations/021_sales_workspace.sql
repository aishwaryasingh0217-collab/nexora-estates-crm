-- Migration 021: Sales Workspace — real roles for agents & channel partners,
-- follow-up scheduling on leads, availability (leave) for fair routing,
-- and a per-lead activity timeline shared by every portal.

-- 1. Field roles (ids match the 1-click demo logins on the sign-in page)
INSERT INTO roles (id, name, description) VALUES
  (3, 'INSIDE_SALES',    'Sales Agent (telecaller): works assigned leads, follow-ups, visit scheduling'),
  (4, 'OUTSIDE_SALES',   'Field / Site Agent: conducts site visits and closes bookings'),
  (5, 'CHANNEL_PARTNER', 'External broker: registers clients, tracks status and commissions')
ON DUPLICATE KEY UPDATE description = VALUES(description);

UPDATE roles SET description = 'Sales Manager: team oversight, lead assignment, approvals and reports' WHERE name = 'ADMIN';

-- 2. Users: link a partner login to its firm, and an availability switch for leave days
ALTER TABLE users
  ADD COLUMN channel_partner_id VARCHAR(36) NULL,
  ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE users
  ADD CONSTRAINT fk_users_channel_partner FOREIGN KEY (channel_partner_id) REFERENCES channel_partners(id) ON DELETE SET NULL;

-- 3. Leads: every open lead carries its next action date
ALTER TABLE leads
  ADD COLUMN next_follow_up_at DATETIME NULL,
  ADD COLUMN last_contacted_at DATETIME NULL,
  ADD COLUMN registered_by VARCHAR(36) NULL,
  ADD COLUMN cp_protected_until DATETIME NULL,
  ADD COLUMN temperature ENUM('HOT', 'WARM', 'COLD') NULL;

CREATE INDEX idx_leads_agent_followup ON leads (assigned_agent_id, next_follow_up_at);
CREATE INDEX idx_leads_channel_partner ON leads (channel_partner_id);

-- 4. Activity timeline (calls, WhatsApp, notes, stage changes, visits, assignment)
CREATE TABLE IF NOT EXISTS lead_activities (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    type ENUM('CALL', 'WHATSAPP', 'NOTE', 'STAGE', 'VISIT', 'ASSIGN', 'BOOKING', 'SYSTEM') NOT NULL,
    outcome VARCHAR(50) NULL,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_activity_lead_created (lead_id, created_at),
    INDEX idx_activity_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Give existing open leads a follow-up date so nothing silently falls through the cracks
UPDATE leads
   SET next_follow_up_at = COALESCE(sla_due_date, DATE(created_at)) + INTERVAL 11 HOUR
 WHERE next_follow_up_at IS NULL
   AND stage NOT IN ('Booking Done', 'WON', 'Closed Won', 'Lost', 'LOST');
