# REAL ESTATE CRM - PRODUCT BLUEPRINT & ARCHITECTURE SPECIFICATION

> **Phase**: Product Discovery & Blueprint Phase  
> **Status**: Comprehensive Specification Baseline  
> **Target System**: Enterprise International Real Estate CRM Platform  

---

## Tagging Legend

To ensure absolute clarity regarding feature origins, design choices, and business logic:
- `[VERIFIED FROM REFERENCE]`: Functionality, UI layout, or workflow observed on `https://app.realtex.in/realestate-dashboard`.
- `[PROJECT REQUIREMENT]`: Mandated tech stack, role constraints, and core system directives specified by project stakeholders.
- `[PROPOSED DESIGN DECISION]`: Architectural, UI/UX, database design, and visual enhancements added to elevate the platform to an enterprise-grade solution.
- `[NEEDS CONFIRMATION]`: Open business questions and configurable options requiring client/stakeholder sign-off.

---

## 1. Product Overview `[PROJECT REQUIREMENT]`

The **Real Estate CRM** platform is an end-to-end management solution designed for real estate developers, builders, agencies, and sales organizations. It streamlines the lifecycle of real estate operations—from multi-channel lead ingestion (WhatsApp, Facebook Ads, Web Forms), lead nurturing, site visit scheduling, and deal negotiation, to unit inventory allocation, booking workflows, payment tracking, and executive analytics.

### Technical Stack `[PROJECT REQUIREMENT]`
- **Frontend Framework**: React.js (built with Vite for lightning-fast HMR and optimized production bundles).
- **Styling & Design System**: Modern CSS with HSL color tokens, Glassmorphism elements, CSS variables, and Tailwind utility concepts for clean visual hierarchy.
- **Backend Runtime**: Node.js & Express.js RESTful API suite.
- **Database Architecture**: MySQL relational database engine (ACID compliant, foreign keys, transaction support for bookings).
- **Authentication**: Dedicated Login Page + JWT (JSON Web Tokens) + 4-Point Role & Status Verification Pipeline.
- **Real-Time Communication**: Socket.IO for live lead assignment notifications, site visit status updates, and interactive collaborative dashboards `[PROPOSED DESIGN DECISION]`.
- **AI Intelligence**: Floating AI Assistant ("AI Float") for natural language CRM search, lead scoring insights, and instant metrics query `[PROJECT REQUIREMENT]`.

---

## 2. Reference Application Analysis `[VERIFIED FROM REFERENCE]`

Based on automated browser analysis of the reference application (`app.realtex.in`), the system exposes the following structural components:

| Category | Reference Module | Key Features & Elements Observed |
| :--- | :--- | :--- |
| **Executive Overview** | Real Estate Dashboard | KPI cards (Total Units, Available Units, Properties Sold, Deals Won, Revenue, Site Visits, Active Projects, Total Plots, Available Plots, Plots Sold). Lead-to-Sale Funnel chart, Monthly Sales trends. |
| **Lead Operations** | Leads Management | Stage funnel (Incoming, Contacted, Visit Scheduled, Visit Completed, Negotiation, Won, Lost). Source attribution (Form, Direct, Call, Facebook Ads, WhatsApp, Referral). SLA/Due buckets (Overdue, Today, Next 7 Days, Later, No Due Date). |
| **Sales & Pipeline** | Deals Kanban & List | Deal stage progression, deal values, linked lead and unit details, agent assignments. |
| **Inventory & Assets** | Projects, Buildings & Plots | Project breakdown, Building tower management (floors, unit types, square footage), Plot management (plot size, facing, corner unit flags, status). |
| **Omnichannel CRM** | WhatsApp & Facebook Ads | WhatsApp inbox, message templates, mass broadcast campaigns, trigger-based workflow automations. Facebook Lead Ads integration for automated lead ingestion. |
| **Directory & Contacts** | Contact Book | Unified contact list, custom contact grouping, tags, customer interaction history. |
| **Business Intelligence** | Reports Suite (9 Sub-pages) | Stage conversion report, Source ROI report, Due date SLA report, Staff performance leaderboards, Staff activity logs, Telephony call analytics, Site visit summaries. |

---

## 3. Proposed CRM Modules `[PROPOSED DESIGN DECISION]`

Our custom Real Estate CRM will be organized into 9 interconnected core modules:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REAL ESTATE CRM PLATFORM                           │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ 1. Auth &    │ 2. Dashboard │ 3. Inventory │ 4. Lead Engine│ 5. Deals       │
│  Security    │  & BI Suite  │  Matrix      │  & Omnichannel│  & Bookings    │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤
│ 6. Site Visits│ 7. Customer │ 8. WhatsApp &│ 9. AI Float  │ Security &      │
│  & Feedback  │  Directory   │  Marketing   │  Assistant   │ RBAC Middleware │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

