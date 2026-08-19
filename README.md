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
Run the database migrations:
```bash
npm run migrate
```

Seed the default Super Admin account:
```bash
node database/seed_super_admin.js
```

### 5. Running the Application
Start the server:
```bash
npm start
```
Open `http://localhost:5001` in your browser.

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **SUPER_ADMIN** | Full system access, user management, audit logs, configuration |
| **SALES_MANAGER** | Team pipeline oversight, approval of deals, executive reports |
| **AGENT** | Assigned leads, site visits, unit lookups, deals recording |

---

## 📄 License
This project is licensed under the [ISC License](LICENSE).
