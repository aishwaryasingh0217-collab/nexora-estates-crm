-- Migration 007: Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(36) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(20) NOT NULL,
    source ENUM('WEBSITE_FORM', 'DIRECT_CALL', 'WHATSAPP', 'FACEBOOK_ADS', 'WALK_IN', 'REFERRAL') NOT NULL,
    stage ENUM('INCOMING', 'CONTACTED', 'VISIT_SCHEDULED', 'VISIT_COMPLETED', 'NEGOTIATION', 'WON', 'LOST') DEFAULT 'INCOMING',
    lost_reason VARCHAR(255) NULL,
    budget_min DECIMAL(14,2) NULL,
    budget_max DECIMAL(14,2) NULL,
    preferred_project_id VARCHAR(36) NULL,
    assigned_agent_id VARCHAR(36) NULL,
    sla_due_date DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_leads_project FOREIGN KEY (preferred_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    CONSTRAINT fk_leads_agent FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
