-- Migration 020: Create Marketplace Multi-Segment & "Must-Buy" Growth Tables
-- Supports Rental, Resale, Developer Pre-Launch, Priority Pass EOI, Group Pools, Resale Deal Rooms, and CP Lead Locks

-- 1. Extend units table with marketplace segments and rental/resale attributes
ALTER TABLE units 
  ADD COLUMN listing_type ENUM('NEW_LAUNCH', 'RESALE', 'RENTAL') DEFAULT 'NEW_LAUNCH',
  ADD COLUMN rental_monthly_rent DECIMAL(12,2) NULL,
  ADD COLUMN rental_deposit DECIMAL(12,2) NULL,
  ADD COLUMN rental_available_date DATE NULL,
  ADD COLUMN furnishing_status ENUM('UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED') DEFAULT 'SEMI_FURNISHED',
  ADD COLUMN owner_seller_name VARCHAR(150) NULL,
  ADD COLUMN owner_seller_phone VARCHAR(20) NULL,
  ADD COLUMN is_verified_listing BOOLEAN DEFAULT TRUE,
  ADD COLUMN virtual_tour_url VARCHAR(255) NULL;

-- 2. Priority Passes (Pre-Launch EOI / Token Hold with Live Counter & 48h Allocation)
CREATE TABLE IF NOT EXISTS priority_passes (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    pass_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_phone VARCHAR(20) NOT NULL,
    buyer_email VARCHAR(150) NULL,
    token_amount DECIMAL(10,2) NOT NULL DEFAULT 21000.00,
    discount_benefit_text VARCHAR(255) DEFAULT '₹500/sq.ft off Day-1 Launch Price',
    priority_rank INT NOT NULL,
    status ENUM('ACTIVE', 'CONVERTED', 'EXPIRED', 'REFUNDED') DEFAULT 'ACTIVE',
    refund_reference VARCHAR(100) NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pass_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Group Buying Pools ("Pool & Save" Viral Discount Engine)
CREATE TABLE IF NOT EXISTS group_buying_pools (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    pool_title VARCHAR(150) NOT NULL,
    target_buyers INT NOT NULL DEFAULT 5,
    current_buyers INT NOT NULL DEFAULT 1,
    discount_percentage DECIMAL(5,2) DEFAULT 6.00,
    flat_discount_amount DECIMAL(12,2) DEFAULT 500000.00,
    token_commitment DECIMAL(10,2) DEFAULT 25000.00,
    deadline DATETIME NOT NULL,
    status ENUM('OPEN', 'DISCOUNT_UNLOCKED', 'COMPLETED', 'EXPIRED') DEFAULT 'OPEN',
    share_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pool_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_pool_members (
    id VARCHAR(36) PRIMARY KEY,
    pool_id VARCHAR(36) NOT NULL,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_phone VARCHAR(20) NOT NULL,
    buyer_email VARCHAR(150) NULL,
    unit_type_preference VARCHAR(50) DEFAULT '3BHK',
    commitment_status ENUM('JOINED', 'VERIFIED', 'BOOKED', 'WITHDRAWN') DEFAULT 'JOINED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_pool FOREIGN KEY (pool_id) REFERENCES group_buying_pools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 7-Day Resale Deal Rooms (Transparent Live Offers)
CREATE TABLE IF NOT EXISTS resale_deal_rooms (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) NOT NULL,
    seller_name VARCHAR(100) NOT NULL,
    seller_phone VARCHAR(20) NOT NULL,
    reserve_price DECIMAL(14,2) NOT NULL,
    current_highest_bid DECIMAL(14,2) DEFAULT 0.00,
    bid_count INT DEFAULT 0,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    status ENUM('ACTIVE', 'ACCEPTED', 'EXPIRED', 'CLOSED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dealroom_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resale_bids (
    id VARCHAR(36) PRIMARY KEY,
    deal_room_id VARCHAR(36) NOT NULL,
    bidder_name VARCHAR(100) NOT NULL,
    bidder_phone VARCHAR(20) NOT NULL,
    bid_amount DECIMAL(14,2) NOT NULL,
    is_preapproved_loan BOOLEAN DEFAULT FALSE,
    status ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED', 'OUTBID') DEFAULT 'SUBMITTED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bid_dealroom FOREIGN KEY (deal_room_id) REFERENCES resale_deal_rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Rental Agreements & Deposit Escrow
CREATE TABLE IF NOT EXISTS rental_agreements (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) NOT NULL,
    tenant_name VARCHAR(100) NOT NULL,
    tenant_phone VARCHAR(20) NOT NULL,
    tenant_email VARCHAR(150) NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2) NOT NULL,
    lease_start_date DATE NOT NULL,
    lease_end_date DATE NOT NULL,
    lock_in_months INT DEFAULT 11,
    deposit_status ENUM('ESCROW_HELD', 'RELEASED_TO_LANDLORD', 'REFUNDED_TO_TENANT') DEFAULT 'ESCROW_HELD',
    agreement_signed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rental_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Channel Partner 60-Day Lead Locks
CREATE TABLE IF NOT EXISTS cp_lead_locks (
    id VARCHAR(36) PRIMARY KEY,
    channel_partner_id VARCHAR(36) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    status ENUM('ACTIVE_LOCKED', 'VISIT_COMPLETED', 'DEAL_CONVERTED', 'EXPIRED') DEFAULT 'ACTIVE_LOCKED',
    locked_until DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cplock_partner FOREIGN KEY (channel_partner_id) REFERENCES channel_partners(id) ON DELETE CASCADE,
    CONSTRAINT fk_cplock_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