1. **Authentication & User Management Engine**: Dedicated login screen (Username/Email, Password, Role Dropdown), 4-point validation backend, Super Admin user management panel (Create Admin, Activate/Deactivate, Revoke Access, Audit Logs).
2. **Executive Dashboard & BI Suite**: Real-time KPI widgets, conversion funnel charts, sales projections, agent leaderboards, project performance filters.
3. **Property & Inventory Matrix**: Interactive project switcher, building/tower floorplan grid, unit availability matrix (Available, Blocked, Reserved, Booked, Sold), Plot management.
4. **Lead Management Engine**: Drag-and-drop Kanban pipeline, table grid with multi-column filtering, source tracking, SLA due date indicators, activity timeline.
5. **Deals & Booking Workflow**: Cost sheet calculator (Base price, PLC charges, GST, maintenance, parking), booking form wizard, milestone payment plans, deal closing.
6. **Site Visit & Field Operations**: Scheduling engine, driver/agent dispatch, GPS check-in support, automated post-visit feedback collection.
7. **Unified Customer Directory**: Contact management, transaction history, document repository (KYC, PAN, agreement drafts).
8. **Omnichannel Communication & Marketing**: WhatsApp template manager, auto-responder workflows, Facebook Ads webhook integration, call log notes.
9. **AI Float Assistant**: Floating contextual UI widget offering instant AI lead summaries, natural language analytics queries, and automated followup drafts.

---

## 4. User Roles `[PROJECT REQUIREMENT]`

The system strictly supports 2 primary user roles:

1. **SUPER ADMIN** `[PROJECT REQUIREMENT]`
   - **Target Persona**: Organization CEO, Managing Director, Project Developer, System Owner.
   - **Access Level**: Full unrestricted access across all modules.
   - **Permissions**: Create, Read, Update, Delete (CRUD) for all entities (Projects, Units, Leads, Deals, Payments, Users, Settings). Exclusive user access management (Create Admin, Activate, Deactivate, Revoke Access).

2. **ADMIN** `[PROJECT REQUIREMENT]`
   - **Target Persona**: Sales Operations Manager, Operational Auditor, Regional Supervisor.
   - **Access Level**: Read-only operational and analytical access.
   - **Permissions**: Search, filter, inspect dashboards, view reports, analyze metrics, view contact directories, inspect inventory status. **Strictly zero mutation capability** (cannot create, update, or delete records; cannot manage users).

---

## 5. Permission Matrix `[PROJECT REQUIREMENT]`

> [!IMPORTANT]
> **Security Mandate**: Role restrictions are enforced at the backend middleware level on every API endpoint. Any unauthorized mutation attempt by an Admin returns **HTTP 403 Forbidden**.

| Module / Endpoint | Super Admin | Admin (Operational) | Backend Security Enforcement |
| :--- | :---: | :---: | :--- |
| `POST /api/v1/auth/login` | Public | Public | 4-Point validation (User, Pass, Active Status, Role Match) |
| `GET /api/v1/dashboard` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `GET /api/v1/leads` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/leads` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `PUT /api/v1/leads/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `DELETE /api/v1/leads/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/inventory` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/inventory/units` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/users` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `POST /api/v1/users` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `PATCH /api/v1/users/:id/status` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `DELETE /api/v1/users/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |

---

## 6. Authentication & Access Control Architecture `[PROJECT REQUIREMENT]`

### Dedicated Login Interface & Validation Engine
- **Login UI Fields**: Username or Email, Password, Role Dropdown (`Super Admin`, `Admin`), Submit Button.
- **Backend 4-Point Verification Pipeline**:
  1. User exists in database.
  2. Password hash matches.
  3. User status is `ACTIVE` (deactivated accounts rejected with `403 Account Deactivated`).
  4. Selected dropdown role matches stored user role in MySQL (role mismatch rejected with `403 Role Mismatch`).
- **Account Deactivation Handling**:
  - Super Admin deactivating an Admin immediately invalidates session/token authorization on subsequent API calls.
  - Frontend interceptor detects `401/403` status, redirects user to login screen with a clear access-revoked notice.
- **Super Admin Creation**: Zero public registration. Initial Super Admin account seeded by system owner; only Super Admin can create subsequent Admin accounts.

---

## 7. Required Business Entities & Database Schema Blueprint `[PROJECT REQUIREMENT]`

```sql
-- Schema Blueprint: MySQL 8.0+

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'SUPER_ADMIN', 'ADMIN'
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    role_id INT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    last_login TIMESTAMP NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) UNIQUE,
    project_type ENUM('RESIDENTIAL', 'COMMERCIAL', 'PLOTTED', 'MIXED') NOT NULL,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    status ENUM('PLANNING', 'UNDER_CONSTRUCTION', 'READY_TO_MOVE', 'COMPLETED') DEFAULT 'UNDER_CONSTRUCTION',
    total_units INT DEFAULT 0,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE buildings (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_floors INT NOT NULL,
    units_per_floor INT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE units (
    id VARCHAR(36) PRIMARY KEY,
    building_id VARCHAR(36) NULL,
    project_id VARCHAR(36) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    floor_number INT,
    unit_type ENUM('1BHK', '2BHK', '3BHK', '4BHK', 'PENTHOUSE', 'PLOT', 'RETAIL', 'OFFICE') NOT NULL,
    carpet_area_sqft DECIMAL(10,2) NOT NULL,
    super_area_sqft DECIMAL(10,2) NOT NULL,
    base_price DECIMAL(14,2) NOT NULL,
    status ENUM('AVAILABLE', 'HOLD', 'BOOKED', 'SOLD') DEFAULT 'AVAILABLE',
    facing ENUM('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST'),
    is_corner_unit BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE leads (
    id VARCHAR(36) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(20) NOT NULL,
    source ENUM('WEBSITE_FORM', 'DIRECT_CALL', 'WHATSAPP', 'FACEBOOK_ADS', 'WALK_IN', 'REFERRAL') NOT NULL,
    stage ENUM('INCOMING', 'CONTACTED', 'VISIT_SCHEDULED', 'VISIT_COMPLETED', 'NEGOTIATION', 'WON', 'LOST') DEFAULT 'INCOMING',
    budget_min DECIMAL(14,2),
    budget_max DECIMAL(14,2),
    preferred_project_id VARCHAR(36),
    assigned_agent_id VARCHAR(36),
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (preferred_project_id) REFERENCES projects(id),
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id)
);

CREATE TABLE site_visits (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    assigned_agent_id VARCHAR(36) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    status ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') DEFAULT 'SCHEDULED',
    client_feedback TEXT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id)
);

