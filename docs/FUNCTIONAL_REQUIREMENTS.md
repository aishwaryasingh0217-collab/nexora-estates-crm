# REAL ESTATE CRM - FUNCTIONAL REQUIREMENTS SPECIFICATION

> **Document Phase**: Product Discovery & Functional Requirements Phase  
> **Target System**: Enterprise International Real Estate CRM Platform  
> **Status**: Official Final Baseline Specification  

---

## 1. Product Scope

The **Real Estate CRM** is an enterprise-grade platform designed for real estate builders, developers, agencies, and sales teams. The system manages the full lifecycle of real estate operations—from project and tower inventory management, multi-channel lead ingestion, site visit scheduling, and deal negotiation, to milestone booking workflows, payment tracking, and executive analytics.

### Key Objectives:
- Provide a unified real estate inventory matrix (Residential, Commercial, Plotted developments).
- Streamline lead nurturing from initial inquiry to closed booking.
- Enforce strict role-based access control (RBAC) and backend security boundaries.
- Offer data-dense, highly scannable dashboards and business intelligence reporting.
- Present a premium, modern, international visual identity tailored for real estate organizations.

### Technology Stack Definition:
- **Frontend**: React.js built with Vite.
- **Backend**: Node.js + Express.js RESTful APIs.
- **Database**: MySQL relational database engine.
- **Authentication**: JWT (JSON Web Tokens) with backend middleware role verification.
- **Real-Time Communication**: Socket.IO (reserved strictly for genuine real-time requirements such as inventory locks and live lead alerts).

---

## 2. V1 Core Features

The V1 Core release focuses strictly on foundational CRM operations, robust authentication, role security, inventory management, lead tracking, site visits, deals, and reports:

1. **Authentication & Session Engine**: Dedicated login screen with 4-point backend credential & role validation pipeline.
2. **Role-Based Access Control (RBAC)**: Backend middleware enforcing Super Admin vs Admin privilege boundaries.
3. **User Access Management**: Super Admin portal to create, view, update, activate, deactivate, and revoke access for Admin user accounts.
4. **Executive Dashboard**: KPI metrics, conversion funnel visualization, revenue tracking, and inventory availability summaries.
5. **Project & Asset Management**: Creation and inspection of real estate projects, towers/buildings, floor matrices, and unit inventories.
6. **Property / Inventory Matrix**: Visual status grid (`AVAILABLE`, `HOLD`, `BOOKED`, `SOLD`) for units and plots.
7. **Lead Management Engine**: Lead capture, status funnel stages, SLA due date tracking, source tagging, and filterable table grid.
8. **Customer Management**: Central directory of buyer contacts, interaction timelines, and associated deals.
9. **Site Visit Manager**: Scheduling engine for site visits, agent assignment, scheduled dates, and client feedback capture.
10. **Deals & Bookings Workflow**: Cost sheet calculation (Base Price, PLC, Taxes), booking form workflow, and milestone tracking.
11. **Basic Payment Tracking**: Milestone record keeping, payment receipts, and balance due monitoring.
12. **Analytics & Reports Suite**: Core operational reports including Lead Funnel, Source ROI, SLA Overdue, Staff Activity, and Inventory Reports.
13. **Audit & Security Logs**: Comprehensive security logging for user creation, login attempts, access toggles, and status changes.

---

## 3. Phase 2 Features

The following features are classified for **Phase 2** delivery following the successful deployment and stabilization of V1 Core:

1. **WhatsApp CRM Integration**: Native WhatsApp inbox UI, template message broadcasting, and automated response rules.
2. **Facebook Lead Ads Webhooks**: Automated real-time lead ingestion directly from Meta Lead Generation campaigns.
3. **Automated Document Generation**: Automated PDF generation for customer cost sheets, payment receipts, and draft booking agreements.
4. **Advanced Omnichannel Marketing Engine**: Mass email/SMS campaign automation and trigger-based workflow builder.

---

## 4. Future Features

The following features are reserved for future roadmap expansions:

1. **Cloud Telephony Integration**: Click-to-call integration (e.g. Exotel / Telecmi) with call recording logs and agent IVR routing.
2. **Customer Self-Service Portal**: External client portal for buyers to view payment schedules, download receipts, and track construction progress.
3. **Channel Partner / Broker Portal**: External portal for third-party real estate brokers to register leads, track commission, and request unit holds.
4. **Multi-Currency & Internationalization (i18n)**: Support for multi-currency transaction records (`USD`, `EUR`, `AED`, `INR`) and localization options.

