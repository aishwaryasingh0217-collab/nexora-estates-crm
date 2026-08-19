const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// --------------------------------------------------------------------------
// 1. KNOWLEDGE BASE & DOCUMENTATION CACHE
// --------------------------------------------------------------------------
const knowledgeBase = {
  loaded: false,
  docs: {},
  concepts: {
    lead: {
      title: 'Lead Pipeline & Management',
      definition: 'A **Lead** is a prospective buyer who has expressed interest in properties via marketing campaigns, social media, walk-ins, or referrals. Leads are nurtured through pipeline stages (e.g. *Fresh Lead*, *1st Attempt Done*, *Site Visit Scheduled*, *Booking Done*) until converted into a customer.'
    },
    customer: {
      title: 'Customer Registry & KYC',
      definition: 'A **Customer** is an individual or corporate buyer who has finalized a property unit booking. Customers have verified KYC details (PAN, Aadhaar) and are linked to active **Deals**, payment milestones, and payment receipts in the CRM.'
    },
    project: {
      title: 'Projects & Developments',
      definition: 'A **Project** represents a real estate development (Residential Towers, Plotted Communities, Commercial Parks, or Luxury Villas) with metadata including location, city, RERA registration number, status, and total inventory units.'
    },
    building: {
      title: 'Buildings & Towers',
      definition: 'A **Building / Tower** is a physical structure within a multi-tower project comprising specific floors and residential/commercial units.'
    },
    unit: {
      title: 'Property Units & Inventory',
      definition: 'A **Unit** is an individual sellable asset (e.g. 2BHK, 3BHK, Plot, Penthouse) with attributes like floor number, carpet area, super built-up area, facing, base price, and real-time status (*AVAILABLE*, *HOLD*, *BOOKED*, *SOLD*).'
    },
    site_visit: {
      title: 'Site Visits & Property Tours',
      definition: 'A **Site Visit** is a scheduled in-person or virtual property tour conducted by a sales agent for a lead or customer. Visits are managed in the CRM Calendar and synchronized with Google Calendar.'
    },
    deal: {
      title: 'Deals & Booking Contracts',
      definition: 'A **Deal** represents a legally binding property booking contract between a customer and the development firm, specifying the unit number, agreed total price, payment schedule, and booking date.'
    },
    payment: {
      title: 'Payments & Receipts',
      definition: 'A **Payment** records financial transactions received against an active Deal. Receipts capture the amount received, payment mode (NEFT, RTGS, Cheque, UPI), transaction reference, and realized date.'
    },
    support_ticket: {
      title: 'Support Tickets & Helpdesk',
      definition: 'A **Support Ticket** tracks customer or prospect inquiries and assistance requests. Each ticket has a unique `#TCK-XXXX` identifier, priority level, status, assignee, and staff resolution notes.'
    },
    reports: {
      title: 'Intelligence & Analytics Reports',
      definition: 'The **Reports** suite provides executive business intelligence including Inventory Availability Matrices, Lead Pipeline Conversion Rates, Monthly Revenue Trends, and Staff Performance Analytics.'
    }
  },
  workflows: {
    create_lead: '➕ **How to Create a Lead**:\n1. Click **Leads** in the left sidebar.\n2. Click the **+ Add Lead** button at top right.\n3. Fill in First Name, Mobile Number, Email, Lead Source, Stage, and Assigned Agent.\n4. Click **Save Lead**.',
    schedule_visit: '📅 **How to Schedule a Site Visit**:\n1. Click **Calendar** in the left sidebar.\n2. Click the **+ Schedule Visit** button.\n3. Choose whether the visitor is a **Lead** or **Customer**.\n4. Select the **Project**, scheduled date & time, and the assigned sales agent.\n5. Click **Schedule Visit** to sync with the CRM Calendar.',
    book_unit: '🏢 **How to Book a Property Unit**:\n1. Click **Projects** in the sidebar and select the target project.\n2. Open the specific Building / Tower.\n3. Click on any green **AVAILABLE** unit tile.\n4. Click **Create Deal / Booking**.\n5. Select the buyer (Lead/Customer), enter the agreed total price, and confirm.',
    record_payment: '💳 **How to Record a Payment Receipt**:\n1. Click **Payments** in the left sidebar.\n2. Click **+ Record Payment**.\n3. Select the Deal Number, enter the Amount Received, Payment Mode (NEFT/RTGS/Cheque/UPI), and transaction reference.\n4. Save to generate an instant payment receipt.',
    double_booking: '🔒 **Double-Booking Prevention Architecture**:\nWhen booking a unit, the CRM executes MySQL row-level locking (`SELECT * FROM units WHERE id = ? FOR UPDATE`) inside an ACID transaction. If two agents attempt to book the same unit simultaneously, the second transaction is safely rejected with HTTP 409 Conflict.',
    lead_vs_customer: '⚖️ **Difference Between Lead and Customer**:\n• **Lead**: A prospective inquiry in the nurturing funnel (evaluating properties, not yet committed).\n• **Customer**: A verified buyer who has finalized a unit booking with an official **Deal Number** and payment schedule.',
    where_to_find_leads: '👉 **Where to Find Leads**: Click the **Leads** tab in the left sidebar navigation to view the entire lead pipeline with filters for Name, Phone, Email, Source, and Stage.',
    where_to_find_reports: '👉 **Where to Find Reports**: Click **Reports** in the left sidebar navigation to access Inventory Status, Lead Funnel Analytics, Staff Performance, and Monthly Revenue metrics.',
    how_to_logout: '🚪 **How to Sign Out**: Click the **Sign Out** icon (door icon) located at the bottom-left of the sidebar beside your username profile.',
    why_action_rejected: '⚠️ **Why Was an Action Rejected?**\nCommon reasons include:\n1. **Role Restriction**: You are logged in with the **ADMIN** role (Read-Only Analyst). Unrestricted CRUD mutations require **SUPER_ADMIN**.\n2. **Double Booking**: The unit you selected was already booked or put on hold by another agent.\n3. **Validation Error**: Required fields (e.g. valid phone number, price, date) were missing.'
  }
};

