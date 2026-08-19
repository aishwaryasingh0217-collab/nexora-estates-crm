# REAL ESTATE CRM - DATABASE ARCHITECTURE SPECIFICATION

> **Document Phase**: Phase 3 - Database Architecture Design  
> **Target Engine**: MySQL 8.0+ Relational Database Management System  
> **Status**: Official Baseline Relational Architecture Specification  

---

## 1. Database Overview

The **Real Estate CRM** database architecture is designed as a highly normalized, production-grade MySQL 8.0+ relational system. It serves as the single source of truth for the entire platform, accessible exclusively via the Node.js + Express backend service layer (the React.js frontend will never connect directly to MySQL).

### Core Architectural Principles:
- **Relational Integrity**: Mandatory foreign keys with strict update and deletion policies (`ON DELETE RESTRICT` on business inventory and customer records).
- **Data Preservation & Auditability**: Zero physical record deletion for core business entities. Deactivation (`ACTIVE` / `INACTIVE`), archiving (`ARCHIVED`), and audit logging (`user_audit_logs`) ensure historical CRM data integrity.
- **Double Booking Prevention**: Enforced via Node.js database transactions using row-level locking (`SELECT * FROM units WHERE id = ? FOR UPDATE`) and atomic state validation against `units.status`.
- **Historical Deal Support**: A single unit can have multiple historical deals over time (e.g. cancelled deals followed by new bookings), modeled as `units (1) → deals (N)`.
- **Flexible Property Modeling**: Asset-specific attribute design accommodating Residential vertical units, Commercial spaces, and Land Plots without forcing irrelevant measurement attributes onto plots.
- **Single Deal Lifecycle Engine**: Single `deals` entity managing commercial transactions from `DRAFT` $\rightarrow$ `BOOKED` $\rightarrow$ `AGREEMENT_SIGNED` $\rightarrow$ `CLOSED_WON` (or `CANCELLED`).

---

## 2. Entity List

The database architecture comprises 12 core relational entities:

1. `roles`: Role definition catalog (`SUPER_ADMIN`, `ADMIN`).
2. `users`: User identity, authentication credentials, account status, and metadata.
3. `user_audit_logs`: Security and access control audit trail.
4. `projects`: Real estate developments (Residential, Commercial, Plotted, Mixed-use).
5. `buildings`: Towers and building structures linked to projects.
6. `units`: Property inventory (vertical units and land plots).
7. `leads`: Multi-channel prospect leads and acquisition pipeline.
8. `customers`: Directory of converted buyers and verified customer profiles.
9. `site_visits`: Scheduled site visit appointments and client feedback scores.
10. `deals`: Commercial transactions, cost sheets (Base, PLC, Parking, Taxes, Discounts), and unit booking states.
11. `payment_milestones`: Construction-linked and time-linked payment milestone schedules.
12. `payments`: Payment transaction logs, mode records, and financial receipts.

---

## 3. Entity Purpose

| Entity | Primary Business Purpose |
| :--- | :--- |
| `roles` | Defines platform access levels (`SUPER_ADMIN`: full create/update/delete + user access management; `ADMIN`: view/analytics only, no create/update/delete). |
| `users` | Manages authentication credentials, user profiles, status (`ACTIVE`/`INACTIVE`), and role assignment. |
| `user_audit_logs` | Provides security event tracking for user creation, login attempts, deactivations, and access revocations. |
| `projects` | Master record for real estate projects, geographical location, and completion status. |
| `buildings` | Structural towers or blocks within a project. |
| `units` | Asset inventory (apartments, penthouses, commercial spaces, land plots) and availability state. |
| `leads` | Captures incoming inquiries, lead stages, SLA due dates, budget preferences, and assigned sales agents. |
| `customers` | Stores buyer identification, PAN/tax details, address, KYC status, and transaction history. |
| `site_visits` | Coordinates site visit schedules, assigned agents, and post-visit customer feedback ratings. |
| `deals` | Formally links a customer to a locked unit, capturing cost sheet pricing and deal progress. |
| `payment_milestones` | Breaks deal total amounts into scheduled milestone installments with due dates. |
| `payments` | Records monetary payments received against milestones, payment modes, and UTR/cheque reference numbers. |