---

## 5. Features Requiring Confirmation

The following business requirements require explicit confirmation from stakeholders prior to implementation:

1. **Payment Gateway Integration**: Should V1 support direct online token payment processing (e.g. Razorpay / Stripe) or remain manual receipt entry?
2. **Custom Approval Matrix**: Should discount approvals on unit cost sheets require a formal multi-level Super Admin workflow?
3. **Tower Floorplan Uploads**: Is visual interactive SVG floorplan mapping required, or is a grid matrix of units sufficient for V1?
4. **Physical User Deletion Endpoint**: Is an exceptional physical `DELETE` capability required for compliance/purging, or should physical deletion be fully disabled in favor of `INACTIVE` status?

---

## 6. User Roles

The application strictly defines and enforces **exactly TWO roles**:

### 1. SUPER ADMIN
- **Target Persona**: Builder, Organisation CEO, System Owner.
- **Access Level**: Full unrestricted access across all application modules.
- **Permissions**: Create, Read, Update, Delete (CRUD) for all entities (Projects, Units, Leads, Deals, Payments, User Accounts, System Settings). Exclusive access to User Management (Create, View, Update, Activate, Deactivate, Revoke Access).

### 2. ADMIN
- **Target Persona**: Sales Operations Manager, Analyst, Operational Supervisor.
- **Access Level**: Read-only operational and analysis user.
- **Permissions**: Login, view CRM data, search, filter, view dashboards, view analytics, view reports, inspect inventory, inspect leads, inspect customers, inspect deals, inspect site visits.
- **Strict Boundaries & Restrictions**:
  - ❌ Cannot create records
  - ❌ Cannot update records
  - ❌ Cannot delete records
  - ❌ Cannot create user accounts
  - ❌ Cannot change user roles
  - ❌ Cannot grant or revoke access
  - ❌ Cannot activate or deactivate users
  - ❌ Cannot modify system permissions or configurations

---

## 7. Authentication

### 7.1 Dedicated Login Page
The application must present a dedicated login page prior to granting access to any CRM workspace.

**Login Form Elements**:
1. **Email / Username Field**: Text input accepting registered email address or assigned username.
2. **Password Field**: Masked password input field.
3. **Role Dropdown**: Form dropdown menu containing strictly two options:
   - `Super Admin`
   - `Admin`
4. **Login Submission Button**: Triggers credential validation request to backend authentication endpoint.

---

### 7.2 Backend Authentication Validation Rules

> [!CAUTION]
> **CRITICAL SECURITY RULE**: The UI Role Dropdown is **ONLY** a login-role selector. It is **NOT** a mechanism to assign or elevate privileges. A user must **NOT** gain Super Admin privileges simply by selecting "Super Admin" in the dropdown.

When a login request is submitted, the backend authentication controller must execute a strict 4-point verification pipeline:

```
[Login Payload Received] (username/email, password, selected_role)
           │
           ▼
1. Validate User Existence (Lookup user in MySQL `users` table)
           │ (Fails -> Return HTTP 401 Invalid Credentials)
           ▼
2. Validate Password (Verify hash using bcrypt / Argon2)
           │ (Fails -> Return HTTP 401 Invalid Credentials)
           ▼
3. Validate Account Status (Check `users.status == 'ACTIVE'`)
           │ (Fails -> Return HTTP 403 Account Inactive / Access Revoked)
           ▼
4. Validate Stored Role Match (Check `selected_role == stored_user_role`)
           │ (Fails -> Return HTTP 401/403 Invalid Credentials / Role Mismatch)
           ▼
[Authentication Success] ──► Issue Signed JWT Access Token & Refresh Token
```

#### Validation Failure Example:
- User stored in MySQL: `role = ADMIN`
- User selects in UI dropdown: `Super Admin`
- **Result**: **LOGIN MUST FAIL**. The backend rejects the assertion, returning an authentication failure response.

The frontend must **NEVER** determine authorization by itself. Backend authorization is the sole source of truth.

---

## 8. User Access Management

ONLY **Super Admin** users have access to User Access Management.

### User Account Deletion Rule & Standard Access Revocation Mechanism:
The system must **NOT** use physical database deletion as the normal method of removing an Admin's access. Physical deletion destroys auditability and breaks historical CRM record linking.

The standard access-revocation mechanism is status transition:
$$\text{ACTIVE} \longrightarrow \text{INACTIVE}$$

