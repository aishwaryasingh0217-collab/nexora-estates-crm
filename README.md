# 🏢 Nexora Estates — Enterprise Real Estate CRM & Management Analytics

Nexora Estates is a comprehensive, production-ready Real Estate Enterprise CRM and Business Intelligence Platform engineered for property developers, sales organizations, and real estate brokerages. It connects inquiry generation, lead progression, inventory absorption, site visit dispatching, contract bookings, financial milestones, and executive reporting into a unified system.

---

## 🌟 Key Functional Modules

### 1. 📊 Executive Management Reporting & Analytics
- **Live BI Dashboard**: Real-time sales funnel dynamics, stage conversion velocity, and drop-off tracking.
- **Project Inventory Absorption**: Real-time stock status (Available, On Hold, Booked, Sold) and valuation breakdowns.
- **Cashflow & Collections Tracking**: Realized cashflow versus pending and overdue milestone receivables.
- **Agent Revenue Leaderboard**: Closed contract values and sales volume rankings.
- **Automated Export & Scheduling**: Direct CSV/PDF dataset export filtered by date range, project, agent, and acquisition channel.

### 2. 🏗️ Project & Unit Inventory Management
- **Multi-Project Portfolio**: Residential apartments, luxury villas, commercial suites, and plotted developments.
- **Unit Availability Matrix**: Unit pricing, floor plans, carpet/super area specifications, and real-time status indicators.
- **Brochure & Document Management**: Asset uploads and direct digital downloads.

### 3. 👥 Lead Pipeline & SLA Tracking
- **Lifecycle Pipeline**: Fresh Lead → Contacted → Qualified → Site Visit Scheduled → Site Visit Done → In Negotiation → Booking Done → Closed Won / Lost.
- **SLA Follow-up Alerts**: Real-time overdue follow-up flags and priority queues.
- **Multi-Channel Attribution**: Website, Social Media, Google Ads, Facebook Ads, Referrals, and Walk-ins.

### 4. 📅 Interactive Calendar & Site Visit Scheduling
- **Buyer Tour Dispatch**: Scheduling site visits with assigned agents and automated customer notifications.
- **Feedback & Outcome Tracking**: Recording customer interest levels and next-step actions.

### 5. 📑 Deals & Booking Contracts Engine
- **Transactional Booking Protection**: ACID-compliant database locking preventing concurrency double-booking of property units.
- **Financial Breakdown**: Base price, preferred location charges (PLC), parking, taxes, and applied discounts.
- **Legal & Agreement Tracking**: Agreement generation and signing milestones.

### 6. 💳 Payment Receipts & Milestone Collections
- **Cashflow Management**: Multi-mode payment recording (Bank Transfer, Cheque, UPI, Cash, Card).
- **Payment Receipts**: Unique receipt generation with reference/UTR numbers.
- **Milestone Auditing**: Real-time balance calculations against agreed total contract values.

### 7. 🤖 Context-Aware AI Assistant
- **Real-Time CRM Querying**: Connected to MySQL database to answer queries regarding live inventory, leads, deals, and performance.
- **CRM Domain Knowledge**: Pre-trained on real estate pipeline terminology, lifecycle stages, and standard operating procedures.
- **Security Boundary Enforcement**: Strict safeguards preventing disclosure of system credentials, passwords, JWT secrets, or raw SQL.

### 8. 🔔 Persistent Notification Engine
- **Real-Time Alerts**: Overdue follow-ups, low inventory warnings, milestone payment updates, and site visit reminders.
- **Unread Counter & Persistence**: Stored and audited in the database across user sessions.

---

## 🛠️ Technology Stack

- **Backend**: Node.js & Express.js (Modular MVC architecture)
- **Database**: MySQL 8 (Normalized relational schema with foreign key constraints, indexes, and ACID transactions)
- **Frontend**: Vanilla JavaScript (ES6+), Modern Semantic HTML5, and Responsive CSS Architecture (CSS Variables, Flexbox, CSS Grid)
- **Security**: JWT (JSON Web Tokens), `bcryptjs` password hashing, Role-Based Access Control (RBAC), and parameterized SQL queries

---

## 📁 Repository Structure

