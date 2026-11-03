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

/**
 * AI Lead Copilot: Analyzes lead intent, calculates heat score (0-100),
 * suggests optimal site visit slots, and generates customized 1-click follow-up messages.
 */
async function analyzeLeadCopilot(leadId) {
  const [leads] = await pool.query(`
    SELECT l.*, p.name AS project_name, p.city AS project_city, p.location AS project_location,
           u.first_name AS agent_first_name, u.last_name AS agent_last_name, u.email AS agent_email, u.phone AS agent_phone
    FROM leads l
    LEFT JOIN projects p ON l.preferred_project_id = p.id
    LEFT JOIN users u ON l.assigned_agent_id = u.id
    WHERE l.id = ?
  `, [leadId]);

  if (!leads || leads.length === 0) {
    throw new Error('Lead not found');
  }

  const lead = leads[0];
  const clientFullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Valued Client';
  const agentFullName = `${lead.agent_first_name || ''} ${lead.agent_last_name || ''}`.trim() || 'Nexora Estates Representative';

  // 1. Fetch site visit history
  const [visits] = await pool.query(`
    SELECT id, status, scheduled_time, client_feedback, created_at
    FROM site_visits
    WHERE lead_id = ?
    ORDER BY scheduled_time DESC
  `, [leadId]);

  // 2. Fetch inventory availability in their preferred project
  let matchingUnitsCount = 0;
  let minAvailablePrice = null;
  if (lead.preferred_project_id) {
    const [units] = await pool.query(`
      SELECT COUNT(*) AS total_avail, MIN(base_price) AS min_price
      FROM units
      WHERE project_id = ? AND status = 'AVAILABLE'
    `, [lead.preferred_project_id]);
    if (units.length > 0) {
      matchingUnitsCount = units[0].total_avail || 0;
      minAvailablePrice = units[0].min_price || null;
    }
  }

  // 3. Compute Lead Heat Score (0-100) & Key Factors
  let score = 50;
  const factors = [];

  // Stage Scoring
  const stageWeights = {
    'INCOMING': { pts: 25, reason: 'Fresh incoming inquiry awaiting primary qualification' },
    'CONTACTED': { pts: 45, reason: 'Initial contact made; requirements identified' },
    'VISIT_SCHEDULED': { pts: 75, reason: 'Site visit confirmed on calendar' },
    'VISIT_COMPLETED': { pts: 88, reason: 'Site visit completed with high engagement' },
    'NEGOTIATION': { pts: 94, reason: 'In commercial negotiation stage' },
    'WON': { pts: 100, reason: 'Booking confirmed' },
    'LOST': { pts: 10, reason: 'Lead marked as lost' }
  };

  const stageData = stageWeights[lead.stage] || { pts: 40, reason: 'Active stage' };
  score = stageData.pts;
  factors.push({ factor: 'Pipeline Stage', impact: `+${stageData.pts}`, description: stageData.reason });

  // Source Scoring
  if (['REFERRAL', 'WALK_IN'].includes(lead.source)) {
    score += 15;
    factors.push({ factor: 'High-Intent Source', impact: '+15', description: `Sourced via ${lead.source} (typically 3x higher conversion)` });
  } else if (['WEBSITE_FORM', 'WHATSAPP'].includes(lead.source)) {
    score += 10;
    factors.push({ factor: 'Digital Inbound Source', impact: '+10', description: `Direct digital inquiry via ${lead.source}` });
  }

  // Budget & Inventory Match
  if (lead.budget_max && minAvailablePrice && Number(lead.budget_max) >= Number(minAvailablePrice)) {
    score += 10;
    factors.push({ factor: 'Budget Alignment', impact: '+10', description: `Budget (₹${Number(lead.budget_max).toLocaleString()}) matches available inventory in ${lead.project_name || 'project'}` });
  } else if (matchingUnitsCount > 0) {
    score += 5;
    factors.push({ factor: 'Inventory Available', impact: '+5', description: `${matchingUnitsCount} available units in preferred project ${lead.project_name || ''}` });
  }

  // Visit Engagement History
  const completedVisits = visits.filter(v => v.status === 'COMPLETED');
  if (completedVisits.length > 0) {
    score += 10;
    factors.push({ factor: 'Physical Verification', impact: '+10', description: `Completed ${completedVisits.length} site walkthrough(s)` });
  }

  // Recency Check
  const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate > 7 && !['WON', 'LOST'].includes(lead.stage)) {
    score -= 10;
    factors.push({ factor: 'Follow-up Velocity Delay', impact: '-10', description: `No CRM updates in the last ${daysSinceUpdate} days` });
  }

  // Clamp score
  score = Math.max(5, Math.min(99, score));

  // Temperature Tag
  let temperature = 'WARM';
  let tempEmoji = '⚡';
  if (score >= 75) {
    temperature = 'HOT';
    tempEmoji = '🔥';
  } else if (score < 45) {
    temperature = 'COLD';
    tempEmoji = '❄️';
  }

  // 4. Strategic Next Action
  let recommendedAction = '';
  if (lead.stage === 'INCOMING') {
    recommendedAction = `Dispatch introductory WhatsApp overview of ${lead.project_name || 'the project'} and propose an on-site property walkthrough.`;
  } else if (lead.stage === 'CONTACTED') {
    recommendedAction = `Confirm preferred site visit date & time slot for ${lead.project_name || 'project'} this weekend.`;
  } else if (lead.stage === 'VISIT_SCHEDULED') {
    recommendedAction = `Send Google Calendar reminder & location pin to client ahead of their scheduled site visit.`;
  } else if (lead.stage === 'VISIT_COMPLETED') {
    recommendedAction = `Share tailored Unit Cost Sheet & payment milestone plan for their favorite unit.`;
  } else if (lead.stage === 'NEGOTIATION') {
    recommendedAction = `Schedule closing call with Senior Sales Director to finalize booking token deposit.`;
  } else {
    recommendedAction = `Keep lead engaged with new phase launch brochures and quarterly price appreciation updates.`;
  }

  // 5. Intelligent Site Visit Slot Recommendations
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

  const saturday = new Date();
  const daysUntilSaturday = (6 - saturday.getDay() + 7) % 7 || 7;
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  const saturdayDateStr = saturday.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

  const suggestedSlots = [
    { label: `${tomorrowDateStr} @ 11:00 AM`, iso: new Date(new Date(tomorrow).setHours(11, 0, 0, 0)).toISOString() },
    { label: `${tomorrowDateStr} @ 04:00 PM`, iso: new Date(new Date(tomorrow).setHours(16, 0, 0, 0)).toISOString() },
    { label: `Upcoming Saturday (${saturdayDateStr}) @ 11:30 AM`, iso: new Date(new Date(saturday).setHours(11, 30, 0, 0)).toISOString() }
  ];

  // 6. Pre-composed Personalized Communication Drafts
  const projectDisplay = lead.project_name || 'Nexora Estates';
  const locationDisplay = lead.project_location ? `at ${lead.project_location}` : '';

  const whatsappMessage = `Hello ${lead.first_name || 'Sir/Ma\'am'}! 👋

Thank you for your interest in *${projectDisplay}* ${locationDisplay}.

We currently have premium units available with modern lifestyle amenities. I would love to arrange a personalized on-site property walkthrough for you.

📅 *Suggested Visit Slots:*
1️⃣ ${suggestedSlots[0].label}
2️⃣ ${suggestedSlots[1].label}
3️⃣ ${suggestedSlots[2].label}

Which of these timings works best for you? Looking forward to assisting you.

Best regards,
*${agentFullName}*
Nexora Estates CRM`;

  const emailSubject = `Exclusive Tour Invitation: ${projectDisplay} | Nexora Estates`;
  const emailBody = `Dear ${clientFullName},

Thank you for reaching out regarding ${projectDisplay}.

We have curated exclusive property options matching your preferences, featuring world-class architecture, expansive green spaces, and high ROI potential.

Would you be available for a 30-minute private tour of our show apartments?
- Option A: ${suggestedSlots[0].label}
- Option B: ${suggestedSlots[1].label}
- Option C: ${suggestedSlots[2].label}

Please let us know your preferred slot and we will send a confirmed Google Calendar invitation.

Warm regards,
${agentFullName}
Nexora Estates Development Team`;

  const smsMessage = `Hi ${lead.first_name || 'there'}, thanks for inquiring about ${projectDisplay}. Premium units are now open for site visits. Reply YES to schedule a tour this weekend or call ${lead.agent_phone || '+91-9876543210'}. - Nexora Estates`;

  const cleanPhone = String(lead.phone || '').replace(/\D/g, '');
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(whatsappMessage)}`;

  return {
    leadId: lead.id,
    clientName: clientFullName,
    clientPhone: lead.phone,
    clientEmail: lead.email,
    projectName: projectDisplay,
    stage: lead.stage,
    score,
    temperature,
    tempEmoji,
    factors,
    recommendedAction,
    matchingUnitsCount,
    suggestedSlots,
    communication: {
      whatsapp: {
        message: whatsappMessage,
        url: whatsappUrl
      },
      email: {
        subject: emailSubject,
        body: emailBody
      },
      sms: {
        message: smsMessage
      }
    }
  };
}

/**
 * Smart Property Matcher & Comparison Engine:
 * Analyzes natural language buyer criteria, scores matching available units,
 * and generates side-by-side comparison analytics & WhatsApp pitch.
 */
async function matchPropertyInventory(rawQuery = '', explicitFilters = {}) {
  const queryStr = (rawQuery || '').toLowerCase();

  // 1. Natural Language Entity Extraction
  let extractedCity = explicitFilters.city || null;
  let extractedUnitType = explicitFilters.unit_type || null;
  let extractedMaxPrice = explicitFilters.max_price ? Number(explicitFilters.max_price) : null;
  let extractedMinPrice = explicitFilters.min_price ? Number(explicitFilters.min_price) : null;
  let extractedFacing = explicitFilters.facing || null;
  let preferCorner = explicitFilters.is_corner === true;

  // Extract City
  if (!extractedCity) {
    if (queryStr.includes('bangalore') || queryStr.includes('bengaluru') || queryStr.includes('blr')) extractedCity = 'Bangalore';
    else if (queryStr.includes('mumbai') || queryStr.includes('bkc') || queryStr.includes('mum')) extractedCity = 'Mumbai';
    else if (queryStr.includes('hyderabad') || queryStr.includes('hyd') || queryStr.includes('gachibowli')) extractedCity = 'Hyderabad';
  }

  // Extract Unit Type
  if (!extractedUnitType) {
    if (queryStr.includes('1bhk') || queryStr.includes('1 bhk')) extractedUnitType = '1BHK';
    else if (queryStr.includes('2bhk') || queryStr.includes('2 bhk')) extractedUnitType = '2BHK';
    else if (queryStr.includes('3bhk') || queryStr.includes('3 bhk')) extractedUnitType = '3BHK';
    else if (queryStr.includes('4bhk') || queryStr.includes('4 bhk')) extractedUnitType = '4BHK';
    else if (queryStr.includes('plot')) extractedUnitType = 'PLOT';
    else if (queryStr.includes('villa')) extractedUnitType = 'VILLA';
    else if (queryStr.includes('commercial') || queryStr.includes('office')) extractedUnitType = 'COMMERCIAL';
  }

  // Extract Facing
  if (!extractedFacing) {
    if (queryStr.includes('north-east') || queryStr.includes('northeast')) extractedFacing = 'NORTH_EAST';
    else if (queryStr.includes('east')) extractedFacing = 'EAST';
    else if (queryStr.includes('north')) extractedFacing = 'NORTH';
    else if (queryStr.includes('west')) extractedFacing = 'WEST';
    else if (queryStr.includes('south')) extractedFacing = 'SOUTH';
  }

  if (queryStr.includes('corner')) preferCorner = true;

  // Extract Price from strings like "under 1.2 cr", "below 90L", "within 1.5 crore"
  if (!extractedMaxPrice) {
    const crMatch = queryStr.match(/(?:under|below|within|upto|max|around)\s*(\d+(?:\.\d+)?)\s*(?:cr|crore)/i);
    if (crMatch) {
      extractedMaxPrice = parseFloat(crMatch[1]) * 10000000;
    } else {
      const lakhMatch = queryStr.match(/(?:under|below|within|upto|max|around)\s*(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)/i);
      if (lakhMatch) {
        extractedMaxPrice = parseFloat(lakhMatch[1]) * 100000;
      }
    }
  }

  // 2. Query available inventory
  const [units] = await pool.query(`
    SELECT u.*, p.name AS project_name, p.code AS project_code, p.location AS project_location,
           p.city AS project_city, p.project_type, p.builder_developer, b.name AS building_name
    FROM units u
    JOIN projects p ON u.project_id = p.id
    LEFT JOIN buildings b ON u.building_id = b.id
    WHERE u.status = 'AVAILABLE'
    ORDER BY u.base_price ASC
  `);

  if (!units || units.length === 0) {
    return {
      query: rawQuery,
      extractedCriteria: { city: extractedCity, unitType: extractedUnitType, maxPrice: extractedMaxPrice, facing: extractedFacing, isCorner: preferCorner },
      totalMatches: 0,
      matches: [],
      summary: 'No available units currently in inventory.'
    };
  }

  // Check if any unit directly matches the raw query string (fuzzy matching across city, name, location, etc.)
  const queryTerms = queryStr.split(/\s+/).filter(t => t.length > 2);
  let hasDirectLocationMatch = false;

  const scoredUnits = units.map(u => {
    let score = 50;
    const matchReasons = [];

    const basePrice = Number(u.base_price || 0);
    const superArea = Number(u.super_area_sqft || u.plot_area_sqft || 1200);
    const carpetArea = Number(u.carpet_area_sqft || (superArea * 0.75));
    const pricePerSqft = Math.round(basePrice / superArea);

    const projectText = `${u.project_name || ''} ${u.project_location || ''} ${u.project_city || ''} ${u.builder_developer || ''} ${u.unit_type || ''}`.toLowerCase();

    // Word Match Boost
    queryTerms.forEach(term => {
      if (projectText.includes(term)) {
        score += 20;
        matchReasons.push(`Matches keyword "${term}"`);
        hasDirectLocationMatch = true;
      }
    });

    // City Match
    if (extractedCity) {
      if (u.project_city && u.project_city.toLowerCase().includes(extractedCity.toLowerCase())) {
        score += 25;
        matchReasons.push(`City match (${u.project_city})`);
        hasDirectLocationMatch = true;
      } else {
        score -= 10;
      }
    }

    // Unit Type Match
    if (extractedUnitType) {
      if (u.unit_type && u.unit_type.toUpperCase() === extractedUnitType.toUpperCase()) {
        score += 25;
        matchReasons.push(`Exact unit type (${u.unit_type})`);
      } else {
        score -= 10;
      }
    }

    // Budget Match
    if (extractedMaxPrice) {
      if (basePrice <= extractedMaxPrice) {
        score += 20;
        matchReasons.push(`Within budget limit (₹${(basePrice / 100000).toFixed(1)}L <= ₹${(extractedMaxPrice / 100000).toFixed(1)}L)`);
      } else if (basePrice <= extractedMaxPrice * 1.1) {
        score += 5;
        matchReasons.push(`Close to budget (₹${(basePrice / 100000).toFixed(1)}L)`);
      } else {
        score -= 15;
      }
    }

    // Facing Match
    if (extractedFacing) {
      if (u.facing && u.facing.toUpperCase() === extractedFacing.toUpperCase()) {
        score += 10;
        matchReasons.push(`Preferred ${u.facing} facing`);
      }
    }

    // Corner Match
    if (preferCorner) {
      if (u.is_corner) {
        score += 10;
        matchReasons.push('Corner unit with dual ventilation');
      }
    }

    if (matchReasons.length === 0) {
      matchReasons.push('Featured available inventory');
    }

    const estimatedGst = Math.round(basePrice * 0.05);
    const estimatedStampDuty = Math.round(basePrice * 0.056);
    const estimatedAllInclusive = basePrice + Number(u.plc_charges || 0) + estimatedGst + estimatedStampDuty + 350000;

    return {
      id: u.id,
      unitNumber: u.unit_number,
      unitType: u.unit_type,
      floorNumber: u.floor_number,
      facing: u.facing || 'East',
      isCorner: !!u.is_corner,
      projectName: u.project_name,
      projectLocation: u.project_location,
      projectCity: u.project_city,
      buildingName: u.building_name || 'Main Tower',
      carpetAreaSqft: carpetArea,
      superAreaSqft: superArea,
      basePrice,
      plcCharges: Number(u.plc_charges || 0),
      pricePerSqft,
      estimatedAllInclusive,
      matchScore: Math.max(15, Math.min(99, score)),
      matchReasons
    };
  });

  // Sort by matchScore descending
  scoredUnits.sort((a, b) => b.matchScore - a.matchScore);

  const topMatches = scoredUnits.slice(0, 4);

  let notice = null;
  if (rawQuery && !hasDirectLocationMatch && queryTerms.length > 0) {
    notice = `No active developments currently registered for "${rawQuery}". Displaying top featured available properties across primary markets.`;
  }

  // Generate Comparison Summary Text for WhatsApp
  let comparisonText = `🏡 *NEXORA ESTATES - CURATED PROPERTY COMPARISON*