When a Super Admin revokes an Admin's access:
1. **Set Account Status to INACTIVE**: Update `users.status = 'INACTIVE'`.
2. **Prevent Future Login**: The authentication pipeline immediately blocks login attempts for `INACTIVE` accounts.
3. **Reject Protected API Requests**: Backend authorization middleware rejects requests from inactive users with `HTTP 403 Forbidden`.
4. **Preserve Role and Identity**: The user's stored role, username, email, and identity remain intact in MySQL.
5. **Preserve Historical CRM Records**: All historical CRM activities, leads created, site visits conducted, and deals handled by that user are **fully preserved**.
6. **Record Audit Log Entry**: The access change event is recorded in the security audit log (`USER_DEACTIVATED` / `ACCESS_REVOKED`).

### API Contract for Access Management:
`PATCH /api/v1/users/:id/access`
Supported action payloads:
- `activate`: Sets status to `ACTIVE`.
- `deactivate`: Sets status to `INACTIVE`.
- `revoke access`: Sets status to `INACTIVE` and revokes active sessions.

### Status of Physical `DELETE /api/v1/users/:id`:
The `DELETE /api/v1/users/:id` endpoint must **NOT** be treated as the normal access-revocation mechanism. If retained at all, it is classified as:
- Restricted
- Exceptional
- Subject to explicit business confirmation
- Never used for ordinary access revocation

### V1 Recommended User Access Behavior:

#### SUPER ADMIN Capabilities:
- Create Admin accounts
- View Admin listing and status
- Update Admin user information
- Activate Admin access (`status -> ACTIVE`)
- Deactivate Admin access (`status -> INACTIVE`)
- Revoke Admin access (`status -> INACTIVE`)

#### ADMIN Capabilities:
- ❌ No user-management permissions whatsoever.

---

## 9. Account Status

Every user account in the system must have an explicit account status.

### Supported Statuses:
- `ACTIVE`: Account is active and authorized to log in and access allowed endpoints.
- `INACTIVE`: Account access is deactivated/revoked by Super Admin.

### Deactivation Rules:
If a Super Admin deactivates an Admin user:
1. **Login Denial**: The deactivated user is immediately blocked from logging in.
2. **API Request Rejection**: Protected backend API endpoints verify user status on every request and reject inactive users with `HTTP 403 Forbidden` / `HTTP 401 Unauthorized`.
3. **Session Termination**: Active JWT sessions for deactivated users are invalidated.
4. **Frontend Response**: The frontend redirects the user or displays a clear access-denied message: *"Account deactivated. Please contact your system owner."*
5. **Data Preservation**: The user's role remains stored in MySQL. Historical CRM activity performed by the user (leads handled, site visits logged) is **preserved** and **NEVER deleted**. Account deactivation, not deletion, is the standard method for revoking access.

---

## 10. Permission Matrix

> [!IMPORTANT]
> Backend authorization is enforced through middleware guards on every protected API endpoint. Any unauthorized mutation attempt by an Admin returns **HTTP 403 Forbidden**.

| Endpoint Category / Target Resource | Super Admin | Admin (Operational) | Backend Middleware Guard |
| :--- | :---: | :---: | :--- |
| `POST /api/v1/auth/login` | Public | Public | Public route with 4-point validation |
| `GET /api/v1/dashboard` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `GET /api/v1/projects` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/projects` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/units` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/units` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `PUT /api/v1/units/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/leads` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/leads` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `PUT /api/v1/leads/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `DELETE /api/v1/leads/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/deals` | ✅ Allow | ✅ Allow | `authGuard`, `checkActiveStatus` |
| `POST /api/v1/deals` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `GET /api/v1/users` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `POST /api/v1/users` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `PATCH /api/v1/users/:id/access` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` (Activate/Deactivate/Revoke) |
| `PATCH /api/v1/users/:id` | ✅ Allow | ❌ 403 Forbidden | `authGuard`, `requireRole('SUPER_ADMIN')` |
| `DELETE /api/v1/users/:id` | ⚠️ Restricted | ❌ 403 Forbidden | Exceptional only; NOT for standard access revocation |

---

## 11. Security Requirements

1. **Zero Public Super Admin Registration**: No public sign-up form or open self-registration as Super Admin.
2. **Super Admin Creation Control**: Initial Super Admin account created strictly through controlled setup process by the system owner.
3. **No Self-Promotion**: Admins cannot promote themselves or create Super Admin accounts.
4. **Backend-Enforced Authorization**: Frontend hiding of buttons is for UX only; backend middleware is the sole security authority.
5. **Token Security**: JWT tokens signed using strong secret keys, with expiration and active status checking.