---

## 4. Table-by-Table Proposed Structure

```sql
-- MySQL 8.0+ Schema Specification Blueprint

-- 1. Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'SUPER_ADMIN', 'ADMIN'
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY, -- UUID v4
    role_id INT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt or Argon2 hash
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

-- 3. Security Audit Logs
CREATE TABLE user_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    performed_by VARCHAR(36) NOT NULL,
    target_user_id VARCHAR(36) NULL,
    action ENUM('USER_CREATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'ACCESS_REVOKED', 'USER_UPDATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT') NOT NULL,
    ip_address VARCHAR(45) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Projects
CREATE TABLE projects (
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

-- 5. Buildings / Towers
CREATE TABLE buildings (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL, -- e.g., 'Tower A', 'Block 1'
    total_floors INT NOT NULL DEFAULT 1,
    units_per_floor INT NOT NULL DEFAULT 1,
    status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buildings_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Units / Inventory (Flexible Asset Model)
CREATE TABLE units (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    building_id VARCHAR(36) NULL, -- NULL for independent land plots
    unit_number VARCHAR(50) NOT NULL,
    floor_number INT NULL, -- Required for vertical units; NULL for land plots
    asset_category ENUM('RESIDENTIAL', 'COMMERCIAL', 'PLOT') NOT NULL,
    unit_type ENUM('1BHK', '2BHK', '3BHK', '4BHK', 'PENTHOUSE', 'RETAIL', 'OFFICE', 'PLOT') NOT NULL,
    carpet_area_sqft DECIMAL(10,2) NULL, -- Required for apartments/commercial; NULL for plots
    super_area_sqft DECIMAL(10,2) NULL, -- Required for apartments/commercial; NULL for plots
    plot_area_sqft DECIMAL(10,2) NULL, -- Required for land plots; NULL for apartments
    plot_dimensions VARCHAR(50) NULL, -- e.g. '30x50' for plots; NULL for apartments
    facing ENUM('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST') NULL,
    is_corner BOOLEAN DEFAULT FALSE,
    base_price DECIMAL(14,2) NOT NULL,
    plc_charges DECIMAL(14,2) DEFAULT 0.00,
    status ENUM('AVAILABLE', 'HOLD', 'BOOKED', 'SOLD', 'ARCHIVED') DEFAULT 'AVAILABLE',
    hold_expires_at TIMESTAMP NULL, -- Timer for temporary inventory reservation (24 hours default)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_units_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_units_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
    CONSTRAINT uk_units_location UNIQUE (project_id, building_id, unit_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Leads
CREATE TABLE leads (
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

-- 8. Customers
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NULL UNIQUE, -- Optional link back to converted lead
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

-- 9. Site Visits
CREATE TABLE site_visits (
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

-- 10. Deals / Bookings (Single Lifecycle Commercial Transaction)
CREATE TABLE deals (
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

-- 11. Payment Milestones
CREATE TABLE payment_milestones (
    id VARCHAR(36) PRIMARY KEY,
    deal_id VARCHAR(36) NOT NULL,
    milestone_name VARCHAR(150) NOT NULL, -- e.g. 'Booking Token', 'Foundation', 'Possession'
    due_percentage DECIMAL(5,2) NULL,
    due_amount DECIMAL(14,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_milestones_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Payments
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    deal_id VARCHAR(36) NOT NULL,
    milestone_id VARCHAR(36) NULL,
    amount_received DECIMAL(14,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('CHEQUE', 'BANK_TRANSFER', 'ONLINE') NOT NULL,
    reference_number VARCHAR(100) NULL, -- Cheque/UTR Reference
    received_by VARCHAR(36) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_milestone FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Primary Keys

- `roles`: `id` (`INT AUTO_INCREMENT PRIMARY KEY`).
- All domain tables (`users`, `user_audit_logs`, `projects`, `buildings`, `units`, `leads`, `customers`, `site_visits`, `deals`, `payment_milestones`, `payments`): `id` (`VARCHAR(36) PRIMARY KEY` using UUID v4).

---

## 6. Foreign Keys

All business entity foreign keys strictly use `ON DELETE RESTRICT` or `ON DELETE SET NULL` to preserve historical integrity:
- `users.role_id` $\rightarrow$ `roles.id` (`ON DELETE RESTRICT`)
- `users.created_by` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `user_audit_logs.performed_by` $\rightarrow$ `users.id` (`ON DELETE RESTRICT`)
- `user_audit_logs.target_user_id` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `projects.created_by` $\rightarrow$ `users.id` (`ON DELETE RESTRICT`)
- `buildings.project_id` $\rightarrow$ `projects.id` (`ON DELETE RESTRICT`)
- `units.project_id` $\rightarrow$ `projects.id` (`ON DELETE RESTRICT`)
- `units.building_id` $\rightarrow$ `buildings.id` (`ON DELETE RESTRICT`)
- `leads.preferred_project_id` $\rightarrow$ `projects.id` (`ON DELETE SET NULL`)
- `leads.assigned_agent_id` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `customers.lead_id` $\rightarrow$ `leads.id` (`ON DELETE SET NULL`)
- `customers.assigned_rep_id` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `site_visits.lead_id` $\rightarrow$ `leads.id` (`ON DELETE SET NULL`)
- `site_visits.customer_id` $\rightarrow$ `customers.id` (`ON DELETE SET NULL`)
- `site_visits.project_id` $\rightarrow$ `projects.id` (`ON DELETE RESTRICT`)
- `site_visits.assigned_agent_id` $\rightarrow$ `users.id` (`ON DELETE RESTRICT`)
- `deals.customer_id` $\rightarrow$ `customers.id` (`ON DELETE RESTRICT`)
- `deals.lead_id` $\rightarrow$ `leads.id` (`ON DELETE SET NULL`)
- `deals.unit_id` $\rightarrow$ `units.id` (`ON DELETE RESTRICT`)
- `deals.created_by` $\rightarrow$ `users.id` (`ON DELETE RESTRICT`)
- `payment_milestones.deal_id` $\rightarrow$ `deals.id` (`ON DELETE RESTRICT`)
- `payments.deal_id` $\rightarrow$ `deals.id` (`ON DELETE RESTRICT`)
- `payments.milestone_id` $\rightarrow$ `payment_milestones.id` (`ON DELETE SET NULL`)
- `payments.received_by` $\rightarrow$ `users.id` (`ON DELETE RESTRICT`)

---

## 7. Relationships

- **One-to-Many**:
  - `roles` (1) $\rightarrow$ `users` (N)
  - `projects` (1) $\rightarrow$ `buildings` (N)
  - `projects` (1) $\rightarrow$ `units` (N)
  - `buildings` (1) $\rightarrow$ `units` (N)
  - `users` (1) $\rightarrow$ `leads` (N)
  - `leads` (1) $\rightarrow$ `site_visits` (N)
  - `customers` (1) $\rightarrow$ `deals` (N)
  - `units (1) → deals (N)` [**Historical Deal Support**: A unit can have multiple historical deals over time (e.g. cancelled deals followed by new bookings), but only one active deal at a time enforced via Node.js transactional checks]
  - `deals` (1) $\rightarrow$ `payment_milestones` (N)
  - `deals` (1) $\rightarrow$ `payments` (N)
- **One-to-One**:
  - `leads` (1) $\leftrightarrow$ `customers` (1) [Optional link when a lead converts to a customer profile]

---

## 8. Index Strategy

```sql
-- Indexes for Users & Auth
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
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
```

---

## 9. Unique Constraints

1. `roles.name`: Enforces distinct role names (`SUPER_ADMIN`, `ADMIN`).
2. `users.username`: Enforces unique login usernames.
3. `users.email`: Enforces unique email addresses.
4. `projects.code`: Prevents duplicate project codes (e.g. `'PRJ-OAK-01'`).
5. `units (project_id, building_id, unit_number)`: Prevents duplicate unit numbers within the same project building.
6. `customers.lead_id`: Ensures a lead links to at most one customer profile.
7. `deals.deal_number`: Unique reference code for deals.
8. `payments.payment_number`: Unique financial receipt identifier.

---

## 10. Status Fields / Enumerations

- `users.status`: `'ACTIVE'`, `'INACTIVE'`
- `projects.status`: `'PLANNING'`, `'UNDER_CONSTRUCTION'`, `'READY_TO_MOVE'`, `'COMPLETED'`, `'ARCHIVED'`
- `buildings.status`: `'ACTIVE'`, `'INACTIVE'`, `'ARCHIVED'`
- `units.asset_category`: `'RESIDENTIAL'`, `'COMMERCIAL'`, `'PLOT'`
- `units.unit_type`: `'1BHK'`, `'2BHK'`, `'3BHK'`, `'4BHK'`, `'PENTHOUSE'`, `'RETAIL'`, `'OFFICE'`, `'PLOT'`
- `units.status`: `'AVAILABLE'`, `'HOLD'`, `'BOOKED'`, `'SOLD'`, `'ARCHIVED'`
- `leads.source`: `'WEBSITE_FORM'`, `'DIRECT_CALL'`, `'WHATSAPP'`, `'FACEBOOK_ADS'`, `'WALK_IN'`, `'REFERRAL'`
- `leads.stage`: `'INCOMING'`, `'CONTACTED'`, `'VISIT_SCHEDULED'`, `'VISIT_COMPLETED'`, `'NEGOTIATION'`, `'WON'`, `'LOST'`
- `site_visits.status`: `'SCHEDULED'`, `'COMPLETED'`, `'CANCELLED'`, `'NO_SHOW'`
- `deals.status`: `'DRAFT'`, `'BOOKED'`, `'AGREEMENT_SIGNED'`, `'CLOSED_WON'`, `'CANCELLED'`
- `payment_milestones.status`: `'PENDING'`, `'PARTIAL'`, `'PAID'`, `'OVERDUE'`
- `payments.payment_mode`: `'CHEQUE'`, `'BANK_TRANSFER'`, `'ONLINE'`

---

## 11. Audit Strategy

- Captured Events: `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ACCESS_REVOKED`, `USER_UPDATED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`.
- Payload: `performed_by`, `target_user_id`, `ip_address`, `timestamp`, `metadata` (`JSON`).
- Immutability: `user_audit_logs` has zero update or delete endpoints exposed to application code.

---

## 12. Delete / Archive Strategy

Core business records are not normally physically deleted.

Use ACTIVE / INACTIVE / ARCHIVED status where appropriate.

Historical:
- leads
- customers
- site visits
- deals
- payment milestones
- payments

must remain preserved.

---

## 13. Transaction Requirements

The Node.js backend executes atomic transactions (`START TRANSACTION ... COMMIT / ROLLBACK`) for:
1. **Unit Booking & Deal Creation**:
   ```sql
   START TRANSACTION;
   SELECT * FROM units WHERE id = ? FOR UPDATE;
   -- Verify units.status == 'AVAILABLE' (If not AVAILABLE, ROLLBACK and return 409 Conflict)
   -- Insert new record into `deals` table
   -- Update units.status = 'BOOKED'
   -- Insert initial payment_milestones
   COMMIT;
   ```
2. **Deal Cancellation & Inventory Release**:
   ```sql
   START TRANSACTION;
   -- Update deals.status = 'CANCELLED', set cancellation_reason and cancelled_at
   -- Update units.status = 'AVAILABLE'
   COMMIT;
   ```

---

## 14. Double Booking Prevention

Double booking is prevented through a database transaction using row-level locking.

The Node.js backend must execute:

START TRANSACTION

SELECT * FROM units
WHERE id = ?
FOR UPDATE;

Check:

units.status = 'AVAILABLE'

If the unit is AVAILABLE:

1. Create the deal.
2. Update units.status = 'BOOKED'.
3. Create required payment milestones.
4. COMMIT.

If the unit is not AVAILABLE:

ROLLBACK
Reject the booking request.

SELECT ... FOR UPDATE locks the selected unit row during the transaction. Therefore, two concurrent booking requests cannot successfully book the same available unit.

The deals table does NOT use a unique constraint on unit_id, because historical cancelled deals must remain associated with the same unit.

---

## 15. Authentication Data Model

- `users` stores credentials (`username`, `email`, `password_hash`), `role_id`, and `status`.
- Passwords stored as bcrypt/Argon2 hashes. JWT tokens are ephemeral and not stored as static database passwords.
- Lightweight check on `users.status == 'ACTIVE'` on every API request ensures immediate session rejection upon access revocation.

---

## 16. User Access Data Model

- `roles` separates `SUPER_ADMIN` and `ADMIN`:
  - **SUPER_ADMIN**: full create/update/delete + user access management.
  - **ADMIN**: view/analytics only, no create/update/delete.
- `users.status` enforces `ACTIVE` vs `INACTIVE`.
- Access revocation sets `status = 'INACTIVE'`, preserving user role and historical records.

---

## 17. Property / Inventory Data Model

- Supports `RESIDENTIAL`, `COMMERCIAL`, and `PLOT` categories.
- Vertical units specify `building_id`, `floor_number`, `carpet_area_sqft` (nullable), `super_area_sqft` (nullable).
- Land plots set `building_id = NULL`, `floor_number = NULL`, and specify `plot_area_sqft` (nullable) and `plot_dimensions` (nullable).
- Status transitions: `AVAILABLE` $\rightarrow$ `HOLD` (with default 24-hour auto-expiration timer) $\rightarrow$ `BOOKED` $\rightarrow$ `SOLD`.

---

## 18. Lead Data Model

- Captures source, lead stage, budget preferences, assigned agent, and SLA due dates.

---

## 19. Customer Data Model

- Directory of buyers linking to optional originating `lead_id`, storing KYC status and address.

---

## 20. Site Visit Data Model

- Links `lead_id` / `customer_id`, `project_id`, `assigned_agent_id`, scheduled time, status, and feedback rating.

---

## 21. Deal / Booking Data Model

- Single `deals` entity tracking commercial transaction lifecycle (`DRAFT` $\rightarrow$ `BOOKED` $\rightarrow$ `AGREEMENT_SIGNED` $\rightarrow$ `CLOSED_WON` or `CANCELLED`).
- `BOOKED` represents the booking reservation state within the commercial transaction lifecycle.
- A deal references a unit through unit_id. Multiple historical deals may reference the same unit, but only one active booking is permitted at a time. Active booking concurrency is protected by the Node.js transaction using SELECT ... FOR UPDATE and the units.status field.
- Includes `discount_amount` column (`DECIMAL(14,2) DEFAULT 0.00`) to capture explicit cost sheet discount adjustments.

---

## 22. Payment Data Model

- `payment_milestones` tracks installment schedules.
- `payments` records monetary receipts and reference numbers.

---

## 23. Analytics Data Sources

Metrics generated via SQL aggregate queries from transactional tables (`units`, `leads`, `deals`, `payments`).

---

## 24. Real-Time Data Considerations

Node.js + Socket.IO emits real-time unit hold/book status events (`INVENTORY_UNIT_LOCKED`) driven by database mutation success. Note: Socket.IO is used exclusively for real-time UI state updates and client notification, NOT for database locking or concurrency enforcement.

---

## 25. Normalization Review

Strict 3NF normalization maintained across all 12 tables.

---

## 26. Potential Performance Risks

- Multi-deal unit history queries: Mitigated by `idx_deals_unit_status (unit_id, status)`.
- SLA due date filtering: Mitigated by `idx_leads_sla_due (sla_due_date, stage)`.
- Double booking prevention: Mitigation: Row locking using SELECT ... FOR UPDATE inside a MySQL transaction, combined with the units.status state.

---

## 27. SYSTEM CONFIGURATION PARAMETERS

1. **Inventory Hold Auto-Expiration Timer**: The default auto-expiration duration for inventory `HOLD` status is set to **24 hours**.
2. **Custom Cost Sheet Discounts**: Discount adjustments are explicitly recorded in the `deals.discount_amount` column (`DECIMAL(14,2) DEFAULT 0.00`).

---

## 28. Final Proposed Entity Relationship Overview

```
[roles] (1) ───< [users] (1) ───< [user_audit_logs] (N)
                    │
                    ├───< [projects] (1) ───< [buildings] (1) ───< [units] (1)
                    │        │                                       │
                    │        ├───< [site_visits] (N)                 │ (1-to-N Historical Deals)
                    │        │                                       ▼
                    ├───< [leads] (1) ───? [customers] (1) ───< [deals] (N)
                    │        │                 │                     │
                    └────────┴─────────────────┴─────────────────────├───< [payment_milestones] (N)
                                                                     │
                                                                     └───< [payments] (N)