```
├── backend/
│   ├── config/             # Database connection pool and configuration
│   ├── controllers/        # Business logic for all CRM modules
│   ├── middleware/         # Authentication, RBAC, error handling, file uploads
│   ├── migrations/         # Database migrations
│   ├── routes/             # RESTful API route definitions
│   ├── services/           # AI service, notifications, calendar, messaging
│   └── server.js           # Server entry point
├── database/
│   ├── migrations/         # Versioned SQL migration scripts
│   ├── migrate.js          # Migration runner
│   ├── schema.sql          # Complete DDL relational database schema
│   └── seed_super_admin.js # Super Admin provisioning script
├── docs/                   # Architecture, product blueprint, and requirements
├── public/
│   ├── app.js              # SPA frontend controller, views, and components
│   ├── index.html          # Main HTML entry point
│   └── styles.css          # Design system, themes, typography, and responsive styles
├── .gitignore              # Protected environment and dependency exclusions
└── package.json            # Node.js dependencies and lifecycle scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18.0.0 or higher)
- MySQL Server (v8.0 or higher)
- npm or yarn

### 2. Installation
Clone the repository:
```bash
git clone https://github.com/aishwaryasingh0217-collab/nexora-estates-crm.git
cd nexora-estates-crm
```

Install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=realestate_crm
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### 4. Database Setup

**New customer install (recommended):** one command creates every table and the owner's account with their own password and company name:
```bash
npm run setup        # asks for company name, owner name, email, password
```
Then sign in, add the team under *User Access Control*, and import existing leads from Excel (*Leads → Import*).

**Demo / development:**
```bash
npm run migrate
```

Seed the default Super Admin account, then the sales team, a partner firm and demo leads:
```bash
node database/seed_super_admin.js
npm run seed:workspace
```
`seed:workspace` is safe to re-run — it resets the demo leads to a known state.

Optional settings in `.env` (defaults shown):
```env
APP_TIMEZONE=Asia/Kolkata   # "today", follow-ups and working hours use this clock (hosting is often UTC)
WORK_START_HOUR=9           # follow-ups are never scheduled outside working hours
WORK_END_HOUR=20
CP_PROTECTION_DAYS=60       # how long a partner's registered client stays protected
DEMO_MODE=false             # show the 1-click demo logins on the sign-in page (on by default only when NODE_ENV isn't production)
WEBHOOK_SECRET=             # ad platforms / Zapier send this in the x-webhook-secret header to skip enquiry rate limits
ENQUIRY_MAX_PER_IP=20       # public enquiry limits per 10 minutes (bots get a fake success via a hidden honeypot field)
ENQUIRY_MAX_PER_PHONE=4
VAPID_PUBLIC_KEY=           # optional: phone-alert keys (generated automatically and stored in the database if unset)
VAPID_PRIVATE_KEY=
```

### 5. Running the Application
Start the server:
```bash
npm start
```
Open `http://localhost:5001` in your browser.

### 6. Tests
With the server running:
```bash
npm test          # 93 API checks across every portal (resets demo data before and after)
npm run test:all  # + 24 browser checks at phone and desktop sizes (needs Google Chrome; set CHROME_PATH if not found)
```
Test data is named `ZZ …` and removed by `npm run test:reset`, which refuses to run with `NODE_ENV=production`.

### 7. Going live
- **Serve over HTTPS.** Installing the app on phones and calendar subscriptions both need it.
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and change or delete the demo accounts.
- Point Meta / Google / 99acres lead forms (directly or via Zapier/Pabbly) at `POST /api/leads/webhook`.

### 8. Public sales demo
A demo server lets prospects try every role with the one-click logins.
- In its `.env`: `NODE_ENV=production` and `DEMO_MODE=true`.
- Build it, and rebuild it every night from cron: `npm run demo:reset`. This wipes the database, re-runs the migrations and demo seeds (dates are relative to today), and deletes brochures visitors uploaded. It refuses to run unless `DEMO_MODE=true`.
- In demo mode the shared demo logins can't be switched off or have their role changed; visitors can add their own users to try that.

---

## 🔐 Roles & Portals

Everyone signs in at the same page and lands in the screen built for their job.