---

## 12. Audit Requirements

User access changes and security events are sensitive operations. The future system must record audit logs for:
- User account created
- User account activated
- User account deactivated
- User role changed (if ever permitted)
- User login success
- User login failure
- User logout
- User access revoked

### Audit Log Record Data Structure (Conceptual):
- `performed_by`: User ID of actor performing the action.
- `target_user`: User ID of affected user account.
- `action`: Specific audit event type code (`USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ACCESS_REVOKED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`).
- `timestamp`: UTC timestamp of event.
- `ip_address`: Client IP address.
- `metadata`: JSON object containing details (e.g. status changed from `ACTIVE` to `INACTIVE`).

---

## 13. Project Management

- **Project Entities**: Support for Residential complexes, Commercial developments, Plotted developments, and Mixed-use projects.
- **Attributes**: Project Name, Code, Type, Location, City, Total Units/Plots, Status (`PLANNING`, `UNDER_CONSTRUCTION`, `READY_TO_MOVE`, `COMPLETED`).
- **Super Admin Actions**: Create project, update project details, archive project.
- **Admin Actions**: View project list, inspect project metrics, search and filter projects.

---

## 14. Property / Inventory Management

### Property Inventory Structure:
```
Project
 └── Building / Tower
      └── Floor
           └── Unit
```

### Supported Asset Categories:
1. **Vertical Units (Residential & Commercial)**:
   - Types: `1BHK`, `2BHK`, `3BHK`, `4BHK`, `PENTHOUSE`, `RETAIL`, `OFFICE`
   - Attributes: Unit Number, Floor Number, Carpet Area (sq.ft.), Super Area (sq.ft.), Base Price, Facing direction, Corner unit flag.
2. **Plots (Land Developments)**:
   - Attributes: Plot Number, Plot Area (sq.ft./sq.yards), Dimensions, Facing, Corner Plot flag, Base Rate per sq.ft.

### Inventory Unit Statuses:
- `AVAILABLE`: Open for booking.
- `HOLD`: Temporarily blocked for customer negotiation (with auto-release timer).
- `BOOKED`: Token amount received, booking form completed.
- `SOLD`: Agreement signed, full payment milestone active.

---

## 15. Lead Management

- **Lead Funnel Stages**:
  1. `INCOMING`: New uncontacted lead inquiry.
  2. `CONTACTED`: Requirements logged (Budget, preferred project, unit type).
  3. `VISIT_SCHEDULED`: Site visit appointment confirmed.
  4. `VISIT_COMPLETED`: Client visited property site.
  5. `NEGOTIATION`: Cost sheet provided, price negotiation in progress.
  6. `WON`: Lead converted to unit booking.
  7. `LOST`: Lead closed without purchase (lost reason logged).
- **Lead Attributes**: First Name, Last Name, Phone, Email, Acquisition Source (`WEBSITE_FORM`, `DIRECT_CALL`, `WHATSAPP`, `FACEBOOK_ADS`, `WALK_IN`, `REFERRAL`), Preferred Project, Budget Min/Max, Assigned Agent, SLA Due Date, Followup Notes.
- **SLA & Due Date Bucketing**: Overdue, Due Today, Next 7 Days, Later, No Due Date.

---

## 16. Customer Management

- **Customer Profile Book**: Consolidated directory of converted buyers and prospects.
- **Attributes**: Full Name, Phone, Email, PAN/Tax ID, Address, KYC Documents, Assigned Representative.
- **History View**: Complete interaction timeline, associated site visits, cost sheet quotes, linked unit bookings, and payment receipts.

---

## 17. Site Visits

- **Visit Management**: Schedule site visit appointments between assigned sales agents and leads.
- **Attributes**: Scheduled Date & Time, Project Location, Assigned Agent, Status (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), Client Feedback Rating (1 to 5 stars), Agent Notes.
- **Reporting**: Site visit completion rates and conversion ratios.

---

## 18. Deals & Bookings

- **Deals Workflow**: Lead progression into formal unit booking.
- **Cost Sheet Calculator**: Automated calculation of:
  - Base Unit Price
  - Preferential Location Charges (PLC - Corner, Garden View, High Floor)
  - Parking Allocation Fees
  - Applicable Statutory Taxes (GST) & Maintenance Deposit
- **Booking Form**: Unit selection, client details, payment schedule selection, token payment record.
- **Deal Statuses**: `DRAFT`, `BOOKED`, `AGREEMENT_SIGNED`, `CLOSED_WON`, `CANCELLED`.