```

---

## DATABASE ARCHITECTURE REVIEW - CORRECTIONS

The database architecture corrections have been fully applied as follows:

### 1. Deals / Units Relationship
- **Previous Design**: Static single-deal assumption.
- **Correction**: Ensured `deals.unit_id` is a standard foreign key with no unique restriction.
- **Reason**: The database must support multiple historical deals for a single unit over time (e.g. Unit A-101 $\rightarrow$ Deal 001 = CANCELLED $\rightarrow$ Deal 002 = CANCELLED $\rightarrow$ Deal 003 = BOOKED).
- **Final Design**: `units (1) → deals (N)` (Historical 1-to-N relationship).
- **Business Rule**: Only ONE active deal (`DRAFT`, `BOOKED`, `AGREEMENT_SIGNED`, `CLOSED_WON`) can exist for a unit at a time.
- **Database Responsibility**: Maintain foreign key `deals.unit_id -> units.id` and index `idx_deals_unit_status (unit_id, status)` for fast historical query lookups.
- **Node.js Responsibility**: Enforce active deal exclusivity using row locking in a transaction:
  ```sql
  START TRANSACTION;
  SELECT * FROM units WHERE id = ? FOR UPDATE;
  IF units.status != 'AVAILABLE':
      ROLLBACK;
      reject booking;
  ELSE:
      INSERT INTO deals (...);
      UPDATE units SET status = 'BOOKED' WHERE id = ?;
      COMMIT;
  ```

### 2. Unit Fields & Asset Modeling
- **Previous Design**: `carpet_area_sqft` and `super_area_sqft` were defined as mandatory `NOT NULL` columns for all units.
- **Correction**: Made `carpet_area_sqft` and `super_area_sqft` nullable (`DECIMAL(10,2) NULL`) and added plot-specific nullable attributes (`plot_area_sqft`, `plot_dimensions`).
- **Reason**: Land plots do not have apartment-style carpet or super areas. Forcing mandatory measurements onto plots produces invalid data.
- **Final Design**: Supports `RESIDENTIAL`, `COMMERCIAL`, and `PLOT` categories across property types (`1BHK`, `2BHK`, `3BHK`, `4BHK`, `PENTHOUSE`, `RETAIL`, `OFFICE`, `PLOT`) with category-appropriate nullable fields.
- **Business Rule**: Vertical units require carpet/super area; plots require plot area/dimensions.
- **Database Responsibility**: Schema flexibility with nullable asset measurement columns.
- **Node.js Responsibility**: Validate asset-specific mandatory fields based on `asset_category` prior to database insertion.

### 3. Building / Unit Deletion & Historical Integrity
- **Previous Design**: Foreign keys used `ON DELETE CASCADE` for `buildings.project_id` and `units.building_id`.
- **Correction**: Replaced `ON DELETE CASCADE` with `ON DELETE RESTRICT` for all business inventory tables (`buildings.project_id`, `units.building_id`, `units.project_id`). Added status flags (`ACTIVE`, `INACTIVE`, `ARCHIVED`).
- **Reason**: Cascading physical deletion in production destroys historical deals, site visits, and financial payment records linked to inventory.
- **Final Design**: Zero physical deletion of business inventory. Soft archiving via status flags (`ARCHIVED` / `INACTIVE`).
- **Business Rule**: Historical CRM transactions, deals, payments, site visits, and leads must remain permanently intact.
- **Database Responsibility**: Enforce `ON DELETE RESTRICT` on inventory FK constraints and `ON DELETE SET NULL` on site visits FKs.
- **Node.js Responsibility**: Expose soft-archive endpoints (`status = 'ARCHIVED'`) and block physical SQL `DELETE` calls on inventory and transactional records.

### 4. Single Deal Lifecycle Model
- **Previous Design**: Single `deals` table (retained).
- **Correction**: Clarified that a separate `bookings` table is not created; `deals` serves as the single commercial transaction record.
- **Reason**: Avoids table redundancy while fully accommodating the transaction lifecycle.
- **Final Design**: Single `deals` entity tracking `DRAFT` $\rightarrow$ `BOOKED` $\rightarrow$ `AGREEMENT_SIGNED` $\rightarrow$ `CLOSED_WON` (or `CANCELLED`).
- **Business Rule**: `BOOKED` represents the booking reservation state within the commercial transaction lifecycle.
- **Database Responsibility**: Store transaction status in `deals.status` enumeration.
- **Node.js Responsibility**: Orchestrate stage transitions and sync `units.status` with `deals.status`.

---

## DATABASE DESIGN SUMMARY

### Final Proposed Tables (12 Entities):
1. `roles`
2. `users`
3. `user_audit_logs`
4. `projects`
5. `buildings`
6. `units`
7. `leads`
8. `customers`
9. `site_visits`
10. `deals`
11. `payment_milestones`
12. `payments`

### Most Important Relationships:
- `users` (1) $\rightarrow$ `user_audit_logs` (N) (Security Audit Trail)
- `projects` (1) $\rightarrow$ `buildings` (N) $\rightarrow$ `units` (N) (Property Asset Tree)
- `leads` (1) $\rightarrow$ `customers` (1) $\rightarrow$ `deals` (N) (Customer Acquisition Pipeline)
- `units (1) → deals (N)` (Historical deal and booking records)
- `customers (1) → deals (N)` (Customer to Deals relationship)
- `deals` (1) $\rightarrow$ `payment_milestones` (N) $\rightarrow$ `payments` (N) (Financial Schedule & Receipts)

### Important Constraints:
- `users.email` and `users.username` are `UNIQUE`.
- `projects.code` is `UNIQUE`.
- `units (project_id, building_id, unit_number)` is `UNIQUE`.
- `deals.unit_id` must NOT be globally UNIQUE because historical cancelled deals must be preserved. Concurrent active bookings are prevented by the Node.js transaction using SELECT ... FOR UPDATE.
- All business entity FK constraints specify `ON DELETE RESTRICT` or `ON DELETE SET NULL` to protect historical data integrity.

### Business Rules Enforced by Node.js Layer:
1. 4-point credential & role validation pipeline on login.
2. Atomic transactions (`START TRANSACTION ... COMMIT`) with `SELECT FOR UPDATE` row locking during unit booking and cancellation workflows to prevent double booking.
3. Socket.IO real-time event emissions (`INVENTORY_UNIT_LOCKED`) upon successful unit status change.

### Business Rules Protected by MySQL Constraints:
1. Historical data integrity protection via `ON DELETE RESTRICT` on active inventory, customers, and deals.
2. Double booking prevention through Node.js transactions using SELECT ... FOR UPDATE and the units.status state.
3. Strict enumeration boundaries on status and role fields.
4. Foreign key integrity across all 12 tables.

---

## FINAL DATABASE APPROVAL STATUS

READY FOR SCHEMA GENERATION

---

*End of Database Architecture Specification*
