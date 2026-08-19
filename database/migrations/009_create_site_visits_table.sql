-- Migration 009: Create site_visits table
CREATE TABLE IF NOT EXISTS site_visits (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NULL,
    customer_id VARCHAR(36) NULL,
    project_id VARCHAR(36) NOT NULL,
    assigned_agent_id VARCHAR(36) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    status ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') DEFAULT 'SCHEDULED',
    client_feedback TEXT NULL,
    rating TINYINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_visits_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_visits_agent FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_visit_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