---

## 19. Payment Tracking

- **Milestone Payment Schedule**: Tracking payments tied to construction milestones (e.g. Booking 10%, Foundation 15%, Superstructure 20%, Possession 10%).
- **Payment Record Attributes**: Deal ID, Milestone Name, Due Amount, Due Date, Received Amount, Paid Date, Payment Mode (`CHEQUE`, `BANK_TRANSFER`, `ONLINE`), Reference Number, Status (`PENDING`, `PARTIAL`, `PAID`, `OVERDUE`).
- **Super Admin Actions**: Record payment, issue receipt, update payment milestone.
- **Admin Actions**: View payment schedules, inspect outstanding balances, view payment history.

---

## 20. Dashboard

### Executive Dashboard Features:
- **Top Summary Cards**:
  - Total Units vs Available Units (Progress visualizer)
  - Properties / Units Sold & Deals Won
  - Revenue Realized vs Pipeline Value
  - Scheduled vs Completed Site Visits
  - Active Lead Count & Overdue SLA Alert Badge
- **Analytics Visualizations**:
  - Lead-to-Sale Conversion Funnel Chart
  - Monthly Sales & Revenue Trend Chart
  - Lead Source Distribution Donut Chart
  - Inventory Status Grid (Quick filter by project/tower)

---

## 21. Analytics & Reports

The platform provides 9 core analytical report views:
1. **Executive Summary**: High-level cross-functional KPI overview.
2. **Lead Acquisition Trends**: Lead volume metrics by channel and date range.
3. **Stage Funnel Conversion**: Stage-by-stage drop-off and conversion rates.
4. **Source ROI Analysis**: Sales velocity and conversion efficiency per marketing source.
5. **SLA & Due Date Monitoring**: Overdue follow-up analysis and agent response delays.
6. **Staff Performance Leaderboard**: Sales closed, revenue generated, and response times per staff member.
7. **Staff Activity Logs**: Activity counts (notes added, status updates logged) per user.
8. **Call & Telephony Summaries**: Manual call outcome logs and agent call statistics.
9. **Site Visit Analysis**: Visit completion rates and customer feedback trends.

---

## 22. Real-Time Requirements

- **Socket.IO Real-Time Engine**: Used strictly where genuine real-time synchronization adds clear operational value:
  - **Live Inventory Unit Lock**: Instant update across all active client screens when a unit is placed on hold or booked, preventing double booking.
  - **Live Lead Assignment Toast**: Immediate alert to assigned agent upon new high-priority lead entry.

---

## 23. External Integrations

> [!NOTE]
> All external communications and integrations are classified as **Phase 2** or **Future** roadmap items.

- **WhatsApp Cloud API** (`[PHASE 2]`): Template messaging, inbound webhook chat sync, broadcast campaigns.
- **Facebook Lead Ads API** (`[PHASE 2]`): Direct webhook listener for Meta ad campaigns.
- **Cloud Telephony Gateway** (`[FUTURE]`): Exotel / Telecmi click-to-call and IVR integration.

---

## 24. AI Assistant

> [!NOTE]
> The AI Assistant ("AI Float") is classified as a **Phase 2 / Separate Module** feature to keep V1 Core clean, reliable, and performance-focused.

- **Concept**: Floating AI Assistant widget ("AI Float") providing natural language queries for CRM search (*"Show leads in negotiation for Tower A"*), lead summary generation, and sales query assistance.

---

## 25. Conceptual Database Entities

*Conceptual model for future MySQL schema design:*

1. `roles`: Role definitions (`SUPER_ADMIN`, `ADMIN`).
2. `users`: Identity credentials, stored role, `status` (`ACTIVE`/`INACTIVE`), last login.
3. `user_audit_logs`: Access changes, logins, deactivations, security audit trail.
4. `projects`: Real estate development projects.
5. `buildings`: Towers and building structures linked to projects.
6. `units`: Inventory units (floor, layout, price, status, facing).
7. `leads`: Lead details, stage, source, assigned agent, SLA due date.
8. `customers`: Converted buyer records and KYC data.
9. `site_visits`: Scheduled visits, assigned agent, client feedback rating.
10. `deals`: Unit bookings, agreed pricing, cost sheet totals, deal status.
11. `payments`: Milestone payment schedules, receipts, outstanding balances.

---

## 26. API Requirements

