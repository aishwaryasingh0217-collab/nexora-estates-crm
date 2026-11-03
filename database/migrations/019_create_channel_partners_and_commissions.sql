-- Migration 019: Create Channel Partners (Brokers) and Commission Ledger
CREATE TABLE IF NOT EXISTS channel_partners (
    id VARCHAR(36) PRIMARY KEY,
    firm_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150) NULL,
    rera_number VARCHAR(100) NULL,
    tier ENUM('PLATINUM', 'GOLD', 'SILVER') DEFAULT 'GOLD',
    commission_rate DECIMAL(5,2) DEFAULT 2.50,
    pan_number VARCHAR(20) NULL,
    gst_number VARCHAR(30) NULL,
    bank_name VARCHAR(100) NULL,
    bank_account_number VARCHAR(50) NULL,
    bank_ifsc_code VARCHAR(20) NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broker_commissions (
    id VARCHAR(36) PRIMARY KEY,
    partner_id VARCHAR(36) NOT NULL,
    deal_id VARCHAR(36) NOT NULL,
    deal_amount DECIMAL(14,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    total_commission DECIMAL(14,2) NOT NULL,
    paid_amount DECIMAL(14,2) DEFAULT 0.00,
    status ENUM('PENDING', 'PARTIALLY_PAID', 'FULLY_PAID') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_comm_partner FOREIGN KEY (partner_id) REFERENCES channel_partners(id) ON DELETE CASCADE,
    CONSTRAINT fk_comm_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broker_payout_records (
    id VARCHAR(36) PRIMARY KEY,
    commission_id VARCHAR(36) NOT NULL,
    partner_id VARCHAR(36) NOT NULL,
    payout_amount DECIMAL(14,2) NOT NULL,
    payment_mode ENUM('NEFT', 'RTGS', 'CHEQUE', 'UPI') DEFAULT 'NEFT',
    transaction_reference VARCHAR(100) NOT NULL,
    payout_date DATE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payout_comm FOREIGN KEY (commission_id) REFERENCES broker_commissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_payout_partner FOREIGN KEY (partner_id) REFERENCES channel_partners(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional columns on leads and deals for broker attribution
-- Note: MySQL ALTER TABLE ADD COLUMN
ALTER TABLE leads ADD COLUMN channel_partner_id VARCHAR(36) NULL;
ALTER TABLE deals ADD COLUMN channel_partner_id VARCHAR(36) NULL;

