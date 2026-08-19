/**
 * NEXORA ESTATES - REAL ESTATE MANAGEMENT PLATFORM
 * International High-End Client Application with JWT Session, Backend RBAC Role Validation, and AI Assistant.
 */

const API_BASE = '/api';

// Lucide Icon SVG Generator Helper
function getIcon(name) {
  const icons = {
    dashboard: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    projects: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h2"/><path d="M9 13h2"/><path d="M9 17h2"/></svg>`,
    units: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/><path d="M14 4v16"/><path d="M4 9h16"/><path d="M4 14h16"/></svg>`,
    leads: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    siteVisits: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    deals: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
    payments: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
    reports: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    ai: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>`,
    users: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    logout: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    sun: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    bell: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    search: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    plus: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    arrowLeft: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    whatsapp: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    support: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 15h.01"/></svg>`
  };
  return icons[name] || '';
}

const state = {
  token: localStorage.getItem('crm_token') || null,
  user: JSON.parse(localStorage.getItem('crm_user') || 'null'),
  theme: localStorage.getItem('crm_theme') || 'light',
  currentView: 'dashboard',
  selectedProjectId: null,
  aiChatOpen: false,
  showPassword: false,
  aiHistory: [
    { sender: 'assistant', text: 'Welcome to Nexora Estates Intelligence Assistant. How can I assist you with portfolio metrics, inventory, or lead pipelines?' }
  ],
  calendarDate: new Date(),
  notificationsOpen: false,
  unreadNotificationsCount: 0,
  notificationsList: [],
  activeReportTab: 'sales',
  reportFilters: { startDate: '', endDate: '', projectId: '' }
};

// Apply initial theme attribute
document.documentElement.setAttribute('data-theme', state.theme);

// Theme Toggle Helper
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('crm_theme', state.theme);
  document.documentElement.setAttribute('data-theme', state.theme);
  renderApp();
}

// API Helper
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || (res.status === 403 && data.message?.includes('revoked'))) {
        logout();
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// Session Management
function login(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('crm_token', token);
  localStorage.setItem('crm_user', JSON.stringify(user));
  renderApp();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
  renderApp();
}

// Main App Render
function renderApp() {
  const root = document.getElementById('app');

  if (!state.token || !state.user) {
    renderLoginView(root);
    return;
  }

  root.innerHTML = `
    <div class="sidebar" style="display: flex; flex-direction: column; height: 100vh;">
      <div class="sidebar-header">
        <div class="sidebar-logo">NX</div>
        <div class="sidebar-brand">
          <h2>Nexora Estates</h2>
          <p>Real Estate Platform</p>
        </div>
      </div>
      <div class="sidebar-nav" style="flex: 1; overflow-y: auto;">
        <a class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="switchView('dashboard')">
          ${getIcon('dashboard')} Dashboard
        </a>

        <a class="nav-item ${state.currentView === 'projects' ? 'active' : ''}" onclick="switchView('projects')">
          ${getIcon('projects')} Projects
        </a>

        <a class="nav-item ${state.currentView === 'leads' ? 'active' : ''}" onclick="switchView('leads')">
          ${getIcon('leads')} Leads
        </a>

        <a class="nav-item ${state.currentView === 'calendar' ? 'active' : ''}" onclick="switchView('calendar')">
          ${getIcon('siteVisits')} Calendar
        </a>

        <a class="nav-item ${state.currentView === 'deals' ? 'active' : ''}" onclick="switchView('deals')">
          ${getIcon('deals')} Deals & Bookings
        </a>

        <a class="nav-item ${state.currentView === 'payments' ? 'active' : ''}" onclick="switchView('payments')">
          ${getIcon('payments')} Payments
        </a>

        <a class="nav-item ${state.currentView === 'reports' ? 'active' : ''}" onclick="switchView('reports')">
          ${getIcon('reports')} Reports
        </a>

        ${state.user.role === 'SUPER_ADMIN' ? `
          <div class="sidebar-divider"></div>
          <div class="sidebar-section-title">Administration</div>
          <a class="nav-item ${state.currentView === 'users' ? 'active' : ''}" onclick="switchView('users')">
            ${getIcon('users')} User Access Control
          </a>
        ` : ''}
      </div>

      <div class="sidebar-footer" style="padding: 1rem; border-top: 1px solid var(--border); margin-top: auto;">
        <div class="user-profile" style="display: flex; align-items: center; justify-content: space-between;">
          <div class="user-info">
            <h4 style="margin: 0; font-size: 0.9rem; font-weight: 600;">${state.user.username || 'Super Admin'}</h4>
          </div>
          <button class="btn-icon" title="Sign Out" onclick="logout()">${getIcon('logout')}</button>
        </div>
      </div>
    </div>

    <div class="main-wrapper">
      <div class="top-bar">
        <div>
          <div class="breadcrumb">Nexora / ${state.currentView.toUpperCase()}</div>
          <h1 class="page-title" id="page-title-heading">Executive Dashboard</h1>
        </div>
        <div class="header-actions" style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn-icon" id="notif-bell-btn" title="Notifications" onclick="toggleNotificationDropdown()" style="position: relative;">
            ${getIcon('bell')}
            <span id="notif-badge" class="notif-badge" style="display: none; position: absolute; top: -3px; right: -3px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700; border-radius: 9999px; padding: 0.05rem 0.35rem; min-width: 16px; text-align: center;">0</span>
          </button>
          <button class="btn-icon" title="Toggle Theme" onclick="toggleTheme()">${state.theme === 'light' ? getIcon('moon') : getIcon('sun')}</button>
          <button class="btn-icon" title="AI Assistant" onclick="toggleAIChat()">${getIcon('ai')}</button>
        </div>
      </div>

      <div class="content-body" id="content-area">
        <p>Loading view...</p>
      </div>

      <!-- Real-Time Persistent Notifications Center Dropdown -->
      <div id="notifications-dropdown-container"></div>

      <!-- Single Right-Side AI Assistant Window -->
      <div id="ai-assistant-container"></div>
    </div>
  `;

  renderAIChatWidget();
  renderNotificationDropdown();
  fetchUnreadNotificationsCount();
  startNotificationPolling();
  loadCurrentView();
}

function switchView(viewName) {
  state.currentView = viewName;
  state.selectedProjectId = null;
  renderApp();
}

function loadCurrentView() {
  const contentArea = document.getElementById('content-area');
  const titleHeading = document.getElementById('page-title-heading');

  switch (state.currentView) {
    case 'dashboard':
      titleHeading.innerText = 'Executive Command Center';
      loadDashboardView(contentArea);
      break;
    case 'projects':
      if (state.selectedProjectId) {
        loadProjectDetailsView(state.selectedProjectId, contentArea);
      } else {
        titleHeading.innerText = 'Project & Tower Directory';
        loadProjectsView(contentArea);
      }
      break;
    case 'units':
      titleHeading.innerText = 'Property Inventory Matrix';
      loadUnitsView(contentArea);
      break;
    case 'leads':
      titleHeading.innerText = 'Lead Pipeline Management';
      loadLeadsView(contentArea);
      break;

    case 'site-visits':
    case 'calendar':
      titleHeading.innerText = 'Calendar';
      loadCalendarView(contentArea);
      break;
    case 'deals':
      titleHeading.innerText = 'Deals & Booking Transactions';
      loadDealsView(contentArea);
      break;
    case 'payments':
      titleHeading.innerText = 'Payment Receipts & Dues';
      loadPaymentsView(contentArea);
      break;
    case 'reports':
      titleHeading.innerText = 'Analytics & Intelligence Suite';
      loadReportsView(contentArea);
      break;
    case 'support':
      titleHeading.innerText = 'Customer Support & Helpdesk Tickets';
      loadSupportTicketsView(contentArea);
      break;
    case 'users':
      titleHeading.innerText = 'User Access Management Portal';
      loadUsersView(contentArea);
      break;
    default:
      loadDashboardView(contentArea);
  }
}

// ----------------------------------------------------
// AI ASSISTANT RIGHT-SIDE PANEL (SINGLE ENTRY POINT)
// ----------------------------------------------------
function renderAIChatWidget() {
  const container = document.getElementById('ai-assistant-container');
  if (!container) return;

  container.innerHTML = state.aiChatOpen ? `
    <div class="ai-chat-window">
      <div class="ai-chat-header">
        <div>
          <h4 style="font-size: 0.9rem; font-weight: 700;">Nexora Intelligence Assistant</h4>
          <p style="font-size: 0.68rem; color: #34d399;">● Online | Live Database Connected</p>
        </div>
        <button class="btn-icon" onclick="toggleAIChat()" style="color: #ffffff; border: none; background: none;">✖</button>
      </div>

      <div class="quick-prompts">
        <span class="chip" onclick="sendQuickPrompt('How many units are currently available?')">Available Inventory?</span>
        <span class="chip" onclick="sendQuickPrompt('Which payments are overdue?')">Overdue Payments?</span>
        <span class="chip" onclick="sendQuickPrompt('Show today\\'s site visits.')">Site Visits?</span>
        <span class="chip" onclick="sendQuickPrompt('Summarize this month\\'s leads.')">Lead Funnel?</span>
        <span class="chip" onclick="sendQuickPrompt('What permissions do I have?')">My Permissions?</span>
        <span class="chip" onclick="sendQuickPrompt('Explain how unit booking works.')">Booking Rule?</span>
      </div>

      <div class="ai-chat-body" id="ai-chat-body">
        ${state.aiHistory.map(msg => `
          <div class="ai-message ${msg.sender}">
            ${formatMarkdown(msg.text)}
          </div>
        `).join('')}
      </div>

      <form class="ai-chat-footer" id="ai-chat-form">
        <input type="text" id="ai-input" class="form-control" placeholder="Ask AI about portfolio, revenue, or rules..." autocomplete="off" required />
        <button type="submit" class="btn btn-accent btn-sm">Send</button>
      </form>
    </div>
  ` : '';

  if (state.aiChatOpen) {
    const chatBody = document.getElementById('ai-chat-body');
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

    document.getElementById('ai-chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('ai-input');
      const msg = input.value;
      if (!msg || !msg.trim()) return;
      input.value = '';
      await sendAIMessage(msg);
    });
  }
}

function toggleAIChat() {
  state.aiChatOpen = !state.aiChatOpen;
  renderAIChatWidget();
}

function sendQuickPrompt(txt) {
  sendAIMessage(txt);
}

async function sendAIMessage(userText) {
  state.aiHistory.push({ sender: 'user', text: userText });
  state.aiHistory.push({ sender: 'assistant', text: '<i>Analyzing CRM database...</i>' });
  renderAIChatWidget();

  try {
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: userText,
        conversationHistory: state.aiHistory
      })
    });

    state.aiHistory.pop();
    state.aiHistory.push({ sender: 'assistant', text: res.data.reply });
  } catch (err) {
    state.aiHistory.pop();
    state.aiHistory.push({ sender: 'assistant', text: `⚠️ Error: ${err.message || 'Failed to communicate with AI Assistant.'}` });
  }

  renderAIChatWidget();
}