Matching criteria: "${rawQuery || `${extractedUnitType || ''} in ${extractedCity || 'all cities'}`}"
${notice ? `ℹ️ _${notice}_\n` : ''}
`;

  topMatches.forEach((m, idx) => {
    comparisonText += `🔹 *Option ${idx + 1}: ${m.projectName} - Unit ${m.unitNumber}* (${m.matchScore}% Match)
• Config: ${m.unitType} | Floor ${m.floorNumber} | ${m.facing} Facing${m.isCorner ? ' | Corner' : ''}
• Location: ${m.projectLocation || ''}, ${m.projectCity || ''}
• Area: ${m.superAreaSqft} sq.ft (${m.carpetAreaSqft} sq.ft carpet)
• Agreement Value: ₹${(m.basePrice / 100000).toFixed(2)} Lakhs (₹${m.pricePerSqft}/sq.ft)
• All-Inclusive Est.: ₹${(m.estimatedAllInclusive / 100000).toFixed(2)} Lakhs
• Highlights: ${m.matchReasons.join(', ')}

`;
  });

  comparisonText += `Would you like to schedule a site tour to view these units?
Generated by Nexora Estates Smart Property Matcher`;

  return {
    query: rawQuery,
    notice,
    extractedCriteria: {
      city: extractedCity,
      unitType: extractedUnitType,
      maxPrice: extractedMaxPrice,
      facing: extractedFacing,
      isCorner: preferCorner
    },
    totalMatches: topMatches.length,
    matches: topMatches,
    whatsappComparisonText: comparisonText
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
  fetchSupportTicketsSummary,
  analyzeLeadCopilot,
  matchPropertyInventory
};