| Role | Lands in | What they do |
|---|---|---|
| **SUPER_ADMIN** (builder / owner) | Full CRM | Projects & units (synced live to the public website), users, payments, reports |
| **ADMIN** (sales manager) | Sales Workspace → *Team* | Sees every agent's load, assigns or auto-distributes leads, marks people on leave; can open the full CRM |
| **INSIDE_SALES** (telecaller) | Sales Workspace → *Today* | Works their own queue: new enquiries first, then overdue follow-ups. One tap to call, WhatsApp, log the outcome |
| **OUTSIDE_SALES** (site agent) | Sales Workspace → *Today* | Today's site visits with directions, visit outcome, unit booking |
| **CHANNEL_PARTNER** (broker) | Partner desk | Registers clients (protected for 60 days), requests visits, follows progress, sees commission earned and paid |

Agents and partners only ever see their own leads; the API enforces this (`/api/workspace`, `backend/middleware/accessGate.js`).

Every role gets a **Calendar** (site visits + planned calls; week grid on desktop, day agenda on phones). Managers also get **Reports** (lead-to-booking funnel, sources, team table with average time to first call, lost reasons) and a **live activity feed**.

### How the portals stay in sync
- **Website → CRM:** every form on the public site (the floating *Enquire* button, project pages, call-back, free-cab visit, rentals, early-bird) creates a lead through one intake (`backend/services/enquiryService.js`): de-duplicated by mobile, routed to the telecaller with the fewest open leads, with the Super Admin and Sales Managers notified. A visitor who picks a date gets a real site visit booked with a free site agent. Priority passes, group-buy pools and resale offers create HOT leads too. Share links from an agent or partner (`?ref=`) credit that person.
- **Telecaller → site agent:** when a telecaller fixes a visit, a free site agent conducts it; both see the client, and the telecaller is told how it went.
- **Live:** every screen refreshes within ~15 seconds when anyone changes something it shows (`GET /api/workspace/pulse`), and new notifications pop up.
- **Phone calendars:** *Sync to phone calendar* subscribes iPhone/Mac Calendar, Google Calendar or Outlook to a private feed of the person's visits; each visit also has *Add to calendar*.
- **Every action sets the next one:** logging *No answer* schedules a retry in 3 hours, *Interested* tomorrow 11 am — always inside working hours. Nothing falls through the cracks.
- **Partner ↔ sales team:** partners are notified when a visit is fixed, done or missed and when a booking happens; agents are notified when a partner registers a client or leaves a note. Partners never see the team's private call notes.
- **Booking → commission:** booking a partner's client locks the unit and creates the partner's commission in the same transaction.
- **Leave without guilt:** an agent who switches to *On leave* stops receiving new leads until they're back.

### Demo logins (after `npm run seed:workspace`)
| Role | Username | Password |
|---|---|---|
| Super Admin | `admin` | `AdminPassword123!` |
| Sales Manager | `admin_ops` | `AdminPassword123!` |
| Inside Sales | `telecaller` | `Telecaller123!` |
| Outside Sales | `siteagent` | `Siteagent123!` |
| Channel Partner | `partner` | `Partner123!` |

Change these before going live.

### Everyday tools
- **Phone alerts:** *menu → Turn on phone alerts*. Every notification (new enquiry, visit fixed, visit done, booking…) reaches the person's phone or computer even when the app is closed. On iPhone, add the app to the Home Screen first (iOS 16.4+).
- **Import / export:** managers import leads from Excel or CSV (*Leads → Import*: columns are recognised automatically, duplicates and bad numbers are skipped, leads are shared fairly). Everyone can *Export* what they can see to Excel.
- **Your brand:** the owner sets the company name, logo and sales contact in *menu → Company & branding*; the app, website, installed app name, calendar invites and alerts all use it.

### Install on phones and computers — no app store needed
The app is a Progressive Web App. **Android / Chrome / Edge (Windows, Mac):** tap *Install* in the app or the browser's install icon. **iPhone / iPad:** Safari → Share → *Add to Home Screen*. It opens full-screen like a native app. (A Play Store listing can later be produced from the same code with a Trusted Web Activity wrapper — no rewrite.)

---

## 📄 License
This project is licensed under the [ISC License](LICENSE).
