-- Migration 012: Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    deal_id VARCHAR(36) NOT NULL,
    milestone_id VARCHAR(36) NULL,
    amount_received DECIMAL(14,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('CHEQUE', 'BANK_TRANSFER', 'ONLINE') NOT NULL,
    reference_number VARCHAR(100) NULL,
    received_by VARCHAR(36) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_milestone FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
