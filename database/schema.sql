-- =============================================================================
-- REAL ESTATE CRM - COMPREHENSIVE MYSQL 9.6 SCHEMA SPECIFICATION
-- Source Document: docs/DATABASE_ARCHITECTURE.md
-- Engine: MySQL 8.0+ / 9.6 (InnoDB Engine, utf8mb4 Character Set)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS realestate_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE realestate_crm;

-- -----------------------------------------------------------------------------
-- Table 1: roles
-- Role catalog separating SUPER_ADMIN and ADMIN access levels
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 2: users
-- User identity, credentials, account status, and role mapping
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    role_id INT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    last_login TIMESTAMP NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 3: user_audit_logs
-- Immutable security audit trail tracking access events and status changes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    performed_by VARCHAR(36) NULL,
    target_user_id VARCHAR(36) NULL,
    action ENUM('USER_CREATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'ACCESS_REVOKED', 'USER_UPDATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT') NOT NULL,
    ip_address VARCHAR(45) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 4: projects
-- Master real estate development project catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    project_type ENUM('RESIDENTIAL', 'COMMERCIAL', 'PLOTTED', 'MIXED') NOT NULL,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    status ENUM('PLANNING', 'UNDER_CONSTRUCTION', 'READY_TO_MOVE', 'COMPLETED', 'ARCHIVED') DEFAULT 'UNDER_CONSTRUCTION',
    total_units INT DEFAULT 0,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 5: buildings
-- Towers, blocks, or sub-structures within a project
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buildings (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_floors INT NOT NULL DEFAULT 1,
    units_per_floor INT NOT NULL DEFAULT 1,
    status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buildings_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 6: units
-- Property inventory (vertical units and land plots) with flexible asset modeling
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    building_id VARCHAR(36) NULL,
    unit_number VARCHAR(50) NOT NULL,
    floor_number INT NULL,
    asset_category ENUM('RESIDENTIAL', 'COMMERCIAL', 'PLOT') NOT NULL,
    unit_type ENUM('1BHK', '2BHK', '3BHK', '4BHK', 'PENTHOUSE', 'RETAIL', 'OFFICE', 'PLOT') NOT NULL,
    carpet_area_sqft DECIMAL(10,2) NULL,
    super_area_sqft DECIMAL(10,2) NULL,
    plot_area_sqft DECIMAL(10,2) NULL,
    plot_dimensions VARCHAR(50) NULL,
    facing ENUM('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST') NULL,
    is_corner BOOLEAN DEFAULT FALSE,
    base_price DECIMAL(14,2) NOT NULL,
    plc_charges DECIMAL(14,2) DEFAULT 0.00,
    status ENUM('AVAILABLE', 'HOLD', 'BOOKED', 'SOLD', 'ARCHIVED') DEFAULT 'AVAILABLE',
    hold_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_units_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_units_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
    CONSTRAINT uk_units_location UNIQUE (project_id, building_id, unit_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 7: leads
-- Acquisition pipeline prospects and lead SLA tracking
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Table 8: customers
-- Converted buyer directory and customer profile records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(20) NOT NULL,
    pan_tax_id VARCHAR(50) NULL,
    address_line1 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    pincode VARCHAR(20) NULL,
    kyc_status ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING',
    assigned_rep_id VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_rep FOREIGN KEY (assigned_rep_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 9: site_visits
-- Scheduled site visits, feedback, and rating scores
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Table 10: deals
-- Commercial transactions, cost sheet breakdowns, and booking states
-- Note: unit_id is NOT unique to support historical deals (units 1 -> N deals)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(36) PRIMARY KEY,
    deal_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id VARCHAR(36) NOT NULL,
    lead_id VARCHAR(36) NULL,
    unit_id VARCHAR(36) NOT NULL,
    base_price DECIMAL(14,2) NOT NULL,
    plc_charges DECIMAL(14,2) DEFAULT 0.00,
    parking_charges DECIMAL(14,2) DEFAULT 0.00,
    taxes_amount DECIMAL(14,2) DEFAULT 0.00,
    discount_amount DECIMAL(14,2) DEFAULT 0.00,
    maintenance_deposit DECIMAL(14,2) DEFAULT 0.00,
    agreed_total_amount DECIMAL(14,2) NOT NULL,
    booking_token_amount DECIMAL(14,2) NOT NULL,
    status ENUM('DRAFT', 'BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'CANCELLED') DEFAULT 'DRAFT',
    created_by VARCHAR(36) NOT NULL,
    closing_date DATE NULL,
    cancellation_reason VARCHAR(255) NULL,
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_deals_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_deals_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    CONSTRAINT fk_deals_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
    CONSTRAINT fk_deals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 11: payment_milestones
-- Construction-linked and time-linked milestone installment schedule
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_milestones (
    id VARCHAR(36) PRIMARY KEY,
    deal_id VARCHAR(36) NOT NULL,
    milestone_name VARCHAR(150) NOT NULL,
    due_percentage DECIMAL(5,2) NULL,
    due_amount DECIMAL(14,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_milestones_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table 12: payments
-- Payment receipts, reference details, and payment modes
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- PERFORMANCE INDEXES STRATEGY
-- =============================================================================

-- Indexes for Users & Auth
CREATE INDEX idx_users_status ON users(status);

-- Indexes for Inventory & Projects
CREATE INDEX idx_units_project_status ON units(project_id, status);
CREATE INDEX idx_units_building ON units(building_id);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_category ON units(asset_category, unit_type);

-- Indexes for Leads & Pipeline
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX idx_leads_sla_due ON leads(sla_due_date);
CREATE INDEX idx_leads_phone ON leads(phone);

-- Indexes for Site Visits
CREATE INDEX idx_site_visits_scheduled ON site_visits(scheduled_time);
CREATE INDEX idx_site_visits_agent ON site_visits(assigned_agent_id);
CREATE INDEX idx_site_visits_status ON site_visits(status);

-- Indexes for Deals & Payments
CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_deals_unit_status ON deals(unit_id, status);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_milestones_due ON payment_milestones(due_date, status);
CREATE INDEX idx_payments_deal ON payments(deal_id);

-- Index for Security Audit Logs
CREATE INDEX idx_audit_target_action ON user_audit_logs(target_user_id, action);
CREATE INDEX idx_audit_created ON user_audit_logs(created_at);

-- =============================================================================
-- SEED INITIAL SYSTEM DATA
-- =============================================================================

INSERT INTO roles (id, name, description) VALUES 
  (1, 'SUPER_ADMIN', 'Platform Super Administrator with full create/update/delete and user access management privileges'),
  (2, 'ADMIN', 'Standard Administrator with view and analytics access')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);