### Authentication & User Management Endpoints:
- `POST /api/v1/auth/login`: 4-point validation login (email/username, password, active status, role match).
- `GET /api/v1/auth/me`: Fetch current user profile and verified role permissions.
- `POST /api/v1/auth/logout`: Invalidate current token session.
- `GET /api/v1/users`: `[SUPER_ADMIN ONLY]` List all users with status and metadata.
- `POST /api/v1/users`: `[SUPER_ADMIN ONLY]` Create new Admin account.
- `PATCH /api/v1/users/:id/access`: `[SUPER_ADMIN ONLY]` Activate, deactivate, or revoke user access (`action`: `activate` | `deactivate` | `revoke`).
- `PATCH /api/v1/users/:id`: `[SUPER_ADMIN ONLY]` Update Admin user information.
- `DELETE /api/v1/users/:id`: `[RESTRICTED / EXCEPTIONAL]` Exceptional hard deletion endpoint (never used for standard access revocation; subject to business confirmation).

### Core CRM Endpoints:
- `GET /api/v1/dashboard`: `[SUPER_ADMIN, ADMIN]` Fetch dashboard metrics and funnel data.
- `GET /api/v1/projects`: `[SUPER_ADMIN, ADMIN]` List projects and towers.
- `POST /api/v1/projects`: `[SUPER_ADMIN ONLY]` Create project.
- `GET /api/v1/units`: `[SUPER_ADMIN, ADMIN]` Query inventory units and floor matrix.
- `POST /api/v1/units`: `[SUPER_ADMIN ONLY]` Create inventory unit.
- `PUT /api/v1/units/:id`: `[SUPER_ADMIN ONLY]` Update unit details or status.
- `GET /api/v1/leads`: `[SUPER_ADMIN, ADMIN]` Search and filter leads.
- `POST /api/v1/leads`: `[SUPER_ADMIN ONLY]` Create lead.
- `PUT /api/v1/leads/:id`: `[SUPER_ADMIN ONLY]` Update lead stage or assignment.
- `DELETE /api/v1/leads/:id`: `[SUPER_ADMIN ONLY]` Delete lead.
- `GET /api/v1/deals`: `[SUPER_ADMIN, ADMIN]` List active deals and booking registry.
- `POST /api/v1/deals`: `[SUPER_ADMIN ONLY]` Create unit booking deal.
- `GET /api/v1/reports/*`: `[SUPER_ADMIN, ADMIN]` Fetch reporting analytics data.

---

## 27. Open Questions

1. **Payment Gateway Integration**: Will V1 rely on manual cheque/bank transfer payment recording, or is online payment gateway integration required?
2. **Initial Seeding**: What is the preferred mechanism for seeding the initial Super Admin account (CLI script vs initial environment variables)?
3. **Report Export Formats**: Is CSV/Excel export required for all report tables in V1?
4. **Physical User Deletion Endpoint**: Should physical `DELETE /api/v1/users/:id` be completely removed from API router or kept behind strict system owner flags?

---

## 28. Final V1 Scope

Below is the concise, definitive list of features to be implemented in **V1 Core**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               FINAL V1 CORE SCOPE                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. Dedicated Login Page (Email/Username, Password, Role Dropdown, Submit Button).│
│ 2. Backend 4-Point Validation Engine (User, Pass, Active Status, Stored Role).   │
│ 3. Express Middleware RBAC Enforcement (HTTP 403 on unauthorized Admin mutation).│
│ 4. Super Admin User Access Management (Create, View, Update, Activate,          │
│    Deactivate, Revoke Access via status change).                                 │
│ 5. Account Status Enforcement (ACTIVE / INACTIVE session rejection & historical │
│    data preservation).                                                           │
│ 6. Executive Overview Dashboard (KPI Cards, Funnel, Sales Trends).              │
│ 7. Project & Building/Tower Inventory Matrix (Unit availability grid).           │
│ 8. Lead Management Engine (Stages, Kanban/List, Filters, SLA due dates).         │
│ 9. Customer Directory & Contact History Book.                                   │
│ 10. Site Visit Scheduling & Feedback Collector.                                  │
│ 11. Deals & Booking Calculator (Cost sheet, milestone payment schedules).        │
│ 12. Basic Payment Tracking (Receipts, outstanding balance logs).                 │
│ 13. Reports Suite (9 analytical report views).                                   │
│ 14. Security Audit Logging (User creation, login attempts, access toggles).     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## USER ACCESS FINAL RULE

"Admin access is revoked through account deactivation/inactivation, not physical deletion, so historical CRM activity remains intact."

---

*End of Functional Requirements Specification*