function loadKnowledgeBase() {
  try {
    const docsDir = path.join(__dirname, '../../docs');
    const files = ['DATABASE_ARCHITECTURE.md', 'FUNCTIONAL_REQUIREMENTS.md', 'PRODUCT_BLUEPRINT.md'];
    for (const f of files) {
      const p = path.join(docsDir, f);
      if (fs.existsSync(p)) {
        knowledgeBase.docs[f] = fs.readFileSync(p, 'utf8');
      }
    }
    knowledgeBase.loaded = true;
  } catch (err) {
    console.error('[AI Service]: Failed to load documentation knowledge base:', err.message);
  }
}

// Initialize Knowledge Base on startup
loadKnowledgeBase();

// --------------------------------------------------------------------------
// 2. CONTROLLED LIVE DATABASE QUERY TOOLS (PARAMETERIZED & SAFE)
// --------------------------------------------------------------------------

async function fetchLiveInventoryStats() {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total_units,
      SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
      SUM(CASE WHEN status = 'HOLD' THEN 1 ELSE 0 END) AS hold_units,
      SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units,
      SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units
    FROM units WHERE status != 'ARCHIVED'
  `);
  return rows[0] || {};
}

async function fetchLiveProjectsSummary(filters = {}) {
  let sql = `
    SELECT p.id, p.name, p.code, p.project_type, p.location, p.city, p.status, p.total_units,
           SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
           SUM(CASE WHEN u.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units
    FROM projects p
    LEFT JOIN units u ON p.id = u.project_id
    WHERE p.status != 'ARCHIVED'
  `;
  const params = [];

  if (filters.city) {
    sql += ` AND p.city LIKE ?`;
    params.push(`%${filters.city}%`);
  }
  if (filters.projectType) {
    sql += ` AND p.project_type LIKE ?`;
    params.push(`%${filters.projectType}%`);
  }
  if (filters.name) {
    sql += ` AND p.name LIKE ?`;
    params.push(`%${filters.name}%`);
  }

  sql += ` GROUP BY p.id, p.name, p.code, p.project_type, p.location, p.city, p.status, p.total_units ORDER BY p.name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Searches units with accurate LEFT JOIN on buildings so plotted and independent
 * units (where building_id IS NULL) are correctly included.
 */
async function searchUnits(filters = {}) {
  let sql = `
    SELECT u.unit_number, u.unit_type, u.floor_number, u.super_area_sqft, u.carpet_area_sqft,
           u.plot_area_sqft, u.plot_dimensions, u.base_price, u.status, u.facing, u.asset_category,
           b.name AS building_name, p.name AS project_name, p.city, p.location
    FROM units u
    JOIN projects p ON u.project_id = p.id
    LEFT JOIN buildings b ON u.building_id = b.id
    WHERE u.status != 'ARCHIVED'
  `;
  const params = [];

  if (filters.status) {
    sql += ` AND u.status = ?`;
    params.push(filters.status);
  } else {
    sql += ` AND u.status = 'AVAILABLE'`;
  }

  if (filters.unitType) {
    sql += ` AND u.unit_type LIKE ?`;
    params.push(`%${filters.unitType}%`);
  }

  if (filters.city) {
    sql += ` AND (p.city LIKE ? OR p.location LIKE ?)`;
    params.push(`%${filters.city}%`, `%${filters.city}%`);
  }

  if (filters.project) {
    sql += ` AND p.name LIKE ?`;
    params.push(`%${filters.project}%`);
  }

  if (filters.maxPrice) {
    sql += ` AND u.base_price <= ?`;
    params.push(filters.maxPrice);
  }

  if (filters.minPrice) {
    sql += ` AND u.base_price >= ?`;
    params.push(filters.minPrice);
  }

  if (filters.sortBy === 'CHEAPEST' || filters.sortBy === 'ASC') {
    sql += ` ORDER BY u.base_price ASC`;
  } else if (filters.sortBy === 'EXPENSIVE' || filters.sortBy === 'DESC') {
    sql += ` ORDER BY u.base_price DESC`;
  } else {
    sql += ` ORDER BY u.base_price ASC`;
  }

  sql += ` LIMIT 15`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function searchLeads(filters = {}) {
  let sql = `
    SELECT l.id, l.first_name, l.last_name, l.phone, l.email, l.source, l.stage,
           l.budget_min, l.budget_max, l.sla_due_date,
           u.first_name AS agent_first_name, u.last_name AS agent_last_name
    FROM leads l
    LEFT JOIN users u ON l.assigned_agent_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.name) {
    sql += ` AND (l.first_name LIKE ? OR l.last_name LIKE ? OR CONCAT(l.first_name, ' ', l.last_name) LIKE ?)`;
    params.push(`%${filters.name}%`, `%${filters.name}%`, `%${filters.name}%`);
  }
  if (filters.phone) {
    sql += ` AND l.phone LIKE ?`;
    params.push(`%${filters.phone}%`);
  }
  if (filters.email) {
    sql += ` AND l.email LIKE ?`;
    params.push(`%${filters.email}%`);
  }
  if (filters.stage) {
    sql += ` AND l.stage LIKE ?`;
    params.push(`%${filters.stage}%`);
  }
  if (filters.source) {
    sql += ` AND l.source LIKE ?`;
    params.push(`%${filters.source}%`);
  }
  if (filters.overdueOnly) {
    sql += ` AND l.sla_due_date < CURDATE() AND l.stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST')`;
  }

  sql += ` ORDER BY l.created_at DESC LIMIT 15`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function fetchCustomerSummary() {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total_customers,
      COUNT(DISTINCT city) AS total_cities
    FROM customers
  `);
  return rows[0] || {};
}

async function searchCustomers(filters = {}) {
  let sql = `
    SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.city, c.pan_tax_id,
           COUNT(d.id) AS total_deals,
           COALESCE(SUM(d.agreed_total_amount), 0) AS total_spent
    FROM customers c
    LEFT JOIN deals d ON c.id = d.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.name) {
    sql += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?)`;
    params.push(`%${filters.name}%`, `%${filters.name}%`, `%${filters.name}%`);
  }
  if (filters.phone) {
    sql += ` AND c.phone LIKE ?`;
    params.push(`%${filters.phone}%`);
  }
  if (filters.email) {
    sql += ` AND c.email LIKE ?`;
    params.push(`%${filters.email}%`);
  }

  sql += ` GROUP BY c.id, c.first_name, c.last_name, c.phone, c.email, c.city, c.pan_tax_id ORDER BY c.created_at DESC LIMIT 15`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function fetchSiteVisits(filters = {}) {
  let sql = `
    SELECT sv.id, sv.scheduled_time, sv.status, sv.client_feedback, sv.rating,
           p.name AS project_name, p.city AS project_city,
           COALESCE(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')), CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))) AS visitor_name,
           u.first_name AS agent_first_name, u.last_name AS agent_last_name
    FROM site_visits sv
    JOIN projects p ON sv.project_id = p.id
    LEFT JOIN customers c ON sv.customer_id = c.id
    LEFT JOIN leads l ON sv.lead_id = l.id
    LEFT JOIN users u ON sv.assigned_agent_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.project) {
    sql += ` AND p.name LIKE ?`;
    params.push(`%${filters.project}%`);
  }
  if (filters.status) {
    sql += ` AND sv.status = ?`;
    params.push(filters.status);
  }
  if (filters.todayOnly) {
    sql += ` AND DATE(sv.scheduled_time) = CURDATE()`;
  }

  sql += ` ORDER BY sv.scheduled_time DESC LIMIT 15`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function fetchLiveLeadSummary() {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total_leads,
      SUM(CASE WHEN stage = 'Fresh Lead' OR stage = 'INCOMING' THEN 1 ELSE 0 END) AS fresh_leads,
      SUM(CASE WHEN stage LIKE '%Attempt%' OR stage = 'CONTACTED' THEN 1 ELSE 0 END) AS in_contact,
      SUM(CASE WHEN stage LIKE '%Visit%' OR stage = 'VISIT_SCHEDULED' THEN 1 ELSE 0 END) AS visit_scheduled,
      SUM(CASE WHEN stage = 'Booking Done' OR stage = 'WON' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage = 'Lost' OR stage = 'LOST' THEN 1 ELSE 0 END) AS lost,
      SUM(CASE WHEN sla_due_date < CURDATE() AND stage NOT IN ('Booking Done', 'WON', 'Lost', 'LOST') THEN 1 ELSE 0 END) AS overdue
    FROM leads
  `);
  return rows[0] || {};
}

async function fetchLiveRevenueStats() {
  const [[dealRows]] = await pool.query(`
    SELECT COUNT(*) AS total_deals, COALESCE(SUM(agreed_total_amount), 0) AS pipeline_total 
    FROM deals WHERE status IN ('BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON')
  `);
  const [[payRows]] = await pool.query('SELECT COUNT(*) AS total_payments, COALESCE(SUM(amount_received), 0) AS total_realized FROM payments');
  return {
    total_deals: dealRows.total_deals || 0,
    pipeline_total: dealRows.pipeline_total || 0,
    total_payments: payRows.total_payments || 0,
    total_realized: payRows.total_realized || 0
  };
}

async function fetchSupportTicketsSummary() {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total_tickets,
      SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_tickets,
      SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_tickets,
      SUM(CASE WHEN priority = 'URGENT' OR priority = 'HIGH' THEN 1 ELSE 0 END) AS high_priority_tickets
    FROM support_tickets
  `);
  return rows[0] || {};
}

// --------------------------------------------------------------------------
// 3. INTENT CLASSIFICATION & NATURAL LANGUAGE UNDERSTANDING (NLU) ENGINE
// --------------------------------------------------------------------------

/**
 * Analyzes natural user questions, accounting for phrasing variations, synonyms,
 * budget amounts, BHK types, cities, and conversation context.
 */
function classifyUserIntent(query, conversationHistory = []) {
  const q = query.toLowerCase().trim();

  // 1. Security & Protection Check
  const securityTerms = [
    'password', 'password_hash', 'jwt', 'jwt_secret', 'secret', 'secret_key',
    'api_key', 'token_secret', 'database_password', 'db_password', 'drop table',
    'delete from', 'select * from users', 'api token', 'credential'
  ];
  if (securityTerms.some(t => q.includes(t))) {
    return { type: 'SECURITY_SHIELD' };
  }

  // 2. Human Support Escalation Request
  if (q.includes('human') || q.includes('talk to support') || q.includes('talk to agent') || q.includes('speak to person') || q.includes('raise a ticket') || q.includes('contact support') || q.includes('help desk') || q.includes('customer care')) {
    return { type: 'HUMAN_SUPPORT' };
  }

  // 3. Conceptual & Workflow Questions (No DB lookup needed)
  if (q.includes('difference between') && (q.includes('lead') || q.includes('customer'))) {
    return { type: 'CRM_WORKFLOW', key: 'lead_vs_customer' };
  }
  if ((q.includes('what is a lead') || q.includes('what is lead') || q.includes('explain lead') || q.includes('meaning of lead'))) {
    return { type: 'CRM_CONCEPT', key: 'lead' };
  }
  if ((q.includes('what is a customer') || q.includes('what is customer') || q.includes('explain customer'))) {
    return { type: 'CRM_CONCEPT', key: 'customer' };
  }
  if ((q.includes('what is a project') || q.includes('what is project'))) {
    return { type: 'CRM_CONCEPT', key: 'project' };
  }
  if ((q.includes('what is a unit') || q.includes('what is unit'))) {
    return { type: 'CRM_CONCEPT', key: 'unit' };
  }
  if ((q.includes('what is a site visit') || q.includes('what is site visit'))) {
    return { type: 'CRM_CONCEPT', key: 'site_visit' };
  }
  if ((q.includes('what is a deal') || q.includes('what is deal') || q.includes('deals & bookings mean'))) {
    return { type: 'CRM_CONCEPT', key: 'deal' };
  }
  if ((q.includes('what is a payment') || q.includes('what is payment'))) {
    return { type: 'CRM_CONCEPT', key: 'payment' };
  }

  // Workflow instructions
  if ((q.includes('create a lead') || q.includes('add a lead') || q.includes('new lead') || q.includes('register a lead') || q.includes('enter a lead') || q.includes('put someone into the lead'))) {
    return { type: 'CRM_WORKFLOW', key: 'create_lead' };
  }
  if ((q.includes('schedule a site visit') || q.includes('schedule a visit') || q.includes('book a visit') || q.includes('schedule visit') || q.includes('set up a visit') || q.includes('book a tour'))) {
    return { type: 'CRM_WORKFLOW', key: 'schedule_visit' };
  }
  if ((q.includes('book a unit') || q.includes('book unit') || q.includes('create a deal') || q.includes('reserve a unit') || q.includes('how to book'))) {
    return { type: 'CRM_WORKFLOW', key: 'book_unit' };
  }
  if ((q.includes('record a payment') || q.includes('add a payment') || q.includes('enter payment') || q.includes('record payment'))) {
    return { type: 'CRM_WORKFLOW', key: 'record_payment' };
  }
  if ((q.includes('double booking') || q.includes('prevent double') || q.includes('concurrency') || q.includes('row locking'))) {
    return { type: 'CRM_WORKFLOW', key: 'double_booking' };
  }
  if ((q.includes('where do i find leads') || q.includes('where are leads') || q.includes('see leads') || q.includes('lead pipeline location'))) {
    return { type: 'CRM_WORKFLOW', key: 'where_to_find_leads' };
  }
  if ((q.includes('where are reports') || q.includes('where do i find reports') || q.includes('see reports'))) {
    return { type: 'CRM_WORKFLOW', key: 'where_to_find_reports' };
  }
  if ((q.includes('how do i log out') || q.includes('how to logout') || q.includes('sign out') || q.includes('log off'))) {
    return { type: 'CRM_WORKFLOW', key: 'how_to_logout' };
  }
  if ((q.includes("why can't i edit") || q.includes('why was my action rejected') || q.includes('action failed') || q.includes('permission denied'))) {
    return { type: 'CRM_WORKFLOW', key: 'why_action_rejected' };
  }
  if ((q.includes('role') || q.includes('permission') || q.includes('super admin vs admin') || q.includes('access level'))) {
    return { type: 'CRM_RBAC_INFO' };
  }

  // 4. Live CRM Data Queries (Intelligent Extraction)

  // Follow-up context extraction from previous turn
  let previousTopic = null;
  if (conversationHistory.length > 0) {
    const lastUserTurn = [...conversationHistory].reverse().find(m => m.sender === 'user');
    if (lastUserTurn) {
      const prev = lastUserTurn.text.toLowerCase();
      if (prev.includes('unit') || prev.includes('3bhk') || prev.includes('2bhk') || prev.includes('apartment') || prev.includes('inventory') || prev.includes('available')) previousTopic = 'UNITS';
      else if (prev.includes('lead') || prev.includes('prospect')) previousTopic = 'LEADS';
      else if (prev.includes('project')) previousTopic = 'PROJECTS';
      else if (prev.includes('visit') || prev.includes('calendar')) previousTopic = 'VISITS';
    }
  }

  // A. Cheapest / Price Sorting Follow-up or Direct Query
  if (q.includes('cheapest') || q.includes('lowest price') || q.includes('least expensive') || q.includes('most affordable') || (previousTopic === 'UNITS' && q.includes('cheap'))) {
    return { type: 'LIVE_DATA', tool: 'SEARCH_UNITS', filters: { sortBy: 'CHEAPEST', status: 'AVAILABLE', singleTarget: true } };
  }

  // B. Unit / Inventory Searches (BHK, City, Budget, Project, Plots, Villas)
  if (
    q.includes('unit') || q.includes('bhk') || q.includes('flat') || q.includes('apartment') ||
    q.includes('villa') || q.includes('plot') || q.includes('inventory') || q.includes('available') ||
    q.includes('crore') || q.includes('lakh') || q.includes('cr') || q.includes('budget') ||
    (previousTopic === 'UNITS' && (q.includes('bangalore') || q.includes('mumbai') || q.includes('hyderabad')))
  ) {
    const filters = { status: 'AVAILABLE' };

    // BHK / Asset Type Extraction
    if (q.includes('1bhk') || q.includes('1 bhk')) filters.unitType = '1BHK';
    else if (q.includes('2bhk') || q.includes('2 bhk')) filters.unitType = '2BHK';
    else if (q.includes('3bhk') || q.includes('3 bhk')) filters.unitType = '3BHK';
    else if (q.includes('4bhk') || q.includes('4 bhk')) filters.unitType = '4BHK';
    else if (q.includes('plot')) filters.unitType = 'PLOT';
    else if (q.includes('villa')) filters.unitType = 'VILLA';

    // City Extraction
    if (q.includes('bangalore') || q.includes('bengaluru')) filters.city = 'Bangalore';
    else if (q.includes('mumbai')) filters.city = 'Mumbai';
    else if (q.includes('hyderabad')) filters.city = 'Hyderabad';
    else if (q.includes('hubli')) filters.city = 'Hubli';

    // Project Name Extraction
    if (q.includes('greenfield')) filters.project = 'Greenfield';
    else if (q.includes('palm springs')) filters.project = 'Palm Springs';
    else if (q.includes('horizon')) filters.project = 'Horizon';

    // Budget Extraction (e.g. "1 crore", "80 lakhs", "1.5 cr", "around 1 crore", "under 1 crore")
    if (q.includes('crore') || q.includes('cr')) {
      const match = q.match(/(\d+(\.\d+)?)\s*(crore|cr)/);
      if (match) filters.maxPrice = parseFloat(match[1]) * 10000000;
    } else if (q.includes('lakh') || q.includes('lac')) {
      const match = q.match(/(\d+(\.\d+)?)\s*(lakh|lac|l)/);
      if (match) filters.maxPrice = parseFloat(match[1]) * 100000;
    }

    // If query is specifically about aggregate inventory overview (e.g. "how many units are available?", "inventory stats")
    if (q.includes('how many') && !filters.unitType && !filters.city && !filters.project && !filters.maxPrice) {
      return { type: 'LIVE_DATA', tool: 'INVENTORY_STATS' };
    }

    return { type: 'LIVE_DATA', tool: 'SEARCH_UNITS', filters };
  }

  // C. Projects List & Lookups
  if (q.includes('project') || q.includes('tower') || q.includes('developments')) {
    const filters = {};
    if (q.includes('bangalore') || q.includes('bengaluru')) filters.city = 'Bangalore';
    else if (q.includes('mumbai')) filters.city = 'Mumbai';
    else if (q.includes('hyderabad')) filters.city = 'Hyderabad';

    if (q.includes('how many') || q.includes('total') || q.includes('list') || q.includes('all') || q.includes('active') || q.includes('summary') || q.includes('are there')) {
      return { type: 'LIVE_DATA', tool: 'PROJECTS_SUMMARY', filters };
    }

    const match = q.match(/(find|search|show|named|about|for)\s+([a-zA-Z0-9\s]+)/i);
    if (match && !['project', 'projects', 'all', 'active'].includes(match[2].toLowerCase().trim())) {
      const cleanName = match[2].replace(/project|projects/gi, '').trim();
      if (cleanName.length > 1) filters.name = cleanName;
    }
    return { type: 'LIVE_DATA', tool: 'PROJECTS_SUMMARY', filters };
  }

  // D. Leads Lookup & Funnel Summary
  if (q.includes('lead') || q.includes('prospect') || (previousTopic === 'LEADS' && (q.includes('overdue') || q.includes('how many')))) {
    if (q.includes('overdue') || q.includes('sla')) {
      return { type: 'LIVE_DATA', tool: 'SEARCH_LEADS', filters: { overdueOnly: true } };
    }

    if (q.includes('how many') || q.includes('summary') || q.includes('funnel') || q.includes('pipeline') || q.includes('who are the leads') || q.includes('all leads') || q.includes('status of leads') || q.includes('do we have')) {
      return { type: 'LIVE_DATA', tool: 'LEAD_SUMMARY' };
    }

    const stripped = q.replace(/(find|search|show|details of|details|named|name|for|about|me|the|all|a|our|who is|who are|lead|leads|pipeline|in)\b/gi, '').trim();
    if (stripped.length >= 2 && !['funnel', 'status', 'summary', 'stages', 'list', 'how many', 'do we have', 'are there'].includes(stripped)) {
      return { type: 'LIVE_DATA', tool: 'SEARCH_LEADS', filters: { name: stripped } };
    }

    return { type: 'LIVE_DATA', tool: 'LEAD_SUMMARY' };
  }

  // E. Customers Lookup
  if (q.includes('customer') || q.includes('buyer') || q.includes('who bought')) {
    if (q.includes('how many') || q.includes('total customer') || q.includes('customer count')) {
      return { type: 'LIVE_DATA', tool: 'CUSTOMER_SUMMARY' };
    }

    const stripped = q.replace(/(find|search|show|details of|details|named|name|for|about|me|the|all|a|our|customer|customers|buyer|who bought|who is)\b/gi, '').trim();
    if (stripped.length >= 2 && !['all', 'list', 'status', 'summary', 'how many'].includes(stripped)) {
      return { type: 'LIVE_DATA', tool: 'SEARCH_CUSTOMERS', filters: { name: stripped } };
    }
    return { type: 'LIVE_DATA', tool: 'SEARCH_CUSTOMERS', filters: {} };
  }

  // F. Site Visits & Calendar Schedule
  if (q.includes('visit') || q.includes('tour') || q.includes('appointment') || q.includes('calendar schedule')) {
    const filters = {};
    if (q.includes('today')) filters.todayOnly = true;
    if (q.includes('greenfield')) filters.project = 'Greenfield';
    return { type: 'LIVE_DATA', tool: 'SITE_VISITS', filters };
  }

  // G. Revenue, Deals & Payments
  if (q.includes('revenue') || q.includes('collection') || q.includes('payment') || q.includes('deal') || q.includes('financial') || q.includes('money') || q.includes('sales total')) {
    return { type: 'LIVE_DATA', tool: 'REVENUE_STATS' };
  }

  // H. Support Tickets
  if (q.includes('ticket') || q.includes('helpdesk') || q.includes('support status')) {
    return { type: 'LIVE_DATA', tool: 'SUPPORT_TICKETS' };
  }

  // I. Greetings
  if (q === 'hi' || q === 'hello' || q === 'hey' || q === 'help' || q === 'good morning' || q === 'good afternoon') {
    return { type: 'GREETING' };
  }

  return { type: 'UNKNOWN' };
}

// --------------------------------------------------------------------------
// 4. MAIN DISPATCHER & RESPONSE GENERATOR
// --------------------------------------------------------------------------

/**
 * Handles incoming chat messages, performs safe intent resolution, routes to
 * live database tools or documentation knowledge, and returns a verified Markdown reply.
 */
async function processChatMessage(userMessage, userRole = 'ADMIN', conversationHistory = []) {
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    throw new Error('Message prompt cannot be empty.');
  }

  const query = userMessage.trim();
  const intent = classifyUserIntent(query, conversationHistory);

  // 1. Security Boundary Shield
  if (intent.type === 'SECURITY_SHIELD') {
    return {
      reply: '🛡️ **Security Boundary Enforcement**: Access to system credentials, database passwords, JWT signing secrets, API keys, and raw SQL queries is strictly restricted and cannot be disclosed.',
      source: 'SECURITY_SHIELD'
    };
  }

  // 2. Human Support Escalation Fallback
  if (intent.type === 'HUMAN_SUPPORT') {
    return {
      reply: '🎫 **Human Support & Helpdesk**:\nIf you require assistance from a human support representative or system administrator, please navigate to the **Support Tickets** section in the left sidebar to submit a ticket. Our support desk will review and attend to your request.',
      source: 'SUPPORT_FALLBACK'
    };
  }

  // 3. RBAC Information & Guardrails
  if (intent.type === 'CRM_RBAC_INFO') {
    return {
      reply: `👥 **Role-Based Access Control (RBAC)**:\n• **SUPER_ADMIN**: Full unrestricted CRUD permissions across all modules (Projects, Units, Leads, Deals, Payments, Support Tickets, and User Access Management).\n• **ADMIN**: Operational read-only analyst access. Can inspect dashboards, pipeline metrics, reports, and property inventory, but cannot perform destructive mutations.\n\n*Your current session access level:* **${userRole}**`,
      source: 'CRM_ARCHITECTURE'
    };
  }

  // 4. CRM Concepts (Documentation Knowledge)
  if (intent.type === 'CRM_CONCEPT') {
    const c = knowledgeBase.concepts[intent.key];
    if (c) {
      return {
        reply: `📘 **${c.title}**\n\n${c.definition}`,
        source: 'DOCUMENTATION_KNOWLEDGE_BASE'
      };
    }
  }

  // 5. CRM Workflow Instructions (Documentation Knowledge)
  if (intent.type === 'CRM_WORKFLOW') {
    const text = knowledgeBase.workflows[intent.key];
    if (text) {
      return {
        reply: text,
        source: 'DOCUMENTATION_KNOWLEDGE_BASE'
      };
    }
  }

  // 6. Live Database Tools Execution
  if (intent.type === 'LIVE_DATA') {
    try {
      switch (intent.tool) {
        case 'INVENTORY_STATS': {
          const stats = await fetchLiveInventoryStats();
          return {
            reply: `📊 **Live CRM Inventory Overview**:\n- **Total Units**: ${stats.total_units || 0}\n- **Available**: ${stats.available_units || 0} units\n- **On Hold**: ${stats.hold_units || 0} units\n- **Booked**: ${stats.booked_units || 0} units\n- **Sold**: ${stats.sold_units || 0} units`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'PROJECTS_SUMMARY': {
          const projects = await fetchLiveProjectsSummary(intent.filters);
          if (projects.length === 0) {
            return {
              reply: '🏢 No matching projects found in the CRM directory.',
              source: 'LIVE_DATABASE'
            };
          }
          const list = projects.map(p => `- **${p.name}** (${p.code}): ${p.project_type} in ${p.city} | Status: *${p.status}* | **${p.available_units || 0}/${p.total_units} Available**`).join('\n');
          return {
            reply: `🏢 **Active Real Estate Projects Summary** (${projects.length} projects):\n\n${list}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'SEARCH_UNITS': {
          const units = await searchUnits(intent.filters);
          if (units.length === 0) {
            let filterDesc = [];
            if (intent.filters.unitType) filterDesc.push(intent.filters.unitType);
            if (intent.filters.city) filterDesc.push(`in ${intent.filters.city}`);
            if (intent.filters.maxPrice) filterDesc.push(`under ₹${Number(intent.filters.maxPrice).toLocaleString()}`);
            const desc = filterDesc.length > 0 ? ` matching ${filterDesc.join(' ')}` : '';
            return {
              reply: `ℹ️ No available property units${desc} were found in the live database. All matching units may currently be booked or on hold.`,
              source: 'LIVE_DATABASE'
            };
          }

          if (intent.filters.singleTarget || (intent.filters.sortBy === 'CHEAPEST' && units.length > 0)) {
            const u = units[0];
            return {
              reply: `🏷️ **Cheapest Available Unit**:\n- **Unit**: ${u.unit_number} (${u.unit_type})\n- **Project**: ${u.project_name} (${u.building_name || 'Plotted / Independent'}, ${u.city})\n- **Floor**: ${u.floor_number || '-'}\n- **Area**: ${u.super_area_sqft || u.carpet_area_sqft || u.plot_area_sqft || '-'} sq.ft.\n- **Base Price**: **₹${Number(u.base_price).toLocaleString()}**`,
              source: 'LIVE_DATABASE'
            };
          }

          const list = units.map(u => `- **Unit ${u.unit_number}** (${u.unit_type}) in *${u.project_name}* (${u.city}) | ${u.building_name ? `${u.building_name} (Floor ${u.floor_number})` : 'Plotted / Independent'} | ${u.super_area_sqft || u.carpet_area_sqft || u.plot_area_sqft || '-'} sq.ft. | **₹${Number(u.base_price).toLocaleString()}**`).join('\n');
          return {
            reply: `🏠 **Available Property Units** (${units.length} found):\n\n${list}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'SEARCH_LEADS': {
          const leads = await searchLeads(intent.filters);
          if (leads.length === 0) {
            return {
              reply: `🔍 No leads found matching your criteria in the database. Please verify the name or stage in the Leads section.`,
              source: 'LIVE_DATABASE'
            };
          }
          const list = leads.map(l => `👤 **${l.first_name} ${l.last_name || ''}**\n• Phone: ${l.phone || '-'}\n• Email: ${l.email || '-'}\n• Stage: *${l.stage}*\n• Source: ${l.source}\n• Assigned Agent: ${l.agent_first_name ? `${l.agent_first_name} ${l.agent_last_name || ''}` : 'Unassigned'}`).join('\n\n');
          return {
            reply: `🎯 **Lead Pipeline Search Results** (${leads.length} found):\n\n${list}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'LEAD_SUMMARY': {
          const leads = await fetchLiveLeadSummary();
          return {
            reply: `🎯 **Lead Pipeline Funnel Summary**:\n- **Total Inquiries**: ${leads.total_leads || 0}\n- **Fresh Leads**: ${leads.fresh_leads || 0}\n- **In Contact / Attempt Done**: ${leads.in_contact || 0}\n- **Site Visits Scheduled**: ${leads.visit_scheduled || 0}\n- **Won / Booked Deals**: ${leads.won || 0}\n- **Lost / Junk**: ${leads.lost || 0}\n- **SLA Overdue Follow-ups**: ${leads.overdue || 0}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'CUSTOMER_SUMMARY': {
          const custSummary = await fetchCustomerSummary();
          return {
            reply: `👥 **Customer Registry Overview**:\n- **Total Registered Customers**: ${custSummary.total_customers || 0}\n- **Customer Geographic Reach**: Across ${custSummary.total_cities || 0} cities`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'SEARCH_CUSTOMERS': {
          const custs = await searchCustomers(intent.filters);
          if (custs.length === 0) {
            return {
              reply: `🔍 No customer records found matching your search.`,
              source: 'LIVE_DATABASE'
            };
          }
          const list = custs.map(c => `👤 **${c.first_name} ${c.last_name || ''}**\n• Phone: ${c.phone}\n• Email: ${c.email}\n• City: ${c.city || '-'}\n• Active Deals: ${c.total_deals} | Total Value: ₹${Number(c.total_spent).toLocaleString()}`).join('\n\n');
          return {
            reply: `👥 **Customer Registry Results** (${custs.length} found):\n\n${list}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'SITE_VISITS': {
          const visits = await fetchSiteVisits(intent.filters);
          if (visits.length === 0) {
            return {
              reply: '📅 **Site Visits & Tours**: There are currently no matching site visits scheduled. You can schedule a visit from the **Calendar** view.',
              source: 'LIVE_DATABASE'
            };
          }
          const list = visits.map(v => {
            const dt = new Date(v.scheduled_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            return `📍 **${v.project_name}** (${v.project_city})\n• Visitor: **${v.visitor_name || 'Prospect'}**\n• Date/Time: ${dt}\n• Status: *${v.status}*\n• Assigned Agent: ${v.agent_first_name ? `${v.agent_first_name} ${v.agent_last_name || ''}` : 'Unassigned'}`;
          }).join('\n\n');
          return {
            reply: `📅 **Scheduled Site Visits & Tours**:\n\n${list}`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'REVENUE_STATS': {
          const rev = await fetchLiveRevenueStats();
          return {
            reply: `💰 **Financial Revenue & Deals Summary**:\n- **Realized Payments Received**: **₹${Number(rev.total_realized).toLocaleString()}** (${rev.total_payments} receipts)\n- **Active Deals Pipeline Value**: **₹${Number(rev.pipeline_total).toLocaleString()}** (${rev.total_deals} bookings)`,
            source: 'LIVE_DATABASE'
          };
        }

        case 'SUPPORT_TICKETS': {
          const tks = await fetchSupportTicketsSummary();
          return {
            reply: `🎫 **Support & Helpdesk Overview**:\n- **Total Tickets**: ${tks.total_tickets || 0}\n- **Open / Pending**: ${tks.open_tickets || 0}\n- **In Progress**: ${tks.in_progress_tickets || 0}\n- **Resolved**: ${tks.resolved_tickets || 0}\n- **High Priority / Urgent**: ${tks.high_priority_tickets || 0}`,
            source: 'LIVE_DATABASE'
          };
        }
      }
    } catch (err) {
      console.error('[AI Assistant]: Database tool execution error:', err.message);
      return {
        reply: "I'm unable to retrieve that CRM data right now. Please try again shortly or use the relevant section in the sidebar.",
        source: 'TOOL_ERROR'
      };
    }
  }

  // 7. Greeting & Overview
  if (intent.type === 'GREETING') {
    return {
      reply: `👋 **Welcome to Nexora Estates Intelligence Assistant!**\n\nI am your central CRM copilot. You can ask me:\n\n• **CRM Workflows**: *"What is a lead?"*, *"How do I schedule a site visit?"*, *"How do I book a unit?"*\n• **Live Inventory**: *"Show available 3BHK units"*, *"Which unit is the cheapest?"*, *"What projects are in Bangalore?"*\n• **Lead Pipeline**: *"Find lead named Priya"*, *"How many leads are overdue?"*\n• **Calendar & Visits**: *"Show upcoming site visits"*\n• **Financials**: *"What is total revenue collected?"*, *"Show deals summary"*\n• **Support & Troubleshooting**: *"Why was my action rejected?"*, *"How does double-booking prevention work?"*`,
      source: 'GENERAL_ASSISTANT'
    };
  }

  // 8. Honest Guardrail Fallback for Unknown / Off-Topic Queries (Zero Hallucination)
  return {
    reply: `I do not have information about that in the Real Estate CRM database. I can assist you with:\n- Live inventory, unit availability, and project details\n- Searching leads, pipeline stages, and customer records\n- Scheduling site visits, deals, payments, and revenue summaries\n- Step-by-step workflow explanations and troubleshooting`,
    source: 'GUARDRAIL_FALLBACK'
  };
}

module.exports = {
  processChatMessage,
  classifyUserIntent,
  fetchLiveInventoryStats,
  fetchLiveProjectsSummary,
  searchUnits,
  searchLeads,
  searchCustomers,
  fetchCustomerSummary,
  fetchSiteVisits,
  fetchLiveLeadSummary,
  fetchLiveRevenueStats,
  fetchSupportTicketsSummary
};