CREATE TABLE deals (
    id VARCHAR(36) PRIMARY KEY,
    lead_id VARCHAR(36) NOT NULL,
    unit_id VARCHAR(36) NOT NULL,
    agreed_amount DECIMAL(14,2) NOT NULL,
    booking_amount DECIMAL(14,2) NOT NULL,
    status ENUM('DRAFT', 'BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'CANCELLED') DEFAULT 'DRAFT',
    closing_date DATE,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (unit_id) REFERENCES units(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE user_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    performed_by VARCHAR(36) NOT NULL,
    target_user_id VARCHAR(36) NULL,
    action ENUM('USER_CREATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_UPDATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED') NOT NULL,
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(id)
);
```

---

## 8. Dashboard Requirements `[PROPOSED DESIGN DECISION]`

### Executive Overview View (Super Admin & Admin)
- **Top Metric Cards**: Total Units vs Available Units, Properties/Units Sold & Deals Won, Revenue Realized (₹ Crores), Scheduled vs Completed Site Visits, Active Lead Count & SLA Breach Badge.
- **Analytical Cards & Charts**: Lead-to-Sale Conversion Funnel, Monthly Sales Trend, Source ROI Donut Chart, Staff Performance Leaderboard, Inventory Status Grid.

---

## 9. Analytics Requirements `[VERIFIED FROM REFERENCE]`

9 specialized reporting modules:
1. Executive Summary
2. Lead Acquisition Trends
3. Stage Funnel Breakdown
4. Source ROI Analysis
5. SLA & Due Date Monitoring
6. Staff Performance Leaderboard
7. Staff Activity Log
8. Call & Telephony Analytics
9. Site Visit Breakdown

---

## 10. Navigation Structure `[PROPOSED DESIGN DECISION]`

```
├── Dedicated Login (`/login`)
├── Executive Dashboard (`/`)
├── Property Inventory (`/inventory`)
├── Lead Management (`/leads`)
├── Sales & Deals (`/deals`)
├── Site Visits (`/site-visits`)
├── Omnichannel Hub (`/marketing`)
├── Customer Book (`/contacts`)
├── Reports & BI (`/reports`)
└── System & Users (`/settings`)
    ├── User Management (`/settings/users`) [SUPER_ADMIN ONLY]
    └── System Preferences
```

---

## 11. Final Summary of Authentication & Access Control Rules `[PROJECT REQUIREMENT]`

1. Dedicated Login Page with Username/Email, Password, and Role Dropdown (`Super Admin`, `Admin`).
2. Selecting a role in the dropdown is an assertion, NOT a privilege assignment.
3. Backend validates: (1) User exists, (2) Password correct, (3) Status `ACTIVE`, (4) Selected role matches MySQL stored role.
4. Only Super Admin can manage users (Create, Activate, Deactivate, Revoke Access).
5. Admin role is strictly read-only across operational modules (Dashboards, Search, Filter, Reports). Any mutation attempt returns `HTTP 403 Forbidden`.
6. Deactivating an Admin immediately blocks login and invalidates API tokens. Zero public registration.

---

*End of Product Blueprint & Architecture Specification*