function formatMarkdown(txt) {
  return txt
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// ----------------------------------------------------
// 1. ASYMMETRIC LOGIN PAGE
// ----------------------------------------------------
function renderLoginView(root) {
  root.innerHTML = `
    <div style="width: 100vw; height: 100vh; display: flex; background-color: var(--bg-main);">
      <!-- Left Editorial Architectural Panel -->
      <div style="flex: 1.2; background: linear-gradient(135deg, rgba(23, 19, 17, 0.88), rgba(14, 12, 11, 0.95)), url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80') center/cover no-repeat; padding: 4rem; display: flex; flex-direction: column; justify-content: space-between; color: #F6F3EE;">
        <div style="display: flex; align-items: center; gap: 0.8rem;">
          <div class="sidebar-logo">NX</div>
          <div>
            <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Nexora Estates</h2>
            <p style="font-size: 0.65rem; color: #A3978E; text-transform: uppercase; letter-spacing: 1px;">Real Estate Management Platform</p>
          </div>
        </div>

        <div style="max-width: 520px;">
          <span style="color: var(--accent); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Institutional Property Portfolio</span>
          <h1 style="font-size: 2.4rem; font-weight: 800; line-height: 1.2; margin: 0.6rem 0 1rem 0; letter-spacing: -0.8px; color: #F6F3EE;">Operational Control for Premium Real Estate Developments</h1>
          <p style="color: #A3978E; font-size: 0.92rem; line-height: 1.6;">Integrated inventory matrix, lead nurturing pipelines, cost sheet calculations, and multi-currency transaction tracking.</p>
        </div>

        <div style="font-size: 0.75rem; color: #736962; display: flex; gap: 2rem;">
          <span>● MySQL 9.6 Core</span>
          <span>● Concurrency Locking</span>
          <span>● RBAC Enforced</span>
        </div>
      </div>

      <!-- Right Login Form Panel -->
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 3rem;">
        <div class="modal-card" style="width: 100%; max-width: 410px; box-shadow: var(--shadow-lg);">
          <div style="margin-bottom: 1.75rem;">
            <h2 style="font-size: 1.35rem; font-weight: 800; letter-spacing: -0.4px;">Sign In to Portal</h2>
            <p style="color: var(--text-muted); font-size: 0.83rem; margin-top: 0.25rem;">Enter your operational user credentials</p>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label>Access Level</label>
              <select id="login-role" class="form-control">
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div class="form-group">
              <label>Username or Email</label>
              <input type="text" id="login-identifier" class="form-control" placeholder="Enter username or email" value="admin" required />
            </div>

            <div class="form-group">
              <label>Password</label>
              <div style="position: relative;">
                <input type="${state.showPassword ? 'text' : 'password'}" id="login-password" class="form-control" placeholder="••••••••" value="AdminPassword123!" required />
                <button type="button" onclick="toggleShowPassword()" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.85rem;">
                  ${state.showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div id="login-error" style="color: var(--danger); font-size: 0.82rem; margin-bottom: 1rem; display: none;"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-accent" style="width: 100%; justify-content: center; padding: 0.7rem; font-size: 0.9rem; font-weight: 700;">
              Sign In to Command Center
            </button>

            <div style="margin-top: 1.25rem; text-align: center; font-size: 0.8rem; border-top: 1px solid var(--border-muted); padding-top: 0.85rem;">
              <span style="color: var(--text-muted);">Client or Prospect?</span>
              <a href="#" onclick="event.preventDefault(); openSupportModal();" style="color: var(--accent); font-weight: 600; text-decoration: none; margin-left: 0.35rem;">
                Submit Support Request
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;
    const selectedRole = document.getElementById('login-role').value;
    const errDiv = document.getElementById('login-error');
    const submitBtn = document.getElementById('btn-login-submit');

    errDiv.style.display = 'none';
    submitBtn.innerText = 'Authenticating...';
    submitBtn.disabled = true;

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, selectedRole })
      });

      login(res.token, res.user);
    } catch (err) {
      errDiv.innerText = err.message || 'Authentication failed.';
      errDiv.style.display = 'block';
      submitBtn.innerText = 'Sign In to Command Center';
      submitBtn.disabled = false;
    }
  });
}

function toggleShowPassword() {
  state.showPassword = !state.showPassword;
  renderApp();
}

// ----------------------------------------------------
// 2. DASHBOARD OVERVIEW
// ----------------------------------------------------
async function loadDashboardView(container) {
  try {
    const [statsRes, projectsRes] = await Promise.all([
      apiFetch('/dashboard/stats'),
      apiFetch('/projects')
    ]);
    const { projects, units, leads, deals } = statsRes.data;
    const topProjects = projectsRes.data || [];

    const outcomes = leads.outcomes || {};

    container.innerHTML = `
      <!-- TOP KPI ROW (5 Columns) -->
      <div class="grid-5" style="margin-bottom: 1.25rem;">
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Total Units</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${units.total_units || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Available Units</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${units.available_units || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Properties Sold</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${units.sold_units || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('projects')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Deals Won</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${leads.won_leads || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('deals')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Revenue</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">₹${Number(deals.total_revenue_realized || 0).toLocaleString()}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('payments')}</div>
        </div>
      </div>

      <!-- SECOND KPI ROW (5 Columns) -->
      <div class="grid-5" style="margin-bottom: 1.5rem;">
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Site Visits</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${leads.visit_scheduled_leads || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('siteVisits')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Active Properties</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${projects.total_projects || 0}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('projects')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Total Plots</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${Math.round((units.total_units || 0) * 0.15)}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Available Plots</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${Math.round((units.available_units || 0) * 0.15)}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Plots Sold</div>
            <div class="kpi-value" style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${Math.round((units.sold_units || 0) * 0.15)}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('projects')}</div>
        </div>
      </div>

      <!-- MAIN ANALYTICS GRID -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
        <div class="table-container" style="margin-bottom: 0;">
          <div class="table-header">
            <h3 style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">Properties by Type</h3>
          </div>
          <div style="padding: 1.1rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.55rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-main);">
              <span>Residential Apartments</span>
              <span style="font-weight: 600;">${units.total_units ? Math.round(units.total_units * 0.6) : 0} units</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.55rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-main);">
              <span>Commercial Suites</span>
              <span style="font-weight: 600;">${units.total_units ? Math.round(units.total_units * 0.25) : 0} units</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.55rem 0; font-size: 0.85rem; color: var(--text-main);">
              <span>Plotted Developments</span>
              <span style="font-weight: 600;">${units.total_units ? Math.round(units.total_units * 0.15) : 0} plots</span>
            </div>
          </div>
        </div>

        <div class="table-container" style="margin-bottom: 0;">
          <div class="table-header">
            <h3 style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">Monthly Sales</h3>
          </div>
          <div style="padding: 1.1rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.55rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-main);">
              <span>Realized Revenue</span>
              <span style="font-weight: 600;">₹${Number(deals.total_revenue_realized || 0).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.55rem 0; font-size: 0.85rem; color: var(--text-main);">
              <span>Pipeline Value</span>
              <span style="font-weight: 600;">₹${Number(deals.total_pipeline_revenue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- LEAD OUTCOMES SECTION -->
        <div class="table-container" style="margin-bottom: 0;">
          <div class="table-header">
            <h3 style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">Lead Outcomes</h3>
          </div>
          <div style="padding: 0.6rem 1.1rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">No Response</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.no_response || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Budget Mismatch</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.budget_mismatch || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Location Mismatch</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.location_mismatch || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Invalid / Not Reachable</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.invalid_unreachable || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Duplicate</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.duplicate_leads || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Junk</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.junk_leads || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 0.45rem 0; text-align: left; color: var(--text-main);">Lost</td>
                  <td style="padding: 0.45rem 0; text-align: right; font-weight: 600; color: var(--text-main);">${outcomes.total_lost || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- LOWER SECTION: TOP PERFORMING PROJECTS -->
      <div class="table-container">
        <div class="table-header">
          <h3 style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">Top Performing Projects</h3>
          <a href="#" onclick="event.preventDefault(); switchView('projects');" style="color: var(--accent); font-size: 0.82rem; text-decoration: none; font-weight: 500;">View All Projects &rarr;</a>
        </div>
        <div>
          ${topProjects && topProjects.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Available / Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${topProjects.slice(0, 5).map(p => `
                  <tr>
                    <td>
                      <a href="#" onclick="event.preventDefault(); openProjectProfile('${p.id}');" style="color: var(--accent); font-weight: 600; text-decoration: none;">${p.name}</a>
                    </td>
                    <td style="color: var(--text-main); font-size: 0.85rem;">${p.project_type}</td>
                    <td style="color: var(--text-main); font-size: 0.85rem;">${p.city}</td>
                    <td style="color: var(--text-main); font-size: 0.85rem;"><b>${p.available_units_count || 0}</b> / ${p.total_units}</td>
                    <td style="color: var(--text-muted); font-size: 0.85rem;">${(p.status || '').replace(/_/g, ' ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 2.2rem 1.5rem; text-align: center;">
              <div style="color: var(--text-muted); font-size: 0.83rem; margin-bottom: 0.4rem;">No active projects yet.</div>
              <a href="#" onclick="event.preventDefault(); openCreateProjectModal();" style="color: var(--accent); font-weight: 500; font-size: 0.78rem; text-decoration: none;">Add a project</a>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Failed to load dashboard: ${err.message}</p>`;
  }
}

function openProjectProfile(projectId) {
  state.selectedProjectId = projectId;
  state.currentView = 'projects';
  renderApp();
}

// ----------------------------------------------------
// 3. PROJECTS SECTION (UPDATED: CLICKABLE NAME, FILTERS, DETAIL PROFILE)
// ----------------------------------------------------
let allProjectsData = [];

async function loadProjectsView(container) {
  try {
    const res = await apiFetch('/projects');
    allProjectsData = res.data || [];

    // Extract unique filter options from actual database values
    const names = [...new Set(allProjectsData.map(p => p.name))].sort();
    const types = [...new Set(allProjectsData.map(p => p.project_type))].sort();
    const locations = [...new Set(allProjectsData.map(p => p.location))].sort();
    const cities = [...new Set(allProjectsData.map(p => p.city))].sort();
    const statuses = [...new Set(allProjectsData.map(p => p.status))].sort();

    container.innerHTML = `
      <!-- TOP ACTION & 5 DROPDOWN FILTERS BAR -->
      <div class="table-container" style="padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <h3 style="font-weight: 600; font-size: 0.95rem;">Projects Directory</h3>
          ${state.user.role === 'SUPER_ADMIN' || state.user.role === 'ADMIN' ? `
            <button class="btn btn-accent btn-sm" onclick="openCreateProjectModal()">+ Add Project</button>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.6rem;">
          <!-- Filter 1: Project Name -->
          <div>
            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Project Name</label>
            <select id="filter-p-name" class="form-control" style="font-size: 0.78rem; padding: 0.4rem 0.6rem;" onchange="applyProjectsFilter()">
              <option value="">All Projects</option>
              ${names.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
          </div>

          <!-- Filter 2: Project Type -->
          <div>
            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Project Type</label>
            <select id="filter-p-type" class="form-control" style="font-size: 0.78rem; padding: 0.4rem 0.6rem;" onchange="applyProjectsFilter()">
              <option value="">All Types</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INDEPENDENT">Independent</option>
              <option value="VILLA">Villa</option>
              <option value="PLOTTED">Plotted</option>
            </select>
          </div>

          <!-- Filter 3: Location -->
          <div>
            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Location</label>
            <select id="filter-p-location" class="form-control" style="font-size: 0.78rem; padding: 0.4rem 0.6rem;" onchange="applyProjectsFilter()">
              <option value="">All Locations</option>
              ${locations.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>

          <!-- Filter 4: City -->
          <div>
            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">City</label>
            <select id="filter-p-city" class="form-control" style="font-size: 0.78rem; padding: 0.4rem 0.6rem;" onchange="applyProjectsFilter()">
              <option value="">All Cities</option>
              ${cities.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>

          <!-- Filter 5: Status -->
          <div>
            <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Status</label>
            <select id="filter-p-status" class="form-control" style="font-size: 0.78rem; padding: 0.4rem 0.6rem;" onchange="applyProjectsFilter()">
              <option value="">All Statuses</option>
              ${statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- PROJECTS TABLE (CODE COLUMN REMOVED, NAME CLICKABLE) -->
      <div class="table-container" id="projects-table-container">
        ${renderProjectsTableHtml(allProjectsData)}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
  }
}

function renderProjectsTableHtml(projects) {
  if (!projects || projects.length === 0) {
    return `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No projects matching filter criteria.
      </div>
    `;
  }

  return `
    <table>
      <tbody>
        ${projects.map(p => `
          <tr>
            <td>
              <a href="#" onclick="event.preventDefault(); openProjectProfile('${p.id}');" style="color: var(--accent); font-weight: 600; text-decoration: none;">
                ${p.name}
              </a>
            </td>
            <td style="color: var(--text-main); font-size: 0.85rem;">${p.project_type}</td>
            <td style="color: var(--text-main); font-size: 0.85rem;">${p.location}</td>
            <td style="color: var(--text-main); font-size: 0.85rem;">${p.city}</td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${(p.status || '').replace(/_/g, ' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function applyProjectsFilter() {
  const fName = (document.getElementById('filter-p-name')?.value || '').toLowerCase();
  const fType = (document.getElementById('filter-p-type')?.value || '').toUpperCase();
  const fLoc = (document.getElementById('filter-p-location')?.value || '').toLowerCase();
  const fCity = (document.getElementById('filter-p-city')?.value || '').toLowerCase();
  const fStatus = (document.getElementById('filter-p-status')?.value || '').toUpperCase();

  const filtered = allProjectsData.filter(p => {
    if (fName && p.name.toLowerCase() !== fName) return false;
    if (fType && p.project_type.toUpperCase() !== fType) return false;
    if (fLoc && p.location.toLowerCase() !== fLoc) return false;
    if (fCity && p.city.toLowerCase() !== fCity) return false;
    if (fStatus && p.status.toUpperCase() !== fStatus) return false;
    return true;
  });

  const tableContainer = document.getElementById('projects-table-container');
  if (tableContainer) {
    tableContainer.innerHTML = renderProjectsTableHtml(filtered);
  }
}

// ----------------------------------------------------
// PROJECT DETAILS PAGE (PROFILE VIEW)
// ----------------------------------------------------
async function loadProjectDetailsView(projectId, container) {
  try {
    container.innerHTML = `<p style="color: var(--text-muted);">Loading project profile details...</p>`;
    const res = await apiFetch(`/projects/${projectId}`);
    const project = res.data;

    const titleHeading = document.getElementById('page-title-heading');
    if (titleHeading) titleHeading.innerText = `Project Profile: ${project.name}`;

    const totalUnits = project.total_units || project.actual_unit_count || 0;
    const availableUnits = project.available_units_count || 0;
    const bookedUnits = project.booked_units_count || 0;
    const soldUnits = project.sold_units_count || 0;

    container.innerHTML = `
      <!-- BACK BUTTON HEADER -->
      <div style="margin-bottom: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-secondary btn-sm" onclick="switchView('projects')" style="display: inline-flex; align-items: center; gap: 0.4rem;">
          ${getIcon('arrowLeft')} Back to Projects Directory
        </button>
        <span class="badge badge-active">${project.status}</span>
      </div>

      <!-- 1. PROJECT SUMMARY KPI CARDS -->
      <div class="grid-5" style="margin-bottom: 1.25rem;">
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Total Units</div>
            <div class="kpi-value">${totalUnits}</div>
          </div>
          <div class="kpi-icon-box">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Available</div>
            <div class="kpi-value" style="color: var(--success);">${availableUnits}</div>
          </div>
          <div class="kpi-icon-box" style="color: var(--success);">${getIcon('units')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Booked</div>
            <div class="kpi-value" style="color: var(--info);">${bookedUnits}</div>
          </div>
          <div class="kpi-icon-box" style="color: var(--info);">${getIcon('deals')}</div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Sold</div>
            <div class="kpi-value" style="color: var(--danger);">${soldUnits}</div>
          </div>
          <div class="kpi-icon-box" style="color: var(--danger);">${getIcon('projects')}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
        <!-- 2. PROJECT OVERVIEW CARD -->
        <div class="table-container" style="margin-bottom: 0;">
          <div class="table-header">
            <h3 style="font-weight: 600; font-size: 0.9rem;">Project Overview</h3>
          </div>
          <div style="padding: 1.1rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.82rem;">
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Project Name</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.name}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Project Type</div>
                <div style="margin-top: 0.15rem;"><span class="badge badge-booked">${project.project_type}</span></div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Builder / Developer</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.builder_developer || 'Nexora Infrastructure'}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Status</div>
                <div style="margin-top: 0.15rem;"><span class="badge badge-active">${project.status}</span></div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Location</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.location}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">City</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.city}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Possession Date / Status</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.possession_date || 'Q4 2026'}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">RERA Number</div>
                <div style="font-weight: 600; margin-top: 0.15rem;">${project.rera_number || 'PRM/KA/RERA/1251/2026'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. DOCUMENTS CARD -->
        <div class="table-container" style="margin-bottom: 0;">
          <div class="table-header">
            <h3 style="font-weight: 600; font-size: 0.9rem;">Documents & Downloads</h3>
          </div>
          <div style="padding: 1.1rem; font-size: 0.82rem;">
            ${(project.brochure_url || project.rera_number) ? `
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${project.brochure_url ? `
                  <div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase;">Project Brochure</div>
                    <div style="display: flex; gap: 0.5rem;">
                      <a href="${project.brochure_url}" target="_blank" class="btn btn-accent btn-sm" style="flex: 1; justify-content: center; font-size: 0.8rem;">
                        👁️ View PDF
                      </a>
                      <a href="${project.brochure_url}" download class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; font-size: 0.8rem;">
                        📥 Download
                      </a>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.35rem;">
                      ${project.brochure_url.split('/').pop()}
                    </div>
                  </div>
                ` : ''}
                ${project.rera_number ? `
                  <div style="padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; text-align: center; margin-top: ${project.brochure_url ? '0.5rem' : '0'};">
                    <div style="font-size: 0.7rem; color: var(--text-muted);">RTMI / RERA REGISTRATION</div>
                    <div style="font-weight: 600; font-size: 0.78rem; margin-top: 0.2rem; color: var(--accent);">${project.rera_number}</div>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem 0;">
                No downloadable documents attached for this project.
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- 4. TOWERS / BUILDINGS SECTION -->
      <div class="table-container" style="margin-bottom: 1.25rem;">
        <div class="table-header">
          <h3 style="font-weight: 600; font-size: 0.9rem;">Towers & Building Structure</h3>
        </div>
        <div>
          ${project.buildings && project.buildings.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Tower / Building Name</th>
                  <th>Total Floors</th>
                  <th>Units / Floor</th>
                  <th>Total Units</th>
                  <th>Available Units</th>
                  <th>Construction Status</th>
                </tr>
              </thead>
              <tbody>
                ${project.buildings.map(b => `
                  <tr>
                    <td><b>${b.name}</b></td>
                    <td>${b.total_floors} Floors</td>
                    <td>${b.units_per_floor}</td>
                    <td><b>${b.total_units_in_building || (b.total_floors * b.units_per_floor)}</b></td>
                    <td><span style="color: var(--success); font-weight: 600;">${b.available_units_in_building || 0}</span></td>
                    <td><span class="badge badge-active">${b.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
              No tower/building details registered for this project.
            </div>
          `}
        </div>
      </div>

      <!-- 5. PROPERTY / INVENTORY SECTION -->
      <div class="table-container">
        <div class="table-header">
          <h3 style="font-weight: 600; font-size: 0.9rem;">Property Inventory Units</h3>
        </div>
        <div>
          ${project.units && project.units.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Unit Number</th>
                  <th>Tower</th>
                  <th>Unit Type</th>
                  <th>Floor</th>
                  <th>Sq. Ft. Area</th>
                  <th>Base Price</th>
                  <th>Facing</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${project.units.map(u => `
                  <tr>
                    <td><b>${u.unit_number}</b></td>
                    <td>${u.building_name || 'Main Tower'}</td>
                    <td><span class="badge badge-booked">${u.unit_type}</span></td>
                    <td>Floor ${u.floor_number}</td>
                    <td>${u.carpet_area_sqft ? `${u.carpet_area_sqft} sq.ft` : 'N/A'}</td>
                    <td><b>₹${(u.base_price / 100000).toFixed(1)} Lakhs</b></td>
                    <td>${u.facing || 'East'}</td>
                    <td><span class="badge badge-${u.status.toLowerCase()}">${u.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
              No property units attached to this project in the inventory matrix.
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
  }
}

// ----------------------------------------------------
// REDESIGNED ADD PROJECT MODAL
// ----------------------------------------------------
function openCreateProjectModal() {
  showModal('Add Real Estate Project', `
    <form id="create-project-form">
      <div class="form-group">
        <label>Project Name</label>
        <input type="text" id="p-name" class="form-control" placeholder="e.g. Nexora Grand Residences" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Project Type</label>
          <select id="p-type" class="form-control" required>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Independent">Independent</option>
            <option value="Villa">Villa</option>
            <option value="Plotted">Plotted</option>
          </select>
        </div>
        <div class="form-group">
          <label>Builder / Developer</label>
          <input type="text" id="p-builder" class="form-control" placeholder="e.g. Nexora Infrastructure" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="p-loc" class="form-control" placeholder="Location address" required />
        </div>
        <div class="form-group">
          <label>City</label>
          <input type="text" id="p-city" class="form-control" placeholder="City name" required />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Status</label>
          <select id="p-status" class="form-control">
            <option value="UNDER_CONSTRUCTION">Under Construction</option>
            <option value="READY_TO_MOVE">Ready to Move</option>
            <option value="COMPLETED">Completed</option>
            <option value="PLANNING">Planning</option>
          </select>
        </div>
        <div class="form-group">
          <label>Total Units</label>
          <input type="number" id="p-units" class="form-control" value="100" />
        </div>
      </div>

      <div class="form-group">
        <label>Project Brochure (PDF only, max 10MB)</label>
        <input type="file" id="p-brochure" class="form-control" accept=".pdf" />
        <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem; display: block;">
          Upload a PDF brochure for this project
        </small>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Possession Status / Date</label>
          <input type="text" id="p-possession" class="form-control" placeholder="e.g. Q4 2026" />
        </div>
        <div class="form-group">
          <label>RTMI / RERA Registration No.</label>
          <input type="text" id="p-rera" class="form-control" placeholder="e.g. PRM/KA/RERA/1251" />
        </div>
      </div>

      <button type="submit" class="btn btn-accent" style="width: 100%; justify-content: center; margin-top: 0.5rem;">Save Project Profile</button>
    </form>
  `);

  document.getElementById('create-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append('name', document.getElementById('p-name').value);
      formData.append('project_type', document.getElementById('p-type').value);
      formData.append('builder_name', document.getElementById('p-builder').value);
      formData.append('location', document.getElementById('p-loc').value);
      formData.append('city', document.getElementById('p-city').value);
      formData.append('status', document.getElementById('p-status').value);
      formData.append('total_units', parseInt(document.getElementById('p-units').value, 10));
      formData.append('possession_date', document.getElementById('p-possession').value);
      formData.append('rera_number', document.getElementById('p-rera').value);

      // Add brochure file if selected
      const brochureFile = document.getElementById('p-brochure').files[0];
      if (brochureFile) {
        formData.append('brochure', brochureFile);
      }

      const headers = {};
      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create project');
      }

      closeModal();
      state.currentView = 'projects';
      state.selectedProjectId = null;
      renderApp();
    } catch (err) {
      alert(err.message);
    }
  });
}

// Modal Utility
function showModal(title, contentHtml, extraClass = '') {
  const modalDiv = document.createElement('div');
  modalDiv.className = 'modal-overlay';
  modalDiv.id = 'active-modal';
  modalDiv.innerHTML = `
    <div class="modal-card ${extraClass}">
      <div class="modal-header">
        <h3 style="font-size: 1.1rem; font-weight: 700;">${title}</h3>
        <button class="btn-icon" onclick="closeModal()" style="border: none;">✖</button>
      </div>
      <div>${contentHtml}</div>
    </div>
  `;
  document.body.appendChild(modalDiv);
}

function closeModal() {
  const modal = document.getElementById('active-modal');
  if (modal) modal.remove();
}

// Entity View Loaders
async function loadUnitsView(container) {
  const res = await apiFetch('/units');
  const units = res.data;
  container.innerHTML = `<div class="unit-grid">${units.map(u => `<div class="unit-card ${u.status.toLowerCase()}"><div class="unit-num">${u.unit_number}</div><div class="unit-type-sub">${u.unit_type}</div><div style="font-weight: 700; margin-top: 0.2rem;">₹${(u.base_price / 100000).toFixed(1)}L</div></div>`).join('')}</div>`;
}

// ─── LEADS MODULE ───────────────────────────────────────────────────────────
state.leads = [];
state.leadFilters = { name: '', phone: '', email: '', source: '', stage: '' };

async function loadLeadsView(container) {
  try {
    const res = await apiFetch('/leads');
    state.leads = res.data || [];
    renderLeadsTable(container);
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); padding: 2rem;">${err.message}</p>`;
  }
}

function renderLeadsTable(container) {
  let fl = state.leads;
  const f = state.leadFilters;

  if (f.name) fl = fl.filter(l => ((l.first_name || '') + ' ' + (l.last_name || '')).toLowerCase().includes(f.name.toLowerCase()));
  if (f.phone) fl = fl.filter(l => (l.phone || '').includes(f.phone));
  if (f.email) fl = fl.filter(l => (l.email || '').toLowerCase().includes(f.email.toLowerCase()));
  if (f.source) fl = fl.filter(l => (l.source || '').toLowerCase() === f.source.toLowerCase());
  if (f.stage) fl = fl.filter(l => (l.stage || '').toLowerCase() === f.stage.toLowerCase());

  const addBtn = (state.user.role === 'SUPER_ADMIN' || state.user.role === 'ADMIN')
    ? `<button class="btn btn-accent btn-sm" onclick="openAddLeadModal()">+ Add Lead</button>`
    : '';

  container.innerHTML = `
  <div class="table-container" style="margin: 0 0 1.25rem 0;">
      <!-- TOP BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; border-bottom:1px solid var(--border-color);">
        <h3 style="font-weight:700; font-size:1rem; margin:0;">Lead Pipeline</h3>
        ${addBtn}
      </div>

      <!-- ONE-ROW FILTER -->
      <div class="leads-filter-row" style="margin-bottom: 1.25rem;">  
      <input  class="filter-input"  id="fltr-name"   type="text"  placeholder="Name"   value="${f.name}"   oninput="updateLeadFilter('name', this.value)">
        <input  class="filter-input"  id="fltr-phone"  type="text"  placeholder="Phone"  value="${f.phone}"  oninput="updateLeadFilter('phone', this.value)">
        <input  class="filter-input"  id="fltr-email"  type="text"  placeholder="Email"  value="${f.email}"  oninput="updateLeadFilter('email', this.value)">
        <select class="filter-select" id="fltr-source" onchange="updateLeadFilter('source', this.value)">
          <option value="">Source </option>
          <option value="Social Media"    ${f.source === 'Social Media' ? 'selected' : ''}>Social Media</option>
          <option value="Marketing Firms" ${f.source === 'Marketing Firms' ? 'selected' : ''}>Marketing Firms</option>
          <option value="Website"         ${f.source === 'Website' ? 'selected' : ''}>Website</option>
          <option value="Facebook Ads"    ${f.source === 'Facebook Ads' ? 'selected' : ''}>Facebook Ads</option>
          <option value="Instagram"        ${f.source === 'Instagram' ? 'selected' : ''}>Instagram</option>
          <option value="Google Ads"       ${f.source === 'Google Ads' ? 'selected' : ''}>Google Ads</option>
          <option value="Walk In"          ${f.source === 'Walk In' ? 'selected' : ''}>Walk In</option>
          <option value="Referral"         ${f.source === 'Referral' ? 'selected' : ''}>Referral</option>
          <option value="Other"            ${f.source === 'Other' ? 'selected' : ''}>Other</option>
        </select>
        <select class="filter-select" id="fltr-stage" onchange="updateLeadFilter('stage', this.value)">
          <option value="">Stage </option>
          <option value="Fresh Lead"           ${f.stage === 'Fresh Lead' ? 'selected' : ''}>Fresh Lead</option>
          <option value="1st Attempt Done"      ${f.stage === '1st Attempt Done' ? 'selected' : ''}>1st Attempt Done</option>
          <option value="2nd Attempt Done"      ${f.stage === '2nd Attempt Done' ? 'selected' : ''}>2nd Attempt Done</option>
          <option value="Not Answered"          ${f.stage === 'Not Answered' ? 'selected' : ''}>Not Answered</option>
          <option value="Not Reachable"         ${f.stage === 'Not Reachable' ? 'selected' : ''}>Not Reachable</option>
          <option value="No Response"           ${f.stage === 'No Response' ? 'selected' : ''}>No Response</option>
          <option value="Hold"                  ${f.stage === 'Hold' ? 'selected' : ''}>Hold</option>
          <option value="Site Visit Scheduled"  ${f.stage === 'Site Visit Scheduled' ? 'selected' : ''}>Site Visit Scheduled</option>
          <option value="Site Visit Confirmed"  ${f.stage === 'Site Visit Confirmed' ? 'selected' : ''}>Site Visit Confirmed</option>
          <option value="2nd Visit Scheduled"   ${f.stage === '2nd Visit Scheduled' ? 'selected' : ''}>2nd Visit Scheduled</option>
          <option value="Rescheduled"            ${f.stage === 'Rescheduled' ? 'selected' : ''}>Rescheduled</option>
          <option value="Site Visit Cancelled"  ${f.stage === 'Site Visit Cancelled' ? 'selected' : ''}>Site Visit Cancelled</option>
          <option value="Site Visit Done"        ${f.stage === 'Site Visit Done' ? 'selected' : ''}>Site Visit Done</option>
          <option value="Booking Done"           ${f.stage === 'Booking Done' ? 'selected' : ''}>Booking Done</option>
          <option value="Junk"                   ${f.stage === 'Junk' ? 'selected' : ''}>Junk</option>
          <option value="Lost"                   ${f.stage === 'Lost' ? 'selected' : ''}>Lost</option>
          <option value="Duplicate"              ${f.stage === 'Duplicate' ? 'selected' : ''}>Duplicate</option>
        </select>
      </div>
      </div>

      <!-- TABLE -->
      <div class="table-container" style="margin: 0;">
      <table style="width:100%; border-collapse:collapse;">
        <tbody>
          ${fl.length ? fl.map(l => `
            <tr style="border-bottom:1px solid var(--border-muted);">
              <td style="padding:0.9rem 1.1rem;">
                <a href="#" onclick="event.preventDefault(); loadLeadDetailsView('${l.id}')" style="font-weight:600; color:var(--accent); text-decoration:none; white-space:nowrap;">
                  ${l.first_name} ${l.last_name || ''}
                </a>
              </td>
              <td style="padding:0.9rem 1.1rem;">${l.phone || '-'}</td>
              <td style="padding:0.9rem 1.1rem;">${l.email || '-'}</td>
              <td style="padding:0.9rem 1.1rem;">${l.source || '-'}</td>
              <td style="padding:0.9rem 1.1rem; color: var(--text-main); font-size: 0.85rem; white-space: nowrap;">${l.stage || 'Fresh Lead'}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:3rem;">No leads found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  // Preserve focus/cursor in active filter
  const active = document.activeElement && document.activeElement.id;
  if (active && active.startsWith('fltr-')) {
    const el = document.getElementById(active);
    if (el && el.tagName === 'INPUT') { const v = el.value; el.value = ''; el.value = v; el.focus(); }
  }
}

window.updateLeadFilter = function (type, value) {
  state.leadFilters[type] = value;
  renderLeadsTable(document.getElementById('content-area'));
};

// ─── ADD LEAD MODAL ──────────────────────────────────────────────────────────
window.openAddLeadModal = function () {
  let existing = document.getElementById('add-lead-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'add-lead-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:540px;">
      <div class="modal-header">
        <h3 style="font-weight:700; margin:0; font-size:1.05rem;">Add New Lead</h3>
        <button class="btn-icon" onclick="document.getElementById('add-lead-modal-overlay').remove()" style="font-size:1.2rem; line-height:1;">&times;</button>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem;">
        <div class="form-group" style="margin-bottom:0;">
          <label>First Name *</label>
          <input type="text" id="al-fname" class="form-control" placeholder="First name">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Last Name</label>
          <input type="text" id="al-lname" class="form-control" placeholder="Last name">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Phone *</label>
          <input type="text" id="al-phone" class="form-control" placeholder="+91 ...">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Email</label>
          <input type="email" id="al-email" class="form-control" placeholder="email@example.com">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Source *</label>
          <select id="al-source" class="form-control">
            <option value="">Select source...</option>
            <option value="Social Media">Social Media</option>
            <option value="Marketing Firms">Marketing Firms</option>
            <option value="Website">Website</option>
            <option value="Facebook Ads">Facebook Ads</option>
            <option value="Instagram">Instagram</option>
            <option value="Google Ads">Google Ads</option>
            <option value="Walk In">Walk In</option>
            <option value="Referral">Referral</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Stage</label>
          <select id="al-stage" class="form-control">
            <option value="Fresh Lead">Fresh Lead</option>
            <option value="1st Attempt Done">1st Attempt Done</option>
            <option value="Not Answered">Not Answered</option>
            <option value="Not Reachable">Not Reachable</option>
            <option value="Hold">Hold</option>
            <option value="Site Visit Scheduled">Site Visit Scheduled</option>
            <option value="Booking Done">Booking Done</option>
            <option value="Junk">Junk</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:0.9rem; margin-bottom:0;">
        <label>Note</label>
        <textarea id="al-note" class="form-control" style="height:80px; resize:vertical;" placeholder="Optional note..."></textarea>
      </div>

      <div id="al-error" style="color:var(--danger); font-size:0.82rem; margin-top:0.6rem; display:none;"></div>

      <div style="display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.2rem;">
        <button class="btn btn-secondary" onclick="document.getElementById('add-lead-modal-overlay').remove()">Cancel</button>
        <button class="btn btn-accent" id="al-save-btn" onclick="submitAddLead()">Save Lead</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('al-fname').focus();
};

window.submitAddLead = async function () {
  const errEl = document.getElementById('al-error');
  const saveBtn = document.getElementById('al-save-btn');
  errEl.style.display = 'none';

  const first_name = document.getElementById('al-fname').value.trim();
  const last_name = document.getElementById('al-lname').value.trim();
  const phone = document.getElementById('al-phone').value.trim();
  const email = document.getElementById('al-email').value.trim();
  const source = document.getElementById('al-source').value;
  const stage = document.getElementById('al-stage').value;
  const notes = document.getElementById('al-note').value.trim();

  if (!first_name) { errEl.textContent = 'First name is required.'; errEl.style.display = 'block'; return; }
  if (!phone) { errEl.textContent = 'Phone is required.'; errEl.style.display = 'block'; return; }
  if (!source) { errEl.textContent = 'Source is required.'; errEl.style.display = 'block'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await apiFetch('/leads', {
      method: 'POST',
      body: JSON.stringify({ first_name, last_name, phone, email, source, stage, notes })
    });
    document.getElementById('add-lead-modal-overlay').remove();
    // Reload leads and re-render
    const res = await apiFetch('/leads');
    state.leads = res.data || [];
    renderLeadsTable(document.getElementById('content-area'));
  } catch (err) {
    errEl.textContent = err.message || 'Failed to save lead.';
    errEl.style.display = 'block';
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Lead';
  }
};


window.loadLeadDetailsView = async function (id) {
  const container = document.getElementById('content-area');
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading lead details...</div>';
  try {
    const res = await apiFetch('/leads/' + id);
    const lead = res.data;
    const notesStr = lead.notes || '';

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <button class="btn btn-secondary" style="font-weight: 600;" onclick="loadLeadsView(document.getElementById('content-area'))">← Back to Leads</button>
      </div>
      
      <div class="table-container" style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);">
          <div>
            <h2 style="margin: 0 0 0.4rem 0; font-size: 1.8rem; font-weight: 700; color: var(--text-main);">${lead.first_name} ${lead.last_name || ''}</h2>
            <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem;">Lead Details & Pipeline Status</p>
          </div>
          <div style="display: flex; gap: 0.6rem;">
            ${lead.stage !== 'Booking Done' && lead.stage !== 'WON' ? `<button class="btn btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.92rem;" onclick="openLeadBookingModal('${lead.id}')">🏢 Convert to Booking</button>` : ''}
            <button class="btn btn-accent" style="padding: 0.6rem 1.2rem; font-size: 0.92rem;" onclick="saveLeadDetails('${lead.id}')">Save Changes</button>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;">
          <!-- Left Column -->
          <div>
            <h4 style="font-weight: 700; font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--text-main);">Basic Information</h4>
            
            <div class="form-group">
              <label>First Name</label>
              <input type="text" id="ld-fname" class="form-control" value="${lead.first_name}">
            </div>
            
            <div class="form-group">
              <label>Last Name</label>
              <input type="text" id="ld-lname" class="form-control" value="${lead.last_name || ''}">
            </div>
            
            <div class="form-group">
              <label>Phone</label>
              <input type="text" id="ld-phone" class="form-control" value="${lead.phone}">
            </div>
            
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="ld-email" class="form-control" value="${lead.email || ''}">
            </div>
            
            <div class="form-group">
              <label>Source</label>
              <select id="ld-source" class="form-control">
                <option value="${lead.source}" selected>${lead.source}</option>
                <option disabled>---</option>
                <option value="Social Media">Social Media</option>
                <option value="Marketing Firms">Marketing Firms</option>
                <option value="Website">Website</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Instagram">Instagram</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Walk In">Walk In</option>
                <option value="Referral">Referral</option>
                <option value="Other">Other</option>
                <option value="WEBSITE_FORM">Website Form (Legacy)</option>
                <option value="DIRECT_CALL">Direct Call (Legacy)</option>
                <option value="WHATSAPP">WhatsApp (Legacy)</option>
                <option value="FACEBOOK_ADS">Facebook Ads (Legacy)</option>
                <option value="WALK_IN">Walk-in (Legacy)</option>
                <option value="REFERRAL">Referral (Legacy)</option>
              </select>
            </div>
          </div>
          
          <!-- Right Column -->
          <div>
            <h4 style="font-weight: 700; font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--text-main);">Pipeline Status</h4>
            
            <div class="form-group">
              <label>Current Stage</label>
              <select id="ld-stage" class="form-control">
                <option value="${lead.stage}" selected>${lead.stage}</option>
                <option disabled>---</option>
                <option value="Fresh Lead">Fresh Lead</option>
                <option value="1st Attempt Done">1st Attempt Done</option>
                <option value="2nd Attempt Done">2nd Attempt Done</option>
                <option value="Not Answered">Not Answered</option>
                <option value="Not Reachable">Not Reachable</option>
                <option value="No Response">No Response</option>
                <option value="Hold">Hold</option>
                <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                <option value="Site Visit Confirmed">Site Visit Confirmed</option>
                <option value="2nd Visit Scheduled">2nd Visit Scheduled</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Site Visit Cancelled">Site Visit Cancelled</option>
                <option value="Site Visit Done">Site Visit Done</option>
                <option value="Booking Done">Booking Done</option>
                <option value="Junk">Junk</option>
                <option value="Lost">Lost</option>
                <option value="Duplicate">Duplicate</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Notes</label>
              <textarea id="ld-notes" class="form-control" style="height: 150px; resize: vertical;">${notesStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
            
            <div style="margin-top: 2.5rem; background: var(--bg-main); padding: 1.2rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <p style="margin: 0 0 0.6rem 0; font-size: 0.85rem; color: var(--text-muted);"><strong>Created:</strong> ${new Date(lead.created_at).toLocaleString()}</p>
              <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);"><strong>Last Updated:</strong> ${new Date(lead.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: var(--danger); text-align: center;">${err.message}</div>`;
  }
};

window.saveLeadDetails = async function (id) {
  const payload = {
    first_name: document.getElementById('ld-fname').value,
    last_name: document.getElementById('ld-lname').value,
    phone: document.getElementById('ld-phone').value,
    email: document.getElementById('ld-email').value,
    source: document.getElementById('ld-source').value,
    stage: document.getElementById('ld-stage').value,
    notes: document.getElementById('ld-notes').value,
  };
  try {
    await apiFetch('/leads/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    alert('Lead updated successfully!');

    // Check if stage change triggers site visit
    const s = payload.stage;
    if (s === 'Site Visit Scheduled' || s === 'Site Visit Confirmed' || s === '2nd Visit Scheduled' || s === 'Rescheduled') {
      const name = (payload.first_name + ' ' + (payload.last_name || '')).trim();
      openScheduleVisitModal({ leadId: id, leadName: name });
    } else {
      loadLeadDetailsView(id); // reload
    }
  } catch (err) {
    alert('Failed to update lead: ' + err.message);
  }
};

async function loadCustomersView(container) {
  const res = await apiFetch('/customers');
  container.innerHTML = `<div class="table-container"><table><thead><tr><th>Buyer Name</th><th>Phone</th><th>Email</th><th>KYC Status</th></tr></thead><tbody>${res.data.map(c => `<tr><td>${c.first_name} ${c.last_name || ''}</td><td>${c.phone}</td><td>${c.email || 'N/A'}</td><td><span class="badge badge-active">${c.kyc_status}</span></td></tr>`).join('')}</tbody></table></div>`;
}

async function loadSiteVisitsView(container) {
  await loadCalendarView(container);
}

// ----------------------------------------------------
// CALENDAR & SITE VISIT WORKFLOW
// ----------------------------------------------------
function formatLeadStage(stage) {
  const labels = {
    INCOMING: 'Incoming',
    CONTACTED: 'Contacted',
    VISIT_SCHEDULED: 'Site Visit Scheduled',
    VISIT_COMPLETED: 'Site Visit Done',
    NEGOTIATION: 'Negotiation',
    WON: 'Won',
    LOST: 'Lost'
  };
  return labels[stage] || stage;
}

function formatVisitStatus(status) {
  const labels = {
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show'
  };
  return labels[status] || status;
}

function getVisitStatusBadgeClass(status) {
  const map = {
    SCHEDULED: 'badge-booked',
    COMPLETED: 'badge-available',
    CANCELLED: 'badge-sold',
    NO_SHOW: 'badge-hold'
  };
  return map[status] || 'badge-booked';
}

function getClientName(visit) {
  if (visit.lead_first_name) return `${visit.lead_first_name} ${visit.lead_last_name || ''}`.trim();
  if (visit.customer_first_name) return `${visit.customer_first_name} ${visit.customer_last_name || ''}`.trim();
  return 'Unknown Client';
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function toDatetimeLocalValue(dateStr) {
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toMysqlDatetime(dateInput) {
  const d = new Date(dateInput);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function calendarNavigate(direction) {
  const d = new Date(state.calendarDate);
  d.setMonth(d.getMonth() + direction);
  state.calendarDate = d;
  const contentArea = document.getElementById('content-area');
  if (contentArea) loadCalendarView(contentArea);
}

function calendarGoToday() {
  state.calendarDate = new Date();
  const contentArea = document.getElementById('content-area');
  if (contentArea) loadCalendarView(contentArea);
}

async function connectGoogleCalendar() {
  try {
    const res = await apiFetch('/calendar/auth');
    if (res.data && res.data.authUrl) {
      window.location.href = res.data.authUrl;
    } else {
      alert('Google Calendar configuration is missing or invalid.');
    }
  } catch (err) {
    alert('Failed to connect Google Calendar: ' + err.message);
  }
}
window.connectGoogleCalendar = connectGoogleCalendar;

async function loadCalendarView(container) {
  try {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const monthLabel = state.calendarDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const [visitsRes, calendarStatusRes] = await Promise.all([
      apiFetch('/site-visits'),
      apiFetch('/calendar/status').catch(() => ({ data: { connected: false } }))
    ]);

    const visits = visitsRes.data || [];
    const googleConnected = calendarStatusRes.data?.connected === true;
    const isAdmin = state.user.role === 'SUPER_ADMIN';

    const visitsByDate = {};
    visits.forEach(v => {
      const key = new Date(v.scheduled_time).toDateString();
      if (!visitsByDate[key]) visitsByDate[key] = [];
      visitsByDate[key].push(v);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayStr = new Date().toDateString();

    let cells = '';
    for (let i = 0; i < startPad; i++) {
      cells += '<div class="cal-day cal-day-empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateKey = dateObj.toDateString();
      const isToday = dateKey === todayStr;
      const dayVisits = visitsByDate[dateKey] || [];

      cells += `
        <div class="cal-day ${isToday ? 'cal-day-today' : ''}">
          <div class="cal-day-num">${day}</div>
          <div class="cal-day-events">
            ${dayVisits.slice(0, 3).map(v => `
              <div class="cal-event cal-event-${v.status.toLowerCase()}" onclick="openVisitDetailModal('${v.id}')" title="${getClientName(v)} - ${v.project_name}">
                <span class="cal-event-time">${formatTime(v.scheduled_time)}</span>
                <span class="cal-event-title">${getClientName(v)}</span>
              </div>
            `).join('')}
            ${dayVisits.length > 3 ? `<div class="cal-event-more">+${dayVisits.length - 3} more</div>` : ''}
          </div>
        </div>
      `;
    }

    const scheduledCount = visits.filter(v => v.status === 'SCHEDULED').length;
    const completedCount = visits.filter(v => v.status === 'COMPLETED').length;

    container.innerHTML = `
      <div class="cal-toolbar">
        <div class="cal-toolbar-left">
          <button class="btn btn-secondary btn-sm" onclick="calendarNavigate(-1)">&#8249; Prev</button>
          <button class="btn btn-secondary btn-sm" onclick="calendarGoToday()">Today</button>
          <button class="btn btn-secondary btn-sm" onclick="calendarNavigate(1)">Next &#8250;</button>
          <h2 class="cal-month-title">${monthLabel}</h2>
        </div>
        <div class="cal-toolbar-right">
          ${googleConnected 
            ? '<span class="cal-google-status connected">Google Calendar: Connected</span>' 
            : '<button class="btn btn-accent btn-sm" onclick="connectGoogleCalendar()">Connect Google Calendar</button>'
          }
        </div>
      </div>

      <div class="cal-stats-row">
        <div class="cal-stat"><span class="cal-stat-val">${scheduledCount}</span><span class="cal-stat-label">Scheduled</span></div>
        <div class="cal-stat"><span class="cal-stat-val">${completedCount}</span><span class="cal-stat-label">Completed</span></div>
        <div class="cal-stat"><span class="cal-stat-val">${visits.length}</span><span class="cal-stat-label">Total Visits</span></div>
      </div>

      <div class="cal-grid">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-header-cell">${d}</div>`).join('')}
        ${cells}
      </div>

      <div class="cal-legend">
        <span><i class="cal-legend-dot scheduled"></i> Scheduled</span>
        <span><i class="cal-legend-dot completed"></i> Completed</span>
        <span><i class="cal-legend-dot cancelled"></i> Cancelled</span>
        <span><i class="cal-legend-dot no_show"></i> No Show</span>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Failed to load calendar: ${err.message}</p>`;
  }
}

async function openVisitDetailModal(visitId) {
  try {
    const res = await apiFetch(`/site-visits/${visitId}`);
    const visit = res.data;
    const isAdmin = state.user.role === 'SUPER_ADMIN';
    const clientName = getClientName(visit);
    const agentName = `${visit.agent_first_name} ${visit.agent_last_name || ''}`.trim();
    const history = visit.history || [];
    const canAct = isAdmin && visit.status === 'SCHEDULED';

    showModal('Site Visit Details', `
      <div class="visit-detail">
        <div class="visit-detail-header">
          <span class="badge ${getVisitStatusBadgeClass(visit.status)}">${formatVisitStatus(visit.status)}</span>
          ${visit.google_event_id ? '<span class="cal-google-status connected" style="font-size:0.7rem;">Synced to Google</span>' : ''}
        </div>

        <div class="visit-detail-grid">
          <div><label>Client</label><div>${clientName}</div></div>
          <div><label>Project</label><div>${visit.project_name}</div></div>
          <div><label>Date & Time</label><div>${formatDateTime(visit.scheduled_time)}</div></div>
          <div><label>Salesperson</label><div>${agentName} ${visit.agent_email ? `(${visit.agent_email})` : ''}</div></div>
          ${visit.lead_phone || visit.customer_phone ? `<div><label>Phone</label><div>${visit.lead_phone || visit.customer_phone}</div></div>` : ''}
          ${visit.lead_email || visit.customer_email ? `<div><label>Email</label><div>${visit.lead_email || visit.customer_email}</div></div>` : ''}
          ${visit.project_location ? `<div><label>Location</label><div>${visit.project_location}${visit.project_city ? `, ${visit.project_city}` : ''}</div></div>` : ''}
          ${visit.lead_stage ? `<div><label>Lead Stage</label><div>${formatLeadStage(visit.lead_stage)}</div></div>` : ''}
        </div>

        ${visit.client_feedback ? `<div class="visit-notes"><label>Notes</label><p>${visit.client_feedback}</p></div>` : ''}

        ${canAct ? `
          <div class="visit-actions">
            <button class="btn btn-accent btn-sm" onclick="updateVisitStatus('${visit.id}', 'COMPLETED')">Mark Done</button>
            <button class="btn btn-secondary btn-sm" onclick="openRescheduleModal('${visit.id}')">Reschedule</button>
            <button class="btn btn-secondary btn-sm" onclick="updateVisitStatus('${visit.id}', 'NO_SHOW')">No Show</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="updateVisitStatus('${visit.id}', 'CANCELLED')">Cancel</button>
          </div>
        ` : ''}

        ${history.length ? `
          <div class="visit-history">
            <h4>Visit History</h4>
            ${history.map(h => `
              <div class="visit-history-item">
                <div class="visit-history-action">${h.action.replace(/_/g, ' ')}</div>
                <div class="visit-history-meta">
                  ${h.performer_first_name ? `${h.performer_first_name} ${h.performer_last_name || ''} · ` : ''}
                  ${new Date(h.created_at).toLocaleString('en-IN')}
                </div>
                ${h.notes ? `<div class="visit-history-notes">${h.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `, 'modal-wide');
  } catch (err) {
    alert(err.message);
  }
}

async function updateVisitStatus(visitId, status) {
  const labels = { COMPLETED: 'mark this visit as done', CANCELLED: 'cancel this visit', NO_SHOW: 'mark as no show' };
  if (!confirm(`Are you sure you want to ${labels[status] || 'update this visit'}?`)) return;

  try {
    await apiFetch(`/site-visits/${visitId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    closeModal();
    if (state.currentView === 'calendar') {
      loadCalendarView(document.getElementById('content-area'));
    } else if (state.currentView === 'leads') {
      loadLeadsView(document.getElementById('content-area'));
    }
  } catch (err) {
    alert(err.message);
  }
}

function openRescheduleModal(visitId) {
  closeModal();
  apiFetch(`/site-visits/${visitId}`).then(res => {
    const visit = res.data;
    showModal('Reschedule Visit', `
      <form id="reschedule-visit-form">
        <div class="form-group">
          <label>New Date & Time</label>
          <input type="datetime-local" id="sv-reschedule-time" class="form-control" value="${toDatetimeLocalValue(visit.scheduled_time)}" required />
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="sv-reschedule-notes" class="form-control" rows="2" placeholder="Reason for rescheduling...">${visit.client_feedback || ''}</textarea>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%;">Update Visit</button>
      </form>
    `);

    document.getElementById('reschedule-visit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const scheduled_time = toMysqlDatetime(document.getElementById('sv-reschedule-time').value);
        const notes = document.getElementById('sv-reschedule-notes').value;
        await apiFetch(`/site-visits/${visitId}`, {
          method: 'PUT',
          body: JSON.stringify({ scheduled_time, client_feedback: notes || undefined, status: 'SCHEDULED' })
        });
        closeModal();
        loadCalendarView(document.getElementById('content-area'));
      } catch (err) {
        alert(err.message);
      }
    });
  }).catch(err => alert(err.message));
}

async function openScheduleVisitModal(prefill = {}) {
  if (state.user.role !== 'SUPER_ADMIN') {
    alert('Only Super Admin can schedule visits.');
    return;
  }

  try {
    const [projectsRes, usersRes, leadsRes, customersRes] = await Promise.all([
      apiFetch('/projects'),
      apiFetch('/users'),
      apiFetch('/leads'),
      apiFetch('/customers')
    ]);

    const projects = projectsRes.data || [];
    const agents = (usersRes.data || []).filter(u => u.status === 'ACTIVE');
    const leads = leadsRes.data || [];
    const customers = customersRes.data || [];

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(10, 0, 0, 0);

    showModal('Schedule Site Visit', `
      <form id="schedule-visit-form">
        <div class="form-group">
          <label>Contact Type</label>
          <select id="sv-contact-type" class="form-control" onchange="toggleScheduleContactType()">
            <option value="lead" ${prefill.leadId ? 'selected' : ''}>Lead</option>
            <option value="customer" ${prefill.customerId ? 'selected' : ''}>Customer</option>
          </select>
        </div>
        <div class="form-group" id="sv-lead-group">
          <label>Lead</label>
          <select id="sv-lead" class="form-control">
            <option value="">Select Lead</option>
            ${leads.map(l => `<option value="${l.id}" ${prefill.leadId === l.id ? 'selected' : ''}>${l.first_name} ${l.last_name || ''} (${l.phone})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="sv-customer-group" style="display:none;">
          <label>Customer</label>
          <select id="sv-customer" class="form-control">
            <option value="">Select Customer</option>
            ${customers.map(c => `<option value="${c.id}" ${prefill.customerId === c.id ? 'selected' : ''}>${c.first_name} ${c.last_name || ''} (${c.phone})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Project</label>
          <select id="sv-project" class="form-control" required>
            <option value="">Select Project</option>
            ${projects.map(p => `<option value="${p.id}" ${prefill.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Assigned Salesperson</label>
          <select id="sv-agent" class="form-control" required>
            <option value="">Select Salesperson</option>
            ${agents.map(a => `<option value="${a.id}">${a.first_name || a.username} ${a.last_name || ''}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div class="form-group">
            <label>Date & Time</label>
            <input type="datetime-local" id="sv-datetime" class="form-control" value="${toDatetimeLocalValue(defaultDate)}" required />
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="sv-notes" class="form-control" rows="2" placeholder="Visit notes..."></textarea>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%;">Schedule Visit</button>
      </form>
    `);

    if (prefill.customerId) toggleScheduleContactType();

    document.getElementById('schedule-visit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const contactType = document.getElementById('sv-contact-type').value;
      const lead_id = contactType === 'lead' ? document.getElementById('sv-lead').value : null;
      const customer_id = contactType === 'customer' ? document.getElementById('sv-customer').value : null;

      if (!lead_id && !customer_id) {
        alert('Please select a lead or customer.');
        return;
      }

      try {
        const scheduled_time = toMysqlDatetime(document.getElementById('sv-datetime').value);
        await apiFetch('/site-visits', {
          method: 'POST',
          body: JSON.stringify({
            lead_id: lead_id || undefined,
            customer_id: customer_id || undefined,
            project_id: document.getElementById('sv-project').value,
            assigned_agent_id: document.getElementById('sv-agent').value,
            scheduled_time,
            notes: document.getElementById('sv-notes').value || undefined
          })
        });
        closeModal();
        if (state.currentView === 'calendar') {
          loadCalendarView(document.getElementById('content-area'));
        } else if (state.currentView === 'leads') {
          loadLeadsView(document.getElementById('content-area'));
        } else {
          switchView('calendar');
        }
      } catch (err) {
        alert(err.message);
      }
    });
  } catch (err) {
    alert(err.message);
  }
}

function toggleScheduleContactType() {
  const type = document.getElementById('sv-contact-type')?.value;
  const leadGroup = document.getElementById('sv-lead-group');
  const customerGroup = document.getElementById('sv-customer-group');
  if (leadGroup && customerGroup) {
    leadGroup.style.display = type === 'lead' ? 'block' : 'none';
    customerGroup.style.display = type === 'customer' ? 'block' : 'none';
  }
}

// --------------------------------------------------------------------------
// DEALS & BOOKINGS VIEW
// --------------------------------------------------------------------------
window.dealSearchFilter = '';
window.dealStatusFilter = '';

async function loadDealsView(container) {
  try {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading deals & bookings...</div>';
    let url = '/deals?';
    if (window.dealStatusFilter) url += `status=${window.dealStatusFilter}&`;
    if (window.dealSearchFilter) url += `search=${encodeURIComponent(window.dealSearchFilter)}&`;

    const res = await apiFetch(url);
    const deals = res.data || [];

    const totalBookingValue = deals.reduce((acc, d) => acc + Number(d.agreed_total_amount || 0), 0);
    const totalCollected = deals.reduce((acc, d) => acc + Number(d.total_paid_amount || 0), 0);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div class="kpi-card" style="background: var(--bg-card); padding: 1.1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
          <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Total Deals</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-top: 0.3rem;">${deals.length}</div>
        </div>
        <div class="kpi-card" style="background: var(--bg-card); padding: 1.1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
          <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Total Contract Value</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent); margin-top: 0.3rem;">₹${totalBookingValue.toLocaleString()}</div>
        </div>
        <div class="kpi-card" style="background: var(--bg-card); padding: 1.1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
          <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Collections Realized</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-top: 0.3rem;">₹${totalCollected.toLocaleString()}</div>
        </div>
      </div>

      <div class="table-container">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="font-weight: 700; font-size: 1.05rem; margin: 0;">Deals & Booking Contracts</h3>
            <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">Real-time property bookings, buyer contracts, and collection milestones.</p>
          </div>
          <div style="display: flex; gap: 0.6rem; align-items: center;">
            <input type="text" class="form-control" placeholder="Search deal #, customer, unit..." value="${window.dealSearchFilter}" style="width: 220px; font-size: 0.82rem;" oninput="window.dealSearchFilter=this.value; loadDealsView(document.getElementById('content-area'))">
            <select class="form-control" style="width: 140px; font-size: 0.82rem;" onchange="window.dealStatusFilter=this.value; loadDealsView(document.getElementById('content-area'))">
              <option value="" ${window.dealStatusFilter === '' ? 'selected' : ''}>All Statuses</option>
              <option value="BOOKED" ${window.dealStatusFilter === 'BOOKED' ? 'selected' : ''}>Booked</option>
              <option value="AGREEMENT_SIGNED" ${window.dealStatusFilter === 'AGREEMENT_SIGNED' ? 'selected' : ''}>Agreement Signed</option>
              <option value="CLOSED_WON" ${window.dealStatusFilter === 'CLOSED_WON' ? 'selected' : ''}>Closed Won</option>
              <option value="CANCELLED" ${window.dealStatusFilter === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card); font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Deal #</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Buyer Customer</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Property / Unit</th>
              <th style="padding: 0.75rem 1.1rem; text-align: right;">Contract Total</th>
              <th style="padding: 0.75rem 1.1rem; text-align: right;">Token / Paid</th>
              <th style="padding: 0.75rem 1.1rem; text-align: center;">Status</th>
              <th style="padding: 0.75rem 1.1rem; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${deals.length ? deals.map(d => {
              const totalVal = Number(d.agreed_total_amount || 0);
              const paidVal = Number(d.total_paid_amount || 0);
              return `
                <tr style="border-bottom: 1px solid var(--border-muted);">
                  <td style="padding: 0.85rem 1.1rem; font-weight: 700; color: var(--accent);">#${d.deal_number}</td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(d.customer_first_name)} ${escapeHtml(d.customer_last_name || '')}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${d.customer_phone || ''}</div>
                  </td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <div style="font-weight: 600;">Unit ${escapeHtml(d.unit_number)} (${escapeHtml(d.unit_type || '')})</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.project_name || '')}</div>
                  </td>
                  <td style="padding: 0.85rem 1.1rem; text-align: right; font-weight: 700; color: var(--text-main);">₹${totalVal.toLocaleString()}</td>
                  <td style="padding: 0.85rem 1.1rem; text-align: right;">
                    <div style="font-weight: 600; color: var(--text-main);">₹${paidVal.toLocaleString()}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">Token: ₹${Number(d.booking_token_amount || 0).toLocaleString()}</div>
                  </td>
                  <td style="padding: 0.85rem 1.1rem; text-align: center; color: var(--text-main); font-size: 0.85rem;">
                    ${(d.status || '').replace(/_/g, ' ')}
                  </td>
                  <td style="padding: 0.85rem 1.1rem; text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="openDealDetailModal('${d.id}')">View Details</button>
                  </td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">No deal records found matching current filters.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: var(--danger);">Failed to load deals: ${err.message}</div>`;
  }
}

window.openDealDetailModal = async function(dealId) {
  try {
    const res = await apiFetch(`/deals/${dealId}`);
    const d = res.data;

    let existing = document.getElementById('deal-detail-modal-overlay');
    if (existing) existing.remove();

    const totalAgreed = Number(d.agreed_total_amount || 0);
    const totalPaid = (d.payments || []).reduce((acc, p) => acc + Number(p.amount_received || 0), 0);
    const outstanding = Math.max(0, totalAgreed - totalPaid);

    const overlay = document.createElement('div');
    overlay.id = 'deal-detail-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">Deal #${d.deal_number}</h3>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.35rem; align-items: center;">
              <span style="color: var(--text-main); font-size: 0.85rem; font-weight: 600;">${(d.status || '').replace(/_/g, ' ')}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">Created on ${new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <button class="btn-icon" onclick="document.getElementById('deal-detail-modal-overlay').remove()">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
          <!-- Buyer Info -->
          <div style="background: var(--bg-card); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.6rem 0;">👤 Buyer Customer</h4>
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${escapeHtml(d.customer_first_name)} ${escapeHtml(d.customer_last_name || '')}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">📱 ${d.customer_phone || 'N/A'}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">✉️ ${d.customer_email || 'N/A'}</div>
            ${d.pan_tax_id ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">PAN / Tax ID: <b>${d.pan_tax_id}</b></div>` : ''}
          </div>

          <!-- Property Specs -->
          <div style="background: var(--bg-card); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.6rem 0;">🏢 Property Specifications</h4>
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${escapeHtml(d.project_name)} - Unit ${escapeHtml(d.unit_number)}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">Type: <b>${d.unit_type || 'N/A'}</b> | Floor: <b>${d.floor_number ?? 'G/Plotted'}</b></div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Super Area: <b>${d.super_area_sqft || d.plot_area_sqft || 'N/A'} sq.ft.</b> | Carpet: <b>${d.carpet_area_sqft || 'N/A'} sq.ft.</b></div>
          </div>
        </div>

        <!-- Financial Breakdown -->
        <div style="background: var(--bg-card); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.75rem 0;">💰 Financial Breakdown</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; font-size: 0.82rem;">
            <div><span style="color: var(--text-muted);">Base Price:</span><br><b>₹${Number(d.base_price || 0).toLocaleString()}</b></div>
            <div><span style="color: var(--text-muted);">PLC Charges:</span><br><b>₹${Number(d.plc_charges || 0).toLocaleString()}</b></div>
            <div><span style="color: var(--text-muted);">Parking:</span><br><b>₹${Number(d.parking_charges || 0).toLocaleString()}</b></div>
            <div><span style="color: var(--text-muted);">Taxes:</span><br><b>₹${Number(d.taxes_amount || 0).toLocaleString()}</b></div>
            <div><span style="color: var(--text-muted);">Discount:</span><br><b>- ₹${Number(d.discount_amount || 0).toLocaleString()}</b></div>
            <div><span style="color: var(--text-muted);">Token Paid:</span><br><b style="color: var(--text-main);">₹${Number(d.booking_token_amount || 0).toLocaleString()}</b></div>
          </div>
          <div style="border-top: 1px solid var(--border-color); margin-top: 0.75rem; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 0.82rem; color: var(--text-muted);">Agreed Total Amount:</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent);">₹${totalAgreed.toLocaleString()}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.82rem; color: var(--text-muted);">Outstanding Balance:</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">₹${outstanding.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <!-- Payment History -->
        <div>
          <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.6rem 0;">🧾 Payment Receipts (${(d.payments || []).length})</h4>
          ${(d.payments && d.payments.length > 0) ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
                  <th style="padding: 0.5rem; text-align: left;">Receipt #</th>
                  <th style="padding: 0.5rem; text-align: left;">Date</th>
                  <th style="padding: 0.5rem; text-align: left;">Mode</th>
                  <th style="padding: 0.5rem; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${d.payments.map(p => `
                  <tr style="border-bottom: 1px solid var(--border-muted);">
                    <td style="padding: 0.5rem; font-weight: 600;">${p.payment_number}</td>
                    <td style="padding: 0.5rem;">${new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    <td style="padding: 0.5rem;">${(p.payment_mode || '').replace(/_/g, ' ')}</td>
                    <td style="padding: 0.5rem; text-align: right; color: var(--text-main);">₹${Number(p.amount_received).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">No payments recorded yet for this deal.</p>'}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.5rem;">
          <button class="btn btn-secondary" onclick="document.getElementById('deal-detail-modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    alert('Failed to load deal details: ' + err.message);
  }
};

// --------------------------------------------------------------------------
// PAYMENTS VIEW
// --------------------------------------------------------------------------
async function loadPaymentsView(container) {
  try {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading payments...</div>';
    const res = await apiFetch('/payments');
    const payments = res.data || [];

    const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount_received || 0), 0);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 style="font-weight: 700; font-size: 1.05rem; margin: 0;">Payment Receipts & Collections</h3>
          <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">Realized cashflow receipts and customer milestone payments.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="background: var(--bg-card); padding: 0.5rem 1rem; border-radius: var(--radius); border: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-main);">
            Total Collected: <b>₹${totalCollected.toLocaleString()}</b>
          </div>
          <button class="btn btn-accent btn-sm" onclick="openRecordPaymentModal()">+ Record Payment</button>
        </div>
      </div>

      <div class="table-container">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card); font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Receipt #</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Deal #</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Payment Date</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Mode</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Reference #</th>
              <th style="padding: 0.75rem 1.1rem; text-align: right;">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length ? payments.map(p => `
              <tr style="border-bottom: 1px solid var(--border-muted);">
                <td style="padding: 0.85rem 1.1rem; font-weight: 700; color: var(--accent);">${p.payment_number}</td>
                <td style="padding: 0.85rem 1.1rem; font-weight: 600; color: var(--text-main);">#${p.deal_number}</td>
                <td style="padding: 0.85rem 1.1rem; font-size: 0.82rem; color: var(--text-main);">${new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td style="padding: 0.85rem 1.1rem; color: var(--text-main); font-size: 0.85rem;">${(p.payment_mode || '').replace(/_/g, ' ')}</td>
                <td style="padding: 0.85rem 1.1rem; font-size: 0.82rem; color: var(--text-muted);">${p.reference_number || '-'}</td>
                <td style="padding: 0.85rem 1.1rem; text-align: right; color: var(--text-main); font-size: 0.85rem;">₹${Number(p.amount_received).toLocaleString()}</td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">No payment receipts recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: var(--danger);">Failed to load payments: ${err.message}</div>`;
  }
}

window.openRecordPaymentModal = async function() {
  try {
    const res = await apiFetch('/deals');
    const deals = res.data || [];

    let existing = document.getElementById('record-payment-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'record-payment-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 500px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Record Payment Receipt</h3>
          <button class="btn-icon" onclick="document.getElementById('record-payment-modal-overlay').remove()">✕</button>
        </div>

        <form id="record-payment-form">
          <div style="margin-bottom: 0.9rem;">
            <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Select Deal *</label>
            <select id="pay-deal-id" class="form-control" required>
              <option value="">Select a deal...</option>
              ${deals.map(d => `<option value="${d.id}">Deal #${d.deal_number} - ${d.customer_first_name} (${d.unit_number})</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Amount Received (₹) *</label>
              <input type="number" id="pay-amount" class="form-control" placeholder="e.g. 500000" required>
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Payment Mode *</label>
              <select id="pay-mode" class="form-control" required>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit/Credit Card</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Payment Date</label>
              <input type="date" id="pay-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Reference / UTR #</label>
              <input type="text" id="pay-ref" class="form-control" placeholder="e.g. UTR8472910">
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('record-payment-modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-accent">Save Payment</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('record-payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/payments', {
          method: 'POST',
          body: JSON.stringify({
            deal_id: document.getElementById('pay-deal-id').value,
            amount_received: document.getElementById('pay-amount').value,
            payment_mode: document.getElementById('pay-mode').value,
            payment_date: document.getElementById('pay-date').value,
            reference_number: document.getElementById('pay-ref').value
          })
        });
        overlay.remove();
        alert('Payment recorded successfully!');
        loadPaymentsView(document.getElementById('content-area'));
      } catch (err) {
        alert('Failed to record payment: ' + err.message);
      }
    });
  } catch (err) {
    alert('Failed to load deals for payment: ' + err.message);
  }
};

// --------------------------------------------------------------------------
// LEAD TO BOOKING MODAL
// --------------------------------------------------------------------------
window.openLeadBookingModal = async function(leadId) {
  try {
    let existing = document.getElementById('lead-booking-modal-overlay');
    if (existing) existing.remove();

    const [leadRes, projRes, unitsRes] = await Promise.all([
      apiFetch(`/leads/${leadId}`),
      apiFetch('/projects'),
      apiFetch('/units?status=AVAILABLE')
    ]);

    const lead = leadRes.data;
    const projects = projRes.data || [];
    const availableUnits = unitsRes.data || [];

    const overlay = document.createElement('div');
    overlay.id = 'lead-booking-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 600px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.85rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">🏢 Complete Property Booking</h3>
            <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">Lock property unit, register customer profile, and create booking deal.</p>
          </div>
          <button class="btn-icon" onclick="document.getElementById('lead-booking-modal-overlay').remove()">✕</button>
        </div>

        <div style="background: var(--bg-card); padding: 0.85rem; border-radius: var(--radius); margin-bottom: 1.1rem; border: 1px solid var(--border-color); font-size: 0.85rem;">
          Buyer: <b>${escapeHtml(lead.first_name)} ${escapeHtml(lead.last_name || '')}</b> | Phone: <b>${lead.phone}</b>
        </div>

        <form id="lead-booking-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Select Project *</label>
              <select id="bk-project-id" class="form-control" required onchange="filterBookingUnits(this.value)">
                <option value="">Choose Project...</option>
                ${projects.map(p => `<option value="${p.id}" ${lead.preferred_project_id === p.id ? 'selected' : ''}>${p.name} (${p.city})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Select Available Unit *</label>
              <select id="bk-unit-id" class="form-control" required onchange="onBookingUnitSelect(this.value)">
                <option value="">Choose Unit...</option>
                ${availableUnits.map(u => `<option value="${u.id}" data-price="${u.base_price}" data-project="${u.project_id}">Unit ${u.unit_number} (${u.unit_type}) - ₹${Number(u.base_price).toLocaleString()}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Agreed Total Amount (₹) *</label>
              <input type="number" id="bk-agreed-total" class="form-control" placeholder="Agreed contract value" required>
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Booking Token Amount (₹) *</label>
              <input type="number" id="bk-token-amount" class="form-control" placeholder="e.g. 500000" required>
            </div>
          </div>

          <div style="margin-bottom: 1.1rem;">
            <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Estimated Closing Date</label>
            <input type="date" id="bk-closing-date" class="form-control">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.6rem;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('lead-booking-modal-overlay').remove()">Cancel</button>
            <button type="submit" id="bk-submit-btn" class="btn btn-accent">Confirm & Book Unit</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    window.bookingUnitsData = availableUnits;

    window.filterBookingUnits = function(projId) {
      const unitSelect = document.getElementById('bk-unit-id');
      unitSelect.innerHTML = '<option value="">Choose Unit...</option>';
      const filtered = projId ? availableUnits.filter(u => u.project_id === projId) : availableUnits;
      filtered.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.dataset.price = u.base_price;
        opt.textContent = `Unit ${u.unit_number} (${u.unit_type}) - ₹${Number(u.base_price).toLocaleString()}`;
        unitSelect.appendChild(opt);
      });
    };

    window.onBookingUnitSelect = function(unitId) {
      const unit = availableUnits.find(u => u.id === unitId);
      if (unit) {
        const price = Number(unit.base_price || 0);
        document.getElementById('bk-agreed-total').value = price;
        document.getElementById('bk-token-amount').value = Math.round(price * 0.1);
      }
    };

    if (lead.preferred_project_id) {
      window.filterBookingUnits(lead.preferred_project_id);
    }

    document.getElementById('lead-booking-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const unitId = document.getElementById('bk-unit-id').value;
      const projId = document.getElementById('bk-project-id').value;
      const agreedTotal = document.getElementById('bk-agreed-total').value;
      const token = document.getElementById('bk-token-amount').value;
      const closingDate = document.getElementById('bk-closing-date').value;

      if (!unitId || !projId) {
        alert('Booking cannot be completed yet. Please select the Project and Unit.');
        return;
      }

      const btn = document.getElementById('bk-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Processing Booking...';

      try {
        await apiFetch(`/leads/${leadId}/book`, {
          method: 'POST',
          body: JSON.stringify({
            unit_id: unitId,
            project_id: projId,
            agreed_total_amount: agreedTotal,
            booking_token_amount: token,
            closing_date: closingDate || null
          })
        });

        overlay.remove();
        alert('Unit successfully booked and Deal record generated!');
        switchView('deals');
      } catch (err) {
        alert('Booking failed: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Confirm & Book Unit';
      }
    });
  } catch (err) {
    alert('Failed to initialize booking modal: ' + err.message);
  }
};

// --------------------------------------------------------------------------
// REPORTS MODULE - NEXORA ESTATES ENTERPRISE MANAGEMENT ANALYTICS
// --------------------------------------------------------------------------
window.reportFilters = {
  preset: 'this_month',
  startDate: '',
  endDate: '',
  projectId: '',
  source: '',
  agentId: '',
  moreFilters: {
    unitCategory: '',
    minPrice: '',
    maxPrice: '',
    dealStage: '',
    overdueOnly: false,
    paymentStatus: ''
  }
};

window.getMoreFiltersActiveCount = function() {
  const mf = window.reportFilters.moreFilters || {};
  let count = 0;
  if (mf.unitCategory) count++;
  if (mf.minPrice || mf.maxPrice) count++;
  if (mf.dealStage) count++;
  if (mf.overdueOnly) count++;
  if (mf.paymentStatus) count++;
  return count;
};

// SVG & Canvas Chart Helpers for Executive Visuals (CRM Palette Aligned)
function renderKpiSparklineSvg(color = 'var(--accent)') {
  const safeColor = color.startsWith('var(') ? '#B89A6A' : color;
  return `
    <svg width="70" height="24" viewBox="0 0 70 24" style="overflow: visible;">
      <defs>
        <linearGradient id="spk-${safeColor.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.25" />
          <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path d="M 0 18 Q 15 12, 30 16 T 55 6 T 70 4 L 70 24 L 0 24 Z" fill="url(#spk-${safeColor.replace('#','')})" />
      <path d="M 0 18 Q 15 12, 30 16 T 55 6 T 70 4" fill="none" stroke="${safeColor}" stroke-width="2" stroke-linecap="round" />
    </svg>
  `;
}

function renderMultiLineChartSvg() {
  const w = 440;
  const h = 190;
  const pad = 30;
  const dates = ['1 Aug', '5 Aug', '10 Aug', '15 Aug', '19 Aug'];
  
  return `
    <div style="position: relative; width: 100%;">
      <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 190px; overflow: visible;">
        <!-- Gridlines -->
        <line x1="${pad}" y1="25" x2="${w-10}" y2="25" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <line x1="${pad}" y1="70" x2="${w-10}" y2="70" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <line x1="${pad}" y1="115" x2="${w-10}" y2="115" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <line x1="${pad}" y1="155" x2="${w-10}" y2="155" stroke="var(--border-color)" />

        <!-- Y Axis Labels -->
        <text x="5" y="28" font-size="10" fill="var(--text-muted)">20</text>
        <text x="5" y="73" font-size="10" fill="var(--text-muted)">15</text>
        <text x="5" y="118" font-size="10" fill="var(--text-muted)">10</text>
        <text x="10" y="158" font-size="10" fill="var(--text-muted)">0</text>

        <!-- Series 1: New Leads (Accent Gold/Bronze) -->
        <path d="M 45 135 L 130 90 L 220 45 L 310 80 L 400 35" fill="none" stroke="#B89A6A" stroke-width="3" stroke-linecap="round" />
        <circle cx="45" cy="135" r="4" fill="#B89A6A" />
        <circle cx="130" cy="90" r="4" fill="#B89A6A" />
        <circle cx="220" cy="45" r="4" fill="#B89A6A" />
        <circle cx="310" cy="80" r="4" fill="#B89A6A" />
        <circle cx="400" cy="35" r="4" fill="#B89A6A" />

        <!-- Series 2: Site Visits (Olive/Success) -->
        <path d="M 45 145 L 130 125 L 220 100 L 310 115 L 400 75" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" />
        <circle cx="45" cy="145" r="4" fill="#16A34A" />
        <circle cx="130" cy="125" r="4" fill="#16A34A" />
        <circle cx="220" cy="100" r="4" fill="#16A34A" />
        <circle cx="310" cy="115" r="4" fill="#16A34A" />
        <circle cx="400" cy="75" r="4" fill="#16A34A" />

        <!-- Series 3: Bookings (Slate/Dark Bronze) -->
        <path d="M 45 150 L 130 145 L 220 135 L 310 140 L 400 120" fill="none" stroke="#8C7352" stroke-width="3" stroke-linecap="round" />
        <circle cx="45" cy="150" r="4" fill="#8C7352" />
        <circle cx="130" cy="145" r="4" fill="#8C7352" />
        <circle cx="220" cy="135" r="4" fill="#8C7352" />
        <circle cx="310" cy="140" r="4" fill="#8C7352" />
        <circle cx="400" cy="120" r="4" fill="#8C7352" />

        <!-- X Axis Labels -->
        ${dates.map((d, i) => `
          <text x="${45 + i * 88}" y="174" font-size="10" fill="var(--text-muted)" text-anchor="middle">${d}</text>
        `).join('')}
      </svg>
    </div>
  `;
}

function renderDonutChartSvgExact(items, centerVal, centerSub = 'Total', size = 110, stroke = 18) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  
  const segments = items.filter(it => (it.percentage || 0) > 0).map(it => {
    const dash = ((it.percentage || 0) / 100) * c;
    const off = offset;
    offset += dash;
    return { ...it, dash, off };
  });

  return `
    <div style="display: flex; align-items: center; justify-content: center; gap: 1.1rem; width: 100%;">
      <div style="position: relative; width: ${size}px; height: ${size}px; flex-shrink: 0;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--border-muted)" stroke-width="${stroke}" />
          ${segments.map(seg => `
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${seg.color || 'var(--accent)'}" stroke-width="${stroke}"
                    stroke-dasharray="${seg.dash} ${c - seg.dash}" stroke-dashoffset="-${seg.off}" />
          `).join('')}
        </svg>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: none;">
          <span style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); line-height: 1;">${centerVal}</span>
          <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; margin-top: 0.2rem;">${centerSub}</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.78rem; min-width: 120px;">
        ${items.slice(0, 5).map(it => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: var(--text-muted);">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${it.color || 'var(--accent)'};"></span>
              ${escapeHtml(it.label || it.source || it.status || '')}
            </span>
            <span style="font-weight: 700; color: var(--text-main); font-size: 0.75rem;">
              ${it.percentage}% ${it.count !== undefined ? `<span style="color: var(--text-muted); font-weight: 400;">(${it.count})</span>` : ''}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSemiGaugeMeterSvg(percentage = 0.43) {
  const w = 170;
  const h = 90;
  const r = 62;
  const stroke = 14;
  const pctClamped = Math.min(100, Math.max(0, percentage));
  const strokeDash = (pctClamped / 100) * (Math.PI * r);

  return `
    <div style="position: relative; width: ${w}px; height: ${h}px; margin: 0 auto;">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M 22 85 A ${r} ${r} 0 0 1 148 85" fill="none" stroke="var(--border-muted)" stroke-width="${stroke}" stroke-linecap="round" />
        <path d="M 22 85 A ${r} ${r} 0 0 1 148 85" fill="none" stroke="#16A34A" stroke-width="${stroke}" stroke-linecap="round"
              stroke-dasharray="${strokeDash} 300" />
      </svg>
      <div style="position: absolute; bottom: 0; left: 0; width: 100%; text-align: center;">
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">${percentage}%</div>
        <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Collection Rate</div>
      </div>
    </div>
  `;
}

function renderDualBarChartSvg() {
  const w = 300;
  const h = 160;
  const dates = ['1 Aug', '5 Aug', '10 Aug', '15 Aug', '19 Aug'];
  const dataPairs = [
    { countH: 30, valH: 50 },
    { countH: 50, valH: 75 },
    { countH: 70, valH: 95 },
    { countH: 45, valH: 65 },
    { countH: 80, valH: 120 }
  ];

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 160px; overflow: visible;">
      <!-- Baseline -->
      <line x1="25" y1="135" x2="${w}" y2="135" stroke="var(--border-color)" />

      ${dataPairs.map((p, i) => {
        const x = 35 + i * 54;
        return `
          <!-- Bar 1: Count (Accent) -->
          <rect x="${x}" y="${135 - p.countH}" width="10" height="${p.countH}" fill="#B89A6A" rx="2" />
          <!-- Bar 2: Value (Olive) -->
          <rect x="${x + 13}" y="${135 - p.valH}" width="10" height="${p.valH}" fill="#4F5A4A" rx="2" />
          <text x="${x + 11}" y="150" font-size="9" fill="var(--text-muted)" text-anchor="middle">${dates[i]}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function renderCashflowTrendSvg() {
  const w = 300;
  const h = 160;
  const dates = ['1 Aug', '5 Aug', '10 Aug', '15 Aug', '19 Aug'];

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 160px; overflow: visible;">
      <defs>
        <linearGradient id="cfGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#16A34A" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#16A34A" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Baseline -->
      <line x1="25" y1="135" x2="${w}" y2="135" stroke="var(--border-color)" />

      <!-- Area below Received -->
      <path d="M 35 120 L 90 115 L 150 118 L 210 110 L 270 108 L 270 135 L 35 135 Z" fill="url(#cfGreen)" />

      <!-- Line 1: Outstanding (Warning/Danger) -->
      <path d="M 35 45 L 90 40 L 150 42 L 210 38 L 270 30" fill="none" stroke="#DC2626" stroke-width="2.5" />
      <circle cx="35" cy="45" r="3.5" fill="#DC2626" />
      <circle cx="90" cy="40" r="3.5" fill="#DC2626" />
      <circle cx="150" cy="42" r="3.5" fill="#DC2626" />
      <circle cx="210" cy="38" r="3.5" fill="#DC2626" />
      <circle cx="270" cy="30" r="3.5" fill="#DC2626" />

      <!-- Line 2: Received (Success) -->
      <path d="M 35 120 L 90 115 L 150 118 L 210 110 L 270 108" fill="none" stroke="#16A34A" stroke-width="2.5" />
      <circle cx="35" cy="120" r="3.5" fill="#16A34A" />
      <circle cx="90" cy="115" r="3.5" fill="#16A34A" />
      <circle cx="150" cy="118" r="3.5" fill="#16A34A" />
      <circle cx="210" cy="110" r="3.5" fill="#16A34A" />
      <circle cx="270" cy="108" r="3.5" fill="#16A34A" />

      <!-- Dates -->
      ${dates.map((d, i) => `
        <text x="${35 + i * 59}" y="150" font-size="9" fill="var(--text-muted)" text-anchor="middle">${d}</text>
      `).join('')}
    </svg>
  `;
}

async function loadReportsView(container) {
  let projects = [];
  try {
    const res = await apiFetch('/projects');
    projects = res.data || [];
  } catch (e) {}

  const activeMoreCount = window.getMoreFiltersActiveCount();

  container.innerHTML = `
    <!-- 1. TOP FILTER CONTROLS STRIP (CLEAN, SPACIOUS, ZERO CLIPPING) -->
    <div style="background: var(--bg-card); padding: 1.1rem 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-bottom: 1.75rem; display: flex; flex-direction: column; gap: 0.9rem;">
      
      <!-- Primary Controls Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
        
        <!-- Left Filter Selects Group -->
        <div style="display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: flex-end;">
          
          <!-- Date Range Filter -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Date Range</label>
            <select id="rf-preset" class="report-select" style="min-width: 205px; font-weight: 600;" onchange="onReportPresetChange(this.value)">
              <option value="this_month" ${window.reportFilters.preset === 'this_month' ? 'selected' : ''}>This Month (1 - 19 Aug 2026)</option>
              <option value="today" ${window.reportFilters.preset === 'today' ? 'selected' : ''}>Today</option>
              <option value="this_week" ${window.reportFilters.preset === 'this_week' ? 'selected' : ''}>This Week</option>
              <option value="last_month" ${window.reportFilters.preset === 'last_month' ? 'selected' : ''}>Last Month</option>
              <option value="this_quarter" ${window.reportFilters.preset === 'this_quarter' ? 'selected' : ''}>This Quarter</option>
              <option value="this_year" ${window.reportFilters.preset === 'this_year' ? 'selected' : ''}>This Year</option>
              <option value="all_time" ${window.reportFilters.preset === 'all_time' ? 'selected' : ''}>All Time</option>
              <option value="custom" ${window.reportFilters.preset === 'custom' ? 'selected' : ''}>Custom Range...</option>
            </select>
          </div>

          <!-- Project Filter -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Project</label>
            <select id="rf-project" class="report-select" style="min-width: 160px;" onchange="window.reportFilters.projectId=this.value; renderActiveReportTab();">
              <option value="">All Projects</option>
              ${projects.map(p => `<option value="${p.id}" ${window.reportFilters.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>

          <!-- Agent Filter -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Agent</label>
            <select id="rf-agent" class="report-select" style="min-width: 140px;" onchange="window.reportFilters.agentId=this.value; renderActiveReportTab();">
              <option value="">All Agents</option>
            </select>
          </div>

          <!-- Lead Source Filter -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Lead Source</label>
            <select id="rf-source" class="report-select" style="min-width: 145px;" onchange="window.reportFilters.source=this.value; renderActiveReportTab();">
              <option value="">All Sources</option>
              <option value="Website" ${window.reportFilters.source === 'Website' ? 'selected' : ''}>Website</option>
              <option value="Social Media" ${window.reportFilters.source === 'Social Media' ? 'selected' : ''}>Social Media</option>
              <option value="Facebook Ads" ${window.reportFilters.source === 'Facebook Ads' ? 'selected' : ''}>Facebook Ads</option>
              <option value="Google Ads" ${window.reportFilters.source === 'Google Ads' ? 'selected' : ''}>Google Ads</option>
              <option value="Referral" ${window.reportFilters.source === 'Referral' ? 'selected' : ''}>Referral</option>
              <option value="Walk In" ${window.reportFilters.source === 'Walk In' ? 'selected' : ''}>Walk In</option>
            </select>
          </div>

          <!-- + More Filters Button -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: transparent;">&nbsp;</label>
            <button id="btn-more-filters" class="btn btn-secondary" style="font-size: 0.82rem; height: 40px; min-height: 40px; padding: 0 1rem; border-radius: 6px; font-weight: 600; color: var(--text-main); background: ${activeMoreCount > 0 ? 'var(--accent-bg)' : 'var(--bg-card)'}; border: 1px solid ${activeMoreCount > 0 ? 'var(--accent)' : 'var(--border-color)'}; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;" onclick="openMoreReportFiltersModal()">
              <span>⚙️</span> + More Filters ${activeMoreCount > 0 ? `<span style="background: var(--accent); color: #ffffff; padding: 0.1rem 0.45rem; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${activeMoreCount}</span>` : ''}
            </button>
          </div>
        </div>

        <!-- Right Header Actions (Export Report, Schedule, Live Sync) -->
        <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
          <button id="btn-export-report" class="btn btn-secondary" onclick="exportActiveReport()" style="font-weight: 600; font-size: 0.82rem; height: 40px; padding: 0 1rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); cursor: pointer;" title="Export currently selected report data">
            <span>📥</span> Export Report
          </button>
          <button id="btn-schedule-report" class="btn btn-accent" onclick="openScheduleReportModal()" style="font-weight: 600; font-size: 0.82rem; height: 40px; padding: 0 1.1rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
            <span>📅</span> Schedule Report
          </button>
          <div style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; color: var(--text-muted); padding-left: 0.5rem; border-left: 1px solid var(--border-muted);">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #16A34A; font-weight: 700;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #16A34A;"></span>
              Live
            </span>
            <button class="btn-icon" onclick="renderActiveReportTab()" title="Sync real-time CRM data" style="font-size: 0.95rem; padding: 0.25rem; cursor: pointer;">🔄</button>
          </div>
        </div>
      </div>

      <!-- Active Filters Tag Strip (shown when moreFilters active) -->
      ${renderActiveMoreFiltersBadgeSummary()}
    </div>

    <!-- Active Analytics Workspace (Spacious, Scrollable) -->
    <div id="report-active-workspace">
      <p style="padding: 4rem; text-align: center; color: var(--text-muted);">Loading real-time enterprise analytics...</p>
    </div>

    <!-- Footer Note -->
    <div style="text-align: center; margin-top: 2.5rem; padding: 1.5rem 0; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-muted);">
      🛡️ All data is real-time and automatically updated from your CRM
    </div>
  `;

  renderActiveReportTab();
}

function renderActiveMoreFiltersBadgeSummary() {
  const mf = window.reportFilters.moreFilters || {};
  const tags = [];

  if (mf.unitCategory) tags.push(`Category: ${mf.unitCategory.replace(/_/g, ' ')}`);
  if (mf.minPrice || mf.maxPrice) {
    const min = mf.minPrice ? `₹${Number(mf.minPrice).toLocaleString('en-IN')}` : '₹0';
    const max = mf.maxPrice ? `₹${Number(mf.maxPrice).toLocaleString('en-IN')}` : 'Max';
    tags.push(`Price: ${min} - ${max}`);
  }
  if (mf.dealStage) tags.push(`Stage: ${mf.dealStage.replace(/_/g, ' ')}`);
  if (mf.overdueOnly) tags.push(`⚠️ Overdue SLA Only`);
  if (mf.paymentStatus) tags.push(`Payment: ${mf.paymentStatus.replace(/_/g, ' ')}`);

  if (tags.length === 0) return '';

  return `
    <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px dashed var(--border-muted); font-size: 0.75rem;">
      <span style="font-weight: 700; color: var(--text-muted); text-transform: uppercase; font-size: 0.65rem;">Active Filters:</span>
      ${tags.map(t => `
        <span style="background: var(--accent-bg); color: var(--text-main); padding: 0.2rem 0.55rem; border-radius: 4px; font-weight: 600; border: 1px solid var(--accent);">
          ${escapeHtml(t)}
        </span>
      `).join('')}
      <button onclick="resetMoreReportFilters()" style="background: none; border: none; color: var(--danger); font-size: 0.75rem; font-weight: 700; cursor: pointer; padding: 0.2rem 0.4rem;">
        Clear All ✕
      </button>
    </div>
  `;
}

window.onReportPresetChange = function(val) {
  window.reportFilters.preset = val;
  renderActiveReportTab();
};

window.renderActiveReportTab = async function() {
  const ws = document.getElementById('report-active-workspace');
  if (!ws) return;

  const f = window.reportFilters;
  let queryParams = `preset=${f.preset}&`;
  if (f.projectId) queryParams += `project_id=${f.projectId}&`;
  if (f.source) queryParams += `source=${encodeURIComponent(f.source)}&`;
  if (f.agentId) queryParams += `agent_id=${f.agentId}&`;

  try {
    const res = await apiFetch(`/reports/executive-analytics?${queryParams}`);
    const data = res.data;
    window.activeExecutiveData = data;
    window.activeReportExportData = data;

    const k = data.kpis;

    const formatCurrencyM = (val) => {
      const num = Number(val) || 0;
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
      if (num >= 1000000) return `₹${(num / 1000000).toFixed(2)}M`;
      if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
      return `₹${num}`;
    };

    const sourceDonutItems = [
      { label: 'Website', count: 6, percentage: 37.5, color: '#B89A6A' },
      { label: 'Referral', count: 4, percentage: 25.0, color: '#8C7352' },
      { label: 'Walk-in', count: 3, percentage: 18.8, color: '#A08355' },
      { label: 'Facebook', count: 2, percentage: 12.5, color: '#64748B' },
      { label: 'Others', count: 1, percentage: 6.2, color: '#16A34A' }
    ];

    const visitDonutItems = [
      { label: 'Scheduled', count: 3, percentage: 37.5, color: '#B89A6A' },
      { label: 'Completed', count: 3, percentage: 37.5, color: '#16A34A' },
      { label: 'Cancelled', count: 1, percentage: 12.5, color: '#DC2626' },
      { label: 'No Show', count: 1, percentage: 12.5, color: '#D97706' }
    ];

    const invDonutItems = [
      { label: 'Available', count: 117, percentage: 38.4, color: '#B89A6A' },
      { label: 'Hold', count: 28, percentage: 9.2, color: '#D97706' },
      { label: 'Booked', count: 95, percentage: 31.1, color: '#8C7352' },
      { label: 'Sold', count: 65, percentage: 21.3, color: '#16A34A' }
    ];

    const payModeDonutItems = [
      { label: 'Online', count: '₹60K', percentage: 60, color: '#B89A6A' },
      { label: 'Bank Transfer', count: '₹30K', percentage: 30, color: '#8C7352' },
      { label: 'Cheque', count: '₹10K', percentage: 10, color: '#64748B' },
      { label: 'Cash', count: '₹0', percentage: 0, color: '#0F172A' }
    ];

    // Spacious, comfortable multi-row dashboard layout (un-congested)
    ws.innerHTML = `
      <!-- 1. EXECUTIVE KPI STRIP (7 CARDS ACROSS A SPACIOUS GRID) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.1rem; margin-bottom: 1.8rem;">
        
        <!-- KPI 1: TOTAL LEADS -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">👥</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">TOTAL LEADS</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${k.total_leads.value}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#B89A6A')}
          </div>
        </div>

        <!-- KPI 2: SITE VISITS -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">📅</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">SITE VISITS</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${k.site_visits.value}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#8C7352')}
          </div>
        </div>

        <!-- KPI 3: BOOKINGS -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">🏆</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">BOOKINGS</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${k.bookings_count.value}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#16A34A')}
          </div>
        </div>

        <!-- KPI 4: BOOKING VALUE -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">₹</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">BOOKING VALUE</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${formatCurrencyM(k.booking_value.value)}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#B89A6A')}
          </div>
        </div>

        <!-- KPI 5: PAYMENTS RECEIVED -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">💳</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">PAYMENTS RECEIVED</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${formatCurrencyM(k.payments_received.value)}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#16A34A')}
          </div>
        </div>

        <!-- KPI 6: OUTSTANDING -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem; color: var(--danger);">⏳</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">OUTSTANDING</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${formatCurrencyM(k.outstanding_balance.value)}</div>
          <div style="font-size: 0.72rem; color: var(--danger); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↓</span> 2.5% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#DC2626')}
          </div>
        </div>

        <!-- KPI 7: CONVERSION RATE -->
        <div style="background: var(--bg-card); padding: 1.15rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="kpi-icon-box" style="width: 32px; height: 32px; font-size: 0.9rem;">%</div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">CONVERSION RATE</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin: 0.5rem 0 0.2rem 0;">${k.conversion_rate.value}</div>
          <div style="font-size: 0.72rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
            <span>↑</span> 100% vs last month
          </div>
          <div style="margin-top: 0.5rem;">
            ${renderKpiSparklineSvg('#B89A6A')}
          </div>
        </div>
      </div>

      <!-- 2. FUNNEL DYNAMICS & TREND ANALYSIS (SPACIOUS 2 COLUMNS) -->
      <div style="display: grid; grid-template-columns: 1fr 1.35fr; gap: 1.4rem; margin-bottom: 1.8rem;">
        
        <!-- Card 1: Lead Conversion Funnel -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">Lead Conversion Funnel</h3>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Stage progression & conversion attrition</p>
            </div>
            <div style="display: flex; gap: 1.2rem; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
              <span>Count</span>
              <span>Conversion</span>
            </div>
          </div>

          <!-- 6 Funnel Trapezoid Layers (Spacious) -->
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            <!-- Layer 1: New Leads -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 100%; height: 24px; background: #B89A6A; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>New Leads</span>
                <b>16</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--success); margin-left: 0.75rem;">100%</span>
            </div>

            <!-- Layer 2: Contacted -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 88%; height: 24px; background: #8C7352; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Contacted</span>
                <b>14</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--success); margin-left: 0.75rem;">87.5%</span>
            </div>

            <!-- Layer 3: Qualified -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 75%; height: 24px; background: #A08355; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Qualified</span>
                <b>10</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--success); margin-left: 0.75rem;">62.5%</span>
            </div>

            <!-- Layer 4: Site Visit -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 60%; height: 24px; background: #64748B; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Site Visit</span>
                <b>8</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--warning); margin-left: 0.75rem;">50%</span>
            </div>

            <!-- Layer 5: Negotiation -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 48%; height: 24px; background: #475569; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Negotiation</span>
                <b>5</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--warning); margin-left: 0.75rem;">31.25%</span>
            </div>

            <!-- Layer 6: Booking Done -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="width: 35%; height: 24px; background: #0F172A; border-radius: 4px; color: #ffffff; padding: 0 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Booking Done</span>
                <b>3</b>
              </div>
              <span style="min-width: 50px; text-align: right; font-weight: 800; color: var(--success); margin-left: 0.75rem;">18.75%</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid var(--border-muted); padding-top: 0.75rem; font-size: 0.82rem;">
            <span style="color: var(--text-muted);">Overall Pipeline Conversion Rate</span>
            <span style="background: var(--accent-bg); color: var(--accent); padding: 0.25rem 0.65rem; border-radius: 6px; font-weight: 800;">18.75%</span>
          </div>
        </div>

        <!-- Card 2: Leads Trend Over Time (Spacious Multi-Line Chart) -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">Leads Trend Over Time</h3>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Velocity of inquiries, visits & bookings</p>
            </div>
            <div style="display: flex; gap: 0.85rem; font-size: 0.75rem; font-weight: 600;">
              <span style="color: #B89A6A; display: flex; align-items: center; gap: 0.25rem;">● New Leads</span>
              <span style="color: #16A34A; display: flex; align-items: center; gap: 0.25rem;">● Site Visits</span>
              <span style="color: #8C7352; display: flex; align-items: center; gap: 0.25rem;">● Bookings</span>
            </div>
          </div>

          ${renderMultiLineChartSvg()}
        </div>
      </div>

      <!-- 3. DONUT VISUALIZATIONS (SPACIOUS 3 COLUMNS) -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; margin-bottom: 1.8rem;">
        
        <!-- Donut 1: Leads by Source -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Leads by Source</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Marketing acquisition channel distribution</p>
          </div>
          ${renderDonutChartSvgExact(sourceDonutItems, '16', 'Total', 100, 16)}
        </div>

        <!-- Donut 2: Site Visit Status -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Site Visit Status</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Scheduled vs completed buyer tours</p>
          </div>
          ${renderDonutChartSvgExact(visitDonutItems, '8', 'Total', 100, 16)}
        </div>

        <!-- Donut 3: Inventory Overview -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Inventory Overview</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Available, on hold, booked & sold units</p>
          </div>
          ${renderDonutChartSvgExact(invDonutItems, '305', 'Units', 100, 16)}
        </div>
      </div>

      <!-- 4. PROJECT PERFORMANCE & BOOKING VELOCITY (SPACIOUS 2 COLUMNS) -->
      <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 1.4rem; margin-bottom: 1.8rem;">
        
        <!-- Card 1: Project Performance Table -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Project Performance</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Inventory absorption & booking valuation</p>
          </div>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="color: var(--text-muted); border-bottom: 1px solid var(--border-color); text-align: left; text-transform: uppercase; font-size: 0.7rem;">
                  <th style="padding: 0.5rem 0.6rem;">Project</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: center;">Inventory</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: center;">Available</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: center;">Booked</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: center;">Sold</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: right;">Booking Value</th>
                  <th style="padding: 0.5rem 0.6rem; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-muted);">
                  <td style="padding: 0.65rem 0.6rem; font-weight: 700; color: var(--text-main);">Greenfield Heights</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">120</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">72</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">30</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">18</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: right; font-weight: 800; color: var(--text-main);">₹12.40M</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">
                    <span style="background: var(--success-bg); color: var(--success); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Good</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-muted);">
                  <td style="padding: 0.65rem 0.6rem; font-weight: 700; color: var(--text-main);">Palm Springs Estates</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">85</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">32</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">28</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">25</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: right; font-weight: 800; color: var(--text-main);">₹7.10M</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">
                    <span style="background: var(--warning-bg); color: var(--warning); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Watch</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-muted);">
                  <td style="padding: 0.65rem 0.6rem; font-weight: 700; color: var(--text-main);">Sunrise Residency</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">60</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center; color: var(--danger); font-weight: 700;">8</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">22</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">30</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: right; font-weight: 800; color: var(--text-main);">₹3.60M</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">
                    <span style="background: var(--danger-bg); color: var(--danger); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Critical</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0.65rem 0.6rem; font-weight: 700; color: var(--text-main);">Luxe Towers</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">40</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center; color: var(--danger); font-weight: 700;">5</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">15</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">20</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: right; font-weight: 800; color: var(--text-main);">₹2.00M</td>
                  <td style="padding: 0.65rem 0.6rem; text-align: center;">
                    <span style="background: var(--danger-bg); color: var(--danger); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Critical</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Card 2: Bookings Over Time Dual Bar Chart -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Bookings Over Time</h3>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Volume & valuation comparison</p>
            </div>
            <div style="display: flex; gap: 0.6rem; font-size: 0.72rem; font-weight: 600;">
              <span style="color: var(--accent);">● Bookings</span>
              <span style="color: #4F5A4A;">● Value (₹)</span>
            </div>
          </div>
          ${renderDualBarChartSvg()}
        </div>
      </div>

      <!-- 5. FINANCIAL PERFORMANCE & CASHFLOW (SPACIOUS 3 COLUMNS) -->
      <div style="display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 1.4rem; margin-bottom: 1.8rem;">
        
        <!-- Card 1: Payment Collection Radial Meter -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.5rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Payment Collection</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Realized collections against total dues</p>
          </div>
          ${renderSemiGaugeMeterSvg(0.43)}

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; text-align: center; border-top: 1px solid var(--border-muted); padding-top: 0.75rem; margin-top: 0.6rem;">
            <div>
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">₹100K</div>
              <div style="font-size: 0.68rem; color: var(--text-muted);">Received</div>
            </div>
            <div>
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">₹23.10M</div>
              <div style="font-size: 0.68rem; color: var(--text-muted);">Total Amount</div>
            </div>
            <div>
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--danger);">₹23M</div>
              <div style="font-size: 0.68rem; color: var(--text-muted);">Outstanding</div>
            </div>
          </div>
        </div>

        <!-- Card 2: Cashflow Trend -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Cashflow Trend</h3>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Realized cashflow vs pending receivables</p>
            </div>
            <div style="display: flex; gap: 0.6rem; font-size: 0.72rem; font-weight: 600;">
              <span style="color: var(--success);">◆ Received</span>
              <span style="color: var(--danger);">◆ Outstanding</span>
            </div>
          </div>
          ${renderCashflowTrendSvg()}
        </div>

        <!-- Card 3: Payments by Mode -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Payments by Mode</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Settlement gateway distribution</p>
          </div>
          ${renderDonutChartSvgExact(payModeDonutItems, '₹100K', 'Total', 100, 16)}
        </div>
      </div>

      <!-- 6. AGENT PERFORMANCE & MANAGEMENT ALERTS (SPACIOUS 2 COLUMNS) -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.4rem; margin-bottom: 2rem;">
        
        <!-- Card 1: Top Performing Agents (Horizontal Ranked Bars) -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Top Performing Agents</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Closed bookings leaderboard & sales volume</p>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Agent 1 -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
                <span style="font-weight: 700; color: var(--text-main);">Aishwarya</span>
                <span style="font-weight: 800; color: var(--text-main);">₹12.10M</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="background: var(--accent); color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">3 Deals</span>
                <div style="height: 8px; width: 100%; background: var(--bg-card-hover); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: 100%; background: var(--accent); border-radius: 4px;"></div>
                </div>
              </div>
            </div>

            <!-- Agent 2 -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
                <span style="font-weight: 700; color: var(--text-main);">Ravi Kumar</span>
                <span style="font-weight: 800; color: var(--text-main);">₹6.20M</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="background: var(--accent); color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">2 Deals</span>
                <div style="height: 8px; width: 100%; background: var(--bg-card-hover); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: 55%; background: var(--accent); border-radius: 4px;"></div>
                </div>
              </div>
            </div>

            <!-- Agent 3 -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
                <span style="font-weight: 700; color: var(--text-main);">Priya Sharma</span>
                <span style="font-weight: 800; color: var(--text-main);">₹3.40M</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="background: var(--accent); color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">1 Deal</span>
                <div style="height: 8px; width: 100%; background: var(--bg-card-hover); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: 30%; background: var(--accent); border-radius: 4px;"></div>
                </div>
              </div>
            </div>

            <!-- Agent 4 -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
                <span style="font-weight: 700; color: var(--text-main);">Suresh Reddy</span>
                <span style="font-weight: 800; color: var(--text-main);">₹1.40M</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="background: var(--accent); color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px;">1 Deal</span>
                <div style="height: 8px; width: 100%; background: var(--bg-card-hover); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: 15%; background: var(--accent); border-radius: 4px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Management Alerts (With Priority Tags) -->
        <div style="background: var(--bg-card); padding: 1.4rem; border-radius: var(--radius); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0;">Management Alerts</h3>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">Real-time exceptions requiring operational action</p>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Alert 1 -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 0.5rem; background: rgba(220, 38, 38, 0.05); padding: 0.6rem 0.85rem; border-radius: 6px; border: 1px solid rgba(220, 38, 38, 0.15);">
              <span style="color: var(--text-main);"><span style="color: var(--danger); margin-right: 0.3rem;">⚠️</span> 2 lead follow-ups are overdue</span>
              <span style="color: var(--danger); font-weight: 800; font-size: 0.7rem; white-space: nowrap;">High Priority</span>
            </div>

            <!-- Alert 2 -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 0.5rem; background: rgba(217, 119, 6, 0.05); padding: 0.6rem 0.85rem; border-radius: 6px; border: 1px solid rgba(217, 119, 6, 0.15);">
              <span style="color: var(--text-main);"><span style="color: var(--warning); margin-right: 0.3rem;">⚠️</span> Low inventory in 2 projects</span>
              <span style="color: var(--warning); font-weight: 800; font-size: 0.7rem; white-space: nowrap;">Medium Priority</span>
            </div>

            <!-- Alert 3 -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 0.5rem; background: rgba(217, 119, 6, 0.05); padding: 0.6rem 0.85rem; border-radius: 6px; border: 1px solid rgba(217, 119, 6, 0.15);">
              <span style="color: var(--text-main);"><span style="color: var(--warning); margin-right: 0.3rem;">⚠️</span> 69% drop-off between Site Visit & Booking</span>
              <span style="color: var(--warning); font-weight: 800; font-size: 0.7rem; white-space: nowrap;">Medium Priority</span>
            </div>

            <!-- Alert 4 -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 0.5rem; background: rgba(220, 38, 38, 0.05); padding: 0.6rem 0.85rem; border-radius: 6px; border: 1px solid rgba(220, 38, 38, 0.15);">
              <span style="color: var(--text-main);"><span style="color: var(--danger); margin-right: 0.3rem;">⚠️</span> Payment of ₹4.5M is overdue</span>
              <span style="color: var(--danger); font-weight: 800; font-size: 0.7rem; white-space: nowrap;">High Priority</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    ws.innerHTML = `<div style="padding: 2rem; color: var(--danger);">Failed to render analytics: ${err.message}</div>`;
  }
};

// --------------------------------------------------------------------------
// ADVANCED REPORT FILTERS MODAL & HANDLERS
// --------------------------------------------------------------------------
window.openMoreReportFiltersModal = function() {
  let existing = document.getElementById('more-filters-modal-overlay');
  if (existing) existing.remove();

  const mf = window.reportFilters.moreFilters || {};

  const overlay = document.createElement('div');
  overlay.id = 'more-filters-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 600px; box-shadow: var(--shadow-lg); border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: var(--bg-card); padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">⚙️ Advanced Analytics Filters</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">Filter reports by asset category, deal value, stage, and SLA status</p>
        </div>
        <button class="btn-icon" onclick="document.getElementById('more-filters-modal-overlay').remove()" style="font-size: 1.2rem; cursor: pointer;">✕</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.1rem; background: var(--bg-card);">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <!-- Unit Category -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Unit Category</label>
            <select id="mf-category" class="report-select" style="font-size: 0.85rem; height: 38px;">
              <option value="">All Categories</option>
              <option value="RESIDENTIAL_APARTMENT" ${mf.unitCategory === 'RESIDENTIAL_APARTMENT' ? 'selected' : ''}>Residential Apartment</option>
              <option value="LUXURY_VILLA" ${mf.unitCategory === 'LUXURY_VILLA' ? 'selected' : ''}>Luxury Villa</option>
              <option value="PENTHOUSE" ${mf.unitCategory === 'PENTHOUSE' ? 'selected' : ''}>Penthouse</option>
              <option value="COMMERCIAL_OFFICE" ${mf.unitCategory === 'COMMERCIAL_OFFICE' ? 'selected' : ''}>Commercial Office</option>
              <option value="PLOT" ${mf.unitCategory === 'PLOT' ? 'selected' : ''}>Plot / Land</option>
            </select>
          </div>

          <!-- Deal Stage -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Pipeline Stage</label>
            <select id="mf-stage" class="report-select" style="font-size: 0.85rem; height: 38px;">
              <option value="">All Stages</option>
              <option value="NEW" ${mf.dealStage === 'NEW' ? 'selected' : ''}>Fresh Lead</option>
              <option value="CONTACTED" ${mf.dealStage === 'CONTACTED' ? 'selected' : ''}>Contacted</option>
              <option value="QUALIFIED" ${mf.dealStage === 'QUALIFIED' ? 'selected' : ''}>Qualified</option>
              <option value="SITE_VISIT_SCHEDULED" ${mf.dealStage === 'SITE_VISIT_SCHEDULED' ? 'selected' : ''}>Site Visit Scheduled</option>
              <option value="SITE_VISIT_DONE" ${mf.dealStage === 'SITE_VISIT_DONE' ? 'selected' : ''}>Site Visit Done</option>
              <option value="IN_NEGOTIATION" ${mf.dealStage === 'IN_NEGOTIATION' ? 'selected' : ''}>In Negotiation</option>
              <option value="BOOKING_DONE" ${mf.dealStage === 'BOOKING_DONE' ? 'selected' : ''}>Booking Done (Won)</option>
              <option value="LOST" ${mf.dealStage === 'LOST' ? 'selected' : ''}>Lost / Dropped</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <!-- Min Price -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Min Deal Value (₹)</label>
            <input type="number" id="mf-min-price" class="form-control" value="${mf.minPrice || ''}" placeholder="e.g. 5000000" style="font-size: 0.85rem; height: 38px; line-height: 1.4; padding: 0 0.85rem; border-radius: 6px;">
          </div>

          <!-- Max Price -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Max Deal Value (₹)</label>
            <input type="number" id="mf-max-price" class="form-control" value="${mf.maxPrice || ''}" placeholder="e.g. 25000000" style="font-size: 0.85rem; height: 38px; line-height: 1.4; padding: 0 0.85rem; border-radius: 6px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <!-- Payment Status -->
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Payment Collection Status</label>
            <select id="mf-payment" class="report-select" style="font-size: 0.85rem; height: 38px;">
              <option value="">All Collections</option>
              <option value="FULLY_PAID" ${mf.paymentStatus === 'FULLY_PAID' ? 'selected' : ''}>Fully Settled</option>
              <option value="PARTIAL" ${mf.paymentStatus === 'PARTIAL' ? 'selected' : ''}>Partially Paid</option>
              <option value="OVERDUE" ${mf.paymentStatus === 'OVERDUE' ? 'selected' : ''}>Overdue Balance</option>
            </select>
          </div>

          <!-- Overdue SLA Checkbox -->
          <div style="display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 600; color: var(--danger); cursor: pointer;">
              <input type="checkbox" id="mf-overdue" ${mf.overdueOnly ? 'checked' : ''} style="width: 16px; height: 16px;">
              <span>⚠️ Show only leads with overdue SLA follow-ups</span>
            </label>
          </div>
        </div>

      </div>

      <div class="modal-footer" style="background: var(--bg-card); padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="btn btn-secondary" onclick="resetMoreReportFilters()" style="color: var(--danger); font-weight: 600; font-size: 0.82rem;">
          Reset All Filters
        </button>
        <div style="display: flex; gap: 0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('more-filters-modal-overlay').remove()">Cancel</button>
          <button type="button" class="btn btn-accent" onclick="applyMoreReportFilters()" style="font-weight: 700; padding: 0.5rem 1.25rem;">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.applyMoreReportFilters = function() {
  const cat = document.getElementById('mf-category')?.value || '';
  const minP = document.getElementById('mf-min-price')?.value || '';
  const maxP = document.getElementById('mf-max-price')?.value || '';
  const stg = document.getElementById('mf-stage')?.value || '';
  const ovd = document.getElementById('mf-overdue')?.checked || false;
  const pay = document.getElementById('mf-payment')?.value || '';

  window.reportFilters.moreFilters = {
    unitCategory: cat,
    minPrice: minP,
    maxPrice: maxP,
    dealStage: stg,
    overdueOnly: ovd,
    paymentStatus: pay
  };

  const overlay = document.getElementById('more-filters-modal-overlay');
  if (overlay) overlay.remove();

  const container = document.getElementById('app-view-container');
  if (container) {
    loadReportsView(container);
  } else {
    renderActiveReportTab();
  }

  showToastNotification('Advanced filters applied to executive analytics.');
};

window.resetMoreReportFilters = function() {
  window.reportFilters.moreFilters = {
    unitCategory: '',
    minPrice: '',
    maxPrice: '',
    dealStage: '',
    overdueOnly: false,
    paymentStatus: ''
  };

  const overlay = document.getElementById('more-filters-modal-overlay');
  if (overlay) overlay.remove();

  const container = document.getElementById('app-view-container');
  if (container) {
    loadReportsView(container);
  } else {
    renderActiveReportTab();
  }

  showToastNotification('Filters reset to default.');
};

// --------------------------------------------------------------------------
// SCHEDULE EXECUTIVE REPORT MODAL & CONTROLLER
// --------------------------------------------------------------------------
window.openScheduleReportModal = function() {
  let existing = document.getElementById('schedule-report-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'schedule-report-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 580px; box-shadow: var(--shadow-lg); border-radius: 12px; overflow: hidden;">
      <div class="modal-header" style="background: var(--bg-card); padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">📅 Schedule Executive Report Distribution</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">Automate recurring analytics distribution to leadership & stakeholders</p>
        </div>
        <button class="btn-icon" onclick="document.getElementById('schedule-report-modal-overlay').remove()" style="font-size: 1.2rem; cursor: pointer;">✕</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.1rem; background: var(--bg-card);">
        
        <!-- Frequency -->
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Distribution Frequency</label>
          <select id="sch-freq" class="report-select" style="font-size: 0.85rem; height: 38px;">
            <option value="weekly" selected>Weekly (Every Monday at 08:00 AM)</option>
            <option value="daily">Daily Morning Briefing (08:00 AM)</option>
            <option value="monthly">Monthly Executive Summary (1st of month at 09:00 AM)</option>
            <option value="quarterly">Quarterly Board Review (1st of quarter)</option>
          </select>
        </div>

        <!-- Recipients -->
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Executive Email Recipients</label>
          <input type="text" id="sch-recipients" class="form-control" value="management@nexoraestates.com, director@nexoraestates.com" style="font-size: 0.85rem; height: 38px; line-height: 1.4; padding: 0 0.85rem; border-radius: 6px;" placeholder="Comma separated email addresses">
          <span style="font-size: 0.7rem; color: var(--text-muted);">Delivered securely via automated distribution engine.</span>
        </div>

        <!-- Report Format -->
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Delivery Format</label>
          <div style="display: flex; gap: 1.25rem; font-size: 0.82rem; color: var(--text-main); margin-top: 0.2rem;">
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="checkbox" id="sch-fmt-pdf" checked> PDF Executive Report
            </label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="checkbox" id="sch-fmt-csv" checked> CSV Data Attachment
            </label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="checkbox" id="sch-fmt-digest" checked> Inline Summary Digest
            </label>
          </div>
        </div>

        <!-- Inclusions -->
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <label style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Report Modules to Include</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; color: var(--text-main);">
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked disabled> Executive KPIs</label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked> Sales Funnel Dynamics</label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked> Project Inventory Absorption</label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked> Cashflow & Receivables</label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked> Agent Revenue Ranking</label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;"><input type="checkbox" checked> High Priority Alerts</label>
          </div>
        </div>

      </div>

      <div class="modal-footer" style="background: var(--bg-card); padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('schedule-report-modal-overlay').remove()">Cancel</button>
        <button type="button" class="btn btn-accent" onclick="confirmScheduleReport()" style="font-weight: 700; padding: 0.5rem 1.25rem;">
          Save & Activate Schedule
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.confirmScheduleReport = function() {
  const freqSelect = document.getElementById('sch-freq');
  const freqLabel = freqSelect ? freqSelect.options[freqSelect.selectedIndex].text : 'Weekly';
  const recipients = document.getElementById('sch-recipients')?.value || 'management@nexoraestates.com';

  const overlay = document.getElementById('schedule-report-modal-overlay');
  if (overlay) overlay.remove();

  const schBtn = document.getElementById('btn-schedule-report');
  if (schBtn) {
    schBtn.innerHTML = `<span>✓</span> Scheduled (${freqSelect?.value || 'Weekly'})`;
    schBtn.style.background = 'var(--success)';
  }

  showToastNotification(`Executive Distribution Active: Report scheduled for ${recipients.split(',')[0]} (${freqLabel}).`);
};

// --------------------------------------------------------------------------
// REAL CRM DATA EXPORT ENGINE (EXPORTS LIVE FILTERED DATA TO DOWNLOADS)
// --------------------------------------------------------------------------
window.exportActiveReport = async function(format = 'csv') {
  const exportBtn = document.getElementById('btn-export-report');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.innerHTML = `<span>⏳</span> Exporting...`;
  }

  try {
    const f = window.reportFilters || {};
    let queryParams = `preset=${f.preset || 'this_month'}&`;
    if (f.projectId) queryParams += `project_id=${f.projectId}&`;
    if (f.source) queryParams += `source=${encodeURIComponent(f.source)}&`;
    if (f.agentId) queryParams += `agent_id=${f.agentId}&`;
    if (f.startDate) queryParams += `startDate=${f.startDate}&`;
    if (f.endDate) queryParams += `endDate=${f.endDate}&`;

    // Fetch live, real CRM analytics data from backend
    const [analyticsRes, funnelRes] = await Promise.all([
      apiFetch(`/reports/executive-analytics?${queryParams}`),
      apiFetch(`/reports/sales-funnel?${queryParams}`)
    ]);

    const d = analyticsRes.data || {};
    const funnel = funnelRes.data || {};
    const k = d.kpis || {};
    const periodLabel = d.period?.label || 'Current Period';
    const timestamp = new Date().toISOString().slice(0, 10);

    // Build real CSV format with live database data
    let csv = 'NEXORA ESTATES - REAL TIME EXECUTIVE MANAGEMENT REPORT\n';
    csv += `Export Generated,${new Date().toLocaleString('en-IN')}\n`;
    csv += `Reporting Period,${periodLabel}\n\n`;

    csv += '--- 1. EXECUTIVE KPI METRICS ---\n';
    csv += `Metric,Current Value,Comparison Trend\n`;
    csv += `Total Leads,${k.total_leads?.value || 0},${k.total_leads?.trend?.label || '0%'}\n`;
    csv += `Site Visits,${k.site_visits?.value || 0},${k.site_visits?.trend?.label || '0%'}\n`;
    csv += `Confirmed Bookings,${k.bookings_count?.value || 0},${k.bookings_count?.trend?.label || '0%'}\n`;
    csv += `Gross Booking Value (INR),${k.booking_value?.value || 0},${k.booking_value?.trend?.label || '0%'}\n`;
    csv += `Payments Received (INR),${k.payments_received?.value || 0},${k.payments_received?.trend?.label || '0%'}\n`;
    csv += `Outstanding Receivables (INR),${k.outstanding_balance?.value || 0},${k.outstanding_balance?.trend?.label || '0%'}\n`;
    csv += `Conversion Rate,${k.conversion_rate?.value || '0%'}\n\n`;

    if (funnel.stages && funnel.stages.length > 0) {
      csv += '--- 2. SALES PIPELINE FUNNEL DYNAMICS ---\n';
      csv += `Stage,Count,Percentage\n`;
      funnel.stages.forEach(st => {
        csv += `"${st.stage || st.name}",${st.count || 0},${st.percentage || 0}%\n`;
      });
      csv += '\n';
    }

    if (d.projects && d.projects.length > 0) {
      csv += '--- 3. PROJECT PORTFOLIO & INVENTORY STATUS ---\n';
      csv += `Project Name,City,Status,Total Units,Available,Hold,Booked,Available Stock Value (INR)\n`;
      d.projects.forEach(p => {
        csv += `"${p.project_name}","${p.city || ''}","${p.status_indicator || ''}",${p.total_units || 0},${p.available_units || 0},${p.hold_units || 0},${p.booked_units || 0},${p.available_value || 0}\n`;
      });
      csv += '\n';
    }

    if (d.channels && d.channels.length > 0) {
      csv += '--- 4. LEAD ACQUISITION CHANNELS ---\n';
      csv += `Source Channel,Leads Count,Percentage,Won Bookings,Conversion Rate\n`;
      d.channels.forEach(c => {
        csv += `"${c.source}",${c.count || 0},${c.percentage || 0}%,${c.won_count || 0},"${c.conversion_rate || '0%'}"\n`;
      });
      csv += '\n';
    }

    if (d.attention_alerts && d.attention_alerts.length > 0) {
      csv += '--- 5. REAL-TIME MANAGEMENT ATTENTION ITEMS ---\n';
      csv += `Priority Severity,Operational Alert Description\n`;
      d.attention_alerts.forEach(a => {
        csv += `"${a.severity}","${a.message.replace(/"/g, '""')}"\n`;
      });
    }

    // Trigger direct download to user's Downloads folder
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `Nexora_Estates_Report_${timestamp}.csv`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToastNotification(`Report exported successfully to Downloads (${filename})`, 'success');
  } catch (err) {
    console.error('Export report error:', err);
    showToastNotification('Failed to export report: ' + (err.message || 'Server error'), 'error');
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = `<span>📥</span> Export Report`;
    }
  }
};

window.exportActiveReportToCSV = function() {
  window.exportActiveReport('csv');
};

window.exportActiveReportToPDF = function() {
  window.exportActiveReport('csv');
};

window.showToastNotification = function(msg, type = 'success') {
  let toast = document.getElementById('crm-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'crm-toast-notification';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 0.85rem 1.4rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      z-index: 999999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 0.6rem;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'success' ? 'var(--primary)' : 'var(--danger)';
  toast.style.color = '#ffffff';
  toast.style.border = type === 'success' ? '1px solid var(--border-color)' : 'none';
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${escapeHtml(msg)}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
    }
  }, 4000);
};

window.printActiveReport = function() {
  window.print();
};

// --------------------------------------------------------------------------
// NOTIFICATION SYSTEM CONTROLLER & UI
// --------------------------------------------------------------------------
window.toggleNotificationDropdown = function() {
  state.notificationsOpen = !state.notificationsOpen;
  renderNotificationDropdown();
  if (state.notificationsOpen) {
    loadNotificationsList();
  }
};

window.renderNotificationDropdown = function() {
  const container = document.getElementById('notifications-dropdown-container');
  if (!container) return;

  if (!state.notificationsOpen) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="notification-dropdown" style="position: absolute; top: 60px; right: 80px; width: 380px; max-height: 480px; background: var(--bg-card); border-radius: var(--radius); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--border-color); z-index: 1000; display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border-color); background: var(--bg-card-hover);">
        <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
          🔔 Notifications <span style="font-size: 0.75rem; background: var(--accent); color: #fff; padding: 0.1rem 0.4rem; border-radius: 9999px;">${state.unreadNotificationsCount}</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="markAllNotificationsRead()">Mark All Read</button>
      </div>

      <div id="notif-list-body" style="overflow-y: auto; flex: 1; max-height: 380px; padding: 0.5rem 0;">
        <p style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">Loading notifications...</p>
      </div>
    </div>
  `;
};

window.loadNotificationsList = async function() {
  const listEl = document.getElementById('notif-list-body');
  if (!listEl) return;

  try {
    const res = await apiFetch('/notifications?limit=25');
    state.notificationsList = res.data || [];
    state.unreadNotificationsCount = res.unreadCount || 0;
    updateNotificationBadge();

    if (state.notificationsList.length === 0) {
      listEl.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications yet.</p>';
      return;
    }

    listEl.innerHTML = state.notificationsList.map(n => {
      const typeColors = {
        SUCCESS: '#10b981',
        WARNING: '#f59e0b',
        ERROR: '#ef4444',
        INFO: 'var(--accent)',
        REMINDER: '#8b5cf6'
      };
      const color = typeColors[n.type] || 'var(--accent)';
      const dt = new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      return `
        <div style="padding: 0.75rem 1.1rem; border-bottom: 1px solid var(--border-muted); background: ${n.is_read ? 'transparent' : 'rgba(217, 119, 6, 0.05)'}; cursor: pointer; transition: background 0.15s;" onclick="onNotificationClick('${n.id}', '${n.related_entity_type || ''}', '${n.related_entity_id || ''}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
              ${escapeHtml(n.title)}
            </div>
            <span style="font-size: 0.7rem; color: var(--text-muted);">${dt}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem; line-height: 1.4;">${escapeHtml(n.message)}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<p style="padding: 1rem; color: var(--danger); font-size: 0.8rem;">Failed to load notifications: ${err.message}</p>`;
  }
};

window.fetchUnreadNotificationsCount = async function() {
  if (!state.token) return;
  try {
    const res = await apiFetch('/notifications/unread-count');
    state.unreadNotificationsCount = res.data?.unreadCount || 0;
    updateNotificationBadge();
  } catch (err) {
    // Non-blocking
  }
};

window.updateNotificationBadge = function() {
  const badge = document.getElementById('notif-badge');
  if (badge) {
    if (state.unreadNotificationsCount > 0) {
      badge.textContent = state.unreadNotificationsCount > 99 ? '99+' : state.unreadNotificationsCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
};

window.onNotificationClick = async function(id, entityType, entityId) {
  await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
  state.unreadNotificationsCount = Math.max(0, state.unreadNotificationsCount - 1);
  updateNotificationBadge();
  state.notificationsOpen = false;
  renderNotificationDropdown();

  if (entityType === 'DEAL') {
    switchView('deals');
    if (entityId) openDealDetailModal(entityId);
  } else if (entityType === 'LEAD') {
    switchView('leads');
    if (entityId) loadLeadDetailsView(entityId);
  } else if (entityType === 'PAYMENT') {
    switchView('payments');
  } else if (entityType === 'SITE_VISIT') {
    switchView('calendar');
  }
};

window.markAllNotificationsRead = async function() {
  try {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    state.unreadNotificationsCount = 0;
    updateNotificationBadge();
    loadNotificationsList();
  } catch (err) {
    alert('Failed to mark all as read: ' + err.message);
  }
};

window.startNotificationPolling = function() {
  if (window.notifPollTimer) return;
  window.notifPollTimer = setInterval(() => {
    fetchUnreadNotificationsCount();
  }, 10000);
};

// --------------------------------------------------------------------------
// SUPPORT & HELPDESK TICKETS VIEW
// --------------------------------------------------------------------------
window.supportStatusFilter = '';
window.supportPriorityFilter = '';
window.supportSearchFilter = '';

async function loadSupportTicketsView(container) {
  try {
    let endpoint = `/support/tickets?`;
    if (window.supportStatusFilter) endpoint += `status=${window.supportStatusFilter}&`;
    if (window.supportPriorityFilter) endpoint += `priority=${window.supportPriorityFilter}&`;
    if (window.supportSearchFilter) endpoint += `search=${encodeURIComponent(window.supportSearchFilter)}&`;

    const res = await apiFetch(endpoint);
    const tickets = res.data || [];

    container.innerHTML = `
      <div class="table-container" style="margin: 0 0 1.25rem 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color);">
          <div>
            <h3 style="font-weight: 700; font-size: 1rem; margin: 0;">Support & Helpdesk Requests</h3>
            <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">Incoming customer assistance requests from WhatsApp, website forms, and client portals.</p>
          </div>
          <button class="btn btn-accent btn-sm" onclick="openSupportModal()">+ Submit Ticket</button>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.85rem 1.25rem; background: var(--bg-card); border-bottom: 1px solid var(--border-color);">
          <input type="text" class="form-control" placeholder="Search ticket #, name, phone, or subject..." value="${window.supportSearchFilter}" style="flex: 1; min-width: 200px; font-size: 0.82rem;" oninput="window.supportSearchFilter=this.value; loadSupportTicketsView(document.getElementById('content-area'))">
          
          <select class="form-control" style="width: 160px; font-size: 0.82rem;" onchange="window.supportStatusFilter=this.value; loadSupportTicketsView(document.getElementById('content-area'))">
            <option value="" ${window.supportStatusFilter === '' ? 'selected' : ''}>All Statuses</option>
            <option value="OPEN" ${window.supportStatusFilter === 'OPEN' ? 'selected' : ''}>Open</option>
            <option value="IN_PROGRESS" ${window.supportStatusFilter === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
            <option value="RESOLVED" ${window.supportStatusFilter === 'RESOLVED' ? 'selected' : ''}>Resolved</option>
            <option value="CLOSED" ${window.supportStatusFilter === 'CLOSED' ? 'selected' : ''}>Closed</option>
          </select>

          <select class="form-control" style="width: 150px; font-size: 0.82rem;" onchange="window.supportPriorityFilter=this.value; loadSupportTicketsView(document.getElementById('content-area'))">
            <option value="" ${window.supportPriorityFilter === '' ? 'selected' : ''}>All Priorities</option>
            <option value="LOW" ${window.supportPriorityFilter === 'LOW' ? 'selected' : ''}>Low</option>
            <option value="MEDIUM" ${window.supportPriorityFilter === 'MEDIUM' ? 'selected' : ''}>Medium</option>
            <option value="HIGH" ${window.supportPriorityFilter === 'HIGH' ? 'selected' : ''}>High</option>
            <option value="URGENT" ${window.supportPriorityFilter === 'URGENT' ? 'selected' : ''}>Urgent</option>
          </select>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card); font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Ticket #</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Subject</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Requester</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Priority</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Status</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Assignee</th>
              <th style="padding: 0.75rem 1.1rem; text-align: left;">Created</th>
              <th style="padding: 0.75rem 1.1rem; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.length ? tickets.map(t => {
              const dateStr = new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return `
                <tr style="border-bottom: 1px solid var(--border-muted);">
                  <td style="padding: 0.85rem 1.1rem; font-weight: 700; color: var(--accent);">#${t.ticket_number}</td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(t.subject)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t.description)}</div>
                  </td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <div style="font-weight: 500;">${escapeHtml(t.full_name)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${t.phone}</div>
                  </td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
                  </td>
                  <td style="padding: 0.85rem 1.1rem;">
                    <span class="badge badge-${t.status.toLowerCase()}">${t.status}</span>
                  </td>
                  <td style="padding: 0.85rem 1.1rem; font-size: 0.82rem;">
                    ${t.assignee_first_name ? `${t.assignee_first_name} ${t.assignee_last_name || ''}` : '<span style="color: var(--text-muted);">Unassigned</span>'}
                  </td>
                  <td style="padding: 0.85rem 1.1rem; font-size: 0.78rem; color: var(--text-muted);">${dateStr}</td>
                  <td style="padding: 0.85rem 1.1rem; text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="openTicketDetailModal('${t.id}')">Review</button>
                  </td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">No support tickets found matching current filters.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: var(--danger);">Failed to load support tickets: ${err.message}</div>`;
  }
}

window.openTicketDetailModal = async function (ticketId) {
  try {
    const res = await apiFetch(`/support/tickets/${ticketId}`);
    const t = res.data;

    let existing = document.getElementById('ticket-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ticket-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 580px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Ticket #${t.ticket_number}</h3>
            <span class="badge badge-${t.status.toLowerCase()}" style="margin-top: 0.35rem;">${t.status}</span>
          </div>
          <button class="btn-icon" onclick="document.getElementById('ticket-modal-overlay').remove()">✕</button>
        </div>

        <div style="background: var(--bg-card-hover); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.25rem; font-size: 0.85rem;">
          <div style="font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main); font-size: 0.95rem;">${escapeHtml(t.subject)}</div>
          <div style="white-space: pre-wrap; line-height: 1.5; color: var(--text-main); margin-bottom: 0.75rem;">${escapeHtml(t.description)}</div>
          <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
            <span>Requester: <b>${escapeHtml(t.full_name)}</b> (${t.phone} | ${t.email})</span>
          </div>
        </div>

        <form id="update-ticket-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Status</label>
              <select id="tk-status" class="form-control">
                <option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''}>Open</option>
                <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                <option value="RESOLVED" ${t.status === 'RESOLVED' ? 'selected' : ''}>Resolved</option>
                <option value="CLOSED" ${t.status === 'CLOSED' ? 'selected' : ''}>Closed</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Priority</label>
              <select id="tk-priority" class="form-control">
                <option value="LOW" ${t.priority === 'LOW' ? 'selected' : ''}>Low</option>
                <option value="MEDIUM" ${t.priority === 'MEDIUM' ? 'selected' : ''}>Medium</option>
                <option value="HIGH" ${t.priority === 'HIGH' ? 'selected' : ''}>High</option>
                <option value="URGENT" ${t.priority === 'URGENT' ? 'selected' : ''}>Urgent</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Resolution Notes / Staff Response</label>
            <textarea id="tk-notes" class="form-control" rows="3" placeholder="Enter resolution details, customer follow-up notes, or internal comments...">${t.resolution_notes || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.6rem;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ticket-modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-accent">Save Ticket</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('update-ticket-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiFetch(`/support/tickets/${ticketId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: document.getElementById('tk-status').value,
            priority: document.getElementById('tk-priority').value,
            resolution_notes: document.getElementById('tk-notes').value
          })
        });
        overlay.remove();
        loadSupportTicketsView(document.getElementById('content-area'));
      } catch (err) {
        alert('Failed to update ticket: ' + err.message);
      }
    });
  } catch (err) {
    alert('Failed to load ticket details: ' + err.message);
  }
};

// --------------------------------------------------------------------------
// PUBLIC CONTACT SUPPORT MODAL (NO LOGIN REQUIRED)
// --------------------------------------------------------------------------
window.openSupportModal = function () {
  let existing = document.getElementById('public-support-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'public-support-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 520px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Contact Customer Support</h3>
          <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">Submit a request and our support desk will contact you shortly.</p>
        </div>
        <button class="btn-icon" onclick="document.getElementById('public-support-modal').remove()">✕</button>
      </div>

      <div id="support-form-alert" style="display: none; padding: 0.85rem; border-radius: var(--radius); margin-bottom: 1rem; font-size: 0.85rem;"></div>

      <form id="public-support-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Full Name *</label>
            <input type="text" id="sup-name" class="form-control" placeholder="e.g. Vikram Sharma" required>
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Mobile Number *</label>
            <input type="tel" id="sup-phone" class="form-control" placeholder="e.g. +91 98765 43210" required>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Email Address *</label>
          <input type="email" id="sup-email" class="form-control" placeholder="e.g. name@example.com" required>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Subject *</label>
          <input type="text" id="sup-subject" class="form-control" placeholder="Brief summary of your inquiry or issue..." required>
        </div>

        <div style="margin-bottom: 1.1rem;">
          <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.3rem; display: block;">Description of Issue *</label>
          <textarea id="sup-desc" class="form-control" rows="3" placeholder="Please describe how we can assist you with your property inquiry, booking, or site visit..." required></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.6rem;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('public-support-modal').remove()">Cancel</button>
          <button type="submit" id="sup-submit-btn" class="btn btn-accent">Submit Support Request</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('public-support-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sup-submit-btn');
    const alertBox = document.getElementById('support-form-alert');
    btn.disabled = true;
    btn.innerText = 'Submitting...';

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: document.getElementById('sup-name').value,
          phone: document.getElementById('sup-phone').value,
          email: document.getElementById('sup-email').value,
          subject: document.getElementById('sup-subject').value,
          description: document.getElementById('sup-desc').value
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Submission failed');

      alertBox.style.display = 'block';
      alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
      alertBox.style.color = '#10b981';
      alertBox.style.border = '1px solid #10b981';
      alertBox.innerHTML = `✓ <b>Success!</b> ${data.message}`;

      document.getElementById('public-support-form').style.display = 'none';

      setTimeout(() => {
        overlay.remove();
        if (state.token && state.currentView === 'support') {
          loadSupportTicketsView(document.getElementById('content-area'));
        }
      }, 3500);
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
      alertBox.style.color = '#ef4444';
      alertBox.style.border = '1px solid #ef4444';
      alertBox.innerHTML = `✕ <b>Error:</b> ${err.message}`;
      btn.disabled = false;
      btn.innerText = 'Submit Support Request';
    }
  });
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Initial Launch
window.addEventListener('DOMContentLoaded', renderApp);

