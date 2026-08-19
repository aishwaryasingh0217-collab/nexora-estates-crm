-- Migration 016: Add Calendar Features
ALTER TABLE site_visits ADD COLUMN google_event_id VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS site_visit_history (
    id VARCHAR(36) PRIMARY KEY,
    site_visit_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(36) NULL,
    previous_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_visit FOREIGN KEY (site_visit_id) REFERENCES site_visits(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
