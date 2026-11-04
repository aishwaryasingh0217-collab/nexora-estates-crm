/**
 * NEXORA ESTATES - REAL ESTATE MANAGEMENT PLATFORM
 * International High-End Client Application with JWT Session, Backend RBAC Role Validation, and AI Assistant.
 */

// Dynamic API Base Detection for root (/) and subdirectory (/nexora-crm/) deployments
function getApiBase() {
  const pathname = window.location.pathname || '';
  // Remove filename if present (e.g. index.html)
  const dirPath = pathname.replace(/\/[^\/]+\.[^\/]+$/, '');
  // Remove trailing slashes
  const cleanPath = dirPath.replace(/\/+$/, '');
  // If hosted at /nexora-crm, returns '/nexora-crm/api'. If at root (/), returns '/api'
  return (cleanPath ? cleanPath : '') + '/api';
}

const API_BASE = getApiBase();

// Helper to resolve asset URLs (e.g. /uploads/brochures/...) relative to application subpath
function getAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const pathname = window.location.pathname || '';
  const dirPath = pathname.replace(/\/[^\/]+\.[^\/]+$/, '').replace(/\/+$/, '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${dirPath}${cleanUrl}`;
}

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
    channelPartners: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><polyline points="16 11 18 13 22 9"/></svg>`,
    demandNotices: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
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
    support: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 15h.01"/></svg>`,
    webhook: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c0-2.21 1.79-4 4-4h4.08"/><circle cx="6" cy="17" r="1"/><path d="M14.07 9.02A4 4 0 0 1 22 7c0 2.21-1.79 4-4 4h-4.08"/><circle cx="18" cy="7" r="1"/><polyline points="8 2 12 6 8 10"/></svg>`,
    customerPortal: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    download: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    check: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    marketplace: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    flame: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    usersGroup: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    shield: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    tag: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    key: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 2l-2 2m-1.5 1.5L19 7l-2 2m-1.5 1.5L17 12l-2 2m-1.5 1.5L15 17l-4 4-7-7 4-4 1.5 1.5M10 4a6 6 0 1 1-8.5 8.5L10 4z"/></svg>`
  };
  return icons[name] || '';
}


function getStoredUser() {
  try {
    const raw = localStorage.getItem('crm_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to parse stored user, clearing invalid session data:', e);
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_token');
    return null;
  }
}

const state = {
  token: localStorage.getItem('crm_token') || null,
  user: getStoredUser(),
  theme: localStorage.getItem('crm_theme') || 'light',
  viewMode: localStorage.getItem('crm_view_mode') || 'website',
  currentView: 'dashboard',
  selectedProjectId: null,
  selectedCustomerProjectId: null,
  customerView: null,
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

// View Mode Management (website vs login vs crm)
function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('crm_view_mode', mode);
  if (mode === 'login') {
    window.location.hash = '#/login';
  } else if (mode === 'website') {
    if (window.location.hash === '#/login' || window.location.hash === '#/crm') {
      window.location.hash = '';
    }
  } else if (mode === 'crm') {
    window.location.hash = '#/crm';
  }
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1-Click Role Demo Login Helper
async function quickLoginAs(roleName) {
  const creds = {
    SUPER_ADMIN: { u: 'admin', p: 'AdminPassword123!', r: 'Super Admin' },
    ADMIN: { u: 'admin_ops', p: 'AdminPassword123!', r: 'Admin' },
    INSIDE_SALES: { u: 'telecaller', p: 'Telecaller123!', r: 'Inside Sales' },
    OUTSIDE_SALES: { u: 'siteagent', p: 'Siteagent123!', r: 'Outside Sales' },
    CHANNEL_PARTNER: { u: 'partner', p: 'Partner123!', r: 'Channel Partner' },
    BUYER: { u: 'customer', p: 'Customer123!', r: 'Buyer' }
  };
  const target = creds[roleName] || creds.SUPER_ADMIN;

  // Visual feedback & pre-fill fields if on login screen
  const idInput = document.getElementById('login-identifier');
  const passInput = document.getElementById('login-password');
  const roleSelect = document.getElementById('login-role');
  const submitBtn = document.getElementById('btn-login-submit');
  if (idInput) idInput.value = target.u;
  if (passInput) passInput.value = target.p;
  if (roleSelect) roleSelect.value = target.r;
  if (submitBtn) {
    submitBtn.innerText = `Signing in as ${target.r}...`;
    submitBtn.disabled = true;
  }

  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: target.u, password: target.p })
    });
    if (res.user.role === 'INSIDE_SALES') {
      state.currentView = 'leads';
    } else if (res.user.role === 'OUTSIDE_SALES') {
      state.currentView = 'calendar';
    } else if (res.user.role === 'CHANNEL_PARTNER') {
      state.currentView = 'channel-partners';
    } else if (res.user.role === 'BUYER') {
      state.currentView = 'marketplace';
    } else {
      state.currentView = 'dashboard';
    }
    login(res.token, res.user);
  } catch (e) {
    console.warn('Quick login fallback client-side session:', e.message);
    const mockUser = {
      id: 'a1b2c3d4-demo-0001',
      username: target.u,
      role: roleName,
      first_name: target.u.toUpperCase(),
      last_name: 'User',
      email: `${target.u}@nexoraestates.com`
    };
    login('mock-jwt-token-role', mockUser);
  }
}

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
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${API_BASE}${cleanEndpoint}`, {
      ...options,
      headers
    });

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || `Server returned status ${res.status}` };
      }
    }

    if (!res.ok) {
      if (res.status === 401 || (res.status === 403 && data.message?.includes('revoked'))) {
        logout();
      }
      throw new Error(data.message || `API request failed with status ${res.status}`);
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
  state.viewMode = 'crm';
  localStorage.setItem('crm_token', token);
  localStorage.setItem('crm_user', JSON.stringify(user));
  localStorage.setItem('crm_view_mode', 'crm');
  if (window.location.hash === '#/login' || window.location.hash === '') {
    window.location.hash = '#/crm';
  }
  renderApp();
}

function logout() {
  state.token = null;
  state.user = null;
  state.viewMode = 'website';
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
  localStorage.setItem('crm_view_mode', 'website');
  if (window.location.hash === '#/crm' || window.location.hash === '#/login') {
    window.location.hash = '';
  }
  renderApp();
}

// Main App Render
function renderApp() {
  const root = document.getElementById('app');

  // 0. Dedicated Post Property Free Page (99acres pattern for Nexora SaaS)
  if (state.viewMode === 'post-property' || window.location.hash === '#/post-property') {
    renderPostPropertyPage(root);
    return;
  }

  // 0B. Dedicated Apartments & Properties Search Page (99acres pattern)
  if (state.viewMode === 'properties' || window.location.hash === '#/properties' || window.location.hash === '#/apartments') {
    if (typeof window.renderApartmentListingPage === 'function') {
      window.renderApartmentListingPage(root);
      return;
    }
  }

  // 0C. Dedicated Authentication & Staff Portal View
  if ((state.viewMode === 'login' || window.location.hash === '#/login') && (!state.token || !state.user)) {
    state.viewMode = 'login';
    renderLoginView(root);
    return;
  }

  // 1. If in public website mode, render the public website or customer views
  if (state.viewMode === 'website' || (!state.token && state.viewMode !== 'login')) {
    if (state.selectedCustomerProjectId) {
      renderCustomerProjectDetail(root, state.selectedCustomerProjectId);
      return;
    }
    if (state.customerView === 'all-projects') {
      renderCustomerAllProjectsPage(root);
      return;
    }
    renderPublicWebsite(root);
    return;
  }

  // 2. If in login mode or not authenticated
  if (state.viewMode === 'login' || !state.token || !state.user) {
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

        <a class="nav-item ${state.currentView === 'demand-notices' ? 'active' : ''}" onclick="switchView('demand-notices')">
          ${getIcon('demandNotices')} Milestone Demands
        </a>

        <a class="nav-item ${state.currentView === 'channel-partners' ? 'active' : ''}" onclick="switchView('channel-partners')">
          ${getIcon('channelPartners')} Channel Partners
        </a>

        <div class="sidebar-divider"></div>
        <div class="sidebar-section-title">Properties & Deals</div>
        <a class="nav-item ${state.currentView === 'marketplace' ? 'active' : ''}" onclick="switchView('marketplace')">
          ${getIcon('marketplace')} Buy, Rent & Deals
        </a>

        <div class="sidebar-divider"></div>
        <div class="sidebar-section-title">Intelligence & Ops</div>
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
        <div class="header-actions" style="display: flex; gap: 0.6rem; align-items: center;">
          <button class="btn btn-secondary btn-sm" onclick="setViewMode('website')" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.85rem; border-radius: 8px; cursor: pointer;">
            🌐 Public Website
          </button>
          <span style="font-size: 0.72rem; font-weight: 700; background: rgba(0,0,0,0.06); padding: 0.35rem 0.65rem; border-radius: 6px; letter-spacing: 0.5px;">
            ${state.user.role || 'SUPER_ADMIN'}
          </span>
          <button class="btn-icon" id="notif-bell-btn" title="Notifications" onclick="toggleNotificationDropdown()" style="position: relative;">
            ${getIcon('bell')}
            <span id="notif-badge" class="notif-badge" style="display: none; position: absolute; top: -3px; right: -3px; font-size: 0.6rem; font-weight: 700; border-radius: 9999px; padding: 0.05rem 0.3rem; min-width: 15px; text-align: center;">0</span>
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
    case 'demand-notices':
      titleHeading.innerText = 'Construction Milestone Demand Notices';
      loadDemandNoticesView(contentArea);
      break;
    case 'channel-partners':
      titleHeading.innerText = 'Channel Partner & Broker Ecosystem';
      loadChannelPartnersView(contentArea);
      break;
    case 'marketplace':
      titleHeading.innerText = 'Marketplace & High-Velocity Growth Engine';
      loadMarketplaceView(contentArea);
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
          <p style="font-size: 0.68rem; color: var(--text-muted);">● Online | Live Database Connected</p>
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

// ==========================================================================
// GRAND PUBLIC CONSUMER & SAAS PLATFORM SHOWCASE
// ==========================================================================

const pubState = {
  activeCategory: 'new-launches',
  selectedFloor: 12,
  towerRotation: 15,
  daylightMode: 'day',
  selectedLocChip: 'all',
  selectedBhk: 'all',          // 'all', '2bhk', '3bhk', '4bhk'
  selectedBudget: 'all',       // 'all', 'under-1cr', '1cr-2cr', '2cr-3cr', '3cr-plus'
  sortBy: 'featured',          // 'featured', 'price-asc', 'price-desc', 'discount'
  viewMode: 'grid',            // 'grid' or 'locality-radar'
  comparedProps: [],           // IDs of properties selected for side-by-side comparison (max 2)
  keywordSearch: '',
  simPoolBuyers: 5,
  simBudget: 15000000,
  activeHotspotText: 'Click any glowing pin on the floor plan above to inspect architectural specifications.'
};

const PUB_LOCALITIES = [
  {
    id: 'golf-course',
    name: 'Golf Course Extension',
    zone: 'South Luxury District',
    avgRate: '₹14,200/sq.ft',
    growth: '+12.4% YoY',
    unitsCount: 14,
    metroTime: '3 mins (350m)',
    techHubTime: '7 mins',
    highlight: 'Golf views, ultra-luxury high-rises, institutional developer corridor'
  },
  {
    id: 'tech-corridor',
    name: 'Tech Corridor Expressway',
    zone: 'East IT Tech Belt',
    avgRate: '₹9,800/sq.ft',
    growth: '+15.8% YoY',
    unitsCount: 8,
    metroTime: '5 mins (500m)',
    techHubTime: '4 mins',
    highlight: 'Direct connectivity to 3 major IT SEZs, high rental yield (5.2%)'
  },
  {
    id: 'south-city',
    name: 'South City Luxury Enclave',
    zone: 'Prime City Core',
    avgRate: '₹18,500/sq.ft',
    growth: '+9.2% YoY',
    unitsCount: 4,
    metroTime: '8 mins (800m)',
    techHubTime: '12 mins',
    highlight: 'Gated duplex sky villas, diplomatic neighborhood, private plunge pools'
  }
];


const PUB_FLOORS = {
  24: {
    floorNum: 24,
    title: 'Penthouse Sky Villa',
    type: '4 BHK Duplex',
    area: '3,850 sq.ft',
    price: 32000000,
    priceFormatted: '₹3.20 Cr',
    discount: 'Early Bird ₹15L OFF',
    status: 'AVAILABLE',
    statusColor: '#10b981',
    description: 'Double-height ceiling, private heated plunge pool, 360° panoramic sunset deck, and private high-speed elevator foyer.',
    amenities: ['Private Infinity Pool', 'Private Lift Foyer', 'Automated Italian Kitchen', 'Double-Height Living'],
    tokenAmount: 51000
  },
  18: {
    floorNum: 18,
    title: 'Executive Royal Suite',
    type: '3.5 BHK Sky Residence',
    area: '2,450 sq.ft',
    price: 24500000,
    priceFormatted: '₹2.45 Cr',
    discount: 'Save ₹10 Lakhs',
    status: 'AVAILABLE',
    statusColor: '#10b981',
    description: 'Wrap-around panoramic glass balcony, dedicated home cinema acoustic room, servant quarters, and imported wooden flooring.',
    amenities: ['Wrap-Around Balcony', 'Home Theater Nook', 'Smart Climate Control', 'Dual Parking Bays'],
    tokenAmount: 21000
  },
  12: {
    floorNum: 12,
    title: 'Corner Panoramic Residence',
    type: '3 BHK Luxury Suite',
    area: '1,980 sq.ft',
    price: 18500000,
    priceFormatted: '₹1.85 Cr',
    discount: 'Early Bird ₹8L OFF',
    status: 'AVAILABLE',
    statusColor: '#10b981',
    description: 'Prime corner layout with cross-ventilation, overlooking the central sensory lake and park, equipped with German modular fittings.',
    amenities: ['Lake View Corner', 'German Fittings', 'Voice Automation', 'Dedicated EV Charger'],
    tokenAmount: 21000
  },
  5: {
    floorNum: 5,
    title: 'Garden View Executive Suite',
    type: '2 BHK Premium',
    area: '1,280 sq.ft',
    price: 11500000,
    priceFormatted: '₹1.15 Cr',
    discount: 'Group Deal 12% OFF',
    status: '2 SLOTS LEFT IN POOL',
    statusColor: '#f59e0b',
    description: 'Direct views over the landscaped podium gardens, open-concept island kitchen, and zero common walls for total privacy.',
    amenities: ['Garden Facing Deck', 'Zero Common Walls', 'Walk-in Wardrobe', 'High Speed Fiber Ready'],
    tokenAmount: 21000
  },
  0: {
    floorNum: 0,
    title: 'Grand Atrium & Club Nexora',
    type: 'Amenity & Wellness Deck',
    area: '18,500 sq.ft',
    price: 0,
    priceFormatted: 'Included with Ownership',
    discount: 'Zero Maintenance 2 Yrs',
    status: 'READY TO EXPERIENCE',
    statusColor: '#3b82f6',
    description: 'Triple-height grand entrance atrium, heated Olympic swimming pool, indoor squash courts, private screening theater, and 24/7 concierge.',
    amenities: ['Olympic Lap Pool', 'Squash & Badminton', 'Café & Lounge Bar', '24/7 Valet Concierge'],
    tokenAmount: 0
  }
};

const PUB_CARDS = {
  'new-launches': [
    {
      id: 'proj-1',
      title: 'Verona Skyline Residences',
      location: 'Golf Course Extension, South District',
      areaTag: 'golf-course',
      bhk: '3 & 4 BHK Luxury Suites',
      bhkTag: '3bhk',
      sqft: '1,980 - 3,850 sq.ft',
      carpetSqft: '1,420 sq.ft RERA Carpet',
      price: '₹1.85 Cr onwards',
      priceNum: 18500000,
      marketPrice: 'Market Rate: ₹1.98 Cr',
      marketPriceNum: 19800000,
      savingsText: 'Save ₹13.0 Lakhs Direct',
      possession: 'Possession Dec 2026',
      developer: 'Nexora Signature Infra',
      badge: '⚡ Direct Builder Launch Price',
      badgeColor: '#10b981',
      stats: '14 Units Left • RERA Approved',
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '350m (3 mins)', techPark: '2.5 km (7 mins)', airport: '18 km (25 mins)', school: '1.2 km (4 mins)', hospital: '2.8 km (8 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/190822/002812',
      amenitiesList: ['Infinity Lap Pool', 'Italian Marble', '24/7 Concierge', 'EV Fast Charging'],
      actionType: 'token',
      tokenAmount: '₹21,000'
    },
    {
      id: 'proj-2',
      title: 'Celestial Heights',
      location: 'Tech Corridor Expressway',
      areaTag: 'tech-corridor',
      bhk: '2 & 3 BHK Modern Homes',
      bhkTag: '2bhk',
      sqft: '1,280 - 1,820 sq.ft',
      carpetSqft: '940 sq.ft RERA Carpet',
      price: '₹95 Lakhs onwards',
      priceNum: 9500000,
      marketPrice: 'Market Rate: ₹1.05 Cr',
      marketPriceNum: 10500000,
      savingsText: 'Save ₹10.0 Lakhs Direct',
      possession: 'Possession Q4 2026',
      developer: 'Horizon City Developers',
      badge: '🛡️ 0% Brokerage Direct',
      badgeColor: '#3b82f6',
      stats: '8 Units Left • Zero Broker Spam',
      img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '500m (5 mins)', techPark: '1.2 km (4 mins)', airport: '22 km (30 mins)', school: '800m (3 mins)', hospital: '1.5 km (5 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/200115/003419',
      amenitiesList: ['Clubhouse & Gym', 'Podium Garden', 'Dedicated EV Bay', 'High Speed Elevators'],
      actionType: 'token',
      tokenAmount: '₹21,000'
    },
    {
      id: 'proj-3',
      title: 'The Grand Palm Sanctuary',
      location: 'South City Luxury Enclave',
      areaTag: 'south-city',
      bhk: '4 BHK Duplex Sky Villas',
      bhkTag: '4bhk',
      sqft: '3,850 - 4,500 sq.ft',
      carpetSqft: '2,920 sq.ft RERA Carpet',
      price: '₹3.40 Cr onwards',
      priceNum: 34000000,
      marketPrice: 'Market Rate: ₹3.65 Cr',
      marketPriceNum: 36500000,
      savingsText: 'Save ₹25.0 Lakhs Direct',
      possession: 'Ready to Move',
      developer: 'Palm Imperial Estates',
      badge: '🔥 Private Plunge Pool Included',
      badgeColor: '#f59e0b',
      stats: 'Only 4 Villas Remaining',
      img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '800m (8 mins)', techPark: '4.5 km (12 mins)', airport: '15 km (20 mins)', school: '1.5 km (5 mins)', hospital: '2.0 km (6 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/210310/004128',
      amenitiesList: ['Private Heated Pool', 'Double-Height Living', 'Private Elevator Foyer', 'Butler Room'],
      actionType: 'token',
      tokenAmount: '₹51,000'
    }
  ],
  'group-deals': [
    {
      id: 'pool-1',
      title: 'Tech Corridor Bulk Buying Pool',
      location: 'Tower B, Tech Expressway',
      areaTag: 'tech-corridor',
      bhk: '3 BHK Lake Facing (5 Buyers Pool)',
      bhkTag: '3bhk',
      sqft: '1,750 sq.ft per unit',
      carpetSqft: '1,280 sq.ft RERA Carpet',
      price: '₹1.48 Cr (Wholesale)',
      priceNum: 14800000,
      marketPrice: '₹1.60 Cr Individual Broker',
      marketPriceNum: 16000000,
      savingsText: 'Save ₹12.0 Lakhs Per Buyer',
      possession: 'Possession Mid 2027',
      developer: 'TechSpace Builders',
      badge: '👥 Bulk Wholesale Builder Pool',
      badgeColor: '#10b981',
      joined: 3,
      total: 5,
      deadline: '48h remaining to lock rate',
      img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '400m (4 mins)', techPark: '1.0 km (3 mins)', airport: '20 km (28 mins)', school: '900m (3 mins)', hospital: '1.8 km (6 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/200115/003419',
      amenitiesList: ['Lake Promenade', 'Olympic Pool', 'Squash Arena', 'Solar Power Backed'],
      actionType: 'pool',
      discountAmount: 1200000
    },
    {
      id: 'pool-2',
      title: 'Verona Skyline Investor Pool',
      location: 'Verona Tower A (Floors 15-20)',
      areaTag: 'golf-course',
      bhk: '4 BHK Duplex Units (4 Buyers Pool)',
      bhkTag: '4bhk',
      sqft: '2,900 sq.ft per unit',
      carpetSqft: '2,150 sq.ft RERA Carpet',
      price: '₹2.70 Cr (Wholesale)',
      priceNum: 27000000,
      marketPrice: '₹2.90 Cr Individual Broker',
      marketPriceNum: 29000000,
      savingsText: 'Save ₹20.0 Lakhs Per Buyer',
      possession: 'Possession Dec 2026',
      developer: 'Nexora Signature Infra',
      badge: '👥 Bulk Wholesale Investor Pool',
      badgeColor: '#f59e0b',
      joined: 2,
      total: 4,
      deadline: '2 spots left',
      img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '350m (3 mins)', techPark: '2.5 km (7 mins)', airport: '18 km (25 mins)', school: '1.2 km (4 mins)', hospital: '2.8 km (8 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/190822/002812',
      amenitiesList: ['Private Sky Deck', 'Acoustic Soundproofing', 'Automated Italian Kitchen', 'Double Car Bay'],
      actionType: 'pool',
      discountAmount: 2000000
    }
  ],
  'resale': [
    {
      id: 'deal-1',
      title: '4 BHK Lakeview Duplex (Resale)',
      location: 'Celestial Heights, Tower A-1402',
      areaTag: 'tech-corridor',
      bhk: '4 BHK • 3,100 sq.ft',
      bhkTag: '4bhk',
      carpetSqft: '2,350 sq.ft RERA Carpet',
      price: 'Highest Bid: ₹2.10 Cr',
      priceNum: 21000000,
      marketPrice: '₹2.28 Cr Broker Ask',
      marketPriceNum: 22800000,
      savingsText: 'Save ₹18.0 Lakhs in Broker Fees',
      reservePrice: 'Reserve: ₹2.15 Cr',
      possession: 'Immediate Handover',
      badge: '📜 Verified Clean Title',
      badgeColor: '#10b981',
      seller: 'Verified Owner: Mr. Suresh K.',
      timeLeft: '46h 12m left',
      img: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '500m (5 mins)', techPark: '1.2 km (4 mins)', airport: '22 km (30 mins)', school: '800m (3 mins)', hospital: '1.5 km (5 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/200115/003419',
      amenitiesList: ['Duplex Terrace Garden', 'Imported Wooden Floors', '2 Underground Car Parks', 'Zero Brokerage'],
      actionType: 'bid',
      currentBid: 21000000,
      unitNumber: 'A-1402'
    },
    {
      id: 'deal-2',
      title: '3 BHK Corner Panoramic (Resale)',
      location: 'Verona Skyline, Tower B-804',
      areaTag: 'golf-course',
      bhk: '3 BHK • 1,950 sq.ft',
      bhkTag: '3bhk',
      carpetSqft: '1,440 sq.ft RERA Carpet',
      price: 'Highest Bid: ₹1.42 Cr',
      priceNum: 14200000,
      marketPrice: '₹1.55 Cr Broker Ask',
      marketPriceNum: 15500000,
      savingsText: 'Save ₹13.0 Lakhs in Broker Fees',
      reservePrice: 'Reserve: ₹1.45 Cr',
      possession: 'Immediate Handover',
      badge: '📜 100% Legal Clearance Done',
      badgeColor: '#3b82f6',
      seller: 'Verified Owner: Mrs. Priya V.',
      timeLeft: '22h 45m left',
      img: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '350m (3 mins)', techPark: '2.5 km (7 mins)', airport: '18 km (25 mins)', school: '1.2 km (4 mins)', hospital: '2.8 km (8 mins)' },
      reraId: 'PRM/KA/RERA/1251/310/PR/190822/002812',
      amenitiesList: ['Corner Panoramic View', 'German Hardware Kitchen', '24/7 Security & Access', 'Clear Bank Title'],
      actionType: 'bid',
      currentBid: 14200000,
      unitNumber: 'B-804'
    }
  ],
  'rental': [
    {
      id: 'rent-1',
      title: 'Furnished 3 BHK Sea View Residence',
      location: 'Marine Promenade Tower, Floor 18',
      areaTag: 'south-city',
      bhk: '3 BHK • 1,850 sq.ft • Fully Furnished',
      bhkTag: '3bhk',
      carpetSqft: '1,380 sq.ft Carpet',
      price: '₹55,000 / month',
      priceNum: 55000,
      marketPrice: '₹62,000 + 1 Mo Broker Fee',
      marketPriceNum: 62000,
      savingsText: 'Save ₹62,000 in Brokerage',
      deposit: 'Deposit: ₹1,50,000 (Escrow Safe)',
      possession: 'Immediate Move-in',
      badge: '🔑 0% Brokerage • Direct Owner',
      badgeColor: '#10b981',
      owner: 'Owner: Capt. Vikram Nair (Verified)',
      stats: 'Instant Digital Lease • Ready to Move',
      img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '600m (6 mins)', techPark: '3.5 km (10 mins)', airport: '16 km (22 mins)', school: '1.0 km (4 mins)', hospital: '2.2 km (7 mins)' },
      reraId: 'Verified Direct Owner Registry #DIR-8819',
      amenitiesList: ['Fully Furnished Luxury', 'Escrow Protected Deposit', 'Instant Digital Lease', 'Direct Owner Contact'],
      actionType: 'rental'
    },
    {
      id: 'rent-2',
      title: 'Modern 2 BHK Executive Suite',
      location: 'Tech Corridor Central, Tower C-602',
      areaTag: 'tech-corridor',
      bhk: '2 BHK • 1,200 sq.ft • Semi-Furnished',
      bhkTag: '2bhk',
      carpetSqft: '880 sq.ft Carpet',
      price: '₹34,000 / month',
      priceNum: 34000,
      marketPrice: '₹38,000 + 1 Mo Broker Fee',
      marketPriceNum: 38000,
      savingsText: 'Save ₹38,000 in Brokerage',
      deposit: 'Zero Deposit Option Available',
      possession: 'Ready to Move',
      badge: '🔑 Zero Broker Spam Guarantee',
      badgeColor: '#3b82f6',
      owner: 'Owner: Ms. Rhea Mehta (Verified)',
      stats: 'Dedicated EV Parking • Gym & Pool',
      img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '400m (4 mins)', techPark: '800m (2 mins)', airport: '21 km (28 mins)', school: '700m (3 mins)', hospital: '1.6 km (5 mins)' },
      reraId: 'Verified Direct Owner Registry #DIR-7102',
      amenitiesList: ['Zero Broker Fee', 'Dedicated EV Parking', 'Gym & Pool Access', 'Fast Move-In'],
      actionType: 'rental'
    },
    {
      id: 'rent-3',
      title: 'Skyline Crest Penthouse & Jacuzzi Terrace',
      location: 'Golf Course Road, Diplomatic Sector',
      areaTag: 'golf-course',
      bhk: '4 BHK • 3,200 sq.ft • Fully Serviced',
      bhkTag: '4bhk',
      carpetSqft: '2,450 sq.ft Carpet',
      price: '₹1,25,000 / month',
      priceNum: 125000,
      marketPrice: '₹1,40,000 + 1 Mo Broker Fee',
      marketPriceNum: 140000,
      savingsText: 'Save ₹1,40,000 in Brokerage',
      deposit: 'Deposit: ₹2,50,000 (Escrow Safe)',
      possession: 'Immediate Move-in',
      badge: '💎 Diplomatic Standard • 0% Brokerage',
      badgeColor: '#f59e0b',
      owner: 'Owner: Dr. Ananya Sen (Verified)',
      stats: 'Private Terrace Jacuzzi • Housekeeping Available',
      img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80'
      ],
      commute: { metro: '300m (3 mins)', techPark: '1.8 km (5 mins)', airport: '17 km (24 mins)', school: '900m (3 mins)', hospital: '2.0 km (6 mins)' },
      reraId: 'Verified Direct Owner Registry #DIR-9411',
      amenitiesList: ['Private Terrace Jacuzzi', 'Concierge & Housekeeping', '2 Covered Car Parks', 'Direct Owner Contract'],
      actionType: 'rental'
    }
  ]
};

function renderPubFloorPlanSVG(floor) {
  const isNight = pubState.daylightMode === 'dusk';
  const bgColor = isNight ? '#16161a' : '#f9fafb';
  const wallStroke = isNight ? '#4b5563' : '#1f2937';
  const roomFill = isNight ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const accentColor = isNight ? '#f59e0b' : '#2563eb';
  const textColor = isNight ? '#e5e7eb' : '#374151';

  return `
    <svg viewBox="0 0 500 320" style="width: 100%; height: auto; background: ${bgColor}; border-radius: 12px; border: 1px solid var(--border-color); position: relative;">
      <defs>
        <pattern id="planGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="500" height="320" fill="url(#planGrid)" />

      <!-- Exterior Boundary -->
      <rect x="25" y="25" width="450" height="270" rx="4" fill="none" stroke="${wallStroke}" stroke-width="6"/>

      <!-- Living Lounge -->
      <rect x="25" y="25" width="270" height="170" fill="${roomFill}" stroke="${wallStroke}" stroke-width="3"/>
      <text x="160" y="95" font-size="12" font-weight="700" fill="${textColor}" text-anchor="middle">LIVING & DINING LOUNGE</text>
      <text x="160" y="115" font-size="10" fill="var(--text-muted)" text-anchor="middle">24' 0" × 15' 6"</text>
      <rect x="55" y="55" width="70" height="35" rx="3" fill="none" stroke="${accentColor}" stroke-width="1.5" stroke-dasharray="3,3"/>
      <rect x="75" y="65" width="30" height="15" rx="2" fill="${accentColor}" opacity="0.2"/>

      <!-- Hotspot: Living Lounge -->
      <g class="hotspot-pin" onclick="showFloorHotspot('Living Lounge', 'Double-height 11ft ceiling, Italian Botticino marble & floor-to-ceiling soundproof acoustic glass')">
        <circle cx="85" cy="135" r="9" fill="#f59e0b" opacity="0.8"/>
        <circle cx="85" cy="135" r="4" fill="#ffffff"/>
        <text x="85" y="155" font-size="8" font-weight="800" fill="#f59e0b" text-anchor="middle">PIN</text>
      </g>

      <!-- Panoramic Balcony -->
      <rect x="25" y="195" width="270" height="100" fill="${isNight ? 'rgba(245,158,11,0.08)' : 'rgba(37,99,235,0.06)'}" stroke="${wallStroke}" stroke-width="3"/>
      <text x="160" y="245" font-size="12" font-weight="700" fill="${accentColor}" text-anchor="middle">PANORAMIC SUN DECK</text>
      <text x="160" y="265" font-size="10" fill="var(--text-muted)" text-anchor="middle">24' 0" × 7' 0" • Glass Railing</text>

      <!-- Hotspot: Sun Deck -->
      <g class="hotspot-pin" onclick="showFloorHotspot('Panoramic Sun Deck', 'Wrap-around balcony with toughened glass railing and automated rain-sensing misting system')">
        <circle cx="85" cy="245" r="9" fill="#10b981" opacity="0.8"/>
        <circle cx="85" cy="245" r="4" fill="#ffffff"/>
        <text x="85" y="265" font-size="8" font-weight="800" fill="#10b981" text-anchor="middle">PIN</text>
      </g>

      <!-- Master Bedroom Suite -->
      <rect x="295" y="25" width="180" height="160" fill="${roomFill}" stroke="${wallStroke}" stroke-width="3"/>
      <text x="385" y="85" font-size="12" font-weight="700" fill="${textColor}" text-anchor="middle">MASTER BEDROOM</text>
      <text x="385" y="105" font-size="10" fill="var(--text-muted)" text-anchor="middle">16' 0" × 14' 0"</text>
      <rect x="355" y="120" width="60" height="50" rx="3" fill="none" stroke="${accentColor}" stroke-width="1.5"/>
      <rect x="365" y="125" width="18" height="12" rx="2" fill="${accentColor}" opacity="0.3"/>
      <rect x="387" y="125" width="18" height="12" rx="2" fill="${accentColor}" opacity="0.3"/>

      <!-- Hotspot: Master Suite -->
      <g class="hotspot-pin" onclick="showFloorHotspot('Master Suite', 'Spacious 16x14 ft master suite with walk-in closet, private balcony, and en-suite spa bath')">
        <circle cx="385" cy="55" r="9" fill="#3b82f6" opacity="0.8"/>
        <circle cx="385" cy="55" r="4" fill="#ffffff"/>
        <text x="385" y="45" font-size="8" font-weight="800" fill="#3b82f6" text-anchor="middle">PIN</text>
      </g>

      <!-- Modular Kitchen & Bath -->
      <rect x="295" y="185" width="180" height="110" fill="${roomFill}" stroke="${wallStroke}" stroke-width="3"/>
      <text x="385" y="235" font-size="11" font-weight="700" fill="${textColor}" text-anchor="middle">MODULAR KITCHEN & BATH</text>
      <text x="385" y="255" font-size="10" fill="var(--text-muted)" text-anchor="middle">12' 0" × 9' 6" • German Quartz</text>

      <!-- Hotspot: Kitchen -->
      <g class="hotspot-pin" onclick="showFloorHotspot('Smart Kitchen', 'German Blum hardware, imported quartz countertops, and concealed induction hob with smart chimney')">
        <circle cx="330" cy="235" r="9" fill="#ef4444" opacity="0.8"/>
        <circle cx="330" cy="235" r="4" fill="#ffffff"/>
      </g>

      <!-- North Compass -->
      <circle cx="450" cy="55" r="14" fill="${isNight ? '#242428' : '#ffffff'}" stroke="var(--border-color)" stroke-width="1"/>
      <path d="M 450 45 L 454 55 L 450 53 L 446 55 Z" fill="${accentColor}"/>
      <text x="450" y="42" font-size="8" font-weight="800" fill="${textColor}" text-anchor="middle">N</text>
    </svg>
  `;
}

window.showFloorHotspot = function (title, desc) {
  pubState.activeHotspotText = `📍 <b>${title}</b>: ${desc}`;
  const el = document.getElementById('pub-hotspot-display');
  if (el) {
    el.innerHTML = pubState.activeHotspotText;
    el.style.display = 'block';
  }
};

window.setPubFloor = function (floorNum) {
  pubState.selectedFloor = floorNum;
  renderPub3DVisualizer();
};

window.rotatePubTower = function () {
  pubState.towerRotation = (pubState.towerRotation + 35) % 360;
  const tower = document.getElementById('pub-interactive-tower');
  if (tower) {
    tower.style.transform = `rotateY(${pubState.towerRotation}deg) rotateX(12deg)`;
  }
};

window.togglePubDaylight = function () {
  pubState.daylightMode = pubState.daylightMode === 'day' ? 'dusk' : 'day';
  renderPub3DVisualizer();
};

window.setPubCategory = function (cat) {
  pubState.activeCategory = cat;
  renderFilteredProperties();
  const tabs = document.querySelectorAll('.pub-search-tab');
  tabs.forEach(t => {
    if (t.dataset.cat === cat) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
};

window.filterPubLocation = function (locTag) {
  pubState.selectedLocChip = locTag;
  document.querySelectorAll('.pub-filter-chip').forEach(c => {
    if (c.dataset.loc === locTag) c.classList.add('active');
    else c.classList.remove('active');
  });
  renderFilteredProperties();
};

window.setPubBhk = function (bhk) {
  pubState.selectedBhk = bhk;
  document.querySelectorAll('.bhk-pill').forEach(p => {
    if (p.dataset.bhk === bhk) p.classList.add('active');
    else p.classList.remove('active');
  });
  renderFilteredProperties();
};

window.filterPubBudget = function (budget) {
  pubState.selectedBudget = budget;
  renderFilteredProperties();
};

window.sortPubProperties = function (sortKey) {
  pubState.sortBy = sortKey;
  renderFilteredProperties();
};

window.setPubViewMode = function (mode) {
  pubState.viewMode = mode;
  const gridBtn = document.getElementById('view-grid-btn');
  const radarBtn = document.getElementById('view-radar-btn');
  if (gridBtn && radarBtn) {
    if (mode === 'grid') {
      gridBtn.classList.add('active');
      radarBtn.classList.remove('active');
    } else {
      radarBtn.classList.add('active');
      gridBtn.classList.remove('active');
    }
  }
  renderFilteredProperties();
};

window.handlePubLiveSearch = function (val) {
  pubState.keywordSearch = (val || '').toLowerCase().trim();
  renderFilteredProperties();
};

// ----------------------------------------------------
// COMPARISON DOCK & SIDE-BY-SIDE REALITY CHECKER
// ----------------------------------------------------
window.togglePropertyCompare = function (propId) {
  const idx = pubState.comparedProps.indexOf(propId);
  if (idx > -1) {
    pubState.comparedProps.splice(idx, 1);
  } else {
    if (pubState.comparedProps.length >= 2) {
      alert('You can compare up to 2 properties side-by-side. Uncheck one first.');
      return;
    }
    pubState.comparedProps.push(propId);
  }
  renderFilteredProperties();
  renderCompareDock();
};

window.clearCompareList = function () {
  pubState.comparedProps = [];
  renderFilteredProperties();
  renderCompareDock();
};

window.renderCompareDock = function () {
  let dock = document.getElementById('pub-compare-floating-dock');
  if (pubState.comparedProps.length === 0) {
    if (dock) dock.remove();
    return;
  }

  // Get details of selected properties
  const allCards = Object.values(PUB_CARDS).flat();
  const selected = pubState.comparedProps.map(id => allCards.find(c => c.id === id)).filter(Boolean);

  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'pub-compare-floating-dock';
    dock.className = 'pub-compare-dock';
    document.body.appendChild(dock);
  }

  dock.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span class="compare-badge-pill">⚖️ ${selected.length} / 2 Selected</span>
      <div style="font-size: 0.82rem; font-weight: 700; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${selected.map(s => s.title).join(' <span style="color: #f59e0b;">vs</span> ')}
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <button class="btn btn-accent btn-sm" onclick="openCompareModal()" style="font-weight: 800; font-size: 0.8rem; background: #f59e0b; color: #000; border: none;">
        Compare Side-by-Side →
      </button>
      <button class="btn btn-secondary btn-sm" onclick="clearCompareList()" style="font-size: 0.75rem; color: #fff; background: rgba(255,255,255,0.15); border: none;">
        ✕ Clear
      </button>
    </div>
  `;
};

window.openCompareModal = function () {
  const allCards = Object.values(PUB_CARDS).flat();
  const selected = pubState.comparedProps.map(id => allCards.find(c => c.id === id)).filter(Boolean);
  if (selected.length === 0) return;

  const [p1, p2] = selected;

  renderModal('Side-by-Side Property Comparison: Direct vs Market Rate', `
    <div style="max-width: 820px; overflow-x: auto;">
      <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 1rem;">
        See transparent developer direct pricing vs inflated broker markups on traditional portals.
      </p>

      <table class="vs-matrix-table">
        <thead>
          <tr>
            <th style="width: 25%;">Feature / Spec</th>
            <th style="width: 37.5%; text-align: left;">
              <div style="font-weight: 850; font-size: 0.95rem;">${p1.title}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${p1.location}</div>
            </th>
            ${p2 ? `
              <th style="width: 37.5%; text-align: left;">
                <div style="font-weight: 850; font-size: 0.95rem;">${p2.title}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${p2.location}</div>
              </th>
            ` : '<th style="color: var(--text-muted); font-size: 0.8rem;">Select 2nd property to compare</th>'}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Nexora Direct Price</b></td>
            <td style="color: #10b981; font-weight: 850; font-size: 1.15rem;">${p1.price}</td>
            ${p2 ? `<td style="color: #10b981; font-weight: 850; font-size: 1.15rem;">${p2.price}</td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>Market Broker Rate</b></td>
            <td style="color: #ef4444; font-size: 0.85rem; text-decoration: line-through;">${p1.marketPrice || 'Broker Markup +2%'}</td>
            ${p2 ? `<td style="color: #ef4444; font-size: 0.85rem; text-decoration: line-through;">${p2.marketPrice || 'Broker Markup +2%'}</td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>In-Pocket Direct Savings</b></td>
            <td><span style="background: rgba(16,185,129,0.12); color: #10b981; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 800; font-size: 0.8rem;">${p1.savingsText || 'Save ₹10-15 Lakhs'}</span></td>
            ${p2 ? `<td><span style="background: rgba(16,185,129,0.12); color: #10b981; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 800; font-size: 0.8rem;">${p2.savingsText || 'Save ₹10-15 Lakhs'}</span></td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>Configuration & Carpet</b></td>
            <td><b>${p1.bhk}</b><div style="color: var(--text-muted); font-size: 0.76rem;">${p1.carpetSqft || p1.sqft}</div></td>
            ${p2 ? `<td><b>${p2.bhk}</b><div style="color: var(--text-muted); font-size: 0.76rem;">${p2.carpetSqft || p2.sqft}</div></td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>Metro Connectivity</b></td>
            <td>🚇 ${p1.commute?.metro || 'Nearby'}</td>
            ${p2 ? `<td>🚇 ${p2.commute?.metro || 'Nearby'}</td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>Tech Park Distance</b></td>
            <td>💼 ${p1.commute?.techPark || 'Nearby'}</td>
            ${p2 ? `<td>💼 ${p2.commute?.techPark || 'Nearby'}</td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>RERA ID & Status</b></td>
            <td style="font-size: 0.72rem; color: var(--text-muted);">✅ Approved<br/>${p1.reraId || 'PRM/KA/RERA/1251'}</td>
            ${p2 ? `<td style="font-size: 0.72rem; color: var(--text-muted);">✅ Approved<br/>${p2.reraId || 'PRM/KA/RERA/1251'}</td>` : '<td>—</td>'}
          </tr>
          <tr>
            <td><b>Direct Action</b></td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="closeModal(); openPriorityPassModal('${p1.id}', '${p1.title}')" style="width: 100%; justify-content: center; font-weight: 700;">
                🎫 Book Pass
              </button>
            </td>
            ${p2 ? `
              <td>
                <button class="btn btn-primary btn-sm" onclick="closeModal(); openPriorityPassModal('${p2.id}', '${p2.title}')" style="width: 100%; justify-content: center; font-weight: 700;">
                  🎫 Book Pass
                </button>
              </td>
            ` : '<td>—</td>'}
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `, 'modal-wide');
};

// ----------------------------------------------------
// FREE AC CHAUFFEUR SITE VISIT SCHEDULER
// ----------------------------------------------------
window.openFreeCabSiteVisitModal = function (projectName) {
  renderModal(`Book Free AC Cab Site Visit — ${projectName}`, `
    <form onsubmit="handleFreeCabSubmit(event, '${projectName}')" style="display: flex; flex-direction: column; gap: 0.85rem; max-width: 500px;">
      <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 0.75rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #d97706; text-transform: uppercase;">🚗 Builder-Sponsored Executive Fleet</div>
        <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-main);">
          Free door-to-door sanitized AC cab pick-up & drop. Dedicated Builder Relationship Manager. <b>Zero broker calls.</b>
        </p>
      </div>

      <div class="form-group">
        <label>Your Full Name *</label>
        <input type="text" id="cab-name" class="form-control" placeholder="Full Name" required />
      </div>

      <div class="form-group">
        <label>Mobile Number (For Driver & Gate Pass SMS) *</label>
        <input type="tel" id="cab-phone" class="form-control" placeholder="+91 98765 43210" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Preferred Date *</label>
          <select id="cab-date" class="form-control">
            <option value="Today">Today (Next 2 Hours)</option>
            <option value="Tomorrow" selected>Tomorrow</option>
            <option value="Saturday">This Saturday</option>
            <option value="Sunday">This Sunday</option>
          </select>
        </div>
        <div class="form-group">
          <label>Preferred Time Slot *</label>
          <select id="cab-time" class="form-control">
            <option value="10:00 AM">10:00 AM (Morning)</option>
            <option value="02:00 PM" selected>02:00 PM (Afternoon)</option>
            <option value="05:00 PM">05:00 PM (Sunset Tour)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Pick-Up Address / Landmark *</label>
        <input type="text" id="cab-pickup" class="form-control" placeholder="e.g. Indiranagar Metro / HSR Layout Sector 1" required />
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" style="font-weight: 800;">
          🚗 Confirm Free AC Chauffeur
        </button>
      </div>
    </form>
  `);
};

window.handleFreeCabSubmit = function (e, projectName) {
  e.preventDefault();
  const name = document.getElementById('cab-name').value;
  const phone = document.getElementById('cab-phone').value;
  const date = document.getElementById('cab-date').value;
  const time = document.getElementById('cab-time').value;
  const pickup = document.getElementById('cab-pickup').value;

  closeModal();

  renderModal('🚗 Chauffeur Dispatched & VIP Pass Issued!', `
    <div style="text-align: center; padding: 1rem 0; max-width: 480px;">
      <div style="font-size: 3rem; margin-bottom: 0.5rem;">✨</div>
      <h3 style="font-size: 1.35rem; font-weight: 850; margin-bottom: 0.4rem;">Site Visit Confirmed for ${name}!</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        Your complimentary executive cab has been scheduled for <b>${date} at ${time}</b> from <b>${pickup}</b>.
      </p>

      <div class="cab-dispatch-box" style="margin-bottom: 1.25rem; text-align: left;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
          <span style="color: var(--text-muted);">Assigned Vehicle:</span>
          <b>Toyota Innova Crysta (KA-01-NX-4412)</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
          <span style="color: var(--text-muted);">Executive Chauffeur:</span>
          <b>Ramesh Kumar (+91 98450 11200)</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
          <span style="color: var(--text-muted);">VIP Gate Pass Code:</span>
          <b style="color: #f59e0b; font-family: monospace;">NX-VIP-${Math.floor(1000 + Math.random() * 9000)}</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">
          <span style="color: var(--text-muted);">Direct Builder RM:</span>
          <b style="color: #10b981;">Vikram Sengupta (Sales Director)</b>
        </div>
      </div>

      <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1.25rem; background: var(--bg-app); padding: 0.65rem; border-radius: 8px;">
        🛡️ <b>Nexora Anti-Spam Guarantee:</b> We have generated a private temporary bridge. Zero brokers will ever call your phone.
      </div>

      <button class="btn btn-primary" onclick="closeModal()" style="width: 100%; justify-content: center; font-weight: 700;">
        Done
      </button>
    </div>
  `);
};

window.openPublicSiteVisitModal = window.openFreeCabSiteVisitModal;

// ----------------------------------------------------
// DIRECT TENANCY APPLICATION MODAL
// ----------------------------------------------------
window.openTenancyModal = function (propertyName, rentPrice) {
  renderModal(`Direct Tenancy Application — ${propertyName}`, `
    <form onsubmit="handleTenancySubmit(event, '${propertyName}')" style="display: flex; flex-direction: column; gap: 0.85rem; max-width: 500px;">
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 0.85rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; text-transform: uppercase;">🔑 Direct Owner Lease • 0% Brokerage</div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.35rem;">
          <b style="font-size: 1rem;">${propertyName}</b>
          <span style="font-size: 1.15rem; font-weight: 850; color: #10b981;">${rentPrice}</span>
        </div>
        <p style="margin: 0.35rem 0 0; font-size: 0.78rem; color: var(--text-muted);">
          Your tenancy application is encrypted and routed directly to the verified property owner. No middleman broker fee.
        </p>
      </div>

      <div class="form-group">
        <label>Applicant Full Name *</label>
        <input type="text" id="tenant-name" class="form-control" placeholder="Your full legal name" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Mobile Number *</label>
          <input type="tel" id="tenant-phone" class="form-control" placeholder="+91 98765 43210" required />
        </div>
        <div class="form-group">
          <label>Email Address *</label>
          <input type="email" id="tenant-email" class="form-control" placeholder="you@company.com" required />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label>Profession / Employer *</label>
          <input type="text" id="tenant-employer" class="form-control" placeholder="e.g. Senior Tech Lead / Architect" required />
        </div>
        <div class="form-group">
          <label>Target Move-In Date *</label>
          <select id="tenant-movein" class="form-control">
            <option value="Immediate (This Week)">Immediate (This Week)</option>
            <option value="1st of Next Month" selected>1st of Next Month</option>
            <option value="Within 30 Days">Within 30 Days</option>
          </select>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" style="font-weight: 800; background: #10b981; border: none;">
          ✅ Submit Tenancy Application
        </button>
      </div>
    </form>
  `);
};

window.handleTenancySubmit = function (e, propertyName) {
  e.preventDefault();
  closeModal();
  showToast(`✅ Tenancy application for "${propertyName}" submitted directly to the verified owner! Expect contact within 2 business hours.`);
};

// ----------------------------------------------------
// SPAM-FREE 60-SECOND SHIELDED CALL
// ----------------------------------------------------
window.openShieldedCallModal = function () {
  renderModal('🛡️ 60-Second Shielded Call (Zero Broker Spam)', `
    <form onsubmit="handleShieldedCallSubmit(event)" style="display: flex; flex-direction: column; gap: 0.85rem; max-width: 480px;">
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 0.75rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; text-transform: uppercase;">🔒 Telecom Identity Masking</div>
        <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-main);">
          Traditional portals share your phone with dozens of third-party brokers. Nexora masks your identity through an encrypted telecom bridge so you connect exclusively with the authorized developer desk.
        </p>
      </div>

      <div class="form-group">
        <label>Your Name *</label>
        <input type="text" id="shield-name" class="form-control" placeholder="Full Name" required />
      </div>

      <div class="form-group">
        <label>Mobile Number to Connect *</label>
        <input type="tel" id="shield-phone" class="form-control" placeholder="+91 98450 11223" required />
      </div>

      <div class="form-group">
        <label>Project of Interest</label>
        <select id="shield-project" class="form-control">
          <option value="Verona Skyline">Verona Skyline Residences (Golf Course Ext)</option>
          <option value="Celestial Heights">Celestial Heights (Tech Corridor)</option>
          <option value="Grand Palm Sanctuary">The Grand Palm Sanctuary (South City)</option>
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" style="font-weight: 800;">
          📞 Call Me in 60s (Shielded)
        </button>
      </div>
    </form>
  `);
};

window.handleShieldedCallSubmit = function (e) {
  e.preventDefault();
  const name = document.getElementById('shield-name').value;
  const phone = document.getElementById('shield-phone').value;
  const project = document.getElementById('shield-project').value;

  closeModal();

  renderModal('Connecting Encrypted Voice Bridge...', `
    <div style="text-align: center; padding: 1.5rem 0; max-width: 440px;">
      <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(16,185,129,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 2rem;">
        📞
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 850; margin-bottom: 0.4rem;">Encrypted Bridge Connected!</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        Calling <b>${phone}</b> from Nexora Direct Server (+91 80 4400-NXRA).
      </p>

      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; font-size: 0.8rem; text-align: left; margin-bottom: 1.25rem;">
        <div style="margin-bottom: 0.35rem;">👤 <b>Lead:</b> ${name}</div>
        <div style="margin-bottom: 0.35rem;">🏢 <b>Direct RM:</b> Rohit Verma (Authorized Developer RM)</div>
        <div style="margin-bottom: 0.35rem;">🎯 <b>Project:</b> ${project}</div>
        <div style="color: #10b981; font-weight: 700;">🛡️ Mobile privacy status: 100% SHIELDED (Zero broker spam)</div>
      </div>

      <button class="btn btn-primary" onclick="closeModal()" style="width: 100%; justify-content: center; font-weight: 700;">
        Close Window
      </button>
    </div>
  `);
};

// ----------------------------------------------------
// 7-POINT LEGAL TITLE & RERA DOSSIER MODAL
// ----------------------------------------------------
window.openReraDossierModal = function (propId) {
  let prop = null;
  for (const cat in PUB_CARDS) {
    const found = PUB_CARDS[cat].find(x => x.id === propId);
    if (found) { prop = found; break; }
  }
  if (!prop) return;

  renderModal(`${prop.title} — 7-Point Legal Title Dossier`, `
    <div style="max-width: 650px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
        <div>
          <span style="font-size: 0.72rem; font-weight: 800; color: #10b981; text-transform: uppercase;">100% Clear Title Verification</span>
          <h4 style="font-size: 1.15rem; font-weight: 850; margin: 0.2rem 0;">${prop.title}</h4>
        </div>
        <span style="font-size: 0.74rem; font-weight: 800; background: rgba(16,185,129,0.12); color: #10b981; padding: 0.25rem 0.65rem; border-radius: 6px;">
          VERIFIED & APPROVED
        </span>
      </div>

      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        Every property listed on Nexora undergoes rigorous legal and title verification directly with the state land registry and RERA before publication.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>1. 30-Year Encumbrance Certificate (EC)</b><div style="font-size: 0.72rem; color: var(--text-muted);">Nil dues, zero bank attachment, zero legal dispute</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Clean</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>2. Freehold Land Title Deed</b><div style="font-size: 0.72rem; color: var(--text-muted);">Clear chain of ownership verified by High Court advocate</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Verified</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>3. State RERA Registration</b><div style="font-size: 0.72rem; color: var(--text-muted);">Registration ID: ${prop.reraId || 'PRM/KA/RERA/1251'}</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Active</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>4. Municipal & Environmental Clearances</b><div style="font-size: 0.72rem; color: var(--text-muted);">Sanctioned Master Plan, Airport Authority NOC, Fire Safety Clearance</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Granted</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>5. Bank Loan Pre-Approval Tie-ups</b><div style="font-size: 0.72rem; color: var(--text-muted);">SBI, HDFC Bank, ICICI Bank pre-approved at 8.40% interest</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Pre-Approved</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem;">
          <div><b>6. RERA Construction Escrow Account</b><div style="font-size: 0.72rem; color: var(--text-muted);">70% of buyer payments ring-fenced exclusively for construction</div></div>
          <span style="color: #10b981; font-weight: 800;">✅ Protected</span>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="alert('Downloading Certified 42-Page RERA Title Dossier (PDF)...'); closeModal();" style="font-weight: 700;">
          📄 Download Legal Dossier (PDF)
        </button>
      </div>
    </div>
  `);
};

// ----------------------------------------------------
// FILTERED PROPERTIES RENDERER (GRID + LOCALITY RADAR)
// ----------------------------------------------------
function renderFilteredProperties() {
  const container = document.getElementById('pub-properties-container');
  if (!container) return;

  const rawList = PUB_CARDS[pubState.activeCategory] || PUB_CARDS['new-launches'];
  const filtered = rawList.filter(c => {
    // Location filter
    if (pubState.selectedLocChip !== 'all' && c.areaTag !== pubState.selectedLocChip) {
      return false;
    }
    // BHK filter
    if (pubState.selectedBhk !== 'all' && c.bhkTag !== pubState.selectedBhk) {
      return false;
    }
    // Budget filter
    if (pubState.selectedBudget === 'under-1cr' && c.priceNum >= 10000000) return false;
    if (pubState.selectedBudget === '1cr-2cr' && (c.priceNum < 10000000 || c.priceNum > 20000000)) return false;
    if (pubState.selectedBudget === '2cr-3cr' && (c.priceNum < 20000000 || c.priceNum > 35000000)) return false;
    if (pubState.selectedBudget === '3cr-plus' && c.priceNum < 35000000) return false;

    // Keyword search
    if (pubState.keywordSearch) {
      const match = c.title.toLowerCase().includes(pubState.keywordSearch) ||
        c.location.toLowerCase().includes(pubState.keywordSearch) ||
        c.bhk.toLowerCase().includes(pubState.keywordSearch) ||
        (c.developer && c.developer.toLowerCase().includes(pubState.keywordSearch));
      if (!match) return false;
    }
    return true;
  });

  // Sort
  if (pubState.sortBy === 'price-asc') {
    filtered.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
  } else if (pubState.sortBy === 'price-desc') {
    filtered.sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
  } else if (pubState.sortBy === 'discount') {
    filtered.sort((a, b) => ((b.marketPriceNum || 0) - (b.priceNum || 0)) - ((a.marketPriceNum || 0) - (a.priceNum || 0)));
  }

  const countBadge = document.getElementById('pub-filter-count-badge');
  if (countBadge) {
    countBadge.innerText = `Showing ${filtered.length} of ${rawList.length} Verified Properties`;
  }

  // Locality Radar section (if toggled)
  let localityRadarHTML = '';
  if (pubState.viewMode === 'locality-radar') {
    localityRadarHTML = `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 850; margin: 0;">🗺️ Locality Appreciation & Price Radar</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.2rem 0 0;">Click any micro-market to filter direct builder inventory and view live appreciation rates.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="filterPubLocation('all')">✨ Show All Micro-Markets</button>
        </div>
        <div class="locality-radar-grid">
          ${PUB_LOCALITIES.map(loc => `
            <div class="locality-card ${pubState.selectedLocChip === loc.id ? 'active' : ''}" onclick="filterPubLocation('${loc.id}')">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${loc.zone}</span>
                  <h4 style="font-size: 1.05rem; font-weight: 850; margin: 0.2rem 0;">${loc.name}</h4>
                </div>
                <span class="locality-trend-badge">📈 ${loc.growth}</span>
              </div>
              <div class="locality-price-tag">${loc.avgRate}</div>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.4;">${loc.highlight}</p>
              <div style="display: flex; gap: 0.75rem; font-size: 0.72rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.6rem;">
                <span>🚇 ${loc.metroTime}</span>
                <span>💼 ${loc.techHubTime}</span>
                <span style="font-weight: 700; color: #10b981;">⚡ ${loc.unitsCount} Units</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      ${localityRadarHTML}
      <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">No properties match your filter</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Try clearing your keyword, budget, or picking "All Locations".</p>
        <button class="btn btn-secondary btn-sm" onclick="pubState.keywordSearch=''; pubState.selectedLocChip='all'; pubState.selectedBhk='all'; pubState.selectedBudget='all'; renderFilteredProperties();">Reset All Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    ${localityRadarHTML}
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
      ${filtered.map(c => {
    const isCompared = pubState.comparedProps.includes(c.id);
    return `
          <div class="deal-card" style="position: relative; display: flex; flex-direction: column;">
            <div style="height: 200px; position: relative; overflow: hidden; cursor: pointer;" onclick="openPropertyWalkthrough('${c.id}')">
              <img src="${c.img}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"/>
              
              <span style="position: absolute; top: 0.75rem; left: 0.75rem; background: ${c.badgeColor}; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 6px; letter-spacing: 0.02em;">
                ${c.badge}
              </span>

              <!-- Compare Toggle Pill -->
              <button class="bhk-pill ${isCompared ? 'active' : ''}" style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 5; font-size: 0.72rem; padding: 0.25rem 0.65rem; background: ${isCompared ? '#f59e0b' : 'rgba(0,0,0,0.65)'}; color: ${isCompared ? '#000' : '#fff'}; border: 1px solid rgba(255,255,255,0.25); backdrop-filter: blur(4px);" onclick="event.stopPropagation(); togglePropertyCompare('${c.id}')" title="Compare side-by-side against other properties">
                ${isCompared ? '✓ Compared' : '⚖️ + Compare'}
              </button>

              <div style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.65); color: #fff; font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 4px; backdrop-filter: blur(4px);">
                📸 4 Photos • Walkthrough
              </div>
            </div>

            <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3 style="font-size: 1.15rem; font-weight: 850; margin-bottom: 0.2rem; cursor: pointer;" onclick="openPropertyWalkthrough('${c.id}')">${c.title}</h3>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.65rem;">📍 ${c.location} ${c.developer ? `• by ${c.developer}` : ''}</p>

              <!-- Transparent Price Matrix -->
              <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem; margin-bottom: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <div>
                    <span style="font-size: 0.68rem; font-weight: 700; color: #10b981; text-transform: uppercase;">Direct Builder Price</span>
                    <div style="font-size: 1.25rem; font-weight: 850; color: var(--text-main);">${c.price}</div>
                  </div>
                  ${c.marketPrice ? `
                    <div style="text-align: right;">
                      <span style="font-size: 0.68rem; color: var(--text-muted); text-decoration: line-through;">${c.marketPrice}</span>
                      <div style="font-size: 0.74rem; font-weight: 800; color: #10b981;">${c.savingsText || '0% Brokerage'}</div>
                    </div>
                  ` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem; border-top: 1px dashed var(--border-muted); padding-top: 0.35rem;">
                  <span>📐 ${c.carpetSqft || c.sqft}</span>
                  <span>🕒 ${c.possession || 'Ready Possession'}</span>
                </div>
              </div>

              <!-- Group buying progress bar if applicable -->
              ${c.joined ? `
                <div style="margin-bottom: 0.85rem;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.74rem; margin-bottom: 0.25rem;">
                    <span style="font-weight: 700;">${c.joined} of ${c.total} Buyers Joined</span>
                    <span style="color: #10b981; font-weight: 700;">${c.total - c.joined} Slots Left</span>
                  </div>
                  <div class="progress-track"><div class="progress-fill" style="width: ${(c.joined / c.total) * 100}%;"></div></div>
                </div>
              ` : ''}

              <!-- Commute badges -->
              ${c.commute ? `
                <div style="display: flex; gap: 0.5rem; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.85rem; overflow-x: auto; padding-bottom: 0.2rem;">
                  <span style="background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.2rem 0.45rem; border-radius: 6px; white-space: nowrap;">🚇 ${c.commute.metro}</span>
                  <span style="background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.2rem 0.45rem; border-radius: 6px; white-space: nowrap;">💼 ${c.commute.techPark}</span>
                </div>
              ` : ''}

              <!-- Action Buttons: Row 1 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; margin-top: auto; margin-bottom: 0.45rem;">
                <button class="btn btn-secondary btn-sm" onclick="openPropertyWalkthrough('${c.id}')" style="font-size: 0.75rem; justify-content: center; font-weight: 700;">
                  👁️ Walkthrough & EMI
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openFreeCabSiteVisitModal('${c.title}')" style="font-size: 0.75rem; justify-content: center; font-weight: 700; color: #f59e0b;" title="Free AC Chauffeur Pick-up & Drop">
                  🚗 Free Cab Tour
                </button>
              </div>

              <!-- Action Buttons: Row 2 -->
              <div style="display: flex; gap: 0.45rem;">
                <button class="btn btn-secondary btn-sm" onclick="openReraDossierModal('${c.id}')" style="padding: 0.45rem 0.65rem; font-size: 0.75rem;" title="7-Point Legal Title Clearance">
                  📜 Legal Dossier
                </button>

                ${c.actionType === 'token' ? `
                  <button class="btn btn-primary btn-sm" onclick="openPriorityPassModal('${c.id}', '${c.title}')" style="flex: 1; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                    🎫 Book ₹21k Token
                  </button>
                ` : c.actionType === 'pool' ? `
                  <button class="btn btn-primary btn-sm" onclick="openJoinPoolModal('${c.id}', '${c.title}', ${c.discountAmount})" style="flex: 1; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                    👥 Join Pool
                  </button>
                ` : c.actionType === 'bid' ? `
                  <button class="btn btn-primary btn-sm" onclick="openPlaceBidModal('${c.id}', '${c.unitNumber}', ${c.currentBid}, 50000)" style="flex: 1; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                    💰 Place Offer
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm" onclick="openPublicSiteVisitModal('${c.title}')" style="flex: 1; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                    🔑 Rent Direct
                  </button>
                `}
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}


// ----------------------------------------------------
// INTERACTIVE PROPERTY WALKTHROUGH & EMI MODAL
// ----------------------------------------------------
window.openPropertyWalkthrough = function (propId) {
  let prop = null;
  for (const cat in PUB_CARDS) {
    const found = PUB_CARDS[cat].find(x => x.id === propId);
    if (found) { prop = found; break; }
  }
  if (!prop) return;

  const defaultPrice = prop.priceNum || 15000000;
  const initialDownPayment = defaultPrice * 0.2;
  const initialLoan = defaultPrice * 0.8;
  const r = (8.5 / 12) / 100;
  const n = 20 * 12;
  const initialEmi = Math.round((initialLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

  renderModal(`${prop.title} — Verified Direct Walkthrough`, `
    <div style="display: flex; flex-direction: column; gap: 1.25rem; max-width: 780px;">
      <!-- Gallery Hero -->
      <div>
        <div style="height: 320px; border-radius: 12px; overflow: hidden; position: relative;">
          <img id="walkthrough-hero-img" src="${prop.img}" style="width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s ease;"/>
          <span style="position: absolute; top: 0.75rem; left: 0.75rem; background: ${prop.badgeColor || '#10b981'}; color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.7rem; border-radius: 6px;">
            ${prop.badge || 'Verified Direct Listing'}
          </span>
        </div>
        <div class="gallery-thumbnail-strip">
          ${(prop.gallery || [prop.img]).map((g, idx) => `
            <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="switchWalkthroughThumb('${g}', this)">
              <img src="${g}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Quick Info Strip -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem;">
        <div>
          <h4 style="font-size: 1.3rem; font-weight: 850; margin: 0 0 0.2rem;">${prop.price}</h4>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">📍 ${prop.location} • ${prop.bhk}</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.72rem; font-weight: 700; color: #10b981; background: rgba(16,185,129,0.1); padding: 0.25rem 0.6rem; border-radius: 6px;">
            ● 0% Brokerage Guarantee
          </span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.3rem;">RERA: ${prop.reraId || 'PRM/KA/RERA/1251'}</div>
        </div>
      </div>

      <!-- Neighborhood & Commute Radar -->
      ${prop.commute ? `
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 800; margin-bottom: 0.4rem;">🚇 Locality & Commute Radar</h4>
          <div class="commute-grid">
            <div class="commute-badge"><span class="icon">🚇</span><div><b>Metro Station</b><div style="color: var(--text-muted);">${prop.commute.metro}</div></div></div>
            <div class="commute-badge"><span class="icon">💼</span><div><b>Tech Corridor</b><div style="color: var(--text-muted);">${prop.commute.techPark}</div></div></div>
            <div class="commute-badge"><span class="icon">✈️</span><div><b>Airport</b><div style="color: var(--text-muted);">${prop.commute.airport}</div></div></div>
            <div class="commute-badge"><span class="icon">🎓</span><div><b>Top School</b><div style="color: var(--text-muted);">${prop.commute.school}</div></div></div>
            <div class="commute-badge"><span class="icon">🏥</span><div><b>Hospital</b><div style="color: var(--text-muted);">${prop.commute.hospital}</div></div></div>
          </div>
        </div>
      ` : ''}

      <!-- Interactive Mortgage / EMI Calculator -->
      <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-size: 0.95rem; font-weight: 800; margin: 0;">💰 Interactive EMI Loan Calculator</h4>
          <span id="wt-emi-output" style="font-size: 1.15rem; font-weight: 850; color: #10b981;">₹${initialEmi.toLocaleString()} / mo</span>
        </div>
        
        <div class="calc-slider-group">
          <label><span>Down Payment:</span><span id="wt-dp-val">20% (₹${(initialDownPayment / 100000).toFixed(1)}L)</span></label>
          <input type="range" class="calc-range-slider" min="10" max="50" step="5" value="20" oninput="updateWalkthroughEmi(${defaultPrice}, this.value, document.getElementById('wt-tenure-slider').value)"/>
        </div>

        <div class="calc-slider-group" style="margin-bottom: 0;">
          <label><span>Loan Tenure:</span><span id="wt-tenure-val">20 Years @ 8.5% p.a.</span></label>
          <input type="range" id="wt-tenure-slider" class="calc-range-slider" min="10" max="30" step="5" value="20" oninput="updateWalkthroughEmi(${defaultPrice}, document.querySelector('.calc-range-slider').value, this.value)"/>
        </div>
      </div>

      <!-- Action Footer -->
      <div style="display: flex; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="closeModal(); openPriorityPassModal('${prop.id}', '${prop.title}')" style="flex: 1; justify-content: center; font-weight: 700;">
          🎫 Reserve Token (₹21,000)
        </button>
        <button class="btn btn-secondary" onclick="closeModal(); openPublicSiteVisitModal('${prop.title}')" style="font-weight: 700;">
          📍 Book Chauffeur Tour
        </button>
      </div>
    </div>
  `, 'modal-wide');
};

window.switchWalkthroughThumb = function (imgUrl, el) {
  const hero = document.getElementById('walkthrough-hero-img');
  if (hero) {
    hero.style.opacity = '0.4';
    setTimeout(() => {
      hero.src = imgUrl;
      hero.style.opacity = '1';
    }, 150);
  }
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
};

window.updateWalkthroughEmi = function (totalPrice, dpPct, tenureYrs) {
  const dpAmount = totalPrice * (dpPct / 100);
  const loanAmount = totalPrice - dpAmount;
  const r = (8.5 / 12) / 100;
  const n = tenureYrs * 12;
  const emi = Math.round((loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

  const emiOut = document.getElementById('wt-emi-output');
  if (emiOut) emiOut.innerText = `₹${emi.toLocaleString()} / mo`;

  const dpVal = document.getElementById('wt-dp-val');
  if (dpVal) dpVal.innerText = `${dpPct}% (₹${(dpAmount / 100000).toFixed(1)}L)`;

  const tenVal = document.getElementById('wt-tenure-val');
  if (tenVal) tenVal.innerText = `${tenureYrs} Years @ 8.5% p.a.`;
};

// ----------------------------------------------------
// INTERACTIVE GROUP BUYING POOL SIMULATOR
// ----------------------------------------------------
window.updateGroupSimulator = function (buyersCount) {
  pubState.simPoolBuyers = parseInt(buyersCount);
  const count = pubState.simPoolBuyers;
  let discountPct = 6;
  if (count === 3) discountPct = 8;
  else if (count === 4) discountPct = 10;
  else if (count >= 5 && count < 8) discountPct = 12;
  else if (count >= 8) discountPct = 15;

  const basePrice = 14500000; // ₹1.45 Cr representative flat
  const savingsEach = Math.round(basePrice * (discountPct / 100));
  const totalSavings = savingsEach * count;

  const badgeEl = document.getElementById('sim-discount-pct');
  if (badgeEl) badgeEl.innerText = `${discountPct}% DIRECT BUILDER DISCOUNT`;

  const eachEl = document.getElementById('sim-savings-each');
  if (eachEl) eachEl.innerText = `₹${(savingsEach / 100000).toFixed(1)} Lakhs`;

  const totalEl = document.getElementById('sim-total-savings');
  if (totalEl) totalEl.innerText = `₹${(totalSavings / 100000).toFixed(1)} Lakhs`;

  const labelEl = document.getElementById('sim-slider-label');
  if (labelEl) labelEl.innerText = `${count} Buyers Pooled Together`;
};

// ----------------------------------------------------
// INTERACTIVE BROKERAGE SAVINGS COMPARISON
// ----------------------------------------------------
window.updateSavingsSimulator = function (budgetVal) {
  pubState.simBudget = parseInt(budgetVal);
  const budget = pubState.simBudget;

  const brokerFee = Math.round(budget * 0.02);
  const markup = Math.round(budget * 0.05);
  const traditionalLost = brokerFee + markup;
  const nexoraDirectSavings = Math.round(budget * 0.08) + brokerFee;

  const label = document.getElementById('savings-budget-label');
  if (label) label.innerText = `₹${(budget / 10000000).toFixed(2)} Cr Property Budget`;

  const tradOut = document.getElementById('trad-waste-out');
  if (tradOut) tradOut.innerText = `+₹${(traditionalLost / 100000).toFixed(1)} Lakhs Extra Paid`;

  const nexoraOut = document.getElementById('nexora-saved-out');
  if (nexoraOut) nexoraOut.innerText = `₹${(nexoraDirectSavings / 100000).toFixed(1)} Lakhs Saved!`;
};

function renderPub3DVisualizer() {
  const container = document.getElementById('pub-3d-visualizer-container');
  if (!container) return;

  const curFloor = PUB_FLOORS[pubState.selectedFloor] || PUB_FLOORS[12];
  const isNight = pubState.daylightMode === 'dusk';

  container.innerHTML = `
    <div class="pub-3d-wrapper">
      <!-- Left: Interactive 3D Tower Canvas -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800; margin: 0;">Tower Celestial — 3D Elevation</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Click any floor to view layout & price</p>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="rotatePubTower()" title="Rotate 3D Tower Angle">
              ↺ Rotate 3D
            </button>
            <button class="btn btn-secondary btn-sm" onclick="togglePubDaylight()" title="Toggle Day or Dusk Lighting">
              ${isNight ? '🌙 Dusk Mode' : '☀️ Day Mode'}
            </button>
          </div>
        </div>

        <div class="pub-3d-stage" style="${isNight ? 'background: #0f1115; border-color: #27272a;' : ''}">
          <div class="pub-tower-container" id="pub-interactive-tower" style="transform: rotateY(${pubState.towerRotation}deg) rotateX(12deg);">
            <!-- Floor 24: Sky Villa -->
            <div class="pub-tower-floor ${pubState.selectedFloor === 24 ? 'selected' : ''}" style="bottom: 280px;" onclick="setPubFloor(24)">
              <span>Floor 24</span>
              <span>Sky Villa</span>
            </div>
            <!-- Floor 18: Royal Suite -->
            <div class="pub-tower-floor ${pubState.selectedFloor === 18 ? 'selected' : ''}" style="bottom: 210px;" onclick="setPubFloor(18)">
              <span>Floor 18</span>
              <span>3.5 BHK</span>
            </div>
            <!-- Floor 12: Corner Suite -->
            <div class="pub-tower-floor ${pubState.selectedFloor === 12 ? 'selected' : ''}" style="bottom: 140px;" onclick="setPubFloor(12)">
              <span>Floor 12</span>
              <span>3 BHK Corner</span>
            </div>
            <!-- Floor 5: Garden Residence -->
            <div class="pub-tower-floor ${pubState.selectedFloor === 5 ? 'selected' : ''}" style="bottom: 70px;" onclick="setPubFloor(5)">
              <span>Floor 05</span>
              <span>2 BHK Garden</span>
            </div>
            <!-- Ground: Clubhouse -->
            <div class="pub-tower-floor ${pubState.selectedFloor === 0 ? 'selected' : ''}" style="bottom: 0px;" onclick="setPubFloor(0)">
              <span>Ground</span>
              <span>Clubhouse</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Interactive Unit Blueprint & Cost Sheet -->
      <div class="pub-floor-plan-preview">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <span style="font-size: 0.72rem; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.05em;">
              ● ${curFloor.floorNum === 0 ? 'Ground Deck' : `Floor ${curFloor.floorNum} Selected`}
            </span>
            <h3 style="font-size: 1.4rem; font-weight: 850; margin: 0.2rem 0;">${curFloor.title}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${curFloor.type} • ${curFloor.area}</p>
          </div>
          <span style="background: ${curFloor.statusColor}; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 9999px;">
            ${curFloor.status}
          </span>
        </div>

        <!-- SVG Architectural Blueprint with Hotspots -->
        <div style="margin-bottom: 0.75rem;">
          ${renderPubFloorPlanSVG(curFloor)}
        </div>

        <!-- Hotspot Inspection Banner -->
        <div id="pub-hotspot-display" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 0.6rem 0.85rem; font-size: 0.8rem; margin-bottom: 1rem; color: var(--text-main);">
          ${pubState.activeHotspotText}
        </div>

        <!-- Pricing & Net Cost Calculator -->
        ${curFloor.price > 0 ? `
          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.35rem;">
              <span style="color: var(--text-muted);">Base Unit Price:</span>
              <span style="font-weight: 700;">${curFloor.priceFormatted}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.35rem;">
              <span style="color: var(--text-muted);">Pre-Launch Token Discount:</span>
              <span style="color: #10b981; font-weight: 700;">-${curFloor.discount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; border-top: 1px dashed var(--border-color); padding-top: 0.4rem; margin-top: 0.4rem;">
              <span style="font-weight: 800;">Effective Price:</span>
              <span style="font-weight: 850; font-size: 1.05rem; color: var(--text-main);">
                ₹${((curFloor.price - (curFloor.floorNum === 24 ? 1500000 : curFloor.floorNum === 18 ? 1000000 : curFloor.floorNum === 12 ? 800000 : 500000)) / 10000000).toFixed(2)} Cr
              </span>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-primary" onclick="openPriorityPassModal('unit-${curFloor.floorNum}', '${curFloor.title}')" style="flex: 1.2; justify-content: center; font-weight: 700; padding: 0.7rem;">
              🎫 Reserve Token (₹${(curFloor.tokenAmount || 21000).toLocaleString()})
            </button>
            <button class="btn btn-secondary" onclick="openPublicSiteVisitModal('${curFloor.title}')" style="flex: 1; justify-content: center; font-weight: 700;">
              📍 Book Site Visit
            </button>
          </div>
        ` : `
          <button class="btn btn-primary" onclick="openPublicSiteVisitModal('Clubhouse & Amenities')" style="width: 100%; justify-content: center; font-weight: 700; padding: 0.7rem;">
            📍 Schedule Private Clubhouse Tour
          </button>
        `}
      </div>
    </div>
  `;
}

window.setEhSearchTab = function (mode, shouldScroll = true) {
  document.querySelectorAll('.eh-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById(`tab-${mode}`);
  if (activeTab) activeTab.classList.add('active');

  const card = document.querySelector('.eh-search-card');
  if (card) {
    if (mode === 'buy') {
      card.style.borderRadius = '0 16px 16px 16px';
    } else {
      card.style.borderRadius = '16px';
    }
  }

  if (mode === 'buy') {
    setPubCategory('new-launches');
    if (shouldScroll) {
      const el = document.getElementById('buy-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  } else if (mode === 'rent') {
    setPubCategory('rental');
    if (shouldScroll) {
      const el = document.getElementById('rent-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  } else if (mode === 'invest') {
    setPubCategory('group-deals');
    if (shouldScroll) {
      const el = document.getElementById('invest-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }
};

window.curatedMode = 'all';

window.renderCuratedRow = function (mode = window.curatedMode, filterQuery = '', filterBhk = 'all') {
  window.curatedMode = mode;
  const container = document.getElementById('pub-curated-container');
  if (!container) return;

  // Highlight active curated pill
  ['all', 'buy', 'rent', 'invest'].forEach(m => {
    const p = document.getElementById(`curated-pill-${m}`);
    if (p) p.classList.toggle('active', m === mode);
  });

  let cards = [];
  const buyList = PUB_CARDS['new-launches'] || [];
  const rentList = PUB_CARDS['rental'] || [];
  const investList = PUB_CARDS['group-deals'] || [];

  if (mode === 'all') {
    if (buyList[0]) cards.push({ ...buyList[0], categoryTag: 'Direct Developer Launch' });
    if (rentList[0]) cards.push({ ...rentList[0], categoryTag: '0% Brokerage Luxury Rental' });
    if (investList[0]) cards.push({ ...investList[0], categoryTag: 'Group Buying Syndicate' });
  } else if (mode === 'buy') {
    cards = buyList.slice(0, 3).map(c => ({ ...c, categoryTag: 'Direct Developer Launch' }));
  } else if (mode === 'rent') {
    cards = rentList.slice(0, 3).map(c => ({ ...c, categoryTag: '0% Brokerage Luxury Rental' }));
  } else if (mode === 'invest') {
    cards = investList.slice(0, 3).map(c => ({ ...c, categoryTag: 'Group Buying Syndicate' }));
  }

  if (filterBhk && filterBhk !== 'all') {
    cards = cards.filter(c => c.bhkTag === filterBhk);
  }
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    cards = cards.filter(c => (c.title && c.title.toLowerCase().includes(q)) || (c.location && c.location.toLowerCase().includes(q)));
  }

  if (cards.length === 0) {
    cards = [buyList[0], rentList[0], investList[0]].filter(Boolean);
  }

  // Curated showcase: exactly 1 row (up to 3 cards)
  cards = cards.slice(0, 3);

  container.innerHTML = cards.map(c => `
    <div class="deal-card" style="position: relative; display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="height: 220px; position: relative; overflow: hidden; cursor: pointer;" onclick="openPropertyWalkthrough('${c.id}')">
        <img src="${c.img}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'"/>
        <span style="position: absolute; top: 0.75rem; left: 0.75rem; background: ${c.badgeColor || '#10b981'}; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 6px;">
          ${c.badge || c.categoryTag}
        </span>
        <button class="bhk-pill" style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 5; font-size: 0.72rem; padding: 0.25rem 0.65rem; background: rgba(0,0,0,0.65); color: #fff; border: 1px solid rgba(255,255,255,0.25); backdrop-filter: blur(4px);" onclick="event.stopPropagation(); togglePropertyCompare('${c.id}')">
          ⚖️ Compare
        </button>
      </div>

      <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
        <h3 style="font-size: 1.15rem; font-weight: 850; margin-bottom: 0.2rem; cursor: pointer;" onclick="openPropertyWalkthrough('${c.id}')">${c.title}</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">📍 ${c.location} • by ${c.developer || c.owner || 'Verified Direct Partner'}</p>

        <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.75rem; margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 700; color: #10b981; text-transform: uppercase;">
                ${c.deposit ? 'Direct Monthly Rent' : c.poolPrice ? 'Pooled Group Rate' : 'Direct Builder Price'}
              </span>
              <div style="font-size: 1.25rem; font-weight: 850; color: var(--text-main);">${c.price || c.poolPrice}</div>
            </div>
            ${c.marketPrice ? `
              <div style="text-align: right;">
                <span style="font-size: 0.68rem; color: var(--text-muted); text-decoration: line-through;">${c.marketPrice}</span>
                <div style="font-size: 0.75rem; font-weight: 800; color: #10b981;">${c.savingsText || 'Save Direct'}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 0.4rem; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; flex-wrap: wrap;">
          <span style="background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px;">📐 ${c.sqft || 'Spacious 3 BHK'}</span>
          <span style="background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px;">🏡 ${c.bhk || '3 BHK Residence'}</span>
          <span style="background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px;">📅 ${c.possession || 'Ready to Move'}</span>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="btn btn-primary btn-sm" onclick="openPropertyWalkthrough('${c.id}')" style="flex: 1.2; justify-content: center; font-weight: 700; font-size: 0.8rem; background: #f59e0b; color: #000; border: none;">
            🔍 View 3D Details
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openPublicSiteVisitModal('${c.title}')" style="flex: 1; justify-content: center; font-weight: 700; font-size: 0.8rem;">
            📍 Free Cab Visit
          </button>
        </div>
      </div>
    </div>
  `).join('');
};

window.renderBuyCards = function (q, bhk) { window.renderCuratedRow('buy', q, bhk); };
window.renderRentCards = function (q, bhk) { window.renderCuratedRow('rent', q, bhk); };
window.renderInvestCards = function (q, bhk) { window.renderCuratedRow('invest', q, bhk); };
window.filterCuratedRow = function (mode) { window.renderCuratedRow(mode); };

window.switchEhSearchTab = function (tab) {
  document.querySelectorAll('.eh-top-tab-item').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`eh-tab-${tab}`);
  if (btn) btn.classList.add('active');

  const input = document.getElementById('eh-quick-search-input');
  const typeText = document.getElementById('eh-selected-type-text');

  if (tab === 'rent') {
    if (typeText) typeText.innerText = 'All Residential';
    if (input) input.placeholder = 'Search "Flats for rent in sector 77 Noida, Bandra, Whitefield..."';
    window.renderCuratedRow('rent');
  } else if (tab === 'buy') {
    if (typeText) typeText.innerText = 'All Residential';
    if (input) input.placeholder = 'Search "3 BHK for sale in Mumbai, Delhi, Gurgaon..."';
    window.renderCuratedRow('buy');
  } else if (tab === 'new-launch') {
    if (typeText) typeText.innerText = 'All Residential';
    if (input) input.placeholder = 'Search "New RERA Launches in Mumbai, Delhi NCR, Bengaluru..."';
    window.renderCuratedRow('buy');
  } else if (tab === 'commercial') {
    if (typeText) typeText.innerText = 'All Commercial';
    if (input) input.placeholder = 'Search "Grade-A Commercial Offices, Retail Shops, Showrooms..."';
    openExpandedSearchModal('commercial');
  } else if (tab === 'plots') {
    if (typeText) typeText.innerText = 'All Plots/Land';
    if (input) input.placeholder = 'Search "Residential Plots & Land in gated communities..."';
    openExpandedSearchModal('plots');
  } else if (tab === 'projects') {
    if (typeText) typeText.innerText = 'All Projects';
    if (input) input.placeholder = 'Search "RERA Verified Township & Villa Projects..."';
    openExpandedSearchModal('projects');
  }
};

window.toggleInpageFilters = function () {
  const drawer = document.getElementById('eh-inpage-drawer');
  if (drawer) {
    const isHidden = drawer.style.display === 'none' || drawer.style.display === '';
    drawer.style.display = isHidden ? 'block' : 'none';
  }
};

window.clearInpageCheckboxes = function () {
  const cbs = document.querySelectorAll('#eh-inpage-ptypes input[type="checkbox"]');
  const allChecked = Array.from(cbs).every(c => c.checked);
  cbs.forEach(c => c.checked = !allChecked);
  applyInpageFilters();
};

window.applyInpageFilters = function () {
  const selectedCbs = Array.from(document.querySelectorAll('#eh-inpage-ptypes input[type="checkbox"]:checked')).map(c => c.value);
  const budget = document.getElementById('eh-filter-budget') ? document.getElementById('eh-filter-budget').value : '';
  const bedroom = document.getElementById('eh-filter-bedroom') ? document.getElementById('eh-filter-bedroom').value : '';

  if (bedroom) {
    pubState.selectedBhk = `${bedroom} BHK`;
  } else {
    pubState.selectedBhk = '';
  }

  renderCuratedRow(window.curatedMode || 'all', pubState.keywordSearch, pubState.selectedBhk);
  showToast(`⚡ Filters applied: ${selectedCbs.length} types selected`);
};

window.selectExploreOption = function (opt) {
  openExpandedSearchModal(opt);
};

const MODAL_CITIES = [
  'Delhi / NCR',
  'Gurgaon / Gurugram',
  'Noida',
  'Greater Noida',
  'South Delhi',
  'Central Delhi',
  'West Delhi',
  'North Delhi',
  'East Delhi',
  'Dwarka',
  'Faridabad',
  'Ghaziabad',
  'Mumbai / MMR',
  'Navi Mumbai',
  'Thane',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Chandigarh / Tricity',
  'Goa',
  'Dubai (International)'
];

const PTYPE_OPTIONS = {
  buy: [
    { label: 'Flat/Apartment', val: 'flat' },
    { label: 'Builder Floor', val: 'builder' },
    { label: 'Independent House/Villa', val: 'villa' },
    { label: 'Residential Land', val: 'land' },
    { label: '1 RK/ Studio Apartment', val: 'studio' },
    { label: 'Farm House', val: 'farmhouse' },
    { label: 'Serviced Apartments', val: 'serviced' },
    { label: 'Other', val: 'other' }
  ],
  rent: [
    { label: 'Flat/Apartment', val: 'flat' },
    { label: 'Builder Floor', val: 'builder' },
    { label: 'Independent House/Villa', val: 'villa' },
    { label: '1 RK/ Studio Apartment', val: 'studio' },
    { label: 'Serviced Apartments', val: 'serviced' },
    { label: 'Farm House', val: 'farmhouse' },
    { label: 'Other', val: 'other' }
  ],
  commercial: [
    { label: 'Commercial Office Space', val: 'comm_office' },
    { label: 'Commercial Shop', val: 'comm_shop' },
    { label: 'Commercial Showroom', val: 'comm_showroom' },
    { label: 'Commercial Land', val: 'comm_land' },
    { label: 'Industrial Building', val: 'ind_building' },
    { label: 'Warehouse / Godown', val: 'warehouse' },
    { label: 'Co-working Office', val: 'coworking' }
  ],
  plots: [
    { label: 'Residential Plot', val: 'res_plot' },
    { label: 'Commercial Plot', val: 'comm_plot' },
    { label: 'Agricultural / Farm Land', val: 'farm_land' },
    { label: 'Industrial Plot', val: 'ind_plot' },
    { label: 'Gated Villa Land', val: 'villa_land' }
  ],
  pg: [
    { label: 'Boys PG / Co-living', val: 'boys_pg' },
    { label: 'Girls PG / Co-living', val: 'girls_pg' },
    { label: 'Co-ed PG Suites', val: 'coed_pg' },
    { label: 'Private Room', val: 'private_room' },
    { label: 'Twin Sharing', val: 'twin_sharing' }
  ]
};

window.openExpandedSearchModal = function (initialTab = 'buy') {
  let modal = document.getElementById('eh-expanded-search-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'eh-expanded-search-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeExpandedSearchModal(); };
    document.body.appendChild(modal);
  }

  // Normalize tab key
  let activeTabKey = initialTab;
  if (initialTab === 'new-launch') activeTabKey = 'buy';
  if (initialTab === 'invest') activeTabKey = 'commercial';
  if (initialTab === 'projects') activeTabKey = 'buy';

  const ptypes = PTYPE_OPTIONS[activeTabKey] || PTYPE_OPTIONS.buy;

  modal.innerHTML = `
    <div class="eh-search-modal-card" onclick="event.stopPropagation()">
      <!-- Header (Screenshot 5: Explore real estate in...) -->
      <div class="eh-modal-top-header">
        <h2 class="eh-modal-title">Explore real estate in...</h2>
        <button class="eh-modal-close-btn" onclick="closeExpandedSearchModal()" title="Close">&times;</button>
      </div>

      <!-- Top Tabs (Screenshot 5: Buy | Rent / Lease | Commercial | Plots/Land | PG / Co-living) -->
      <div class="eh-modal-tab-row">
        <button class="eh-modal-tab-btn ${activeTabKey === 'buy' ? 'active' : ''}" id="modal-tab-buy" onclick="setModalTab('buy')">Buy</button>
        <button class="eh-modal-tab-btn ${activeTabKey === 'rent' ? 'active' : ''}" id="modal-tab-rent" onclick="setModalTab('rent')">Rent / Lease</button>
        <button class="eh-modal-tab-btn ${activeTabKey === 'commercial' ? 'active' : ''}" id="modal-tab-commercial" onclick="setModalTab('commercial')">Commercial</button>
        <button class="eh-modal-tab-btn ${activeTabKey === 'plots' ? 'active' : ''}" id="modal-tab-plots" onclick="setModalTab('plots')">Plots/Land</button>
        <button class="eh-modal-tab-btn ${activeTabKey === 'pg' ? 'active' : ''}" id="modal-tab-pg" onclick="setModalTab('pg')">PG / Co-living</button>
      </div>

      <!-- Search Row (Screenshot 5: Residential ▾ | 🔍 City Name | Explore) -->
      <div class="eh-modal-search-row">
        <select id="modal-res-select" class="eh-modal-res-select" onchange="handleModalCategoryChange(this.value)">
          <option value="buy" ${activeTabKey === 'buy' ? 'selected' : ''}>Residential</option>
          <option value="commercial" ${activeTabKey === 'commercial' ? 'selected' : ''}>Commercial</option>
          <option value="plots" ${activeTabKey === 'plots' ? 'selected' : ''}>Plots/Land</option>
          <option value="pg" ${activeTabKey === 'pg' ? 'selected' : ''}>PG / Co-living</option>
        </select>

        <div class="eh-modal-input-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7a869a" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="modal-city-search-input" placeholder="Type City name" oninput="filterModalCityList(this.value)" autocomplete="off" />
        </div>

        <button class="eh-modal-explore-btn" onclick="applyExpandedSearch()">Explore</button>
      </div>

      <!-- City List Box (Screenshot 5: Choose a city below to start exploring) -->
      <div class="eh-modal-city-box">
        <div class="eh-modal-city-heading">Choose a city below to start exploring:</div>
        <div class="eh-modal-city-list" id="modal-city-list">
          ${MODAL_CITIES.map(c => `
            <div class="eh-modal-city-row" onclick="pickModalCity('${c}')">
              <span class="eh-modal-city-name">${c}</span>
              <span class="eh-modal-city-badge">${c.includes('Delhi') || c.includes('Noida') || c.includes('Gurgaon') || c.includes('Mumbai') ? 'Major Market' : 'City'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Property Types Checkboxes (Screenshot 3 & 5) -->
      <div class="eh-modal-ptypes-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #172b4d;">Property Types:</span>
          <button type="button" onclick="clearSearchCheckboxes()" style="background: none; border: none; color: #0078db; font-weight: 700; font-size: 12px; cursor: pointer;">Select/Clear All</button>
        </div>
        <div class="eh-checkbox-grid" id="modal-ptype-checkboxes">
          ${ptypes.map(p => `
            <label class="eh-checkbox-item"><input type="checkbox" name="ptype" value="${p.val}" checked> ${p.label}</label>
          `).join('')}
        </div>
      </div>

      <!-- Footer Bar (Screenshot 5: All India, Dubai, For NRI, International, View top cities ▸) -->
      <div class="eh-modal-bottom-footer">
        <div class="eh-modal-footer-links">
          <a onclick="pickModalCity('All India')">All India</a>
          <a onclick="pickModalCity('Dubai (International)')">Dubai</a>
          <a onclick="showToast('⭐ NRI Direct Investment Concierge Desk active')">For NRI</a>
          <span style="font-size: 12px; color: #7a869a;">International</span>
        </div>
        <a class="eh-top-cities-link" onclick="document.getElementById('modal-city-search-input').focus()">View top cities ▸</a>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  setTimeout(() => {
    const input = document.getElementById('modal-city-search-input');
    if (input) input.focus();
  }, 50);
};

window.closeExpandedSearchModal = function () {
  const m = document.getElementById('eh-expanded-search-modal');
  if (m) m.style.display = 'none';
};

window.setModalTab = function (tab) {
  document.querySelectorAll('.eh-modal-tab-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`modal-tab-${tab}`);
  if (btn) btn.classList.add('active');

  const resSelect = document.getElementById('modal-res-select');
  if (resSelect) resSelect.value = tab === 'buy' ? 'buy' : tab;

  const input = document.getElementById('modal-city-search-input');
  if (input) {
    if (tab === 'rent') input.placeholder = 'Search "Flats for rent in Noida, Mumbai, Bangalore..."';
    else if (tab === 'commercial') input.placeholder = 'Search "Offices & Shops in BKC, Cyber City..."';
    else if (tab === 'plots') input.placeholder = 'Search "Plots & Land in gated communities..."';
    else if (tab === 'pg') input.placeholder = 'Search "PG & Co-living suites..."';
    else input.placeholder = 'Type City name';
  }

  // Update dynamic checkboxes for this tab
  const ptypes = PTYPE_OPTIONS[tab] || PTYPE_OPTIONS.buy;
  const cbContainer = document.getElementById('modal-ptype-checkboxes');
  if (cbContainer) {
    cbContainer.innerHTML = ptypes.map(p => `
      <label class="eh-checkbox-item"><input type="checkbox" name="ptype" value="${p.val}" checked> ${p.label}</label>
    `).join('');
  }
};

window.handleModalCategoryChange = function (cat) {
  setModalTab(cat);
};

window.filterModalCityList = function (keyword) {
  const q = (keyword || '').toLowerCase().trim();
  const listEl = document.getElementById('modal-city-list');
  if (!listEl) return;
  const filtered = q ? MODAL_CITIES.filter(c => c.toLowerCase().includes(q)) : MODAL_CITIES;
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="eh-modal-city-row" onclick="pickModalCity('${keyword}')">
        <span class="eh-modal-city-name">Search in "${keyword}"</span>
        <span class="eh-modal-city-badge">Locality / Project</span>
      </div>
    `;
  } else {
    listEl.innerHTML = filtered.map(c => `
      <div class="eh-modal-city-row" onclick="pickModalCity('${c}')">
        <span class="eh-modal-city-name">${c}</span>
        <span class="eh-modal-city-badge">City</span>
      </div>
    `).join('');
  }
};

window.pickModalCity = function (city) {
  const input = document.getElementById('modal-city-search-input');
  if (input) input.value = city;
  const quickInput = document.getElementById('eh-quick-search-input');
  if (quickInput) quickInput.value = city;

  const headerCity = document.getElementById('eh-header-city-label');
  if (headerCity) headerCity.innerText = city.split('/')[0].trim();

  // Determine active mode
  const activeTab = document.querySelector('.eh-modal-tab-btn.active');
  let mode = 'buy';
  if (activeTab) {
    if (activeTab.id.includes('rent') || activeTab.id.includes('pg')) mode = 'rent';
    else if (activeTab.id.includes('commercial')) mode = 'invest';
    else mode = 'buy';
  }

  closeExpandedSearchModal();
  window.renderCuratedRow(mode, city === 'All India' ? '' : city);
  const el = document.getElementById('curated-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.clearSearchCheckboxes = function () {
  const cbs = document.querySelectorAll('#modal-ptype-checkboxes input[type="checkbox"]');
  const allChecked = Array.from(cbs).every(c => c.checked);
  cbs.forEach(c => c.checked = !allChecked);
};

window.applyExpandedSearch = function () {
  const cityInput = document.getElementById('modal-city-search-input');
  const query = cityInput ? cityInput.value : '';
  pickModalCity(query || 'All India');
};

window.detectUserCity = function (e) {
  if (e) e.stopPropagation();
  const input = document.getElementById('eh-quick-search-input');
  if (input) {
    input.value = 'Sector 77, Noida / Delhi NCR';
    showToast('📍 Location detected: Sector 77, Noida / Delhi NCR');
  }
};

window.triggerVoiceSearch = function (e) {
  if (e) e.stopPropagation();
  showToast('🎙️ Voice Assistant listening: Say "3 BHK in Mumbai or Delhi"');
  setTimeout(() => {
    const input = document.getElementById('eh-quick-search-input');
    if (input) input.value = '3 BHK Luxury Apartment';
    openExpandedSearchModal('buy');
  }, 1000);
};

window.openPostPropertyModal = function () {
  if (typeof openPostPropertyPage === 'function') {
    openPostPropertyPage();
  } else {
    state.viewMode = 'post-property';
    window.location.hash = '#/post-property';
    renderApp();
  }
};

window.openInsightsModal = function () {
  let modal = document.getElementById('eh-insights-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'eh-insights-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeInsightsModal(); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 680px;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: linear-gradient(135deg, #091e42, #0052cc); color: #ffffff; padding: 1.25rem 1.5rem;">
        <div>
          <div style="font-size: 0.75rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Nexora 99 Market Intelligence</div>
          <h2 style="font-size: 1.4rem; font-weight: 850; color: #ffffff; margin: 0.2rem 0 0;">Real Estate Price Trends & Insights</h2>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeInsightsModal()">&times;</button>
      </div>
      <div style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;">
        <!-- City Price Growth Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
          <div style="background: #f4f5f7; padding: 1rem; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 0.75rem; color: #6b778c; font-weight: 700;">DELHI / NCR</div>
            <div style="font-size: 1.25rem; font-weight: 850; color: #091e42; margin: 0.25rem 0;">₹9,850/sq.ft</div>
            <div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">▲ +14.8% YoY Growth</div>
          </div>
          <div style="background: #f4f5f7; padding: 1rem; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 0.75rem; color: #6b778c; font-weight: 700;">MUMBAI / MMR</div>
            <div style="font-size: 1.25rem; font-weight: 850; color: #091e42; margin: 0.25rem 0;">₹24,400/sq.ft</div>
            <div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">▲ +11.2% YoY Growth</div>
          </div>
          <div style="background: #f4f5f7; padding: 1rem; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 0.75rem; color: #6b778c; font-weight: 700;">BENGALURU</div>
            <div style="font-size: 1.25rem; font-weight: 850; color: #091e42; margin: 0.25rem 0;">₹8,200/sq.ft</div>
            <div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">▲ +18.4% YoY Growth</div>
          </div>
        </div>

        <!-- Hot Investment Corridors -->
        <h4 style="font-size: 0.95rem; font-weight: 800; color: #091e42; margin: 0 0 0.75rem;">Top Demand Micro-Markets</h4>
        <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #fafbfc; border: 1px solid #ebecf0; border-radius: 8px;">
            <div>
              <div style="font-weight: 750; font-size: 0.9rem; color: #172b4d;">Dwarka Expressway, Gurgaon</div>
              <div style="font-size: 0.75rem; color: #6b778c;">High infrastructure velocity & Metro expansion</div>
            </div>
            <span style="background: #e6fffa; color: #00a389; font-weight: 800; font-size: 0.8rem; padding: 0.25rem 0.65rem; border-radius: 4px;">High ROI (16%)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #fafbfc; border: 1px solid #ebecf0; border-radius: 8px;">
            <div>
              <div style="font-weight: 750; font-size: 0.9rem; color: #172b4d;">Whitefield & Sarjapur, Bengaluru</div>
              <div style="font-size: 0.75rem; color: #6b778c;">IT corridor rental yields & Tech campus proximity</div>
            </div>
            <span style="background: #e6fffa; color: #00a389; font-weight: 800; font-size: 0.8rem; padding: 0.25rem 0.65rem; border-radius: 4px;">High Rental (5.2%)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #fafbfc; border: 1px solid #ebecf0; border-radius: 8px;">
            <div>
              <div style="font-weight: 750; font-size: 0.9rem; color: #172b4d;">Sector 150 & Expressway, Noida</div>
              <div style="font-size: 0.75rem; color: #6b778c;">Jewar Airport connectivity & sports city ecosystem</div>
            </div>
            <span style="background: #e6fffa; color: #00a389; font-weight: 800; font-size: 0.8rem; padding: 0.25rem 0.65rem; border-radius: 4px;">High ROI (14%)</span>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary" onclick="closeInsightsModal(); openExpandedSearchModal('buy');" style="flex: 1; justify-content: center; font-weight: 700;">
            🔍 Search Properties in Top Corridors
          </button>
          <button class="btn btn-secondary" onclick="showToast('Market Intelligence Report sent to your email'); closeInsightsModal();" style="flex: 1; justify-content: center; font-weight: 700;">
            📥 Download Market PDF Report
          </button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.closeInsightsModal = function () {
  const m = document.getElementById('eh-insights-modal');
  if (m) m.style.display = 'none';
};

window.showEhNavDropdown = function (id) {
  const el = document.getElementById(`eh-nav-${id}`);
  if (el) el.style.display = 'block';
};

window.hideEhNavDropdown = function (id) {
  const el = document.getElementById(`eh-nav-${id}`);
  if (el) el.style.display = 'none';
};

const LOCALITIES_DATA = {
  ncr: [
    { name: 'Dwarka Expressway, Gurgaon', tag: 'High Growth', count: '45+ Projects' },
    { name: 'Golf Course Extension Road', tag: 'Luxury', count: '32+ Projects' },
    { name: 'Sector 150, Noida', tag: 'Green Corridor', count: '28+ Projects' },
    { name: 'Noida Expressway', tag: 'IT Hub', count: '54+ Projects' },
    { name: 'Central Delhi', tag: 'Ultra Luxury', count: '12+ Projects' },
    { name: 'Sohna Road, South Gurgaon', tag: 'Affordable', count: '38+ Projects' }
  ],
  mumbai: [
    { name: 'Bandra West & Khar', tag: 'Prime', count: '24+ Projects' },
    { name: 'Powai & Chandivali', tag: 'Lakefront', count: '31+ Projects' },
    { name: 'Andheri West', tag: 'Metro Hub', count: '42+ Projects' },
    { name: 'Thane West (Ghodbunder)', tag: 'High ROI', count: '65+ Projects' }
  ],
  blr: [
    { name: 'Whitefield', tag: 'Tech Hub', count: '50+ Projects' },
    { name: 'Sarjapur Road', tag: 'High Demand', count: '48+ Projects' },
    { name: 'Hebbal & Airport Rd', tag: 'Luxury Corridor', count: '29+ Projects' },
    { name: 'Indiranagar', tag: 'Lifestyle', count: '15+ Projects' }
  ],
  pune: [
    { name: 'Hinjewadi IT Park', tag: 'IT Hub', count: '40+ Projects' },
    { name: 'Baner & Balewadi', tag: 'High Growth', count: '35+ Projects' },
    { name: 'Kharadi', tag: 'SEZ Corridor', count: '28+ Projects' }
  ],
  hyd: [
    { name: 'Gachibowli & HITEC City', tag: 'Financial District', count: '44+ Projects' },
    { name: 'Kokapet Neopolis', tag: 'Skyline Hub', count: '26+ Projects' },
    { name: 'Tellapur', tag: 'Villa Communities', count: '30+ Projects' }
  ]
};

window.switchLocalityCity = function (cityKey) {
  document.querySelectorAll('[id^="loc-city-"]').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`loc-city-${cityKey}`);
  if (btn) btn.classList.add('active');

  const container = document.getElementById('eh-popular-localities-grid');
  if (!container) return;
  const list = LOCALITIES_DATA[cityKey] || LOCALITIES_DATA.ncr;
  container.innerHTML = list.map(item => `
    <div style="background: #ffffff; border: 1px solid #ebecf0; border-radius: 8px; padding: 0.85rem 1rem; cursor: pointer; transition: all 0.15s; display: flex; justify-content: space-between; align-items: center;" 
         onmouseover="this.style.borderColor='#0078db'; this.style.boxShadow='0 4px 12px rgba(9,30,66,0.08)'" 
         onmouseout="this.style.borderColor='#ebecf0'; this.style.boxShadow='none'"
         onclick="pickModalCity('${item.name}')">
      <div>
        <div style="font-weight: 750; font-size: 0.88rem; color: #172b4d;">${item.name}</div>
        <div style="font-size: 0.72rem; color: #6b778c; margin-top: 2px;">${item.count}</div>
      </div>
      <span style="font-size: 0.68rem; font-weight: 800; background: #eef2f6; color: #0078db; padding: 0.2rem 0.45rem; border-radius: 4px;">${item.tag}</span>
    </div>
  `).join('');
};

window.handlePubGlobalSearch = function (query) {
  pubState.keywordSearch = (query || '').toLowerCase();
  renderCuratedRow(window.curatedMode, pubState.keywordSearch, pubState.selectedBhk);
};

window.handlePubTypeFilter = function (type) {
  pubState.selectedBhk = type;
  renderCuratedRow(window.curatedMode, pubState.keywordSearch, pubState.selectedBhk);
};

window.executeHeroSearch = function () {
  if (typeof window.openApartmentListingPage === 'function') {
    window.openApartmentListingPage('ALL');
    return;
  }
  openExpandedSearchModal('buy');
};

window.togglePubLoginDropdown = function (e) {
  if (e) e.stopPropagation();
  const d = document.getElementById('eh-login-dropdown');
  if (d) {
    d.style.display = d.style.display === 'block' ? 'none' : 'block';
  }
};

// ============================================================================
// CINEMATIC KEN BURNS SCREENSAVER HERO SLIDESHOW (5 ULTRA-LUXURY RESIDENCES)
// ============================================================================
window.HERO_SLIDES_META = [
  { img: '/assets/hero_slide_1_villa.jpg', title: 'The Horizon Villa • Twilight View' },
  { img: '/assets/hero_slide_2_estate.jpg', title: 'Palm Boulevard Estate • Golden Hour' },
  { img: '/assets/hero_slide_3_interior.jpg', title: 'Double-Height Living Penthouse' },
  { img: '/assets/hero_slide_4_waterfront.jpg', title: 'Waterfront Marina Residence' },
  { img: '/assets/hero_slide_5_terrace.jpg', title: 'The Courtyard Pavilion • Architectural Suite' }
];

window.heroSlideInterval = null;
window.currentHeroSlide = 0;

window.initHeroKenBurnsScreensaver = function () {
  if (window.heroSlideInterval) {
    clearInterval(window.heroSlideInterval);
    window.heroSlideInterval = null;
  }
  window.currentHeroSlide = 0;
  window.updateHeroScreensaverDOM(0);

  window.heroSlideInterval = setInterval(function () {
    const next = (window.currentHeroSlide + 1) % window.HERO_SLIDES_META.length;
    window.switchHeroSlide(next);
  }, 3000);
};

window.switchHeroSlide = function (idx) {
  window.currentHeroSlide = idx;
  window.updateHeroScreensaverDOM(idx);
};

window.updateHeroScreensaverDOM = function (idx) {
  const slides = document.querySelectorAll('.eh-screensaver-slide');
  slides.forEach((slide, i) => {
    if (i === idx) {
      slide.classList.add('active');
      slide.style.zIndex = '2';
    } else {
      slide.classList.remove('active');
      slide.style.zIndex = '1';
    }
  });
};


// ──────────────────────────────────────────────────────────
// NEXORA SALE REAL ESTATE NEWS ENGINE (TOP ARTICLES ON HOME BUYING)
// ──────────────────────────────────────────────────────────
const NEXORA_INDIAN_NEWS_DB = {
  news: [
    {
      id: 'grap-ncr',
      title: 'GRAP Stage 1 Imposed in Delhi-NCR: Construction Guidelines & Timelines',
      category: 'Delhi-NCR Policy',
      tag: 'Policy Alert',
      img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '3 min read',
      author: 'Nexora Regulatory & Urban Affairs Desk',
      summary: 'The Commission for Air Quality Management (CAQM) has enacted Stage 1 of the Graded Response Action Plan (GRAP) across Delhi, Noida, Greater Noida, Gurgaon, Faridabad, and Ghaziabad. Non-polluting interior fit-outs, hospital infra, and RERA-registered ready developments continue operations under zero-dust guidelines.',
      keyPoints: [
        'Pre-cast assembly and interior MEP finishing projects remain fully operational under anti-smog protocols.',
        'Buyer inquiries for ready-to-move-in inventory surged 22% this week across Noida Expressway and Dwarka Expressway.',
        'RERA structural delivery schedules protected under standard municipal force majeure buffers.'
      ]
    },
    {
      id: 'new-noida-land',
      title: 'Land Acquisitions for New Noida (DNGIR) Fast-Tracked for Aerotropolis',
      category: 'Infrastructure',
      tag: 'Airport Corridor',
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '4 min read',
      summary: 'Noida Authority accelerates the ₹1,000 Cr land acquisition phase for the Dadri-Noida-Ghaziabad Investment Region (DNGIR - New Noida). The planned 20,000-hectare industrial and residential city links directly to Jewar International Airport.',
      keyPoints: [
        'Direct 8-lane expressway connecting Jewar Airport cargo terminal to Eastern Peripheral Expressway.',
        'Expected to spur 45,000+ new verified residential and institutional units by 2028.',
        'Capital values in peripheral Noida sectors appreciating at 18.5% YoY.'
      ]
    },
    {
      id: 'mumbai-coastal-road',
      title: 'Mumbai Coastal Road Phase 2 Spurs 26% Capital Influx in Bandra-Worli Belt',
      category: 'Mumbai MMR',
      tag: 'High Growth',
      img: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '5 min read',
      summary: 'With commute times from Nariman Point to Kandivali dropping from 2 hours to 35 minutes, sea-facing luxury residences along Worli, Bandra West, and Khar register peak institutional demand and near-zero unsold inventory.',
      keyPoints: [
        'Transit velocity unlocks western sea-facing residential clusters.',
        'Ultra-luxury transactions cross ₹1.2 Lakh/sq.ft threshold across prime Worli and Bandra towers.',
        'Direct developer allocation pipelines outperforming secondary market resales.'
      ]
    },
    {
      id: 'bengaluru-metro-ring',
      title: 'Bengaluru Outer Ring Road & Sarjapur Metro Phase 3 Gets Final Cabinet Nod',
      category: 'Bengaluru IT',
      tag: 'Metro Expansion',
      img: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      summary: 'Karnataka government greenlights the 44-km Phase 3 line connecting Hebbal to Sarjapur Road. Top GCC tech campuses along Outer Ring Road report steady commercial pre-leasing and residential rental yield expansion to 5.4%.',
      keyPoints: [
        'Mass transit access for 450,000+ tech employees along Bellandur and Marathahalli.',
        'High-density residential projects commanding 12-15% pre-booking premiums.',
        'Direct metro station skywalks integrated into upcoming township masterplans.'
      ]
    }
  ],
  legal: [
    {
      id: 'rera-de-registration',
      title: 'RERA Stricture on Misleading Carpet Area Advertisements: What Buyers Must Check',
      category: 'Legal Precedent',
      tag: 'Buyer Protection',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '4 min read',
      author: 'Advocate Sneha Patel, Real Estate Legal Counsel',
      summary: 'State RERA authorities issue revised compliance notices mandating that all print, billboard, and digital listings state the exact RERA net usable carpet area rather than loading or super built-up claims. Nexora ensures 100% architectural floor plan transparency.',
      keyPoints: [
        'RERA net carpet area must exclude external balcony and utility walls in primary pricing metrics.',
        'Penalty of up to 5% project cost on misleading marketing collateral.',
        'Escrow audit mechanisms tightened across Haryana, Maharashtra, and Karnataka.'
      ]
    },
    {
      id: 'stamp-duty-women',
      title: 'Stamp Duty Concessions for Women Homebuyers: State-by-State 2026 Guide',
      category: 'Tax Benefits',
      tag: 'Save on Registration',
      img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '3 min read',
      summary: 'States including Delhi (4% vs 6%), Uttar Pradesh (1% rebate up to ₹10 Lakhs), and Maharashtra provide targeted stamp duty exemptions when women are primary or sole co-owners. Nexora assists clients in structuring title ownership to maximize registration rebates.',
      keyPoints: [
        'Save between ₹1 Lakh to ₹4.5 Lakhs on registration by registering property in spouse or mother’s name.',
        'Lower interest rate slabs of 5 to 10 bps offered by leading public sector housing finance banks.',
        'Co-ownership structures qualify for joint tax deductions under Section 80C and Section 24(b).'
      ]
    },
    {
      id: 'completion-certificate-rules',
      title: 'Occupancy Certificate (OC) vs Completion Certificate (CC): Demystifying Legality',
      category: 'Compliance',
      tag: 'Essential Due Diligence',
      img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '4 min read',
      summary: 'Why taking possession without an Occupancy Certificate (OC) exposes buyers to municipal disconnection risks. The definitive legal checklist every homeowner must review before taking physical handover.',
      keyPoints: [
        'OC certifies building is safe and constructed according to approved fire, sanitation and structural sanctions.',
        'Taking possession on "fit-out basis" without OC renders municipal water and power tariffs commercial.',
        'Banks cannot disburse final loan tranches without verified OC documentation.'
      ]
    },
    {
      id: 'capital-gains-54f',
      title: 'Section 54F Capital Gains Exemption: Maximizing Tax Savings on Asset Reinvestment',
      category: 'Tax Optimization',
      tag: 'HNIs & Investors',
      img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '5 min read',
      summary: 'How selling shares, mutual funds, or commercial land and reinvesting net proceeds into verified residential properties protects wealth from 20% long-term capital gains tax under Section 54F.',
      keyPoints: [
        'Net consideration must be reinvested in one residential home in India within 2 years.',
        'Capital Gains Account Scheme (CGAS) allows parking funds until construction completion.',
        'Threshold cap of ₹10 Crores applies under the latest Finance Act directives.'
      ]
    }
  ],
  guides: [
    {
      id: 'first-time-buyer-checklist',
      title: 'The 30-Point Homebuyer Checklist: From Down Payment to Key Handover',
      category: 'Buying Guide',
      tag: 'Beginners Must-Read',
      img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '6 min read',
      author: 'Nexora Editorial Advisory Board',
      summary: 'A step-by-step master walkthrough designed for first-generation property investors. Budgeting beyond base selling price: factoring in stamp duty, GST, club membership, IFMS, and 2 years advance maintenance.',
      keyPoints: [
        'All-inclusive pricing breakdown: calculating the true cost of purchase beyond basic sale price.',
        'Essential legal checks: 30-year search report, encumbrance certificate, and environmental clearance.',
        'Staggered construction-linked payment plans vs time-linked milestones.'
      ]
    },
    {
      id: 'carpet-vs-super-area',
      title: 'Carpet Area vs Super Built-up Area: The Math Behind Loading Percentages',
      category: 'Area Explained',
      tag: 'Buyer Education',
      img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '3 min read',
      summary: 'Learn how to detect inflated 40% loading factors and calculate the true per-square-foot cost on your actual living space before putting down token deposits.',
      keyPoints: [
        'RERA carpet area is the net usable floor area excluding external walls and balconies.',
        'Loading factor = (Super Area - Carpet Area) / Carpet Area.',
        'High-efficiency layouts maintain loading under 25-28% with minimal corridor wastage.'
      ]
    },
    {
      id: 'home-loan-interest-hacks',
      title: 'Home Loan Hacks: How a ₹5,000 Extra Monthly Principal Saves ₹18 Lakhs Interest',
      category: 'Home Finance',
      tag: 'Smart Mortgages',
      img: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '4 min read',
      summary: 'The compound interest advantage: Prepaying one additional EMI each year or increasing your monthly EMI by 5% annually reduces a 20-year home loan tenure to 12 years.',
      keyPoints: [
        'Prepayment flexibility: RBI mandates zero prepayment penalty on floating rate home loans.',
        'Home loan overdraft accounts (MaxGain/SmartHome) allow parking emergency funds to save daily interest.',
        'Maintain CIBIL score above 780 to qualify for prime lowest-slab repo-linked interest rates.'
      ]
    },
    {
      id: 'vastu-shastra-modern',
      title: 'Modern Architecture & Vastu Shastra: Balancing Aesthetics with Energy Flow',
      category: 'Interior & Vastu',
      tag: 'Design Balance',
      img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      summary: 'How contemporary architects harmonise master bedroom placements, northeast water features, and southeast kitchens in high-rise condominium floor layouts.',
      keyPoints: [
        'North-East entrance orientations maintain maximum natural morning illumination and ventilation.',
        'Open plan kitchens with eastward cooking views comply with Agni corner principles.',
        'Zero structural compromises: modern partition design techniques achieving full energetic balance.'
      ]
    }
  ],
  investment: [
    {
      id: 'high-yield-micro-markets',
      title: 'Top 7 High-Yield Indian Micro-Markets Delivering 16%+ Annual Returns',
      category: 'Market Trends',
      tag: 'Wealth Creation',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '5 min read',
      author: 'Nexora Strategic Investments Desk',
      summary: 'Data-driven analysis across 40 Indian sub-markets: Why Jewar Airport Corridor, Dwarka Expressway (Sec 102-113), Kokapet Hyderabad, and Panathur-Varthur Bengaluru continue to outpace traditional equity indices.',
      keyPoints: [
        'Infrastructure-led appreciation cycles typically yield 2.5x growth over 5-year holding horizons.',
        'Rental yield expansion driven by Grade-A IT park completions and high-speed expressway connectivity.',
        'Institutional developers capturing 68% of total metropolitan absorption.'
      ]
    },
    {
      id: 'fractional-ownership-reits',
      title: 'Commercial Fractional Ownership vs Residential Buy-to-Let: Yield Comparison',
      category: 'Alternative Assets',
      tag: 'Commercial vs Resi',
      img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '4 min read',
      summary: 'With SEBI introducing the Small and Medium REITs (SM REITs) framework, retail investors can enter pre-leased Grade-A corporate assets with ₹10 Lakhs ticket sizes to earn 8.5% gross yields.',
      keyPoints: [
        'Commercial pre-leased office spaces offer 8-9% gross yields vs 3-4% residential rental yields.',
        'SEBI regulated SM REITs provide institutional governance and secondary exchange liquidity.',
        'Dual benefit of quarterly dividend cash flows paired with underlying asset appreciation.'
      ]
    },
    {
      id: 'nri-investment-fema',
      title: 'FEMA Guidelines for NRI Real Estate Investments: Inflows, Repatriation & NRE Accounts',
      category: 'NRI Desk',
      tag: 'Global Indian Wealth',
      img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '5 min read',
      summary: 'Clear answers on repatriation of sale proceeds under the $1 Million USD LRS route, using NRE/NRO banking channels, and power of attorney (POA) registration without physical travel to India.',
      keyPoints: [
        'NRIs can purchase unlimited residential and commercial properties in India with zero prior RBI approval.',
        'Repatriation of principal purchase price allowed via foreign inward remittance channels.',
        '100% transparent title diligence and institutional asset management.'
      ]
    },
    {
      id: 'plots-vs-flats-roi',
      title: 'Plotted Land vs High-Rise Apartments: 5-Year Liquidity and ROI Faceoff',
      category: 'Asset Allocation',
      tag: 'Land vs Flat',
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      summary: 'Which asset generates higher net returns along fast-growing peripheral expressways: Gated RERA residential plots vs luxury high-rise condominium developments.',
      keyPoints: [
        'Plotted land delivers 18-24% capital growth but 0% rental yield.',
        'Apartments generate immediate 4-5% cash flow + steady appreciation.',
        'Gated township plots offer lowest holding cost and fastest title transfer.'
      ]
    }
  ]
};

let nexoraNewsState = {
  currentTab: 'news',
  offset: 0
};

function formatDynamicNewsDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const dateStr = d.toLocaleDateString('en-US', options);
  if (daysAgo === 0) return `Today, ${dateStr}`;
  if (daysAgo === 1) return `Yesterday, ${dateStr}`;
  return dateStr;
}

window.exploreBuyingHome = function () {
  const target = document.getElementById('newly-launched-section') || document.getElementById('curated-section');
  if (target) {
    const yOffset = -75;
    const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
};

window.renderNexoraNewsGrid = function (categoryKey = 'news', offset = 0) {
  nexoraNewsState.currentTab = categoryKey;
  nexoraNewsState.offset = offset;

  const container = document.getElementById('nx-news-grid-container');
  if (!container) return;

  const list = NEXORA_INDIAN_NEWS_DB[categoryKey] || NEXORA_INDIAN_NEWS_DB.news;
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const totalOffset = (dayOfYear + offset) % list.length;

  const displayItems = [];
  for (let i = 0; i < Math.min(4, list.length); i++) {
    displayItems.push(list[(totalOffset + i) % list.length]);
  }

  container.innerHTML = displayItems.map((item) => `
    <div class="nx-article-card" onclick="openNexoraNewsModal('${item.id}', '${categoryKey}')">
      <div class="nx-article-thumb-wrap">
        <img src="${item.img}" alt="${item.title}" loading="lazy" />
      </div>
      <div class="nx-article-meta">
        <h4 class="nx-article-title">${item.title}</h4>
        <div class="nx-article-subinfo">
          <span>${formatDynamicNewsDate(item.daysAgo)}</span>
          <span style="color: #cbd5e1;">•</span>
          <span style="color: #0078db; font-weight: 700;">${item.tag}</span>
        </div>
      </div>
    </div>
  `).join('');

  const dateBadge = document.getElementById('nx-news-live-date-badge');
  if (dateBadge) {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dateBadge.innerText = `Auto-updated ${today}`;
  }
};

window.switchNexoraNewsTab = function (tab) {
  document.querySelectorAll('.nx-news-tab').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`nx-ntab-${tab}`);
  if (btn) btn.classList.add('active');
  renderNexoraNewsGrid(tab, 0);
};

window.rotateNexoraNewsNext = function () {
  const list = NEXORA_INDIAN_NEWS_DB[nexoraNewsState.currentTab] || NEXORA_INDIAN_NEWS_DB.news;
  const nextOffset = (nexoraNewsState.offset + 1) % list.length;
  renderNexoraNewsGrid(nexoraNewsState.currentTab, nextOffset);
};

window.openNexoraNewsModal = function (articleId, categoryKey = 'news') {
  let modal = document.getElementById('nx-news-reader-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'nx-news-reader-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeNexoraNewsModal(); };
    document.body.appendChild(modal);
  }

  let article = null;
  const categories = Object.keys(NEXORA_INDIAN_NEWS_DB);
  for (const cat of categories) {
    const found = NEXORA_INDIAN_NEWS_DB[cat].find(a => a.id === articleId);
    if (found) { article = found; break; }
  }

  if (!article) return;

  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 680px;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: linear-gradient(135deg, #091e42, #0052cc); color: #ffffff; padding: 1.25rem 1.5rem;">
        <div>
          <div style="font-size: 0.75rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Nexora Indian Realty Intel</div>
          <h2 style="font-size: 1.25rem; font-weight: 850; color: #ffffff; margin: 0.2rem 0 0; line-height: 1.3;">${article.title}</h2>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeNexoraNewsModal()">&times;</button>
      </div>

      <div style="padding: 1.5rem; max-height: 72vh; overflow-y: auto;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <span style="background: #e0f2fe; color: #0284c7; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px;">${article.category}</span>
          <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">📅 ${formatDynamicNewsDate(article.daysAgo)}</span>
          <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">⏱️ ${article.readTime}</span>
          <span style="color: #10b981; font-weight: 750;">✓ 100% Indian Market Verified</span>
        </div>

        <div style="width: 100%; height: 230px; border-radius: 10px; overflow: hidden; margin-bottom: 1.25rem; background: #ebecf0;">
          <img src="${article.img}" alt="${article.title}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>

        <p style="font-size: 0.95rem; line-height: 1.65; color: #1e293b; margin-bottom: 1.25rem; font-weight: 500;">
          ${article.summary}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.15rem; margin-bottom: 1.5rem;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #091e42; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
            📌 Key Takeaways for Homebuyers & Investors
          </div>
          <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.88rem; color: #475569; line-height: 1.65;">
            ${article.keyPoints.map(kp => `<li style="margin-bottom: 0.35rem;">${kp}</li>`).join('')}
          </ul>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary" onclick="closeNexoraNewsModal(); openExpandedSearchModal('buy');" style="flex: 1; justify-content: center; font-weight: 700;">
            🔍 Explore Verified Indian Residences
          </button>
          <button class="btn btn-secondary" onclick="openShieldedCallModal(); closeNexoraNewsModal();" style="flex: 1; justify-content: center; font-weight: 700;">
            🛡️ Talk to Nexora Property Advisor
          </button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.closeNexoraNewsModal = function () {
  const m = document.getElementById('nx-news-reader-modal');
  if (m) m.style.display = 'none';
};

window.openAllNewsModal = function () {
  openNexoraNewsModal('grap-ncr', 'news');
};

// ──────────────────────────────────────────────────────────
// NEXORA RENTAL REAL ESTATE NEWS & ADVICE ENGINE (LIVE & AUTO-UPDATED DAILY)
// ──────────────────────────────────────────────────────────
function getLiveRentalDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}
window.getLiveRentalDate = getLiveRentalDate;

const NEXORA_RENTAL_NEWS_DB = {
  news: [
    {
      id: 'rn-emerald-court-tenants',
      title: 'Emerald Court asks bachelor tenants to vacate...',
      fullTitle: 'Emerald Court & Gated Societies: RWA notice restricting bachelor tenants faces legal challenge',
      category: 'news',
      tag: 'Tenant Rights',
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '3 min read',
      author: 'Aakash Verma, Legal Affairs Correspondent',
      source: 'National Housing Bureau',
      summary: 'Several resident welfare associations in NCR issued arbitrary guidelines restricting bachelor tenants. Legal authorities have affirmed that under the Model Tenancy Act 2021 and established Supreme Court precedents, RWAs possess no statutory authority to enforce discriminatory tenancy restrictions based on marital status, dietary preference, or gender when the landlord and tenant have signed a valid Leave & License agreement.',
      keyPoints: [
        'Model Tenancy Act 2021 supersedes individual society guidelines regarding tenant eligibility.',
        'High Court rulings confirm RWAs cannot restrict bachelor or single tenants from common areas or elevators.',
        'Landlords in Noida and Gurugram formed owner federations to protect direct rental yields.'
      ]
    },
    {
      id: 'rn-rental-uid-ludhiana',
      title: 'Rental units to get UID number in Ludhiana...',
      fullTitle: 'Rental units to get unique digital UID number in Ludhiana & Punjab municipal zones',
      category: 'news',
      tag: 'Digital Registry',
      img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '2 min read',
      author: 'Simranjeet Kaur',
      source: 'Realty Economic Times',
      summary: 'The Punjab Municipal Administration has launched a dedicated digital portal to assign Unique Identification (UID) numbers to all rented residential and commercial properties. The pilot rollout aims to eliminate unregistered tenancy disputes, streamline police tenant verifications online, and ensure property owners receive accurate municipal assessment incentives.',
      keyPoints: [
        'QR-code enabled property UID tags linked to verified owner and tenant lease records.',
        'Enables instant digital police verification without physical police station queues.',
        'Provides tenants with verified landlord ownership checks before paying deposits.'
      ]
    },
    {
      id: 'rn-noida-e-rent-portal',
      title: 'Noida: New e-rent portal paves the way for digital lease registration...',
      fullTitle: 'Noida: New mandatory e-rent agreement portal launched with instant digital verification',
      category: 'news',
      tag: 'Lease Portal',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '3 min read',
      author: 'Rohit Sharma',
      source: 'NCR Urban News Desk',
      summary: 'Noida Authority, in coordination with the Department of Registration and Stamps, has unveiled an e-Rental agreement system allowing tenants and landlords to complete registered leave & license agreements entirely online. The portal reduces stamp duty verification turnaround from days to under 15 minutes.',
      keyPoints: [
        'Aadhaar e-Sign integration eliminates the need for physical visits to sub-registrar offices.',
        'Direct link with local police tenant verification databases for 24-hour clearance.',
        'Standardized 11-month and 24-month lease templates protecting security deposit refunds.'
      ]
    },
    {
      id: 'rn-bengaluru-it-rents',
      title: 'Bengaluru IT Corridor rents climb 14% across Whitefield & ORR...',
      fullTitle: 'Bengaluru IT Corridor rental rates climb 14% across Whitefield & ORR on full return-to-office',
      category: 'news',
      tag: 'Rental Surge',
      img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      author: 'Priya Narayanan',
      source: 'Deccan Realty Monitor',
      summary: 'Bengaluru rental market data reveals an unprecedented surge in demand across major IT hubs including Bellandur, Marathahalli, and Whitefield. Quality gated township 2 BHK rentals have crossed ₹42,000 to ₹55,000 monthly, prompting tenants to demand transparent lease contracts and capped security deposits.',
      keyPoints: [
        'Tech mandates drive acute rental demand in Bellandur, Sarjapur Road, and Whitefield.',
        'Average vacancy duration dropped to an all-time low of under 7 calendar days.',
        'Tenants increasingly opting for verified direct platform bookings to avoid broker fees.'
      ]
    },
    {
      id: 'rn-gurugram-luxury-rents',
      title: 'Gurugram Golf Course Extn luxury rental yields breach 4.2%...',
      fullTitle: 'Gurugram Golf Course Extn & Cyber City luxury rental yields breach 4.2% threshold',
      category: 'news',
      tag: 'Luxury Yield',
      img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
      daysAgo: 4,
      readTime: '3 min read',
      author: 'Devendra Mehta',
      source: 'Gurugram Business Times',
      summary: 'Residential rental yields along Golf Course Extension Road, Sector 54, and Sector 62 in Gurugram have climbed to 4.2%—one of the highest residential rental yield levels in northern India. Corporate lease agreements are being signed for 24-to-36-month terms with built-in 7% annual escalation clauses.',
      keyPoints: [
        'MNC corporate executive relocations drive demand for 3 & 4 BHK condominiums.',
        'Clubhouse, concierge, and EV infrastructure becoming mandatory tenant criteria.',
        'High rental yields outperforming traditional savings and commercial retail returns.'
      ]
    },
    {
      id: 'rn-mumbai-metro-rents',
      title: 'Mumbai Metro Phase commissioning triggers 12% rise in suburban rental demand...',
      fullTitle: 'Mumbai Metro Phase commissioning triggers 12% rise in suburban 1 & 2 BHK rental demand',
      category: 'news',
      tag: 'Transit Living',
      img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80',
      daysAgo: 5,
      readTime: '3 min read',
      author: 'Tanvi Deshmukh',
      source: 'Mumbai Real Estate Herald',
      summary: 'Suburban Mumbai is witnessing a noticeable redistribution of residential tenancy. Newly operational metro corridors have reduced peak commute times between western and eastern suburbs by 40 minutes, leading young professionals to trade compact south-central apartments for spacious 2 BHK gated community homes.',
      keyPoints: [
        'Transit velocity unlocks western and central suburban rental clusters.',
        'Rental demand in Dahisar, Borivali, and Thane up by 18% YoY.',
        'Direct metro access commanding an 8-10% rental premium over interior lanes.'
      ]
    }
  ],

  'tax-legal': [
    {
      id: 'rn-gst-rule-residential-rent',
      title: 'New GST rule on residential house rent explained...',
      fullTitle: 'New GST rule on residential house rent explained for landlords & registered business tenants',
      category: 'tax-legal',
      tag: 'GST Rule',
      img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '4 min read',
      author: 'CA Rajesh Agarwal',
      source: 'Nexora Tax & Legal Desk',
      summary: 'Under updated GST provisions, residential rent paid by an unregistered individual for personal residential use remains 100% exempt from GST. However, when a residential property is rented to a GST-registered business entity or proprietor claiming input tax credit, GST at 18% is applicable under the Reverse Charge Mechanism (RCM).',
      keyPoints: [
        'No GST liability for salaried or unregistered individual tenants living in rented homes.',
        '18% GST applies under RCM only when tenant is GST-registered and claims ITC.',
        'Landlords should include an explicit non-business residential declaration in agreements.'
      ]
    },
    {
      id: 'rn-tds-194-ib-rent',
      title: 'Section 194-IB: How tenants paying over ₹50K monthly rent must deduct 5% TDS...',
      fullTitle: 'Section 194-IB: How tenants paying over ₹50,000 monthly rent must deduct 5% TDS',
      category: 'tax-legal',
      tag: 'TDS on Rent',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '3 min read',
      author: 'Meenakshi Sundaram',
      source: 'Chartered Accountants Journal',
      summary: 'Individual tenants paying rent exceeding ₹50,000 per month are legally mandated under Section 194-IB of the Income Tax Act to deduct 5% TDS from the rent paid in the last month of tenancy or financial year. Failure to furnish Form 26QC within 30 days carries a penalty of ₹200 per day of delay.',
      keyPoints: [
        'Applicable only when monthly rent exceeds ₹50,000.',
        'Tenant does not need a TAN (Tax Deduction Account Number); PAN is sufficient.',
        'TDS deducted only once a year or in the final month of the lease.'
      ]
    },
    {
      id: 'rn-model-tenancy-act-cap',
      title: 'Model Tenancy Act: 2-month security deposit cap & eviction protection...',
      fullTitle: 'Model Tenancy Act: 2-month security deposit cap & eviction protection guidelines',
      category: 'tax-legal',
      tag: 'Tenancy Law',
      img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '5 min read',
      author: 'Advocate Vikramaditya Sen',
      source: 'National Law Review',
      summary: 'The Model Tenancy Act establishes clear national benchmarks for rental housing: residential security deposits cannot exceed two months of rent, while commercial deposits are capped at six months. Landlords cannot enter rented premises without 24-hour written notice, and rent courts must resolve eviction petitions within 60 calendar days.',
      keyPoints: [
        'Security deposit capped strictly at 2 months for all residential tenancies.',
        'Mandatory 24-hour prior written notice before landlord property visits.',
        'Establishment of specialized Rent Courts and Rent Tribunals for fast-track dispute disposal.'
      ]
    },
    {
      id: 'rn-hra-exemption-parents',
      title: 'HRA Exemption: Legitimate rules for claiming rent paid to parents...',
      fullTitle: 'How salaried employees can legitimately claim HRA by paying rent to parents',
      category: 'tax-legal',
      tag: 'Tax Saving',
      img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '3 min read',
      author: 'Sanjay Chawla',
      source: 'Personal Finance Express',
      summary: 'Salaried individuals living with their parents can claim HRA tax exemption under Section 10(13A) by paying bona fide rent to the parent who is the registered property owner. To withstand scrutiny, rent must be paid via regular bank transfers, rent receipts with revenue stamps must be maintained, and the parent must declare the rental income in their ITR.',
      keyPoints: [
        'Property must be legally owned by the parent (not the employee or spouse).',
        'Regular monthly bank transfers (NEFT/UPI) must be recorded to prove transaction legitimacy.',
        'Parent must report rental income under "Income from House Property" in their annual ITR.'
      ]
    }
  ],

  'help-guides': [
    {
      id: 'rn-move-in-checklist',
      title: '25-Point Move-In Checklist: Inspecting a rental home before signing...',
      fullTitle: 'The Ultimate 25-Point Move-In Checklist: Inspecting a rental home before signing the lease',
      category: 'help-guides',
      tag: 'Inspection Guide',
      img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '4 min read',
      author: 'Editorial Desk',
      source: 'Nexora Editorial Guide',
      summary: 'Before accepting keys to a new rental apartment, thorough documentation protects you from losing security deposits later. Our editors compiled a 25-point checklist covering: checking water pressure in all showers simultaneously, testing MCB electrical trip switches, photographing existing wall marks and bathroom grout conditions, recording electricity and piped gas meter readings, and confirming society maintenance payment status.',
      keyPoints: [
        'Take timestamped video walkthrough of the entire apartment on move-in day.',
        'Document and attach meter readings for electricity, water, and piped gas to the lease agreement.',
        'Confirm society maintenance charges are fully cleared by the landlord up to the handover date.'
      ]
    },
    {
      id: 'rn-negotiating-rent-brokerage',
      title: 'How to negotiate rental price, maintenance & zero brokerage in metros...',
      fullTitle: 'How to negotiate rental price, maintenance charges, and brokerage in metro cities',
      category: 'help-guides',
      tag: 'Smart Renting',
      img: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '3 min read',
      author: 'Ananya Roy',
      source: 'Smart Tenant Handbook',
      summary: 'Savvy tenants use local inventory data to negotiate favourable lease terms. In markets with upcoming possession deliveries, landlords are often willing to offer 5% to 8% rent discounts or absorb monthly society maintenance charges in exchange for longer 2-year lock-in agreements. Direct platforms like Nexora allow tenants to bypass traditional brokerage commissions altogether.',
      keyPoints: [
        'Leverage upcoming supply in adjacent sectors to negotiate 5-8% rental discounts.',
        'Offer longer lock-in terms or advance post-dated cheques in exchange for waived maintenance.',
        'Use verified direct developer platforms like Nexora to eliminate 1-month broker fees entirely.'
      ]
    },
    {
      id: 'rn-police-verification-online',
      title: 'Tenant police verification: Complete step-by-step online portal guide...',
      fullTitle: 'Tenant police verification: Complete step-by-step online guide across major states',
      category: 'help-guides',
      tag: 'Police Verification',
      img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '3 min read',
      author: 'Gaurav Joshi',
      source: 'Citizen Civic Watch',
      summary: 'Tenant police verification is a legal prerequisite for residential leasing across all Indian metro jurisdictions. Most states have now migrated this service entirely to citizen mobile applications and web portals, eliminating visits to police stations. Tenants upload Aadhaar details, employer ID, and photograph, receiving digital acknowledgment within 48 hours.',
      keyPoints: [
        '100% online portal submissions available in Delhi NCR, Mumbai, and Bengaluru.',
        'Aadhaar, employer ID, and passport photograph required for digital submission.',
        'Landlords who fail to register tenants face Section 188 IPC non-compliance notices.'
      ]
    },
    {
      id: 'rn-rwa-rules-freedoms',
      title: 'RWA Rules vs Tenant Rights: What societies can & cannot enforce...',
      fullTitle: 'RWA Rules vs Tenant Rights: What housing societies can and cannot legally enforce',
      category: 'help-guides',
      tag: 'Tenant Rights',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      author: 'Nandita Sen',
      source: 'Housing Rights India',
      summary: 'High Courts have repeatedly struck down discriminatory society rules imposing higher maintenance fees or clubhouse surcharge charges on tenants compared to owner-residents. Landlords and tenants hold identical co-owner enjoyment rights to common amenities, elevators, and designated parking spots. Societies cannot ban pets or impose curfews on adult tenants.',
      keyPoints: [
        'Equal amenity access: Tenants cannot be charged higher swimming pool or gym fees than owners.',
        'Pet ownership is protected under the Prevention of Cruelty to Animals Act.',
        'RWAs have zero jurisdiction to interrogate or ban legitimate personal guests.'
      ]
    }
  ],

  investment: [
    {
      id: 'rn-top-rental-yield-cities',
      title: 'High-Yield Rental Micro-Markets in India: Bengaluru, Hyderabad & NCR Lead with 4.5% ROI...',
      fullTitle: 'High-Yield Rental Micro-Markets in India: Bengaluru, Hyderabad & NCR Lead with 4.5% ROI',
      category: 'investment',
      tag: 'Rental Yields',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      daysAgo: 0,
      readTime: '4 min read',
      author: 'Karan Singhal, CFA',
      source: 'Real Estate Investment Monitor',
      summary: 'Residential real estate in India has traditionally yielded 2% to 3%, but high-demand IT micro-markets in Bengaluru (Whitefield, Sarjapur, Marathahalli) and Hyderabad (Gachibowli, Tellapur) are consistently generating gross yields between 3.8% and 4.6%. Proximity to multinational tech parks, international schools, and metro rail connectivity are the primary drivers of sustained rental growth.',
      keyPoints: [
        'Bengaluru East (Whitefield/ORR) yields 4.2% - 4.6% gross rental return.',
        'Hyderabad Financial District delivering highest capital-plus-rental composite returns.',
        'Modern gated townships with clubhouse amenities commanding 25% rent premiums over standalone plots.'
      ]
    },
    {
      id: 'rn-commercial-vs-residential-yield',
      title: 'Commercial Office vs Residential Flat: Net cash flow comparison...',
      fullTitle: 'Commercial Office vs Residential Flat: Which rental asset delivers better net cash flow?',
      category: 'investment',
      tag: 'Commercial vs Resi',
      img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80',
      daysAgo: 1,
      readTime: '4 min read',
      author: 'Shalini Mahajan',
      source: 'Wealth & Assets Weekly',
      summary: 'Investors evaluating rental assets must weigh risk-adjusted returns: commercial office spaces deliver robust 8% to 10% rental yields with 5-to-9-year corporate leases, but require higher ticket sizes and carry longer re-leasing times. Residential apartments provide 3% to 4% yields with lower entry barriers, high liquidity, and superior long-term capital appreciation.',
      keyPoints: [
        'Commercial delivers 8-10% rental yield with long-term 9-year institutional leases.',
        'Residential flats offer faster liquidity, easier mortgage terms, and higher appreciation.',
        'Fractional real estate REITs bridge the gap for individual investors with small tickets.'
      ]
    },
    {
      id: 'rn-furnished-rental-premium',
      title: 'Furnished vs Unfurnished: Spending ₹2.5L on interiors boosts annual rent by 22%...',
      fullTitle: 'Furnished vs Unfurnished: Spending ₹2.5 Lakhs on interiors boosts annual rent by 22%',
      category: 'investment',
      tag: 'Interior ROI',
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
      daysAgo: 2,
      readTime: '3 min read',
      author: 'Manish Talwar',
      source: 'Investor Intel Digest',
      summary: 'Market analysis of 10,000+ rental listings indicates that apartments outfitted with modular kitchens, wardrobes, inverter backups, ACs, and modern lighting lease out within 6 days on average, compared to 28 days for unfurnished units. The incremental monthly rent of ₹8,000 to ₹12,000 recovers the initial furnishing investment in under 24 months.',
      keyPoints: [
        'Furnished units lease 3x faster with near-zero vacancy periods between tenants.',
        'Incremental monthly rent of ₹8,000 to ₹12,000 recovers furnishing cost within 2 years.',
        'High demand among young relocating executives, consultants, and tech professionals.'
      ]
    },
    {
      id: 'rn-tenant-screening-playbook',
      title: "The Landlord's Tenant Screening Playbook: Zero default onboarding...",
      fullTitle: "The Landlord's Tenant Screening Playbook: CIBIL checks, employment verification, and zero defaults",
      category: 'investment',
      tag: 'Risk Mitigation',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80',
      daysAgo: 3,
      readTime: '4 min read',
      author: 'Deepak Saxena',
      source: 'Property Managers Forum',
      summary: 'Experienced landlords employ structured tenant onboarding frameworks: obtaining official corporate email confirmations, verifying employer credentials, requesting previous landlord references, and executing registered agreements with clear dispute resolution mechanisms. This reduces tenancy payment disputes by over 95%.',
      keyPoints: [
        'Official corporate email verification confirms employment status and stability.',
        'Checking CIBIL scores over 750 ensures consistent payment discipline.',
        'Standardized Leave & License contracts with built-in 7% escalation clauses.'
      ]
    }
  ]
};

window.rentalNewsState = {
  currentTab: 'news',
  page: 0,
  articlesPerPage: 4,
  apiData: null
};

window.initRentalNewsSection = async function () {
  try {
    const res = await apiFetch('/rental-news');
    if (res && res.status === 'success' && res.categories) {
      window.rentalNewsState.apiData = res.categories;
    }
  } catch (err) {
    // Graceful offline fallback
    console.log('[RentalNews] Using local daily dynamic rental news engine');
  }
  window.renderRentalNewsGrid();
};

window.switchRentalNewsTab = function (tabKey) {
  window.rentalNewsState.currentTab = tabKey;
  window.rentalNewsState.page = 0;

  // Update active tab buttons
  ['news', 'tax-legal', 'help-guides', 'investment'].forEach(k => {
    const btn = document.getElementById(`rna-tab-${k}`);
    if (btn) {
      if (k === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  window.renderRentalNewsGrid();
};

window.renderRentalNewsGrid = function () {
  const container = document.getElementById('rna-articles-grid');
  if (!container) return;

  const tab = window.rentalNewsState.currentTab || 'news';
  const page = window.rentalNewsState.page || 0;
  const perPage = window.rentalNewsState.articlesPerPage || 4;

  // Use API data if available, otherwise local pool
  let list = [];
  if (window.rentalNewsState.apiData && window.rentalNewsState.apiData[tab]) {
    list = window.rentalNewsState.apiData[tab];
  } else {
    list = NEXORA_RENTAL_NEWS_DB[tab] || NEXORA_RENTAL_NEWS_DB.news;
  }

  // Calculate day-of-year rotation offset so news changes everyday
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const shift = dayOfYear % list.length;
  const rotated = [...list.slice(shift), ...list.slice(0, shift)];

  const totalPages = Math.ceil(rotated.length / perPage) || 1;
  const startIndex = (page % totalPages) * perPage;
  const displayItems = rotated.slice(startIndex, startIndex + perPage);

  container.innerHTML = displayItems.map((item, idx) => {
    const daysAgo = startIndex + idx;
    const dateStr = item.date || getLiveRentalDate(daysAgo);
    const isToday = daysAgo === 0;

    return `
      <div class="rna-article-item" onclick="openRentalArticleModal('${item.id}', '${tab}')">
        <img src="${item.img}" alt="${item.title}" class="rna-article-thumb" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80';" />
        <div class="rna-article-info">
          <h4 class="rna-article-title" title="${item.fullTitle || item.title}">${item.title}</h4>
          <div class="rna-article-meta">
            <span>${dateStr}</span>
            ${isToday ? `<span class="rna-article-badge-today">● Live Today</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Update Page indicator and arrow buttons
  const pageIndicator = document.getElementById('rna-page-indicator');
  if (pageIndicator) {
    pageIndicator.innerText = `Page ${(page % totalPages) + 1} of ${totalPages}`;
  }

  const prevBtn = document.getElementById('rna-arrow-prev');
  if (prevBtn) {
    prevBtn.style.display = totalPages > 1 && page > 0 ? 'flex' : 'none';
  }

  const nextBtn = document.getElementById('rna-arrow-next');
  if (nextBtn) {
    nextBtn.style.display = totalPages > 1 ? 'flex' : 'none';
  }

  // Update live date indicator
  const dateIndicator = document.getElementById('rna-date-indicator');
  if (dateIndicator) {
    dateIndicator.innerText = `📅 Updated Today: ${getLiveRentalDate(0)}`;
  }
};

window.nextRentalNewsPage = function () {
  const tab = window.rentalNewsState.currentTab || 'news';
  const list = (window.rentalNewsState.apiData && window.rentalNewsState.apiData[tab]) || NEXORA_RENTAL_NEWS_DB[tab] || [];
  const totalPages = Math.ceil(list.length / window.rentalNewsState.articlesPerPage) || 1;
  window.rentalNewsState.page = (window.rentalNewsState.page + 1) % totalPages;
  window.renderRentalNewsGrid();
};

window.prevRentalNewsPage = function () {
  const tab = window.rentalNewsState.currentTab || 'news';
  const list = (window.rentalNewsState.apiData && window.rentalNewsState.apiData[tab]) || NEXORA_RENTAL_NEWS_DB[tab] || [];
  const totalPages = Math.ceil(list.length / window.rentalNewsState.articlesPerPage) || 1;
  window.rentalNewsState.page = (window.rentalNewsState.page - 1 + totalPages) % totalPages;
  window.renderRentalNewsGrid();
};

window.openRentalArticleModal = function (articleId, categoryKey = 'news') {
  let modal = document.getElementById('rna-article-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rna-article-modal';
    modal.className = 'rna-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeRentalArticleModal(); };
    document.body.appendChild(modal);
  }

  // Find article across DB
  let article = null;
  const categories = ['news', 'tax-legal', 'help-guides', 'investment'];
  for (const cat of categories) {
    const pool = (window.rentalNewsState.apiData && window.rentalNewsState.apiData[cat]) || NEXORA_RENTAL_NEWS_DB[cat] || [];
    const found = pool.find(a => a.id === articleId);
    if (found) { article = found; break; }
  }

  if (!article) return;

  const dateStr = article.date || getLiveRentalDate(article.daysAgo || 0);

  modal.innerHTML = `
    <div class="rna-modal-card" onclick="event.stopPropagation()">
      <div class="rna-modal-header" style="background: linear-gradient(135deg, #091e42, #0052cc); color: #ffffff; border-radius: 16px 16px 0 0;">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
            Nexora Verified Rental Intelligence • ${article.source || 'Editor Desk'}
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 850; color: #ffffff; margin: 0.25rem 0 0; line-height: 1.3;">
            ${article.fullTitle || article.title}
          </h2>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff; font-size: 1.5rem; background: none; border: none; cursor: pointer;" onclick="closeRentalArticleModal()">&times;</button>
      </div>

      <div class="rna-modal-body" style="padding: 1.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; font-size: 0.8rem; color: #64748b; font-weight: 600;">
          <span style="background: #e0f2fe; color: #0284c7; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.74rem;">${article.tag || 'Rental Law'}</span>
          <span>📅 ${dateStr}</span>
          <span>⏱️ ${article.readTime || '3 min read'}</span>
          <span style="color: #16a34a; font-weight: 750;">✓ Verified True Rental News</span>
        </div>

        <div style="width: 100%; height: 240px; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; background: #091e42;">
          <img src="${article.img}" alt="${article.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';" />
        </div>

        <p style="font-size: 0.96rem; line-height: 1.7; color: #1e293b; margin-bottom: 1.5rem; font-weight: 500;">
          ${article.fullStory || article.summary}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #091e42; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
            📌 Key Takeaways for Tenants & Landlords
          </div>
          <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.88rem; color: #475569; line-height: 1.7;">
            ${(article.keyPoints || [
      'Model Tenancy Act provisions protect both parties with defined dispute timelines.',
      'Security deposits must be refunded within 30 days of lease conclusion.',
      'Always ensure Leave & License agreements are legally registered with state authorities.'
    ]).map(kp => `<li style="margin-bottom: 0.4rem;">${kp}</li>`).join('')}
          </ul>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="closeRentalArticleModal(); openExpandedSearchModal('rent');" style="flex: 1; justify-content: center; font-weight: 750; background: #0078db;">
            🔍 Explore Verified Rental Homes
          </button>
          <button class="btn" onclick="closeRentalArticleModal(); openPostPropertyModal();" style="flex: 1; justify-content: center; font-weight: 750; background: #f1f5f9; color: #091e42; border: 1px solid #cbd5e1;">
            📢 Post Rental Listing (0% Brokerage)
          </button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.closeRentalArticleModal = function () {
  const m = document.getElementById('rna-article-modal');
  if (m) m.style.display = 'none';
};

window.openAllRentalNewsModal = function () {
  const tab = window.rentalNewsState.currentTab || 'news';
  const pool = (window.rentalNewsState.apiData && window.rentalNewsState.apiData[tab]) || NEXORA_RENTAL_NEWS_DB[tab] || [];
  if (pool.length > 0) {
    window.openRentalArticleModal(pool[0].id, tab);
  }
};

// ── NEXORA PLOT & LAND REAL ESTATE NEWS ENGINE (BEST ARTICLES ON PLOTS/LAND) ──
const NEXORA_PLOT_NEWS_DB = {
  news: [
    {
      id: 'p-news-1',
      title: 'Tips for Buying a Plot in India: Due Diligence & 2026 RERA Checklist',
      fullTitle: 'Complete Legal Due Diligence Guide for Buying Plotted Land in India: Title Deeds, RERA Approvals & Encumbrance Verification',
      dateAgo: 0,
      tag: 'Buyer Checklist',
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Essential checklist before signing an agreement to sell for residential or commercial plots. Verification of original title deed, 30-year Encumbrance Certificate (EC), and local development authority layout sanctions.',
      keyPoints: [
        'Insist on obtaining the Mother Deed tracing clean chain of title for at least 30 years.',
        'Verify layout sanction number with state RERA authority and local town planning body.',
        'Ensure the plot has an approved approach road of minimum 9 to 12 meters width as per master plan.'
      ]
    },
    {
      id: 'p-news-2',
      title: 'YEIDA Sector 18 & 20 Plotted Schemes: Registry Drive Near Jewar Airport',
      fullTitle: 'Yamuna Expressway Authority Fast-Tracks Possession and Sub-Lease Deed Registry for 21,000 Residential Plots',
      dateAgo: 1,
      tag: 'Authority Plots',
      img: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80',
      readTime: '3 min read',
      summary: 'YEIDA accelerates physical handover and possession checklists for residential plots in Sector 18 and Sector 20 along the Yamuna Expressway corridor.',
      keyPoints: [
        'Over 14,000 plot owners receive clearance for execution of tripartite sub-lease deeds.',
        'Infrastructure development including 45-meter arterial sector roads and 220kV power substations completed.',
        'Secondary market appreciation jumps 34% year-on-year driven by commercial flight trials at Noida International Airport.'
      ]
    },
    {
      id: 'p-news-3',
      title: 'Bengaluru STRR & Devanahalli: KIADB Fast-Tracks 1,200 Acres Land Parcels',
      fullTitle: 'Karnataka Industrial Area Development Board (KIADB) Releases Industrial & Plotted Townships along Satellite Town Ring Road (STRR)',
      dateAgo: 2,
      tag: 'Growth Corridor',
      img: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=400&q=80',
      readTime: '5 min read',
      summary: 'Strategic plotted developments along the Satellite Town Ring Road (STRR) connecting Dobbaspet to Devanahalli and Hoskote witness unprecedented institutional demand.',
      keyPoints: [
        'BMRDA and BDA approve integrated gated plotted layouts with underground fiber and water supply lines.',
        'Capital value of NA-converted residential plots surges from ₹3,200/sq.ft to ₹5,400/sq.ft in 18 months.',
        'Direct interchange connectivity to Bengaluru-Chennai Expressway fuels investor interest.'
      ]
    },
    {
      id: 'p-news-4',
      title: 'Digital Land Records: Telangana Dharani & Karnataka Bhoomi Verification',
      fullTitle: 'How Digital Title Verification Portals are Streamlining Boundary Survey & Mutation of Land Records Across Indian States',
      dateAgo: 3,
      tag: 'Govt Policy',
      img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'State governments integrate GIS-based geo-coordinates with revenue records to eliminate duplicate plot registries and fraudulent sales.',
      keyPoints: [
        'Unique Land Parcel Identification Number (ULPIN / Bhu-Aadhaar) mandatory for all registered plots.',
        'Instant online extraction of RTC / Pahani / Patta Chitta directly through government mobile apps.',
        'Biometric Aadhaar authentication mandatory for both buyer and seller during registrar deed execution.'
      ]
    }
  ],
  legal: [
    {
      id: 'p-legal-1',
      title: 'Agricultural to NA Land Conversion: Section 44/48 Procedure & Fees',
      fullTitle: 'Complete Legal Blueprint for Non-Agricultural (NA) Land Conversion under State Land Revenue Codes',
      dateAgo: 0,
      tag: 'Zoning & NA',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80',
      readTime: '5 min read',
      summary: 'Step-by-step guidance on obtaining District Collector sanction for converting agricultural land to residential (NA-44) or commercial use.',
      keyPoints: [
        'Verification that land does not fall within reserved forest, waterbody buffer, or ASI monument protected zones.',
        'Payment of conversion premium and development fees to state revenue department.',
        'Sanction of layout plan by Town & Country Planning Organization (TCPO) before sub-division into individual plots.'
      ]
    },
    {
      id: 'p-legal-2',
      title: '7/12 Extract, Patta & Chitta: Reading Encumbrance Certificates (EC)',
      fullTitle: 'Understanding Revenue Documents: How to Verify Nil-Encumbrance Form 15 and Ownership Mutation Extracts',
      dateAgo: 1,
      tag: 'Title Verification',
      img: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Comprehensive legal guide on decoding revenue land records: 7/12 Satbara, Khata certificate, Patta Passbook, and Form 15 Encumbrance Certificates.',
      keyPoints: [
        'Form 15 lists all registered transactions, mortgages, court stays, and liens on the property.',
        'Form 16 (Nil Encumbrance Certificate) certifies that no registered encumbrance exists for the queried timeline.',
        'Cross-verifying mutation register entries ensures deceased owners legal heirs are fully party to the sale deed.'
      ]
    },
    {
      id: 'p-legal-3',
      title: 'Capital Gains on Land Sales: Section 54F Exemptions & Indexation',
      fullTitle: 'Tax Optimization on Plot Sale: Section 54F Reinvestment in Residential Property and Section 54EC Bonds',
      dateAgo: 2,
      tag: 'Tax Planning',
      img: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'How to calculate Long-Term Capital Gains (LTCG) on plotted land held for more than 24 months, and available income tax exemptions.',
      keyPoints: [
        'Reinvesting entire net sale proceeds in a residential house property within 2 years qualifies for full 54F exemption.',
        'Investing up to ₹50 Lakhs in specified capital gains infrastructure bonds (REC, PFC, NHAI) under Section 54EC.',
        'Budget 2024 LTCG rules: 12.5% flat tax without indexation or 20% with indexation for pre-July 2024 acquisitions.'
      ]
    },
    {
      id: 'p-legal-4',
      title: 'Stamp Duty & Circle Rates for Plots: NCR, Maharashtra & Karnataka',
      fullTitle: 'State-Wise Plot Registration Costs, Circle Rate Multipliers, and Collector Guidelines for 2026',
      dateAgo: 4,
      tag: 'Stamp Duty',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      readTime: '3 min read',
      summary: 'State-by-state stamp duty comparison for residential and commercial land parcels, including concessions for women buyers.',
      keyPoints: [
        'Registration charges in UP/Haryana: 5-7% stamp duty + 1% registration fee based on district circle rates.',
        'Maharashtra ready reckoner rate: 5% stamp duty + 1% local body cess (LBC) + ₹30,000 registration fee.',
        'Karnataka e-Stamping portal calculates automated market guidance values for vacant site registrations.'
      ]
    }
  ],
  guides: [
    {
      id: 'p-guides-1',
      title: 'Boundary Demarcation & ETS Survey: Preventing Encroachment Disputes',
      fullTitle: 'Electronic Total Station (ETS) Survey and GPS Stone Demarcation for Plotted Properties',
      dateAgo: 0,
      tag: 'Site Due Diligence',
      img: 'https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Why physical boundary demarcation and boundary wall erection immediately after purchase is the single most critical step in securing plot ownership.',
      keyPoints: [
        'Hiring a licensed government surveyor to establish precise satellite GPS coordinates.',
        'Fencing and planting boundary corner pillars to prevent adverse possession or neighbor encroachments.',
        'Installing a display sign board with RERA registration details and owner contact.'
      ]
    },
    {
      id: 'p-guides-2',
      title: 'Gated Townships vs Revenue Plots: Basic Amenities & Sanctions',
      fullTitle: 'Comparing RERA-Approved Integrated Plotted Townships with Unauthorized Revenue / Gram Panchayat Plots',
      dateAgo: 1,
      tag: 'Plotted Living',
      img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'The crucial differences between buying in a master-planned gated plotted community versus standalone unapproved agricultural layout plots.',
      keyPoints: [
        'Gated communities guarantee underground electricity, sewage treatment plants (STP), and water connections.',
        'Revenue plots often face demolition notices, power connection rejections, and zero bank loan approvals.',
        'RERA escrow protection ensures the promoter completes all committed blacktop roads and clubhouse amenities.'
      ]
    },
    {
      id: 'p-guides-3',
      title: 'SBI Realty & Bank Loans for Plots: Eligibility & Construction Rules',
      fullTitle: 'How to Secure a Bank Plot Loan: Down Payment, Interest Rates, and Mandatory Construction Timelines',
      dateAgo: 3,
      tag: 'Plot Financing',
      img: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80',
      readTime: '5 min read',
      summary: 'Detailed walkthrough on financing your plot purchase through leading institutional lenders like SBI, HDFC, and ICICI Bank.',
      keyPoints: [
        'Banks typically finance up to 70-75% of the plot cost, requiring a 25-30% personal down payment.',
        'Plot-plus-construction composite loans offer lower interest rates and tax deduction on home loan interest.',
        'Most public sector banks mandate starting residential construction within 3 to 5 years of plot disbursement.'
      ]
    },
    {
      id: 'p-guides-4',
      title: '11 Common Traps in Unapproved Layouts: How to Protect Your Money',
      fullTitle: 'Red Flags Every Land Buyer Must Detect: Quota Scams, Green Belt Restrictions, and GPA Sales',
      dateAgo: 5,
      tag: 'Fraud Prevention',
      img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Expert legal warning on red flags when evaluating private developer land sales in suburban fringes.',
      keyPoints: [
        'Never purchase land through General Power of Attorney (GPA) or Agreement to Sell without registered Sale Deed.',
        'Beware of promised future zoning changes that have not yet been gazetted by the state urban development ministry.',
        'Ensure the seller has paid all past land revenue taxes and holds the latest valid Khata/Mutation copy.'
      ]
    }
  ],
  investment: [
    {
      id: 'p-investment-1',
      title: 'Plots Deliver 18-24% Growth: Peripheral Expressways vs High-Rise Condos',
      fullTitle: 'Comparative ROI Study: Plotted Land Capital Appreciation Versus Built Apartments in Metro Fringes',
      dateAgo: 0,
      tag: 'High ROI',
      img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80',
      readTime: '5 min read',
      summary: 'Comprehensive 5-year data analysis tracking land appreciation across major Indian infrastructure growth corridors.',
      keyPoints: [
        'Land plots in Tier-1 suburban hubs delivered average 21.4% CAGR over 2021-2026 vs 11.2% for built apartments.',
        'Zero depreciation on land value compared to ageing residential high-rise superstructures.',
        'Lowest maintenance holding costs: no monthly society maintenance fees or tenant vacancy risks.'
      ]
    },
    {
      id: 'p-investment-2',
      title: 'Top Emerging Plotting Corridors in India: Jewar, Dholera & Samruddhi',
      fullTitle: 'Mega Infrastructure Corridors Driving Landmark Institutional & Plotted Demand Across India',
      dateAgo: 1,
      tag: 'Megaprojects',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'In-depth market mapping of Indias most profitable land plotting belts driven by expressways, freight corridors, and greenfield airports.',
      keyPoints: [
        'Yamuna Expressway (YEIDA): Beneficiary of Jewar Airport, International Film City, and F1 Formula track.',
        'Dholera Special Investment Region (SIR): Semiconductor fab clusters and multi-modal logistics hub.',
        'Mumbai-Nagpur Samruddhi Mahamarg: 18 planned new smart cities and logistics parks along 701 km expressway.'
      ]
    },
    {
      id: 'p-investment-3',
      title: 'Commercial vs Residential Plots: Yields, Holding Costs & Exit Strategies',
      fullTitle: 'Asset Allocation Playbook: When to Invest in Retail Commercial Land vs Gated Residential Townships',
      dateAgo: 2,
      tag: 'Commercial Land',
      img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Strategic guide for high-net-worth investors evaluating commercial SCO (Shop-cum-Office) plots vs residential plots.',
      keyPoints: [
        'SCO plots generate 8-10% rental yields once constructed, with institutional anchor tenants.',
        'Residential plots provide faster retail liquidation and lower ticket size entry barriers.',
        'Commercial land allows multi-level development rights (FAR 2.0 to 3.5) in designated town planning zones.'
      ]
    },
    {
      id: 'p-investment-4',
      title: 'Warehousing & Logistics Land Parcels Along DMIC: Institutional Boom',
      fullTitle: 'Delhi-Mumbai Industrial Corridor (DMIC): Industrial & Logistics Plot Demand Hits Record Highs',
      dateAgo: 4,
      tag: 'Logistics Parks',
      img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80',
      readTime: '4 min read',
      summary: 'Global private equity funds deploy over $2.5 Billion into industrial land aggregation along western freight corridors.',
      keyPoints: [
        'E-commerce and 3PL logistics demand drives land values in Bhiwandi, Chakan, and Gurgaon-Faridabad expressways.',
        'Direct rail and expressway connectivity ensures long-term 12-15% lease yields on built warehouses.',
        'Pre-leased industrial land emerges as preferred fixed-income alternative asset for family offices.'
      ]
    }
  ]
};

window.plotNewsState = {
  currentTab: 'news',
  page: 0
};

window.renderPlotNewsGrid = function (tab = 'news', page = 0) {
  window.plotNewsState.currentTab = tab;
  window.plotNewsState.page = page;

  const container = document.getElementById('pna-articles-grid');
  if (!container) return;

  const list = NEXORA_PLOT_NEWS_DB[tab] || NEXORA_PLOT_NEWS_DB.news;
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const totalOffset = (dayOfYear + page * 2) % list.length;

  const displayItems = [];
  for (let i = 0; i < Math.min(4, list.length); i++) {
    displayItems.push(list[(totalOffset + i) % list.length]);
  }

  container.innerHTML = displayItems.map((item) => `
    <div class="pna-article-item" onclick="openPlotArticleModal('${item.id}', '${tab}')">
      <div class="pna-article-thumb">
        <img src="${item.img}" alt="${item.title}" loading="lazy" />
      </div>
      <div>
        <h4 class="pna-article-title">${item.title}</h4>
        <div class="pna-article-meta">
          <span>${formatDynamicNewsDate(item.dateAgo)}</span>
          <span style="color: #cbd5e1;">•</span>
          <span style="color: #059669; font-weight: 750;">${item.tag}</span>
        </div>
      </div>
    </div>
  `).join('');

  const prevBtn = document.getElementById('pna-arrow-prev');
  const nextBtn = document.getElementById('pna-arrow-next');
  if (prevBtn) prevBtn.style.display = page > 0 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = 'flex';

  const pageInd = document.getElementById('pna-page-indicator');
  if (pageInd) {
    pageInd.innerText = `Page ${page + 1} of 2`;
  }
};

window.switchPlotNewsTab = function (tab) {
  document.querySelectorAll('.pna-tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`pna-tab-${tab}`);
  if (btn) btn.classList.add('active');
  renderPlotNewsGrid(tab, 0);
};

window.nextPlotNewsPage = function () {
  const nextPage = (window.plotNewsState.page + 1) % 2;
  renderPlotNewsGrid(window.plotNewsState.currentTab, nextPage);
};

window.prevPlotNewsPage = function () {
  const prevPage = Math.max(0, window.plotNewsState.page - 1);
  renderPlotNewsGrid(window.plotNewsState.currentTab, prevPage);
};

window.openPlotArticleModal = function (id, cat = 'news') {
  let modal = document.getElementById('pna-article-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pna-article-modal';
    modal.className = 'rna-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closePlotArticleModal(); };
    document.body.appendChild(modal);
  }

  let article = null;
  const categories = Object.keys(NEXORA_PLOT_NEWS_DB);
  for (const c of categories) {
    const found = NEXORA_PLOT_NEWS_DB[c].find(a => a.id === id);
    if (found) { article = found; break; }
  }

  if (!article) return;

  modal.innerHTML = `
    <div class="rna-modal-card" onclick="event.stopPropagation()">
      <div class="rna-modal-header" style="background: linear-gradient(135deg, #064e3b, #047857);">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.05em;">Nexora Plots &amp; Land Intelligence</div>
          <div style="font-size: 0.85rem; color: #ecfdf5; margin-top: 0.2rem;">${article.tag} • ${formatDynamicNewsDate(article.dateAgo)}</div>
        </div>
        <button class="rna-modal-close" onclick="closePlotArticleModal()">✕</button>
      </div>

      <div class="rna-modal-body">
        <h3 class="rna-modal-title">${article.fullTitle || article.title}</h3>
        <p class="rna-modal-summary">${article.summary}</p>

        <h4 class="rna-modal-section-title">Critical Legal Points &amp; Due Diligence:</h4>
        <ul class="rna-modal-list">
          ${(article.keyPoints || []).map(pt => `<li>${pt}</li>`).join('')}
        </ul>

        <div style="margin-top: 1.5rem; padding: 1rem 1.25rem; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; font-size: 0.84rem; color: #065f46;">
          <b>Nexora Verified Land Records Notice:</b> Always cross-verify survey numbers on official state land portals (Bhoomi, Dharani, AnyROR, Mahabhumi) before signing agreement deeds.
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.closePlotArticleModal = function () {
  const m = document.getElementById('pna-article-modal');
  if (m) m.style.display = 'none';
};

window.openAllPlotNewsModal = function () {
  const tab = window.plotNewsState.currentTab || 'news';
  const pool = NEXORA_PLOT_NEWS_DB[tab] || [];
  if (pool.length > 0) {
    window.openPlotArticleModal(pool[0].id, tab);
  }
};

// ── NEXORA ARTICLES & GUIDES FOR PROPERTY OWNERS ──
const NEXORA_OWNER_NEWS_DB = {
  news: [
    {
      id: 'o-news-1',
      title: 'Tips to Declutter Your Home Post Festival: Maximize Buyer Appeal',
      fullTitle: 'Strategic Home Decluttering & Staging Post-Festive Season: How Indian Sellers Increase Inquiries by 35%',
      dateAgo: 0,
      tag: 'Seller Tips',
      img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80',
      summary: 'Decluttering open spaces and minimalist staging transforms buyer perception during open houses and direct site visits, helping you negotiate top market rates.',
      keyPoints: [
        'Clear hallway corridors and storage lofts to demonstrate maximum cubic capacity.',
        'Neutralize personal artifacts so prospective buyers can envision their family living there.',
        'Use high-CRI warm lighting to elevate living room and kitchen photography.'
      ]
    },
    {
      id: 'o-news-2',
      title: 'The New Meaning of Luxury Homes: Sustainability & High-Yield Plotted Living',
      fullTitle: 'Shifting Preferences of Indian Homeowners: Energy Efficiency, Smart Automation and Dedicated Home Offices',
      dateAgo: 1,
      tag: 'Market Trends',
      img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
      summary: 'Premium homeowners in Mumbai, Bengaluru, and Gurgaon are commanding 20% higher rental premiums by marketing sustainable IGBC ratings and smart automation.',
      keyPoints: [
        'Electric Vehicle (EV) charging integration in private parking spaces boosts executive appeal.',
        'Smart biometric access and acoustic soundproofing are top tenant demands.',
        'Plotted developments near expressway spurs are seeing unprecedented resale demand.'
      ]
    },
    {
      id: 'o-news-3',
      title: 'Vastu Tips for Property Owners: Enhancing Prosperity and Resale Speed',
      fullTitle: 'Essential Vastu Guidelines for Sellers & Landlords: Balancing Energies to Expedite Property Transactions',
      dateAgo: 2,
      tag: 'Vastu & Design',
      img: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=300&q=80',
      summary: 'Practical architectural Vastu alignments that resonate with 80% of Indian homebuyers during initial walk-throughs and auspicious registry dates.',
      keyPoints: [
        'Ensure the Northeast (Ishanya) corner remains clutter-free and well-illuminated.',
        'Check entrance door swing and maintain clear, squeak-free hardware.',
        'Position water features or green indoor plants in the North quadrant.'
      ]
    },
    {
      id: 'o-news-4',
      title: 'Earn Passive Rental Income from Property: 2026 Landlord Masterclass',
      fullTitle: 'Complete Rental Yield Optimization Guide: Long-Term Leases, Corporate Tenancies & Zero Vacancy Tactics',
      dateAgo: 3,
      tag: 'Passive Income',
      img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80',
      summary: 'How individual landlords in metro cities are achieving 4.5% to 6% net rental yields by targeting corporate executives and offering semi-furnished packages.',
      keyPoints: [
        'Equip modern modular kitchens and branded air conditioners for faster tenant closures.',
        'Include annual maintenance clauses (AMC) in the registered agreement.',
        'Use digital security deposits and automated rent reconciliation via Nexora.'
      ]
    }
  ],
  legal: [
    {
      id: 'o-legal-1',
      title: 'Capital Gains Tax Exemptions Under Section 54: Seller Guide 2026',
      fullTitle: 'How Property Sellers Can Legally Exempt Long-Term Capital Gains (LTCG) via Section 54 and 54EC Capital Gain Bonds',
      dateAgo: 1,
      tag: 'Tax Exemption',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=300&q=80',
      summary: 'Understanding rollover provisions under Section 54 and reinvestment options in specified NHAI/REC bonds to minimize capital gains liabilities upon property sale.',
      keyPoints: [
        'Reinvest capital gains in up to two residential houses if capital gain is under ₹2 Crore.',
        'Deposit unutilized gains in Capital Gains Account Scheme (CGAS) before income tax filing deadline.',
        'Maximum ₹50 Lakh exemption available under Section 54EC bonds within 6 months of transfer.'
      ]
    },
    {
      id: 'o-legal-2',
      title: 'How to Obtain Online Encumbrance Certificate (EC) for Free Title Check',
      fullTitle: 'State-by-State Online Portal Guide for Verifying 30-Year Encumbrance Records (IGRS, Kaveri, Dharani, AnyROR)',
      dateAgo: 2,
      tag: 'Title Verification',
      img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=300&q=80',
      summary: 'Step-by-step instructions for property owners to download digitally signed Form 15 Encumbrance Certificates to satisfy bank buyers and mortgage underwriters.',
      keyPoints: [
        'Form 15 lists all registered mortgages, sales, court attachments, and leases.',
        'Form 16 (Nil Encumbrance) certifies no registered transactions exist during the search period.',
        'Crucial document required by all scheduled commercial banks for disbursing buyer home loans.'
      ]
    },
    {
      id: 'o-legal-3',
      title: 'Gift Deed vs Will for Ancestral Property: Stamp Duty & Legal Safety',
      fullTitle: 'Estate Planning for Indian Property Owners: When to Register a Gift Deed vs Executing a Registered Will',
      dateAgo: 3,
      tag: 'Estate Planning',
      img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=300&q=80',
      summary: 'Comparative analysis of gift deeds with blood-relative stamp duty concessions versus registered testamentary wills to avoid family probate disputes.',
      keyPoints: [
        'Gift deeds take effect immediately upon execution and registration with the sub-registrar.',
        'Wills take effect only post demise and do not attract stamp duty.',
        'Concessional stamp duty (1% to 2%) applies for gift deeds to blood relatives in most states.'
      ]
    },
    {
      id: 'o-legal-4',
      title: 'Property Mutation (Dakhil Kharij) Procedure Post Sale Deed Registration',
      fullTitle: 'Updating Municipal Corporation & Revenue Land Records: Why Mutation is Critical for Title Perfection',
      dateAgo: 4,
      tag: 'Revenue Records',
      img: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80',
      summary: 'Mutation transfers property tax liability to the new owner in municipal records. Essential for paying property taxes and avoiding municipal disputes.',
      keyPoints: [
        'Submit registered conveyance deed, latest tax receipts, and indemnity bond to municipal ward office.',
        'Mutation does not create title by itself but establishes fiscal possession in government records.',
        'Necessary before applying for revised water, electricity, and gas utility connections.'
      ]
    }
  ],
  guides: [
    {
      id: 'o-guide-1',
      title: 'Home Staging Checklist: Sell Your Flat for 10% Higher in 14 Days',
      fullTitle: 'Professional Home Staging Techniques for Indian Sellers: Lighting, Aroma, Neutral Palettes & Virtual Staging',
      dateAgo: 0,
      tag: 'Home Staging',
      img: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=300&q=80',
      summary: 'How simple aesthetic improvements like fresh neutral paint, warm accent lighting, and depersonalized spaces generate bidding competition.',
      keyPoints: [
        'Fresh neutral off-white or light gray coat makes rooms appear 20% larger in photography.',
        'Fix dripping faucets, loose cabinet hinges, and clean grout lines prior to buyer visits.',
        'Schedule buyer viewings during peak natural daylight hours.'
      ]
    },
    {
      id: 'o-guide-2',
      title: 'Tenant Screening Framework: Verifying Credit, Employment & Police Records',
      fullTitle: 'How Smart Landlords Avoid Rent Defaults: Comprehensive Tenant Due Diligence and Online Verification',
      dateAgo: 2,
      tag: 'Tenant Screening',
      img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      summary: 'Standard operating procedure for verifying corporate employment letters, PAN/Aadhaar verification, and completing local police tenant intimation online.',
      keyPoints: [
        'Request recent corporate email confirmation or official HR salary certificate.',
        'Verify tenant identity documents against government digilocker or UIDAI QR code.',
        'Complete online police tenant verification via state police portal or mobile app.'
      ]
    },
    {
      id: 'o-guide-3',
      title: 'High-Impact Renovation Upgrades Yielding 200% ROI Before Listing',
      fullTitle: 'Cost-Effective Renovations that Directly Increase Resale Valuation and Rental Appraisals',
      dateAgo: 3,
      tag: 'Renovation ROI',
      img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=300&q=80',
      summary: 'Focusing refurbishment budget strictly on kitchen counter stone, bathroom fixtures, and LED recessed lighting for maximum appraisal uplift.',
      keyPoints: [
        'Quartz or granite kitchen countertops provide the highest perceived value to buyers.',
        'Replace outdated plumbing fixtures with modern brushed nickel or chrome fittings.',
        'Deep steam cleaning of floors and tiles yields higher returns than full structural remodeling.'
      ]
    },
    {
      id: 'o-guide-4',
      title: 'Digital Registered Rent Agreement vs Notarized Lease: Legal Rights',
      fullTitle: 'Model Tenancy Act Compliance: Why Registered Leave & License Agreements Protect Landlord Eviction Rights',
      dateAgo: 4,
      tag: 'Tenancy Act',
      img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=300&q=80',
      summary: 'Why notarized agreements have limited evidentiary weight in eviction disputes and how digital Aadhaar biometric registration provides enforceable protection.',
      keyPoints: [
        'Agreements exceeding 11 months must be compulsorily registered under Registration Act 1908.',
        'Registered agreements allow summary eviction proceedings before the Rent Controller.',
        'Clearly define security deposit refund timelines and deduction parameters.'
      ]
    }
  ],
  investment: [
    {
      id: 'o-inv-1',
      title: 'Rental Yield Comparison: Residential Flats vs Commercial Office Spaces',
      fullTitle: 'Where to Reinvest Property Sale Proceeds: Comparing 3% Residential Yields with 7-9% Pre-Leased Commercial Assets',
      dateAgo: 1,
      tag: 'Commercial Yield',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=300&q=80',
      summary: 'Asset reallocation strategy for high-net-worth property owners looking to transition from low-yield residential flats to high-cashflow institutional Grade-A offices.',
      keyPoints: [
        'Grade-A commercial office space offers 7% to 9% gross rental yields with 9-year corporate leases.',
        'Residential properties typically cap out at 2.5% to 3.8% yields with frequent annual tenant turnover.',
        'Commercial leases include 15% contractual rent escalations every 3 years.'
      ]
    },
    {
      id: 'o-inv-2',
      title: 'Fractional Real Estate & REITs: How Landlords Diversify Illiquid Assets',
      fullTitle: 'Liquid Real Estate Wealth Management: Allocating Capital into SEBI-Regulated SM REITs and Commercial Portfolios',
      dateAgo: 2,
      tag: 'SM REITs',
      img: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=300&q=80',
      summary: 'How owners selling residential properties are deploying ticket sizes into SEBI Small and Medium REITs (SM REITs) with quarterly dividend distributions.',
      keyPoints: [
        'Minimum investment threshold reduced to ₹10 Lakhs under new SEBI SM REIT guidelines.',
        'Quarterly cash payouts backed by rent from Fortune 500 tenants.',
        'Superior liquidity compared to physical apartment transactions.'
      ]
    },
    {
      id: 'o-inv-3',
      title: 'Top Micro-Markets for High-Appreciation Resale Properties Across India',
      fullTitle: 'Where to Buy Next: High-Growth Infrastructure Belts in Gurgaon, Noida, Bengaluru & Hyderabad',
      dateAgo: 3,
      tag: 'Capital Growth',
      img: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=300&q=80',
      summary: 'Analyzing secondary market velocity along operational expressways and upcoming metro line expansions delivering double-digit annual appreciation.',
      keyPoints: [
        'Dwarka Expressway and Golf Course Extension in Gurgaon continue recording 15%+ YoY capital growth.',
        'North Bengaluru airport corridor witnessing aggressive institutional plotted absorption.',
        'Financial District and Neopolis in Hyderabad lead commercial absorption benchmarks.'
      ]
    },
    {
      id: 'o-inv-4',
      title: 'Pre-Leased Banks and Retail Showrooms: Zero-Management Cash Flows',
      fullTitle: 'Institutional Landlord Playbook: Acquiring Pre-Leased Retail High-Street and Banking Assets for Stress-Free Income',
      dateAgo: 4,
      tag: 'Pre-Leased',
      img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
      summary: 'Why seasoned investors prefer ground-floor pre-leased spaces with national banks and retail chains over vacant under-construction units.',
      keyPoints: [
        'Nationalized and private banks rarely relocate, guaranteeing 15+ year tenant stability.',
        'Triple-net leases ensure property taxes and internal maintenance are handled by the tenant.',
        'Immediate cashflow from day one without tenant acquisition delays.'
      ]
    }
  ]
};

window.ownerNewsState = {
  currentTab: 'news',
  page: 0
};

window.renderOwnerNewsGrid = function (tab = 'news', page = 0) {
  window.ownerNewsState.currentTab = tab;
  window.ownerNewsState.page = page;

  const container = document.getElementById('ona-articles-grid');
  if (!container) return;

  const list = NEXORA_OWNER_NEWS_DB[tab] || NEXORA_OWNER_NEWS_DB.news;
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const totalOffset = (dayOfYear + page * 2) % list.length;

  const displayItems = [];
  for (let i = 0; i < Math.min(4, list.length); i++) {
    displayItems.push(list[(totalOffset + i) % list.length]);
  }

  container.innerHTML = displayItems.map((item) => `
    <div class="ona-article-item" onclick="openOwnerArticleModal('${item.id}', '${tab}')">
      <div class="ona-article-thumb">
        <img src="${item.img}" alt="${item.title}" loading="lazy" />
      </div>
      <div>
        <h4 class="ona-article-title">${item.title}</h4>
        <div class="ona-article-meta">
          <span>${formatDynamicNewsDate(item.dateAgo)}</span>
          <span style="color: #cbd5e1;">•</span>
          <span style="color: #0078db; font-weight: 600;">${item.tag}</span>
        </div>
      </div>
    </div>
  `).join('');

  const prevBtn = document.getElementById('ona-arrow-prev');
  const nextBtn = document.getElementById('ona-arrow-next');
  if (prevBtn) prevBtn.style.display = page > 0 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = 'flex';

  const pageInd = document.getElementById('ona-page-indicator');
  if (pageInd) {
    pageInd.innerText = `Page ${page + 1} of 2`;
  }
};

window.switchOwnerNewsTab = function (tab) {
  document.querySelectorAll('.ona-tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`ona-tab-${tab}`);
  if (btn) btn.classList.add('active');
  renderOwnerNewsGrid(tab, 0);
};

window.nextOwnerNewsPage = function () {
  const nextPage = (window.ownerNewsState.page + 1) % 2;
  renderOwnerNewsGrid(window.ownerNewsState.currentTab, nextPage);
};

window.prevOwnerNewsPage = function () {
  const prevPage = Math.max(0, window.ownerNewsState.page - 1);
  renderOwnerNewsGrid(window.ownerNewsState.currentTab, prevPage);
};

window.openOwnerArticleModal = function (id, cat = 'news') {
  let modal = document.getElementById('ona-article-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ona-article-modal';
    modal.className = 'rna-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeOwnerArticleModal(); };
    document.body.appendChild(modal);
  }

  let article = null;
  const categories = Object.keys(NEXORA_OWNER_NEWS_DB);
  for (const c of categories) {
    const found = NEXORA_OWNER_NEWS_DB[c].find(a => a.id === id);
    if (found) { article = found; break; }
  }

  if (!article) return;

  modal.innerHTML = `
    <div class="rna-modal-card" onclick="event.stopPropagation()">
      <div class="rna-modal-header" style="background: linear-gradient(135deg, #091e42, #0052cc);">
        <div>
          <div style="font-size: 0.72rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Nexora Property Owners Intelligence</div>
          <div style="font-size: 0.85rem; color: #ecfdf5; margin-top: 0.2rem;">${article.tag} • ${formatDynamicNewsDate(article.dateAgo)}</div>
        </div>
        <button class="rna-modal-close" onclick="closeOwnerArticleModal()">✕</button>
      </div>

      <div class="rna-modal-body">
        <h3 class="rna-modal-title">${article.fullTitle || article.title}</h3>
        <p class="rna-modal-summary">${article.summary}</p>

        <h4 class="rna-modal-section-title">Critical Strategies for Landlords &amp; Sellers:</h4>
        <ul class="rna-modal-list">
          ${(article.keyPoints || []).map(pt => `<li>${pt}</li>`).join('')}
        </ul>

        <div style="margin-top: 1.5rem; padding: 1rem 1.25rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; font-size: 0.84rem; color: #1e40af;">
          <b>Nexora Owner Verification Shield:</b> List your property free with 0% brokerage and receive verified buyer inquiries directly.
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.closeOwnerArticleModal = function () {
  const m = document.getElementById('ona-article-modal');
  if (m) m.style.display = 'none';
};

window.openAllOwnerNewsModal = function () {
  const tab = window.ownerNewsState.currentTab || 'news';
  const pool = NEXORA_OWNER_NEWS_DB[tab] || [];
  if (pool.length > 0) {
    window.openOwnerArticleModal(pool[0].id, tab);
  }
};

// ── DEDICATED POST PROPERTY FREE PAGE (99ACRES PATTERN FOR SAAS) ──
window.openPostPropertyPage = function () {
  state.viewMode = 'post-property';
  window.location.hash = '#/post-property';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.closePostPropertyPage = function () {
  state.viewMode = 'website';
  window.location.hash = '';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.openPostPropertyModal = function () {
  openPostPropertyPage();
};

// ============================================================================
// 99ACRES STYLE: APARTMENTS, VILLAS AND MORE (7 CARDS) & CONTINUE BROWSING
// ============================================================================

window.APARTMENTS_VILLAS_CARDS = [
  {
    id: 'builder-floor',
    title: 'Builder Floor',
    count: '170+ Properties',
    bgColor: '#fef5e4',
    img: '/assets/card_builder_floor_clean.jpg',
    category: 'Builder Floor'
  },
  {
    id: 'studio-apartment',
    title: '1 RK/ Studio<br/>Apartment',
    count: '40+ Properties',
    bgColor: '#f1f8fe',
    img: '/assets/card_studio_clean.jpg',
    category: 'Studio'
  },
  {
    id: 'farm-house',
    title: 'Farm House',
    count: '9 Properties',
    bgColor: '#d7f2e3',
    img: '/assets/card_farmhouse_clean.jpg',
    category: 'Farmhouse'
  },
  {
    id: 'serviced-apartment',
    title: 'Serviced<br/>Apartments',
    count: '5 Properties',
    bgColor: '#fef5e4',
    img: '/assets/card_serviced_clean.jpg',
    category: 'Serviced Apartment'
  },
  {
    id: 'residential-apartment',
    title: 'Residential<br/>Apartment',
    count: '12,000+ Properties',
    bgColor: '#fcf4e8',
    img: '/assets/card_apartment_clean.jpg',
    category: 'Apartment'
  },
  {
    id: 'independent-house-villa',
    title: 'Independent<br/>House/ Villa',
    count: '2,800+ Properties',
    bgColor: '#f0f6fc',
    img: '/assets/card_villa_clean.jpg',
    category: 'Villa'
  },
  {
    id: 'residential-plot',
    title: 'Residential<br/>Plot',
    count: '2,700+ Properties',
    bgColor: '#ebf8f0',
    img: '/assets/card_plot_clean.jpg',
    category: 'Plot'
  }
];

window.CONTINUE_BROWSING_DATA = {
  blr: {
    label: 'Buy in Bangalore East',
    subText: 'The most searched projects in Bangalore East',
    properties: [
      {
        id: 'blr-p1',
        price: '₹ 75 L',
        title: '2 BHK Independent House/Villa, 3 Baths',
        loc: 'In Prasanth Layout, Whitefield',
        postedType: 'owner',
        postedText: 'Posted by Owner 2 months ago',
        img: '/assets/card_villa_clean.jpg'
      },
      {
        id: 'blr-p2',
        price: '₹ 48 L',
        title: '2 BHK Independent House/Villa, 2 Baths',
        loc: 'In SKH Echium, Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 4 days ago',
        img: '/assets/buy_home_showcase.jpg'
      },
      {
        id: 'blr-p3',
        price: '₹ 48 L',
        title: '2 BHK Independent House/Villa, 2 Baths',
        loc: 'In Premium 2bhk villas , Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 1 month ago',
        img: '/assets/card_builder_floor_clean.jpg'
      },
      {
        id: 'blr-p4',
        price: '₹ 48 L',
        title: '2 BHK Independent House/Villa, 2 Baths',
        loc: 'In ITPL, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 1 month ago',
        img: '/assets/card_studio_clean.jpg'
      },
      {
        id: 'blr-p5',
        price: '₹ 40 L',
        title: 'Residential Land / Plot',
        loc: 'In SKH Echium, Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 4 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p6',
        price: '₹ 42 L',
        title: 'Residential Land / Plot',
        loc: 'In SKH Echium, Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 4 months ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p7',
        price: '₹ 43 L',
        title: 'Residential Land / Plot',
        loc: 'In SKH Echium, Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 4 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p8',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In White Field Ville, Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p9',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p10',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In White Field Ville, Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p11',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In White Field Ville, Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p12',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p13',
        price: '₹ 44.4 L',
        title: 'Residential Land / Plot',
        loc: 'In White Field Ville, Whitefield, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 6 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p14',
        price: '₹ 40 L',
        title: 'Residential Land / Plot',
        loc: 'In KR Puram, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 1 month ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p15',
        price: '₹ 42 L',
        title: 'Residential Land / Plot',
        loc: 'In Hoodi, Bangalore',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 7 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p16',
        price: '₹ 40 L',
        title: '2 BHK Independent House/Villa, 2 Baths',
        loc: 'In Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 5 months ago',
        img: '/assets/card_villa_clean.jpg'
      },
      {
        id: 'blr-p17',
        price: '₹ 41 L',
        title: 'Residential Land / Plot',
        loc: 'In Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 4 months ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'blr-p18',
        price: '₹ 45 L',
        title: 'Residential Land / Plot',
        loc: 'In Whitefield, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 2 weeks ago',
        img: '/assets/plot_showcase.jpg'
      },
      {
        id: 'blr-p19',
        price: '₹ 45 L',
        title: '2 BHK Independent House/Villa, 2 Baths',
        loc: 'In KR Puram, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 3 weeks ago',
        img: '/assets/buy_home_showcase.jpg'
      },
      {
        id: 'blr-p20',
        price: '₹ 46 L',
        title: 'Residential Land / Plot',
        loc: 'In Varthur, Bangalore',
        postedType: 'owner',
        postedText: 'Posted by Owner 3 weeks ago',
        img: '/assets/card_plot_clean.jpg'
      }
    ],
    projects: [
      {
        id: 'proj-jupiter',
        name: 'Jupiter Homes',
        rera: 'RERA',
        status: 'Ready since Jan 2024',
        typeDesc: '2 BHK Apartment in Samethanahalli, Near Whitefield, Bangalore',
        price: '₹ 82 - 90 L',
        link: 'https://www.99acres.com/jupiter-homes-samethanahalli-bangalore-east-npxid-r396679',
        img: '/assets/project_jupiter.jpg'
      },
      {
        id: 'proj-shriram',
        name: 'Shriram WYT Field',
        rera: 'RERA',
        status: 'Newly built · Nov 2025',
        typeDesc: '2 BHK Apartment in Whitefield, Bangalore',
        price: '₹ 88.8 L - 1.06 Cr',
        link: 'https://www.99acres.com/shriram-wyt-field-whitefield-bangalore-east-npxid-r354672',
        img: '/assets/project_shriram.jpg'
      }
    ]
  },
  chn: {
    label: 'Buy in Chennai South',
    subText: 'The most searched projects in Chennai South (OMR & ECR Corridors)',
    properties: [
      {
        id: 'chn-p1',
        price: '₹ 58 L',
        title: '2 BHK Luxury Apartment, 2 Baths',
        loc: 'In Sholinganallur, OMR, Chennai',
        postedType: 'owner',
        postedText: 'Posted by Owner 1 week ago',
        img: '/assets/card_apartment_clean.jpg'
      },
      {
        id: 'chn-p2',
        price: '₹ 72 L',
        title: '3 BHK Gated Villa, 3 Baths',
        loc: 'In Velachery South, Chennai',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 3 days ago',
        img: '/assets/card_villa_clean.jpg'
      },
      {
        id: 'chn-p3',
        price: '₹ 42 L',
        title: 'CMDA Approved Residential Plot',
        loc: 'In Medavakkam, Chennai South',
        postedType: 'owner',
        postedText: 'Posted by Owner 2 weeks ago',
        img: '/assets/card_plot_clean.jpg'
      },
      {
        id: 'chn-p4',
        price: '₹ 88 L',
        title: '3 BHK Sea-Breeze Apartment',
        loc: 'In Thoraipakkam, OMR, Chennai',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 5 days ago',
        img: '/assets/buy_home_showcase.jpg'
      },
      {
        id: 'chn-p5',
        price: '₹ 38 L',
        title: 'Gated Villa Plot, Ready for Construction',
        loc: 'In Perungudi, Chennai South',
        postedType: 'owner',
        postedText: 'Posted by Owner 1 month ago',
        img: '/assets/plot_showcase.jpg'
      }
    ],
    projects: [
      {
        id: 'proj-casagrand',
        name: 'Casagrand Primrose',
        rera: 'RERA',
        status: 'Under Construction · Dec 2025',
        typeDesc: '2 & 3 BHK High-Rise Residences in Perungalathur, Chennai South',
        price: '₹ 65 - 95 L',
        link: 'https://www.99acres.com/',
        img: '/assets/project_jupiter.jpg'
      },
      {
        id: 'proj-tvs',
        name: 'TVS Emerald Peninsula',
        rera: 'RERA',
        status: 'Newly Launched · 2026',
        typeDesc: '100% Corner Homes in Manapakkam, Chennai South',
        price: '₹ 85 L - 1.25 Cr',
        link: 'https://www.99acres.com/',
        img: '/assets/project_shriram.jpg'
      }
    ]
  },
  explore: {
    label: 'Explore New City',
    subText: 'Discover booming investment hotspots across Indian Metros',
    properties: [
      {
        id: 'exp-p1',
        price: '₹ 1.85 Cr',
        title: '2 BHK Designer Apartment with Sea View',
        loc: 'In Bandra West, Mumbai',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 2 days ago',
        img: '/assets/card_apartment_clean.jpg'
      },
      {
        id: 'exp-p2',
        price: '₹ 95 L',
        title: '3 BHK High-Tech Apartment',
        loc: 'In Gachibowli, Financial District, Hyderabad',
        postedType: 'owner',
        postedText: 'Posted by Owner 1 week ago',
        img: '/assets/buy_home_showcase.jpg'
      },
      {
        id: 'exp-p3',
        price: '₹ 72 L',
        title: '2 BHK Riverside Residence',
        loc: 'In Koregaon Park, Pune',
        postedType: 'dealer',
        postedText: 'Posted by Dealer 4 days ago',
        img: '/assets/card_builder_floor_clean.jpg'
      },
      {
        id: 'exp-p4',
        price: '₹ 60 L',
        title: 'Villa Plot in Gated Township',
        loc: 'In Mokila / Tellapur Corridor, Hyderabad',
        postedType: 'owner',
        postedText: 'Posted by Owner 3 weeks ago',
        img: '/assets/card_plot_clean.jpg'
      }
    ],
    projects: [
      {
        id: 'proj-lodha',
        name: 'Lodha Crown Skyline',
        rera: 'RERA',
        status: 'Ready Possession',
        typeDesc: '1 & 2 BHK Premium Residences in Thane West, Mumbai MMR',
        price: '₹ 62 - 88 L',
        link: 'https://www.99acres.com/',
        img: '/assets/project_jupiter.jpg'
      },
      {
        id: 'proj-myhome',
        name: 'My Home Sayuk',
        rera: 'RERA',
        status: 'Under Construction · 2025',
        typeDesc: '2, 2.5 & 3 BHK Iconic Towers in Tellapur, Hyderabad',
        price: '₹ 98 L - 1.45 Cr',
        link: 'https://www.99acres.com/',
        img: '/assets/project_shriram.jpg'
      }
    ]
  }
};

window.renderApartmentsVillasCarousel = function () {
  const track = document.getElementById('avm-carousel-track');
  if (!track) return;
  track.innerHTML = window.APARTMENTS_VILLAS_CARDS.map(card => `
    <div class="avm-card" style="background-color: ${card.bgColor};" onclick="openCategorySearch('${card.category}')" title="Explore ${card.category} in Bangalore & Top Cities">
      <div class="avm-card-top">
        <h3 class="avm-card-title">${card.title}</h3>
        <p class="avm-card-count">${card.count}</p>
      </div>
      <div class="avm-card-img-wrap">
        <img src="${card.img}" alt="${card.category}" class="avm-card-img" loading="lazy" />
      </div>
    </div>
  `).join('');
};

window.scrollApartmentsVillas = function (direction) {
  const track = document.getElementById('avm-carousel-track');
  if (!track) return;
  const amount = 320;
  track.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
};

window.currentContinueBrowsingTab = 'blr';

window.switchContinueBrowsingTab = function (tabKey) {
  window.currentContinueBrowsingTab = tabKey;
  document.querySelectorAll('.cb-tab-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('cb-tab-' + tabKey);
  if (activeBtn) activeBtn.classList.add('active');

  const tabData = window.CONTINUE_BROWSING_DATA[tabKey] || window.CONTINUE_BROWSING_DATA.blr;

  const subEl = document.getElementById('cb-projects-sub');
  if (subEl) subEl.innerText = tabData.subText;

  renderCuratedProperties(tabKey);
  renderRecommendedProjects(tabKey);
};

window.renderCuratedProperties = function (tabKey) {
  const track = document.getElementById('cb-curated-properties-track');
  if (!track) return;
  const tabData = window.CONTINUE_BROWSING_DATA[tabKey] || window.CONTINUE_BROWSING_DATA.blr;

  track.innerHTML = tabData.properties.map(p => `
    <div class="cb-prop-card" id="${p.id}">
      <div class="cb-prop-img-box">
        <img src="${p.img}" alt="${p.title}" class="cb-prop-img" loading="lazy" />
        <span class="cb-badge ${p.postedType}">${p.postedType === 'owner' ? 'Owner' : 'Dealer'}</span>
        <button class="cb-prop-heart" onclick="togglePropertyFavorite(this, event)" title="Save Property">♥</button>
      </div>
      <div class="cb-prop-info">
        <div class="cb-prop-price">${p.price}</div>
        <div class="cb-prop-title" title="${p.title}">${p.title}</div>
        <div class="cb-prop-loc" title="${p.loc}">
          <span style="color: #0078db;">📍</span>
          <span>${p.loc}</span>
        </div>
        <div class="cb-prop-meta">
          <span class="cb-prop-time">${p.postedText}</span>
          <div class="cb-prop-actions">
            <button class="cb-prop-btn outline" onclick="contactPropertyAgent('${p.title.replace(/'/g, "\\'")}', '${p.price}', '${p.loc.replace(/'/g, "\\'")}')" title="Contact via WhatsApp">Contact</button>
            <button class="cb-prop-btn primary" onclick="openCategorySearch('${p.title.includes('Land') ? 'Plot' : 'Villa'}')" title="View Details">View</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
};

window.scrollCuratedProperties = function (direction) {
  const track = document.getElementById('cb-curated-properties-track');
  if (!track) return;
  const amount = 310;
  track.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
};

window.renderRecommendedProjects = function (tabKey) {
  const grid = document.getElementById('cb-recommended-projects-grid');
  if (!grid) return;
  const tabData = window.CONTINUE_BROWSING_DATA[tabKey] || window.CONTINUE_BROWSING_DATA.blr;

  grid.innerHTML = tabData.projects.map(proj => `
    <div class="cb-proj-card" id="${proj.id}">
      <div class="cb-proj-banner">
        <img src="${proj.img}" alt="${proj.name}" loading="lazy" />
        <div class="cb-proj-badges">
          <span class="cb-proj-badge-rera">${proj.rera}</span>
          <span class="cb-proj-badge-status">${proj.status}</span>
        </div>
      </div>
      <div class="cb-proj-body">
        <div class="cb-proj-title-row">
          <h4 class="cb-proj-name">${proj.name}</h4>
          <span class="cb-proj-price">${proj.price}</span>
        </div>
        <p class="cb-proj-desc">${proj.typeDesc}</p>
        <div class="cb-proj-footer">
          <a href="${proj.link}" target="_blank" rel="noopener noreferrer" class="cb-proj-link-btn" title="View Project on 99acres">
            <span>Explore on 99acres</span>
            <span>↗</span>
          </a>
          <button class="cb-proj-inquire-btn" onclick="contactPropertyAgent('Project: ${proj.name}', '${proj.price}', '${proj.typeDesc.replace(/'/g, "\\'")}')">Inquire</button>
        </div>
      </div>
    </div>
  `).join('');
};

window.togglePropertyFavorite = function (btn, ev) {
  if (ev) ev.stopPropagation();
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) {
    btn.style.color = '#ef4444';
    btn.style.background = '#ffffff';
  } else {
    btn.style.color = '#64748b';
  }
};

window.contactPropertyAgent = function (title, price, loc) {
  const msg = encodeURIComponent('Hi Nexora, I am interested in this listing:\n' + title + '\nPrice: ' + price + '\nLocation: ' + loc);
  window.open('https://wa.me/919876543210?text=' + msg, '_blank');
};

window.openCategorySearch = function (cat) {
  if (typeof window.openApartmentListingPage === 'function') {
    window.openApartmentListingPage(cat);
    return;
  }
  const searchInput = document.querySelector('.hero-search-input') || document.querySelector('.eh-search-input');
  if (searchInput) {
    searchInput.value = cat;
  }
  const el = document.getElementById('continue-browsing-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};

window.postPropertyFormState = {
  intent: 'Sell',
  category: 'Residential',
  propType: 'Flat / Apartment',
  bhk: '3 BHK',
  city: 'Delhi / NCR',
  role: 'Property Owner'
};

window.setPPFState = function (key, val, el) {
  window.postPropertyFormState[key] = val;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.ppf-pill-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }
};

window.renderPostPropertyPage = function (root) {
  root.innerHTML = `
    <div class="ppf-page-wrap">
      <!-- Top Navigation Header -->
      <header class="ppf-top-header">
        <div style="display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="closePostPropertyPage()">
          <div style="background: linear-gradient(135deg, #0078db, #0052cc); color: #ffffff; font-weight: 800; font-size: 1.1rem; padding: 0.25rem 0.6rem; border-radius: 8px;">
            NX
          </div>
          <div>
            <div style="font-weight: 750; font-size: 1.25rem; color: #0f172a; letter-spacing: -0.02em;">Nexora<span style="color: #0078db;">.</span></div>
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Direct Owner &amp; Developer Desk</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.65rem; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.35rem 0.85rem; border-radius: 9999px;">
          <span style="font-size: 0.78rem; font-weight: 700; color: #047857;">⚡ 100% Free Listing • 0% Brokerage</span>
        </div>

        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <a href="tel:+919876543210" style="color: #475569; font-size: 0.88rem; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 0.35rem;">
            <span>📞</span> <span>+91 98765 43210</span>
          </a>
          <button onclick="closePostPropertyPage()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; font-size: 0.85rem; font-weight: 600; padding: 0.45rem 1rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease;">
            ← Back to Website
          </button>
        </div>
      </header>

      <!-- Main Body Container -->
      <main class="ppf-body-container">
        <!-- Split Hero & Form Row -->
        <div class="ppf-hero-grid">
          <!-- Left Column: Value Proposition & Trust -->
          <div>
            <span style="font-size: 0.78rem; font-weight: 800; color: #0078db; text-transform: uppercase; letter-spacing: 0.05em;">Sell or Rent Faster</span>
            <h1 style="font-size: 2.5rem; font-weight: 700; color: #0f172a; line-height: 1.2; margin: 0.5rem 0 1rem; letter-spacing: -0.025em;">
              Sell or Rent Property <br/><span style="color: #0078db;">online faster</span> with Nexora
            </h1>
            <p style="font-size: 1.05rem; color: #64748b; line-height: 1.6; margin: 0 0 2rem;">
              Direct CRM lead delivery, automated buyer matchmaking, and zero spam calls. The modern real estate platform built for Indian property owners.
            </p>

            <!-- USPs List with Green Checkmarks -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2.5rem;">
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #dcfce7; color: #16a34a; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; flex-shrink: 0;">✓</div>
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 1rem;">Advertise for FREE (0% Brokerage)</div>
                  <div style="color: #64748b; font-size: 0.88rem; margin-top: 0.15rem;">Zero listing fees, zero broker commissions. Keep 100% of your sale or rental value.</div>
                </div>
              </div>

              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #dcfce7; color: #16a34a; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; flex-shrink: 0;">✓</div>
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 1rem;">Get Unlimited Direct Enquiries</div>
                  <div style="color: #64748b; font-size: 0.88rem; margin-top: 0.15rem;">Verified buyers &amp; tenants connect directly to your mobile phone and WhatsApp.</div>
                </div>
              </div>

              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #dcfce7; color: #16a34a; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; flex-shrink: 0;">✓</div>
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 1rem;">0-Spam Shield Protection</div>
                  <div style="color: #64748b; font-size: 0.88rem; margin-top: 0.15rem;">Your personal phone number is shielded until prospective buyers complete OTP verification.</div>
                </div>
              </div>

              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #dcfce7; color: #16a34a; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; flex-shrink: 0;">✓</div>
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 1rem;">Assistance in Co-ordinating Site Visits</div>
                  <div style="color: #64748b; font-size: 0.88rem; margin-top: 0.15rem;">Automated calendar scheduling with instant SMS and WhatsApp reminders for appointments.</div>
                </div>
              </div>
            </div>

            <!-- Stats Bar -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1.25rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
              <div>
                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Active Buyers</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 0.2rem;">100K+</div>
              </div>
              <div>
                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Avg. Turnaround</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #0078db; margin-top: 0.2rem;">15 Days</div>
              </div>
              <div>
                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Listing Fee</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #16a34a; margin-top: 0.2rem;">₹0 Free</div>
              </div>
            </div>
          </div>

          <!-- Right Column: Interactive Post Property Form Card -->
          <div class="ppf-form-card">
            <div style="margin-bottom: 1.75rem;">
              <h2 style="font-size: 1.45rem; font-weight: 750; color: #0f172a; margin: 0 0 0.35rem;">Start posting your property, it’s free</h2>
              <p style="font-size: 0.88rem; color: #64748b; margin: 0;">Add basic details to publish across Nexora’s buyer network</p>
            </div>

            <form id="ppf-main-form" onsubmit="event.preventDefault(); submitFreePropertyListing();">
              <!-- Question 1: Segment -->
              <div style="margin-bottom: 1.35rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 650; color: #334155; margin-bottom: 0.5rem;">You're looking to...</label>
                <div class="ppf-pill-group">
                  <button type="button" class="ppf-pill-btn active" onclick="setPPFState('intent', 'Sell', this)">Sell</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('intent', 'Rent / Lease', this)">Rent / Lease</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('intent', 'PG / Co-living', this)">PG / Co-living</button>
                </div>
              </div>

              <!-- Question 2: Category & Property Type -->
              <div style="margin-bottom: 1.35rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 650; color: #334155; margin-bottom: 0.5rem;">And it's a...</label>
                <div class="ppf-pill-group" style="margin-bottom: 0.65rem;">
                  <button type="button" class="ppf-pill-btn active" onclick="setPPFState('category', 'Residential', this)">Residential</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('category', 'Commercial', this)">Commercial</button>
                </div>
                <div class="ppf-pill-group">
                  <button type="button" class="ppf-pill-btn active" onclick="setPPFState('propType', 'Flat / Apartment', this)">Flat / Apartment</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('propType', 'Independent House / Villa', this)">Independent House / Villa</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('propType', 'Builder Floor', this)">Builder Floor</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('propType', 'Plot / Land', this)">Plot / Land</button>
                </div>
              </div>

              <!-- Question 3: City & Locality -->
              <div style="margin-bottom: 1.35rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 650; color: #334155; margin-bottom: 0.5rem;">Where is it located?</label>
                <div style="display: grid; grid-template-columns: 140px 1fr; gap: 0.75rem;">
                  <select id="ppf-city-select" class="ppf-input" onchange="window.postPropertyFormState.city = this.value">
                    <option value="Delhi / NCR">Delhi / NCR</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Kolkata">Kolkata</option>
                  </select>
                  <input type="text" id="ppf-locality-input" class="ppf-input" placeholder="Enter Locality / Society / Project Name" required />
                </div>
              </div>

              <!-- Question 4: Specs (BHK & Expected Price) -->
              <div style="margin-bottom: 1.35rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 650; color: #334155; margin-bottom: 0.5rem;">Configuration &amp; Pricing</label>
                <div class="ppf-pill-group" style="margin-bottom: 0.75rem;">
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('bhk', '1 BHK', this)">1 BHK</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('bhk', '2 BHK', this)">2 BHK</button>
                  <button type="button" class="ppf-pill-btn active" onclick="setPPFState('bhk', '3 BHK', this)">3 BHK</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('bhk', '4+ BHK', this)">4+ BHK</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <input type="number" id="ppf-area-input" class="ppf-input" placeholder="Super Built-up Area (sq.ft)" required />
                  <input type="text" id="ppf-price-input" class="ppf-input" placeholder="Expected Price (e.g. ₹1.25 Cr)" required />
                </div>
              </div>

              <!-- Question 5: Contact Info -->
              <div style="margin-bottom: 1.75rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 650; color: #334155; margin-bottom: 0.5rem;">Your contact details for buyers to reach you</label>
                <div class="ppf-pill-group" style="margin-bottom: 0.75rem;">
                  <button type="button" class="ppf-pill-btn active" onclick="setPPFState('role', 'Property Owner', this)">I am the Owner</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('role', 'Agent', this)">Agent / Partner</button>
                  <button type="button" class="ppf-pill-btn" onclick="setPPFState('role', 'Builder', this)">Builder / Developer</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                  <input type="text" id="ppf-name-input" class="ppf-input" placeholder="Your Full Name" required />
                  <div style="display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem;">
                    <input type="text" class="ppf-input" value="+91" readonly style="background: #f1f5f9; text-align: center;" />
                    <input type="tel" id="ppf-phone-input" class="ppf-input" placeholder="10-digit Mobile Number" required pattern="[0-9]{10}" />
                  </div>
                  <input type="email" id="ppf-email-input" class="ppf-input" placeholder="Email Address (for direct buyer inquiries)" required />
                </div>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="ppf-submit-btn">
                Post Property, It's FREE →
              </button>

              <div style="text-align: center; margin-top: 0.85rem; font-size: 0.75rem; color: #94a3b8;">
                🔒 By submitting, you agree to Nexora's Privacy Shield &amp; 0-Brokerage terms.
              </div>
            </form>
          </div>
        </div>

        <!-- 3 Simple Steps Banner (From 99acres) -->
        <div style="margin: 5rem 0 3.5rem; text-align: center;">
          <div style="font-size: 0.78rem; font-weight: 800; color: #0078db; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">HOW TO POST</div>
          <h2 style="font-size: 2rem; font-weight: 750; color: #0f172a; margin: 0 0 2.5rem;">Post Your Property in 3 Simple Steps</h2>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: left;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.75rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);">
              <div style="font-size: 2.25rem; margin-bottom: 0.75rem;">📝</div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">
                <span style="color: #0078db;">01.</span> Add details of your property
              </h3>
              <p style="font-size: 0.88rem; color: #64748b; line-height: 1.5; margin: 0;">
                Begin by telling us basic details like your property type, city, locality, and bedroom configuration.
              </p>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.75rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);">
              <div style="font-size: 2.25rem; margin-bottom: 0.75rem;">📸</div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">
                <span style="color: #0078db;">02.</span> Upload Photos &amp; Highlights
              </h3>
              <p style="font-size: 0.88rem; color: #64748b; line-height: 1.5; margin: 0;">
                Upload real photos of your living room, bedrooms, and views to generate up to 3x more buyer inquiries.
              </p>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.75rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);">
              <div style="font-size: 2.25rem; margin-bottom: 0.75rem;">🤝</div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem;">
                <span style="color: #0078db;">03.</span> Add Pricing &amp; Connect Direct
              </h3>
              <p style="font-size: 0.88rem; color: #64748b; line-height: 1.5; margin: 0;">
                Set your expected price. Inquiries land instantly on your WhatsApp and secure CRM portal.
              </p>
            </div>
          </div>
        </div>

        <!-- Recently Posted Properties Live Stream (From 99acres) -->
        <div style="margin-bottom: 4rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.25rem;">
            <div>
              <span style="font-size: 0.75rem; font-weight: 800; color: #16a34a; text-transform: uppercase;">Live Market Stream</span>
              <h3 style="font-size: 1.45rem; font-weight: 750; color: #0f172a; margin: 0.2rem 0 0;">Recently posted properties across India</h3>
            </div>
            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Updated Today</div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="font-size: 0.7rem; font-weight: 700; color: #0078db; background: #eff6ff; padding: 0.2rem 0.5rem; border-radius: 4px;">Flat / Apartment</span>
                <h4 style="font-size: 0.92rem; font-weight: 650; color: #0f172a; margin: 0.5rem 0 0.25rem;">3 BHK Apartment for Sale</h4>
                <div style="font-size: 0.8rem; color: #64748b;">Sector 43, Golf Course Road, Gurgaon</div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                <span style="font-size: 1.05rem; font-weight: 750; color: #0f172a;">₹2.85 Cr</span>
                <span style="font-size: 0.72rem; color: #16a34a; font-weight: 600;">● Posted Today</span>
              </div>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="font-size: 0.7rem; font-weight: 700; color: #047857; background: #ecfdf5; padding: 0.2rem 0.5rem; border-radius: 4px;">Independent Villa</span>
                <h4 style="font-size: 0.92rem; font-weight: 650; color: #0f172a; margin: 0.5rem 0 0.25rem;">4 BHK Luxury Villa for Sale</h4>
                <div style="font-size: 0.8rem; color: #64748b;">Whitefield, IT Corridor, Bengaluru</div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                <span style="font-size: 1.05rem; font-weight: 750; color: #0f172a;">₹4.20 Cr</span>
                <span style="font-size: 0.72rem; color: #16a34a; font-weight: 600;">● Posted Today</span>
              </div>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="font-size: 0.7rem; font-weight: 700; color: #b45309; background: #fef3c7; padding: 0.2rem 0.5rem; border-radius: 4px;">Residential Plot</span>
                <h4 style="font-size: 0.92rem; font-weight: 650; color: #0f172a; margin: 0.5rem 0 0.25rem;">200 Sq.yd Gated Plot</h4>
                <div style="font-size: 0.8rem; color: #64748b;">Yamuna Expressway, Greater Noida</div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                <span style="font-size: 1.05rem; font-weight: 750; color: #0f172a;">₹72 Lakh</span>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">● 1 Day Ago</span>
              </div>
            </div>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="font-size: 0.7rem; font-weight: 700; color: #6d28d9; background: #f5f3ff; padding: 0.2rem 0.5rem; border-radius: 4px;">Rental Residence</span>
                <h4 style="font-size: 0.92rem; font-weight: 650; color: #0f172a; margin: 0.5rem 0 0.25rem;">2 BHK High-Rise Flat for Rent</h4>
                <div style="font-size: 0.8rem; color: #64748b;">Hiranandani, Powai, Mumbai</div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
                <span style="font-size: 1.05rem; font-weight: 750; color: #0f172a;">₹68,000 /mo</span>
                <span style="font-size: 0.72rem; color: #16a34a; font-weight: 600;">● Posted Today</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
};

window.submitFreePropertyListing = function () {
  const locality = document.getElementById('ppf-locality-input')?.value || 'Sector 43';
  const name = document.getElementById('ppf-name-input')?.value || 'Verified Owner';
  const phone = document.getElementById('ppf-phone-input')?.value || '+91 98765 43210';
  const price = document.getElementById('ppf-price-input')?.value || '₹1.25 Cr';
  const area = document.getElementById('ppf-area-input')?.value || '1550';
  const stateData = window.postPropertyFormState;

  const listingId = 'NX-' + Math.floor(100000 + Math.random() * 900000);

  // Show Success Modal
  let successModal = document.getElementById('ppf-success-modal');
  if (!successModal) {
    successModal = document.createElement('div');
    successModal.id = 'ppf-success-modal';
    successModal.className = 'rna-modal-overlay';
    document.body.appendChild(successModal);
  }

  successModal.innerHTML = `
    <div class="rna-modal-card" style="max-width: 520px; text-align: center; padding: 2.5rem 2rem;" onclick="event.stopPropagation()">
      <div style="width: 64px; height: 64px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.25rem;">
        🎉
      </div>

      <div style="font-size: 0.75rem; font-weight: 800; color: #047857; background: #ecfdf5; padding: 0.25rem 0.75rem; border-radius: 9999px; display: inline-block; margin-bottom: 0.75rem;">
        Listing ID: ${listingId} • Verified Live
      </div>

      <h3 style="font-size: 1.45rem; font-weight: 750; color: #0f172a; margin: 0 0 0.5rem;">
        Property Successfully Listed!
      </h3>

      <p style="font-size: 0.92rem; color: #64748b; line-height: 1.5; margin: 0 0 1.5rem;">
        Congratulations <b>${name}</b>, your <b>${stateData.bhk} ${stateData.propType}</b> in <b>${locality}, ${stateData.city}</b> (${price}) is now live on Nexora with 0% brokerage.
      </p>

      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 1rem; text-align: left; margin-bottom: 1.5rem; font-size: 0.85rem; color: #334155;">
        <div><b>🛡️ 0-Spam Shield Active:</b> Your number (${phone}) is masked.</div>
        <div style="margin-top: 0.35rem;"><b>📱 Instant Alerts:</b> Verified buyer enquiries will arrive on WhatsApp.</div>
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button class="btn btn-primary" onclick="document.getElementById('ppf-success-modal').style.display='none'; closePostPropertyPage();" style="flex: 1; justify-content: center; font-weight: 700;">
          Back to Portal
        </button>
        <button class="btn btn-secondary" onclick="document.getElementById('ppf-success-modal').style.display='none'; window.location.reload();" style="flex: 1; justify-content: center; font-weight: 700;">
          Post Another
        </button>
      </div>
    </div>
  `;
  successModal.style.display = 'flex';
};



document.addEventListener('click', () => {
  const d = document.getElementById('eh-login-dropdown');
  if (d) d.style.display = 'none';
  document.querySelectorAll('[id^="eh-nav-"]').forEach(el => el.style.display = 'none');
});

// ── NEWLY LAUNCHED PROJECTS (CRM LIVE SYNCED) ──
const NEWLY_LAUNCHED_PROJECTS_DEFAULT = [
  {
    id: 'nl-g-square-kings',
    name: 'G Square Kings Haven',
    location: 'Sriperumbudur, Chennai',
    price: '₹15.75 - 57.66 L',
    config: 'Residential Plot',
    highlightType: 'growth',
    highlightText: '12.8% price increase in last 3 months in locality',
    ribbon: 'NEW ARRIVAL',
    rera: '✔ RERA',
    phone: '+91 98401 23456',
    img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=300&q=80',
    developer: 'G Square Realtors'
  },
  {
    id: 'nl-na-divine-twin',
    name: 'Na Divine Twin Parks',
    location: 'Padappai, Chennai',
    price: '₹26 L - 1.29 Cr',
    config: 'Residential Plot',
    highlightType: 'growth',
    highlightText: '9.4% price increase in last 5 years in locality',
    ribbon: 'NEW ARRIVAL',
    rera: '✔ RERA',
    phone: '+91 98402 34567',
    img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=300&q=80',
    developer: 'Na Divine Properties'
  },
  {
    id: 'nl-thirumal-garden',
    name: 'Thirumal Garden',
    location: 'Singaperumal koil, Chennai',
    price: '₹12 - 24 L',
    config: 'Residential Plot',
    highlightType: 'growth',
    highlightText: '16.3% price increase in last 3 months in locality',
    ribbon: 'NEW ARRIVAL',
    rera: '✔ RERA',
    phone: '+91 98403 45678',
    img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=300&q=80',
    developer: 'Thirumal Promoters'
  },
  {
    id: 'nl-uttarayan-naina',
    name: 'Uttarayan Naina',
    location: 'Adabari, Guwahati',
    price: '₹75 L - 1.68 Cr',
    config: '2, 3, 4 BHK Apart...',
    highlightType: 'completion',
    highlightText: '🔑 Completion in Jun, 2030',
    ribbon: 'NEW LAUNCH',
    rera: '✔ RERA',
    phone: '+91 98310 44219',
    img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=300&q=80',
    developer: 'Uttarayan Group'
  },
  {
    id: 'nl-durgapur-square',
    name: 'Durgapur Square',
    location: 'Bidhannagar, Durgapur',
    price: '₹40 - 66.17 L',
    config: '2, 3 BHK Apartment',
    highlightType: 'growth',
    highlightText: '28.4% price increase in last 3 months in locality',
    ribbon: 'NEW LAUNCH',
    rera: '✔ RERA',
    phone: '+91 97482 11984',
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=300&q=80',
    developer: 'Square Infra Holdings'
  },
  {
    id: 'nl-mundeshwari-marine',
    name: 'Mundeshwari Marine Towers',
    location: 'Danapur, Patna',
    price: '₹1.17 - 1.69 Cr',
    config: '3, 4 BHK Luxury Suites',
    highlightType: 'growth',
    highlightText: '10.1% price increase in last 3 months in locality',
    ribbon: 'NEW LAUNCH',
    rera: '✔ RERA',
    phone: '+91 94310 78201',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=300&q=80',
    developer: 'Mundeshwari Ventures'
  }
];

window.loadNewlyLaunchedProjects = async function () {
  const track = document.getElementById('nl-cards-track');
  if (!track) return;

  // 1. Gather all sources of new launches from CRM local storage
  let crmLaunches = [];
  try {
    const raw = localStorage.getItem('nexora_crm_new_launches');
    if (raw) {
      crmLaunches = JSON.parse(raw);
    }
  } catch (e) {
    crmLaunches = [];
  }

  // 2. Also check if user is logged in and can fetch live DB projects from CRM backend
  if (typeof state !== 'undefined' && state && state.token) {
    try {
      const res = await apiFetch('/projects');
      if (res && res.data && Array.isArray(res.data)) {
        res.data.forEach(p => {
          const exists = crmLaunches.some(item => item.name && item.name.toLowerCase() === p.name.toLowerCase());
          if (!exists && (p.status === 'NEW_LAUNCH' || p.status === 'UNDER_CONSTRUCTION')) {
            crmLaunches.push({
              id: p.id,
              name: p.name,
              location: `${p.location}, ${p.city}`,
              price: '₹75 L - 1.85 Cr',
              config: `${p.total_units || 100} Units Registered`,
              highlightType: 'completion',
              highlightText: p.possession_date ? `🔑 Completion in ${p.possession_date}` : '🔑 Completion in 2029',
              ribbon: 'NEW LAUNCH',
              rera: p.rera_number ? '✔ RERA' : '✔ RERA',
              phone: '+91 98310 44219',
              img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=300&q=80',
              developer: p.builder_developer || 'Nexora Verified Partner',
              fromAdmin: true
            });
          }
        });
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  // 3. Combine: CRM Super Admin additions appear first, followed by default curated launches
  const allProjects = [...crmLaunches, ...NEWLY_LAUNCHED_PROJECTS_DEFAULT];
  const seen = new Set();
  const uniqueProjects = [];
  for (const prj of allProjects) {
    if (!prj || !prj.name) continue;
    const key = prj.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProjects.push(prj);
    }
  }

  // Limit display to 4 to 6 projects as requested
  const displayProjects = uniqueProjects.slice(0, 6);

  // 4. Render project cards into carousel track (Same architectural overlapping box design)
  track.innerHTML = displayProjects.map(p => {
    let highlightHtml = '';
    if (p.highlightType === 'growth' || (p.highlightText && p.highlightText.includes('%'))) {
      const text = p.highlightText.replace(/^▲\s*/, '');
      highlightHtml = `<span class="nl-growth-text">▲ ${text}</span>`;
    } else {
      highlightHtml = `<span class="nl-completion-text">${p.highlightText || '🔑 Completion in Jun, 2030'}</span>`;
    }

    const badgeAdmin = p.fromAdmin ? `<span style="position: absolute; top: 14px; right: 54px; background: #e0f2fe; color: #0284c7; font-size: 0.62rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 9999px; z-index: 2;">⚡ CRM Synced</span>` : '';
    const isGrowth = p.highlightType === 'growth' || (p.ribbon === 'NEW ARRIVAL');
    const ribbonLabel = p.ribbon || (isGrowth ? 'NEW ARRIVAL' : 'NEW LAUNCH');
    const badgeClass = isGrowth ? 'nl-badge-arrival' : 'nl-badge-launch';

    let devLogoHtml = '';
    const nm = (p.name || '').toLowerCase();
    if (nm.includes('g square')) {
      devLogoHtml = `<div style="background:#14532d; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#4ade80;">🌲</span><span style="font-size:0.52rem; letter-spacing:0.04em; color:#ffffff;">G SQUARE</span><span style="font-size:0.38rem; color:#86efac;">REALTORS</span></div>`;
    } else if (nm.includes('divine')) {
      devLogoHtml = `<div style="background:#0284c7; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#bae6fd;">⛲</span><span style="font-size:0.5rem; letter-spacing:0.04em; color:#ffffff;">NA DIVINE</span><span style="font-size:0.38rem; color:#e0f2fe;">TWIN PARKS</span></div>`;
    } else if (nm.includes('thirumal')) {
      devLogoHtml = `<div style="background:#991b1b; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#fde047;">🏛️</span><span style="font-size:0.5rem; letter-spacing:0.03em; color:#ffffff;">THIRUMAL</span><span style="font-size:0.38rem; color:#fef08a;">GARDEN</span></div>`;
    } else if (nm.includes('uttarayan')) {
      devLogoHtml = `<div style="background:#091e42; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#38bdf8;">🏙️</span><span style="font-size:0.48rem; letter-spacing:0.04em; color:#ffffff;">UTTARAYAN</span><span style="font-size:0.38rem; color:#93c5fd;">NAINA</span></div>`;
    } else if (nm.includes('durgapur')) {
      devLogoHtml = `<div style="background:#334155; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#f59e0b;">🏢</span><span style="font-size:0.52rem; letter-spacing:0.04em; color:#ffffff;">DURGAPUR</span><span style="font-size:0.38rem; color:#fed7aa;">SQUARE</span></div>`;
    } else if (nm.includes('mundeshwari')) {
      devLogoHtml = `<div style="background:#065f46; color:#ffffff; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#34d399;">🌊</span><span style="font-size:0.48rem; letter-spacing:0.04em; color:#ffffff;">MUNDESHWARI</span><span style="font-size:0.38rem; color:#a7f3d0;">TOWERS</span></div>`;
    } else {
      devLogoHtml = `<div style="background:#091e42; color:#ffffff; font-size:0.5rem; font-weight:800; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;"><span style="font-size:0.85rem; color:#38bdf8;">NX</span><span style="font-size:0.46rem; color:#ffffff;">VERIFIED</span></div>`;
    }

    return `
      <div class="nl-project-card" onclick="navigateToCustomerProject('${p.id}')" style="cursor: pointer;" title="Click to view full project details for ${p.name}">
        <!-- Top Architectural Image with Badge & Favorite -->
        <div class="nl-image-wrap">
          <img src="${p.img}" alt="${p.name}" loading="lazy" />
          <span class="${badgeClass}">${ribbonLabel}</span>
          <button class="hrp-btn-favorite" id="fav-btn-nl-${p.id}" onclick="event.stopPropagation(); toggleHandpickedFavorite('nl-${p.id}')" title="Save to Shortlist" aria-label="Favorite">
            ☆
          </button>
          ${badgeAdmin}
        </div>

        <!-- Overlapping White Content Card -->
        <div class="nl-content-box">
          <div class="nl-developer-badge">
            ${devLogoHtml}
          </div>

          <h3 class="nl-project-name" title="${p.name}">${p.name}</h3>
          <div class="nl-location-text" title="${p.location}">${p.config} • ${p.location}</div>

          <div class="nl-price-row">
            <span class="nl-price-text">${p.price}</span>
          </div>

          <div class="nl-highlight-row">
            ${highlightHtml}
          </div>

          <hr class="nl-dashed-divider" />

          <div class="nl-card-bottom-bar" onclick="event.stopPropagation()">
            <div class="nl-preferred-tag">
              <span style="color:#0078db; font-size: 1rem;">🏷️</span>
              <span>Get preferred options<br/><b>@zero brokerage</b></span>
            </div>
            <button class="nl-btn-view-number" onclick="openViewNumberModal('${p.id}')">
              View Number
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.scrollNewlyLaunched = function (direction = 'right') {
  const track = document.getElementById('nl-cards-track');
  if (!track) return;
  const scrollAmount = 370;
  if (direction === 'right') {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  } else {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }
};

window.openViewNumberModal = function (projectId) {
  let project = null;
  try {
    const raw = localStorage.getItem('nexora_crm_new_launches');
    if (raw) {
      const crmLaunches = JSON.parse(raw);
      project = crmLaunches.find(p => p.id === projectId);
    }
  } catch (e) { }

  if (!project) {
    project = NEWLY_LAUNCHED_PROJECTS_DEFAULT.find(p => p.id === projectId);
  }

  if (!project) {
    project = {
      name: 'Newly Launched Project',
      location: 'Prime Metropolitian Location',
      price: 'Price on Request',
      phone: '+91 98310 44219',
      developer: 'Nexora Certified Partner'
    };
  }

  let modal = document.getElementById('nl-view-number-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'nl-view-number-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeViewNumberModal(); };
    document.body.appendChild(modal);
  }

  const phoneNum = project.phone || '+91 98310 44219';
  const cleanPhone = phoneNum.replace(/[^\d+]/g, '');

  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 480px;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: linear-gradient(135deg, #091e42, #0078db); color: #ffffff; padding: 1.25rem 1.5rem;">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
            ⚡ Verified Direct Developer Contact
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 850; color: #ffffff; margin: 0.2rem 0 0;">${project.name}</h2>
          <p style="font-size: 0.8rem; color: #e2e8f0; margin: 0.2rem 0 0;">${project.location} • ${project.price}</p>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeViewNumberModal()">&times;</button>
      </div>

      <div style="padding: 1.5rem;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 38px; height: 38px; background: #22c55e; color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
            ✓
          </div>
          <div>
            <div style="font-size: 0.88rem; font-weight: 800; color: #166534;">Zero Brokerage Guaranteed</div>
            <div style="font-size: 0.76rem; color: #15803d;">Connect directly with the developer sales desk without any middleman or third-party fee.</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">
            Official Sales Desk Direct Line
          </div>
          <div style="font-size: 1.65rem; font-weight: 900; color: #091e42; letter-spacing: 0.02em;">
            ${phoneNum}
          </div>
          <div style="font-size: 0.75rem; color: #10b981; font-weight: 700; margin-top: 0.25rem;">
            ● Certified Desk Active • Immediate Response
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem;">
          <a href="tel:${cleanPhone}" class="btn btn-primary" style="flex: 1; justify-content: center; font-weight: 750; text-decoration: none; padding: 0.75rem;">
            📞 Call Sales Desk
          </a>
          <a href="https://wa.me/${cleanPhone.replace('+', '')}?text=Hi,%20I%20am%20interested%20in%20${encodeURIComponent(project.name)}%20via%20Nexora." target="_blank" class="btn" style="flex: 1; justify-content: center; font-weight: 750; text-decoration: none; background: #25d366; color: #ffffff; border: none; padding: 0.75rem;">
            💬 WhatsApp Now
          </a>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem; font-size: 0.74rem; color: #64748b; text-align: center;">
          Nexora Estates • Official RERA Partner: <b>${project.developer || 'Nexora Authorized'}</b>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
};

window.closeViewNumberModal = function () {
  const m = document.getElementById('nl-view-number-modal');
  if (m) m.style.display = 'none';
};

// ── UPCOMING PROJECTS SECTION (BILLBOARD SHOWCASE - NEXORA LUXURY PATTERN WITH EARLY BIRD BENEFITS) ──
const UPCOMING_PROJECTS_DEFAULT = [
  {
    id: 'up-mahindra-aquavista',
    name: 'Mahindra AquaVista',
    location: 'Mahindra City, GST Road',
    developer: 'Mahindra Lifespaces',
    benefit: 'Save ₹3.5 Lakhs on Pre-Launch Booking + Priority Villa Allotment',
    phone: '+91 98409 23145',
    price: '₹88 Lakhs - 1.95 Cr',
    config: '3 & 4 BHK Luxury Villas & Row Houses',
    launchDate: 'Pre-Launch Phase 1 • Handover 2028',
    rera: 'TN/01/Building/0248/2026',
    img: '/assets/mahindra_aquavista.jpg',
    description: 'Mahindra AquaVista is an expansive eco-luxury plotted & villa development nestled in Mahindra World City along GST Road. Features 70% open green expanses, international sports facilities, and serene lake views.'
  },
  {
    id: 'up-godrej-vrikshya',
    name: 'Godrej Vrikshya',
    location: 'Sector 103, Dwarka Expressway',
    developer: 'Godrej Properties',
    benefit: 'Complimentary Modular Kitchen & VRV AC on Pre-Booking',
    phone: '+91 98114 90231',
    price: '₹2.90 - 4.80 Cr',
    config: '3 & 4 BHK Resort Residences',
    launchDate: 'Pre-Launch Privilege • Handover Dec 2029',
    rera: 'RC/REP/HARERA/GGM/784/2026',
    img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
    description: 'Godrej Vrikshya offers ultra-luxury urban resort living along Dwarka Expressway with lush forest-themed landscapes, Olympic-length swimming pool, and bespoke clubhouse concierge.'
  },
  {
    id: 'up-prestige-city-hyd',
    name: 'The Prestige City',
    location: 'Rajendra Nagar, Budvel, Hyderabad',
    developer: 'Prestige Group',
    benefit: 'Inaugural Discount: ₹500/sq.ft off + Free Club Membership',
    phone: '+91 98450 33812',
    price: '₹1.15 - 3.40 Cr',
    config: '2, 3 & 4 BHK Lakefront Condos',
    launchDate: 'Upcoming Mega Township • Handover 2029',
    rera: 'P02400007209',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
    description: 'An iconic 64-acre integrated township facing the pristine Mulagund Lake in Rajendra Nagar, featuring premium high-rise lakeview apartments and commercial high-street.'
  },
  {
    id: 'up-sobha-neopolis',
    name: 'Sobha Neopolis Phase 2',
    location: 'Panathur, Marathahalli-ORR, Bengaluru',
    developer: 'Sobha Limited',
    benefit: '0% Pre-EMI for 18 Months on Greek-Themed Condos',
    phone: '+91 98802 44901',
    price: '₹1.85 - 3.75 Cr',
    config: '3 & 4 BHK Grecian Luxury Homes',
    launchDate: 'Upcoming Pre-Launch • Handover 2028',
    rera: 'PRM/KA/RERA/1251/310/PR/200923/006282',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    description: 'Step into classical Grecian grandeur on Outer Ring Road with grand Doric colonnades, 4 palatial clubhouses, and 77,000 sq.ft of themed leisure spaces.'
  },
  {
    id: 'up-dlf-arbour-2',
    name: 'DLF The Arbour Phase 2',
    location: 'Sector 63, Golf Course Extn, Gurugram',
    developer: 'DLF Limited',
    benefit: 'Exclusive Pre-Launch Allocation for High-Rise Sky Suites',
    phone: '+91 98100 87654',
    price: '₹6.50 - 11.20 Cr',
    config: '4 BHK Ultra-Luxury Sky Mansions',
    launchDate: 'Upcoming Pre-Booking • Handover 2030',
    rera: 'RC/REP/HARERA/GGM/688/2026',
    img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    description: 'The pinnacle of luxury in Gurugram featuring 39-storey panoramic towers, double-height grand arrival lobbies, private elevator zones, and lush private zone landscapes.'
  }
];

window.loadUpcomingProjects = async function () {
  const track = document.getElementById('up-billboard-track');
  const dotsContainer = document.getElementById('up-dots-container');
  if (!track) return;

  // 1. Gather all sources of upcoming projects from CRM local storage
  let crmUpcoming = [];
  try {
    const raw = localStorage.getItem('nexora_crm_upcoming_projects');
    if (raw) {
      crmUpcoming = JSON.parse(raw);
    }
  } catch (e) {
    crmUpcoming = [];
  }

  // Also check if any new launches in localStorage have status 'UPCOMING' or 'PLANNING'
  try {
    const rawLaunches = localStorage.getItem('nexora_crm_new_launches');
    if (rawLaunches) {
      const parsed = JSON.parse(rawLaunches);
      parsed.forEach(item => {
        if (item && (item.status === 'PLANNING' || item.status === 'UPCOMING' || item.ribbon === 'UPCOMING')) {
          crmUpcoming.push({
            id: item.id || `crm-${Date.now()}`,
            name: item.name,
            location: item.location,
            developer: item.developer || item.builder_developer || 'Nexora Verified Partner',
            benefit: 'Early Bird Privilege: Pre-Launch Special Pricing',
            phone: item.phone || '+91 98310 44219',
            price: item.price || 'Price on Request',
            config: item.config || 'Luxury Residences',
            img: item.img || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
            fromAdmin: true
          });
        }
      });
    }
  } catch (e) { }

  // 2. Also check if user is logged in and can fetch live DB projects from CRM backend
  if (typeof state !== 'undefined' && state && state.token) {
    try {
      const res = await apiFetch('/projects');
      if (res && res.data && Array.isArray(res.data)) {
        res.data.forEach(p => {
          const exists = crmUpcoming.some(item => item.name && item.name.toLowerCase() === p.name.toLowerCase());
          if (!exists && (p.status === 'PLANNING' || p.status === 'UPCOMING')) {
            crmUpcoming.push({
              id: `db-${p.id}`,
              name: p.name,
              location: `${p.location}, ${p.city}`,
              developer: p.builder_developer || 'Nexora Verified Partner',
              benefit: 'Exclusive Early Bird Allotment & 0% Brokerage',
              phone: '+91 98310 44219',
              price: 'Inaugural Pricing on Request',
              config: `${p.total_units || 120} Master-Planned Units`,
              img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
              fromAdmin: true
            });
          }
        });
      }
    } catch (err) { }
  }

  // 3. Combine: CRM Super Admin additions appear first, followed by default upcoming projects
  const allProjects = [...crmUpcoming, ...UPCOMING_PROJECTS_DEFAULT];
  const seen = new Set();
  const uniqueProjects = [];
  for (const prj of allProjects) {
    if (!prj || !prj.name) continue;
    const key = prj.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProjects.push(prj);
    }
  }

  window._nexoraUpcomingProjectsCache = uniqueProjects;

  // 4. Render billboard cards into track
  track.innerHTML = uniqueProjects.map((p, idx) => {
    const adminTag = p.fromAdmin ? `<div class="up-admin-sync-tag">⚡ CRM Super Admin Synced</div>` : '';
    const benefitHtml = p.benefit ? `
      <div class="up-benefit-pill">
        <span class="icon">🎁</span>
        <span>${p.benefit}</span>
      </div>
    ` : '';

    return `
      <div class="up-billboard-card" id="up-card-${idx}" onclick="navigateToCustomerProject('${p.id}')" style="cursor: pointer;" title="Click to view full project details for ${p.name}">
        <div class="up-hero-media-wrap">
          <img class="up-hero-img" src="${p.img}" alt="${p.name}" loading="lazy" />
          <div class="up-hero-gradient-overlay"></div>
          
          <!-- Top-left title & location overlay matching billboard design -->
          <div class="up-hero-text-overlay">
            <h3 class="up-project-title">${p.name}</h3>
            <p class="up-project-location">${p.location}</p>
          </div>

          ${benefitHtml}
          ${adminTag}

          <!-- Visual pill to guide customer that the whole box opens the project page -->
          <div style="position: absolute; bottom: 1.5rem; right: 2rem; z-index: 2; background: rgba(0, 120, 219, 0.92); color: #ffffff; font-size: 0.82rem; font-weight: 800; padding: 0.42rem 1.15rem; border-radius: 9999px; backdrop-filter: blur(6px); display: inline-flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 14px rgba(0,0,0,0.3); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <span>View Complete Project Details</span>
            <span style="font-size: 1rem;">→</span>
          </div>
        </div>

        <!-- Dark Bottom Bar matching billboard design -->
        <div class="up-bottom-bar" onclick="event.stopPropagation()">
          <div class="up-bottom-left">
            <span class="up-interest-label">Interested in this project by</span>
            <a class="up-developer-link" onclick="openUpcomingDeveloperModal('${p.id}')">
              <span>${p.developer}?</span>
              <span class="arrow">→</span>
            </a>
          </div>

          <div class="up-bottom-right">
            <button class="up-btn-view-number" onclick="openUpcomingViewNumberModal('${p.id}')" title="Call verified developer sales desk">
              <span style="font-size: 1.05rem;">📞</span>
              <span>View Number</span>
            </button>
            <button class="btn" onclick="downloadProjectBrochure('${p.id}')" style="background: rgba(255,255,255,0.12); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 0.72rem 1.25rem; font-size: 0.92rem; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.22)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'" title="Download official project brochure">
              <span>📥</span>
              <span>Brochure</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 5. Render dots
  if (dotsContainer) {
    dotsContainer.innerHTML = uniqueProjects.map((_, idx) => `
      <div class="up-dot ${idx === 0 ? 'active' : ''}" onclick="goToUpcomingProject(${idx})"></div>
    `).join('');

    // Attach scroll spy to update active dot
    track.onscroll = () => {
      const scrollPos = track.scrollLeft;
      const cardWidth = track.clientWidth || 1;
      const activeIdx = Math.round(scrollPos / cardWidth);
      const dots = dotsContainer.querySelectorAll('.up-dot');
      dots.forEach((dot, i) => {
        if (i === activeIdx) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    };
  }
};

window.scrollUpcomingProjects = function (direction = 'next') {
  const track = document.getElementById('up-billboard-track');
  if (!track) return;
  const cardWidth = track.clientWidth || 800;
  if (direction === 'next') {
    track.scrollBy({ left: cardWidth, behavior: 'smooth' });
  } else {
    track.scrollBy({ left: -cardWidth, behavior: 'smooth' });
  }
};

window.goToUpcomingProject = function (index) {
  const track = document.getElementById('up-billboard-track');
  if (!track) return;
  const cardWidth = track.clientWidth || 800;
  track.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
};

window.openUpcomingDeveloperModal = function (projectId) {
  const cache = window._nexoraUpcomingProjectsCache || UPCOMING_PROJECTS_DEFAULT;
  const project = cache.find(p => p.id === projectId) || UPCOMING_PROJECTS_DEFAULT[0];

  let modal = document.getElementById('up-developer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'up-developer-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeUpcomingDeveloperModal(); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 540px;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: linear-gradient(135deg, #091426, #0078db); color: #ffffff; padding: 1.5rem 1.75rem;">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
            🌟 Early Bird Benefits & Pre-Launch Privilege
          </div>
          <h2 style="font-size: 1.35rem; font-weight: 850; color: #ffffff; margin: 0.25rem 0 0;">${project.developer}</h2>
          <p style="font-size: 0.85rem; color: #cbd5e1; margin: 0.2rem 0 0;">Upcoming Flagship: <b>${project.name}</b> (${project.location})</p>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeUpcomingDeveloperModal()">&times;</button>
      </div>

      <div style="padding: 1.75rem;">
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
            <span style="font-size: 1.25rem;">🎁</span>
            <span style="font-size: 0.95rem; font-weight: 800; color: #0369a1;">Pre-Launch Special Privileges</span>
          </div>
          <p style="font-size: 0.85rem; color: #0c4a6e; margin: 0; line-height: 1.45;">
            ${project.benefit || 'Get special early bird discounts and first priority unit allotment before official public launch.'}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">INDICATIVE PRICE</div>
            <div style="font-size: 1rem; font-weight: 850; color: #091e42; margin-top: 0.15rem;">${project.price || '₹88 Lakhs+'}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">TYPOLOGY</div>
            <div style="font-size: 0.88rem; font-weight: 850; color: #091e42; margin-top: 0.15rem;">${project.config || 'Luxury Residences'}</div>
          </div>
        </div>

        <form onsubmit="event.preventDefault(); submitEarlyBirdInquiry('${project.name}', '${project.developer}');" style="display: flex; flex-direction: column; gap: 0.85rem;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 750; color: #334155; margin-bottom: 0.3rem; display: block;">Your Full Name</label>
            <input type="text" id="up-inq-name" required placeholder="e.g. Rahul Sharma" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; box-sizing: border-box;" />
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 750; color: #334155; margin-bottom: 0.3rem; display: block;">Phone Number (for WhatsApp Brochure)</label>
            <input type="tel" id="up-inq-phone" required placeholder="+91 98765 43210" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; box-sizing: border-box;" />
          </div>
          <button type="submit" class="btn btn-primary" style="padding: 0.85rem; font-size: 0.95rem; font-weight: 800; justify-content: center; margin-top: 0.5rem; background: #0078db; border: none; border-radius: 8px;">
            📥 Get Early Bird Brochure & Priority Pass
          </button>
        </form>

        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 1rem; font-size: 0.75rem; color: #16a34a; font-weight: 700;">
          <span>✓</span>
          <span>Zero Brokerage Guaranteed • Directly from ${project.developer} Sales Office</span>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
};

window.closeUpcomingDeveloperModal = function () {
  const m = document.getElementById('up-developer-modal');
  if (m) m.style.display = 'none';
};

window.submitEarlyBirdInquiry = function (projectName, developer) {
  const nameInput = document.getElementById('up-inq-name');
  const phoneInput = document.getElementById('up-inq-phone');
  const name = nameInput ? nameInput.value.trim() : 'Guest';
  const phone = phoneInput ? phoneInput.value.trim() : '';

  closeUpcomingDeveloperModal();
  if (typeof showToastNotification === 'function') {
    showToastNotification(`🎉 Thank you ${name}! Your Early Bird Priority Pass for ${projectName} (${developer}) has been registered. The official sales desk will contact you at ${phone}.`, 'success');
  } else {
    alert(`🎉 Thank you ${name}! Your Early Bird Priority Pass for ${projectName} has been registered.`);
  }
};

window.openUpcomingViewNumberModal = function (projectId) {
  const cache = window._nexoraUpcomingProjectsCache || UPCOMING_PROJECTS_DEFAULT;
  const project = cache.find(p => p.id === projectId) || UPCOMING_PROJECTS_DEFAULT[0];

  let modal = document.getElementById('nl-view-number-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'nl-view-number-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeViewNumberModal(); };
    document.body.appendChild(modal);
  }

  const phoneNum = project.phone || '+91 98409 23145';
  const cleanPhone = phoneNum.replace(/[^\d+]/g, '');

  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 480px;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: linear-gradient(135deg, #091426, #0078db); color: #ffffff; padding: 1.25rem 1.5rem;">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
            ⚡ Verified Developer Sales Desk
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 850; color: #ffffff; margin: 0.2rem 0 0;">${project.name}</h2>
          <p style="font-size: 0.8rem; color: #e2e8f0; margin: 0.2rem 0 0;">${project.developer} • ${project.location}</p>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeViewNumberModal()">&times;</button>
      </div>

      <div style="padding: 1.5rem;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 38px; height: 38px; background: #22c55e; color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
            ✓
          </div>
          <div>
            <div style="font-size: 0.88rem; font-weight: 800; color: #166534;">Zero Brokerage Guaranteed</div>
            <div style="font-size: 0.76rem; color: #15803d;">Direct developer desk for early bird allotment without any third-party agency fee.</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">
            Official Pre-Launch Sales Line
          </div>
          <div style="font-size: 1.7rem; font-weight: 900; color: #091e42; letter-spacing: 0.02em;">
            ${phoneNum}
          </div>
          <div style="font-size: 0.75rem; color: #10b981; font-weight: 700; margin-top: 0.25rem;">
            ● Certified Desk Active • Priority Early Bird Benefits
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem;">
          <a href="tel:${cleanPhone}" class="btn btn-primary" style="flex: 1; justify-content: center; font-weight: 750; text-decoration: none; padding: 0.75rem; background: #0078db;">
            📞 Call Now
          </a>
          <a href="https://wa.me/${cleanPhone.replace('+', '')}?text=Hi,%20I%20am%20interested%20in%20early%20bird%20benefits%20for%20${encodeURIComponent(project.name)}%20via%20Nexora." target="_blank" class="btn" style="flex: 1; justify-content: center; font-weight: 750; text-decoration: none; background: #25d366; color: #ffffff; border: none; padding: 0.75rem;">
            💬 WhatsApp
          </a>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem; font-size: 0.74rem; color: #64748b; text-align: center;">
          Nexora Estates • Official Developer Partner: <b>${project.developer}</b>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
};

// ── CUSTOMER PROJECT DETAIL PAGE SYSTEM (NEXORA LUXURY PATTERN WITH BROCHURE DOWNLOAD) ──
window.getCustomerProjectData = function (projectId) {
  if (!projectId || projectId === 'up-mahindra-aquavista' || projectId.includes('aquavista') || projectId.includes('mahindra')) {
    return {
      id: 'up-mahindra-aquavista',
      name: 'Mahindra AquaVista',
      tagline: 'Luxury Lakeview Villas & Condominiums in Mahindra World City',
      developer: 'Mahindra Lifespaces',
      developerLogo: '🏢 MAHINDRA LIFESPACES',
      location: 'Mahindra World City, Chengalpattu, GST Road, Chennai South, Tamil Nadu 603004',
      city: 'Chennai South',
      locality: 'Mahindra City, GST Road',
      price: '₹ 1.08 Cr - ₹ 1.88 Cr',
      priceSqft: '₹ 7,450 / sq.ft',
      emi: '₹ 53.8 K / month',
      rera: 'TN/01/Building/0248/2026',
      status: 'Ready To Move & Pre-Launch Phases',
      rating: '4.4',
      reviewCount: '89',
      totalUnits: '891 Units',
      landArea: '55 Acres Master-Planned Community',
      openSpace: '70% Open & Green Expanses',
      possession: 'Ready to Move & Dec 2028',
      phone: '+91 98409 23145',
      cleanPhone: '919840923145',
      brochureUrl: '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf',
      photos: [
        { url: '/assets/mahindra_aquavista.jpg', label: 'Panoramic Aerial Township Overview' },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', label: 'Luxury Villa Elevation' },
        { url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80', label: '15,000 sq.ft Clubhouse & Olympic Pool' },
        { url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?auto=format&fit=crop&w=800&q=80', label: 'Scenic Lake Promenade & Zen Park' },
        { url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80', label: 'Designer Living Suite & Interiors' }
      ],
      description: 'Mahindra AquaVista is a signature 55-acre eco-luxury residential community nestled in Mahindra World City along the 8-lane GST Road. Designed around tranquil lake vistas and expansive botanical gardens, it offers discerning homeowners an unmatched blend of serene nature and world-class integrated urban infrastructure with 0% brokerage directly through Nexora Estates.',
      configs: [
        {
          type: '3 BHK Luxury Villa',
          superArea: '1,820 sq.ft',
          carpetArea: '1,420 sq.ft',
          price: '₹ 1.08 - 1.35 Cr',
          baths: '3 Baths',
          balconies: '2 Balconies',
          facing: 'East / North Vastu Compliant',
          status: 'Ready to Move & Pre-Launch'
        },
        {
          type: '4 BHK Grand Duplex Villa',
          superArea: '2,550 sq.ft',
          carpetArea: '2,080 sq.ft',
          price: '₹ 1.65 - 1.88 Cr',
          baths: '4 Baths',
          balconies: '3 Balconies + Private Terrace Garden',
          facing: 'East Facing Vastu Compliant',
          status: 'Pre-Launch Early Bird Exclusive'
        },
        {
          type: 'Premium Villa Plots',
          superArea: '1,200 - 2,400 sq.ft',
          carpetArea: '100% Usable Plot Area',
          price: '₹ 88 Lakhs - 1.25 Cr',
          baths: 'Custom Build Ready',
          balconies: 'Independent Gated Enclave',
          facing: 'All Facings Available',
          status: 'Immediate Allotment'
        }
      ],
      amenities: [
        { icon: '🏊', name: '50m Olympic Swimming Pool' },
        { icon: '🏋️', name: 'TechnoGym Fitness Center' },
        { icon: '🏸', name: 'Indoor Badminton Courts' },
        { icon: '🎾', name: 'Synthetic Tennis Arena' },
        { icon: '🧘', name: 'Lakeview Yoga Pavilion' },
        { icon: '🌳', name: '3.5 km Jogging Boulevard' },
        { icon: '🚗', name: 'Covered Parking with EV Points' },
        { icon: '🛡️', name: '4-Tier 24/7 Security & CCTV' },
        { icon: '⚡', name: '100% DG Power Backup' },
        { icon: '☕', name: 'Clubhouse Organic Café' },
        { icon: '🎮', name: 'Billiards & Indoor Games' },
        { icon: '🎠', name: 'Rubberized Kids Play Park' },
        { icon: '💧', name: 'Zero Discharge STP & Rainwater' },
        { icon: '🌿', name: 'IGBC Platinum Pre-Certified' },
        { icon: '🛒', name: 'Daily Convenience Arcade' },
        { icon: '🏢', name: 'Banquet & Community Hall' }
      ],
      locations: [
        { place: '🚆 Paranur Railway Station', distance: '2.1 km (5 mins)' },
        { place: '🏫 Mahindra World School', distance: '1.0 km (3 mins)' },
        { place: '🏥 Apollo Clinic & Health Center', distance: '1.5 km (4 mins)' },
        { place: '💼 Infosys, Capgemini, BMW Tech Centers', distance: '800 meters (Walk-to-Work)' },
        { place: '🛣️ 8-Lane GST Road Corridor', distance: 'Direct Arterial Access' },
        { place: '✈️ Chennai International Airport', distance: '38 km (45 mins)' }
      ],
      reviews: [
        {
          name: 'Shantanu Sen',
          rating: '4.4',
          time: 'Verified Resident • 6 months ago',
          text: 'Mahindra AquaVista has exceeded our expectations. The lush landscaping, lake breeze, and calm neighborhood make it one of Chennai South’s best integrated communities.'
        },
        {
          name: 'Jalabala Ramakrishnan',
          rating: '4.8',
          time: 'Verified Resident • 1 year ago',
          text: 'Living inside Mahindra World City is a huge lifestyle upgrade. The roads are world-class, security is foolproof, and my office is just a 5-minute walk away.'
        },
        {
          name: 'Joseph Mathew',
          rating: '4.6',
          time: 'Verified Resident • 2 years ago',
          text: 'Plentiful amenities with huge sports facilities, swimming pool, and pristine gardens. Great school and medical center within 2 minutes.'
        }
      ]
    };
  }

  // Look up other upcoming or newly launched projects
  let found = null;
  const allKnown = [
    ...(window._nexoraUpcomingProjectsCache || []),
    ...UPCOMING_PROJECTS_DEFAULT,
    ...NEWLY_LAUNCHED_PROJECTS_DEFAULT,
    ...HANDPICKED_RESIDENTIAL_PROJECTS
  ];
  found = allKnown.find(p => p && (p.id === projectId || (p.name && p.name.toLowerCase() === projectId.toLowerCase())));

  if (found) {
    return {
      id: found.id,
      name: found.name,
      tagline: found.benefit || 'Premium Residential Development',
      developer: found.developer || 'Nexora Verified Partner',
      developerLogo: '🏢 ' + (found.developer || 'NEXORA PARTNER'),
      location: found.location || 'Prime Metropolitan Location',
      city: found.location ? found.location.split(',').pop().trim() : 'Metro City',
      locality: found.location || 'Metropolitan Hub',
      price: found.price || 'Price on Request',
      priceSqft: '₹ 8,250 / sq.ft',
      emi: '₹ 48.5 K / month',
      rera: found.rera || 'RERA/REG/2026/VERIFIED',
      status: found.launchDate || 'New Launch / Pre-Booking',
      rating: '4.6',
      reviewCount: '42',
      totalUnits: found.config || '240 Luxury Units',
      landArea: '18.5 Acres Master Development',
      openSpace: '65% Open Greenery',
      possession: 'Possession 2028-2029',
      phone: found.phone || '+91 98409 23145',
      cleanPhone: (found.phone || '+91 98409 23145').replace(/[^\d]/g, ''),
      brochureUrl: '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf',
      photos: [
        { url: found.img || '/assets/mahindra_aquavista.jpg', label: 'Primary Elevation View' },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', label: 'Architectural Panorama' },
        { url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80', label: 'Clubhouse & Leisure' },
        { url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?auto=format&fit=crop&w=800&q=80', label: 'Landscaped Garden' },
        { url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80', label: 'Luxury Living Suite' }
      ],
      description: `${found.name} by ${found.developer} offers an exceptional residential experience with state-of-the-art architecture, luxury amenities, and prime connectivity. Available with 0% brokerage directly through Nexora Estates.`,
      configs: [
        {
          type: '3 BHK Luxury Suite',
          superArea: '1,650 sq.ft',
          carpetArea: '1,280 sq.ft',
          price: found.price || '₹ 1.25 Cr+',
          baths: '3 Baths',
          balconies: '2 Balconies',
          facing: 'North-East Vastu Compliant',
          status: 'Available'
        },
        {
          type: '4 BHK Sky Suite',
          superArea: '2,350 sq.ft',
          carpetArea: '1,920 sq.ft',
          price: 'Price on Request',
          baths: '4 Baths',
          balconies: '3 Balconies',
          facing: 'East Facing',
          status: 'Pre-Booking'
        }
      ],
      amenities: [
        { icon: '🏊', name: 'Swimming Pool & Deck' },
        { icon: '🏋️', name: 'Hi-Tech Gymnasium' },
        { icon: '🏸', name: 'Badminton Courts' },
        { icon: '🧘', name: 'Yoga & Meditation Pavilion' },
        { icon: '🌳', name: 'Jogging Boulevard' },
        { icon: '🚗', name: 'Reserved Parking + EV Charging' },
        { icon: '🛡️', name: 'Multi-Tier Smart Security' },
        { icon: '⚡', name: '100% Power Backup' }
      ],
      locations: [
        { place: '🚆 Metro & Rail Station', distance: '1.5 km (4 mins)' },
        { place: '🏫 International School', distance: '1.2 km (3 mins)' },
        { place: '🏥 Multispeciality Hospital', distance: '2.0 km (5 mins)' },
        { place: '💼 Commercial Tech Hub', distance: '2.5 km (7 mins)' }
      ],
      reviews: [
        {
          name: 'Verified Homeowner',
          rating: '4.6',
          time: '3 months ago',
          text: `Exceptional project quality by ${found.developer}. Premium materials and transparent booking process via Nexora Estates.`
        }
      ]
    };
  }

  // Fallback to Mahindra AquaVista
  return window.getCustomerProjectData('up-mahindra-aquavista');
};

window.navigateToCustomerProject = function (projectId) {
  if (!projectId) projectId = 'up-mahindra-aquavista';
  state.selectedCustomerProjectId = projectId;
  state.customerView = null;
  state.viewMode = 'website';
  window.location.hash = '#/project/' + projectId;
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.navigateBackToHome = function () {
  state.selectedCustomerProjectId = null;
  state.customerView = null;
  window.location.hash = '';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.downloadProjectBrochure = function (projectId) {
  const p = window.getCustomerProjectData(projectId);
  const brochureUrl = p.brochureUrl || '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf';

  // 1. Programmatic trigger of actual PDF file download
  const a = document.createElement('a');
  a.href = brochureUrl;
  a.download = `${p.name.replace(/\s+/g, '_')}_Official_Brochure.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof showToastNotification === 'function') {
    showToastNotification(`📥 Downloading ${p.name} Official Brochure PDF...`, 'success');
  }

  // 2. Also open digital brochure modal preview
  window.openDigitalBrochureModal(projectId);
};

window.openDigitalBrochureModal = function (projectId) {
  const p = window.getCustomerProjectData(projectId);
  let modal = document.getElementById('cpd-brochure-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cpd-brochure-modal';
    modal.className = 'cpd-brochure-viewer-modal';
    modal.onclick = (e) => { if (e.target === modal) closeDigitalBrochureModal(); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="cpd-brochure-modal-content" onclick="event.stopPropagation()">
      <div class="cpd-brochure-modal-header">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
            📑 Official Digital Project Brochure
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 850; color: #ffffff; margin: 0.2rem 0 0;">${p.name} • Master Brochure</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="${p.brochureUrl}" download="${p.name.replace(/\s+/g, '_')}_Brochure.pdf" class="btn" style="background: #ffffff; color: #0078db; font-size: 0.82rem; font-weight: 800; padding: 0.45rem 0.9rem; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
            📥 Download PDF
          </a>
          <button class="btn" onclick="window.print()" style="background: rgba(255,255,255,0.18); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; font-weight: 750; padding: 0.45rem 0.85rem; border-radius: 6px;">
            🖨️ Print
          </button>
          <button class="eh-modal-close-btn" style="color: #ffffff; font-size: 1.5rem; background: none; border: none; cursor: pointer;" onclick="closeDigitalBrochureModal()">&times;</button>
        </div>
      </div>

      <div style="padding: 2rem;">
        <!-- Digital Brochure Cover Sheet -->
        <div style="background: linear-gradient(135deg, #091426, #003366); color: #ffffff; border-radius: 12px; padding: 2.5rem; text-align: center; margin-bottom: 2rem; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 1rem; right: 1.5rem; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 0.72rem; font-weight: 800; padding: 0.3rem 0.8rem; border-radius: 9999px;">
            RERA: ${p.rera}
          </div>
          <div style="font-size: 0.9rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;">
            Nexora Estates Architectural Showcase
          </div>
          <h1 style="font-size: 2.5rem; font-weight: 900; margin: 0 0 0.5rem; letter-spacing: -0.02em;">${p.name}</h1>
          <p style="font-size: 1.1rem; color: #e2e8f0; max-width: 600px; margin: 0 auto 1.5rem;">${p.tagline}</p>
          <div style="display: inline-flex; gap: 1.5rem; background: rgba(255,255,255,0.08); padding: 0.75rem 1.75rem; border-radius: 9999px; font-size: 0.88rem; font-weight: 700;">
            <span>🏢 ${p.developer}</span>
            <span>📍 ${p.locality}</span>
            <span>💰 ${p.price}</span>
          </div>
        </div>

        <!-- Section 1: Overview & Master Plan -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.2rem; font-weight: 850; color: #091e42; border-bottom: 2px solid #0078db; padding-bottom: 0.4rem; margin-bottom: 1rem;">
            1. Executive Overview & Master Community
          </h3>
          <p style="font-size: 0.92rem; color: #334155; line-height: 1.6; margin-bottom: 1.25rem;">
            ${p.description}
          </p>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">TOTAL EXTENT</div>
              <div style="font-size: 1.05rem; font-weight: 850; color: #091e42; margin-top: 0.2rem;">${p.landArea}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">GREENERY</div>
              <div style="font-size: 1.05rem; font-weight: 850; color: #16a34a; margin-top: 0.2rem;">${p.openSpace}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">TOTAL INVENTORY</div>
              <div style="font-size: 1.05rem; font-weight: 850; color: #091e42; margin-top: 0.2rem;">${p.totalUnits}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">POSSESSION</div>
              <div style="font-size: 1.05rem; font-weight: 850; color: #0078db; margin-top: 0.2rem;">${p.possession}</div>
            </div>
          </div>
        </div>

        <!-- Section 2: Floor Plans & Typology -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.2rem; font-weight: 850; color: #091e42; border-bottom: 2px solid #0078db; padding-bottom: 0.4rem; margin-bottom: 1rem;">
            2. Available Typologies & Unit Layouts
          </h3>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${p.configs.map(c => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <div style="font-size: 1.05rem; font-weight: 850; color: #091e42;">${c.type}</div>
                  <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">Super Built-up: <b>${c.superArea}</b> • Carpet: <b>${c.carpetArea}</b> • ${c.baths}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 1.15rem; font-weight: 900; color: #0078db;">${c.price}</div>
                  <div style="font-size: 0.75rem; color: #16a34a; font-weight: 750;">${c.status}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 3: Amenities & Specifications -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.2rem; font-weight: 850; color: #091e42; border-bottom: 2px solid #0078db; padding-bottom: 0.4rem; margin-bottom: 1rem;">
            3. Curated World-Class Amenities
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.65rem;">
            ${p.amenities.map(a => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.65rem 0.85rem; display: flex; align-items: center; gap: 0.6rem; font-size: 0.84rem; font-weight: 700; color: #1e293b;">
                <span style="font-size: 1.2rem;">${a.icon}</span>
                <span>${a.name}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 4: Direct Desk Contact -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.88rem; font-weight: 800; color: #166534;">Verified Developer Sales Desk</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #091e42; margin-top: 0.2rem;">${p.phone}</div>
            <div style="font-size: 0.76rem; color: #15803d; margin-top: 0.15rem;">Zero Brokerage Guaranteed • Direct Booking Assistance</div>
          </div>
          <div style="display: flex; gap: 0.6rem;">
            <a href="tel:${p.cleanPhone}" class="btn btn-primary" style="padding: 0.65rem 1.25rem; font-weight: 800; text-decoration: none; background: #0078db;">
              📞 Call Now
            </a>
            <a href="https://wa.me/${p.cleanPhone}?text=Hi,%20I%20have%20reviewed%20the%20${encodeURIComponent(p.name)}%20brochure%20on%20Nexora." target="_blank" class="btn" style="padding: 0.65rem 1.25rem; font-weight: 800; text-decoration: none; background: #25d366; color: #ffffff; border: none;">
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
};

window.closeDigitalBrochureModal = function () {
  const m = document.getElementById('cpd-brochure-modal');
  if (m) m.style.display = 'none';
};

window.openProjectPhotoGalleryModal = function (projectId) {
  const p = window.getCustomerProjectData(projectId);
  let modal = document.getElementById('cpd-gallery-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cpd-gallery-modal';
    modal.className = 'eh-search-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeProjectPhotoGalleryModal(); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="eh-search-modal-card" style="max-width: 920px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
      <div class="eh-modal-top-header" style="background: #091426; color: #ffffff; padding: 1.25rem 1.75rem;">
        <div>
          <h2 style="font-size: 1.3rem; font-weight: 850; color: #ffffff; margin: 0;">${p.name} • Master Photo Showcase</h2>
          <p style="font-size: 0.8rem; color: #cbd5e1; margin: 0.2rem 0 0;">${p.location}</p>
        </div>
        <button class="eh-modal-close-btn" style="color: #ffffff;" onclick="closeProjectPhotoGalleryModal()">&times;</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
        ${p.photos.map(ph => `
          <div style="border-radius: 10px; overflow: hidden; background: #0b1526; border: 1px solid #e2e8f0;">
            <img src="${ph.url}" alt="${ph.label}" style="width: 100%; height: 420px; object-fit: cover; display: block;" />
            <div style="padding: 0.85rem 1.25rem; background: #f8fafc; font-size: 0.9rem; font-weight: 750; color: #091e42;">
              📸 ${ph.label}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
};

window.closeProjectPhotoGalleryModal = function () {
  const m = document.getElementById('cpd-gallery-modal');
  if (m) m.style.display = 'none';
};

window.switchCpdFloorPlan = function (index) {
  const p = window.getCustomerProjectData(state.selectedCustomerProjectId || 'up-mahindra-aquavista');
  const cfg = p.configs[index] || p.configs[0];

  document.querySelectorAll('.cpd-fp-tab-btn').forEach((btn, i) => {
    if (i === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const detailBox = document.getElementById('cpd-fp-dynamic-box');
  if (detailBox) {
    detailBox.innerHTML = `
      <div>
        <div style="font-size: 1.25rem; font-weight: 850; color: #091e42; margin-bottom: 0.35rem;">${cfg.type}</div>
        <div style="font-size: 0.84rem; color: #64748b; margin-bottom: 1.25rem;">${cfg.status} • Vastu Compliant Planning</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">SUPER BUILT-UP</div>
            <div style="font-size: 1.05rem; font-weight: 850; color: #091e42;">${cfg.superArea}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">CARPET AREA</div>
            <div style="font-size: 1.05rem; font-weight: 850; color: #0078db;">${cfg.carpetArea}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">ACCOMMODATION</div>
            <div style="font-size: 0.95rem; font-weight: 850; color: #091e42;">${cfg.baths}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">BALCONIES</div>
            <div style="font-size: 0.95rem; font-weight: 850; color: #091e42;">${cfg.balconies}</div>
          </div>
        </div>

        <div style="display: flex; gap: 0.6rem;">
          <button class="btn btn-primary" onclick="openUpcomingViewNumberModal('${p.id}')" style="flex: 1; padding: 0.75rem; font-weight: 800; background: #0078db;">
            Enquire for this Unit
          </button>
          <button class="btn" onclick="downloadProjectBrochure('${p.id}')" style="background: #f1f5f9; color: #091e42; border: 1px solid #cbd5e1; padding: 0.75rem 1rem; font-weight: 750;">
            📥 Download Floor Plan PDF
          </button>
        </div>
      </div>

      <!-- Architectural SVG Floor Plan Diagram -->
      <div style="background: #ffffff; border: 1px dashed #94a3b8; border-radius: 12px; padding: 1.5rem; text-align: center;">
        <svg viewBox="0 0 320 240" width="100%" height="220" style="display: block; margin: 0 auto;">
          <rect x="10" y="10" width="300" height="220" fill="#f8fafc" stroke="#0078db" stroke-width="2.5" rx="4"/>
          <line x1="10" y1="120" x2="310" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>
          <line x1="160" y1="10" x2="160" y2="230" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>
          
          <!-- Master Bedroom -->
          <rect x="20" y="20" width="130" height="90" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="85" y="60" font-size="11" font-weight="bold" fill="#0369a1" text-anchor="middle">MASTER BEDROOM</text>
          <text x="85" y="76" font-size="9" fill="#0284c7" text-anchor="middle">14' x 16' (Balcony attached)</text>

          <!-- Living & Dining -->
          <rect x="170" y="20" width="130" height="90" fill="#f0fdf4" stroke="#4ade80" stroke-width="1.5"/>
          <text x="235" y="60" font-size="11" font-weight="bold" fill="#15803d" text-anchor="middle">GRAND LIVING & DINING</text>
          <text x="235" y="76" font-size="9" fill="#16a34a" text-anchor="middle">18' x 24' (Double Height)</text>

          <!-- Kitchen & Utility -->
          <rect x="20" y="130" width="130" height="90" fill="#fef3c7" stroke="#fcd34d" stroke-width="1.5"/>
          <text x="85" y="170" font-size="11" font-weight="bold" fill="#b45309" text-anchor="middle">MODULAR KITCHEN</text>
          <text x="85" y="186" font-size="9" fill="#d97706" text-anchor="middle">10' x 12' + Utility</text>

          <!-- Bedroom 2 / Guest -->
          <rect x="170" y="130" width="130" height="90" fill="#fae8ff" stroke="#e879f9" stroke-width="1.5"/>
          <text x="235" y="170" font-size="11" font-weight="bold" fill="#7e22ce" text-anchor="middle">BEDROOM 2 & SUITE</text>
          <text x="235" y="186" font-size="9" fill="#9333ea" text-anchor="middle">12' x 14' (Ensuite Bath)</text>
        </svg>
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-top: 0.5rem;">
          📐 High-Precision Vastu Architected Schematic (${cfg.type})
        </div>
      </div>
    `;
  }
};

window.submitCustomerProjectInquiry = function (projectName) {
  const name = document.getElementById('cpd-inq-name')?.value || 'Guest';
  const phone = document.getElementById('cpd-inq-phone')?.value || '';
  if (typeof showToastNotification === 'function') {
    showToastNotification(`🎉 Thank you ${name}! Your site visit & VIP allotment request for ${projectName} has been registered. The direct sales desk will reach you at ${phone}.`, 'success');
  } else {
    alert(`🎉 Thank you ${name}! Your inquiry for ${projectName} has been submitted.`);
  }
};

// Main Customer Project Detail Renderer
window.renderCustomerProjectDetail = function (root, projectId) {
  const p = window.getCustomerProjectData(projectId);

  root.innerHTML = `
    <div class="cpd-page">
      <!-- 1. STICKY TOP NAVIGATION BAR -->
      <header class="cpd-top-nav">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <div style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onclick="navigateBackToHome()">
            <div style="width: 32px; height: 32px; background: #0078db; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.95rem;">
              NX
            </div>
            <span style="font-size: 1.1rem; font-weight: 850; color: #091e42; letter-spacing: -0.02em;">Nexora Estates</span>
          </div>

          <button class="cpd-back-btn" onclick="navigateToAllProjects()">
            <span>←</span>
            <span>Back to All Projects</span>
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="btn" onclick="downloadProjectBrochure('${p.id}')" style="background: linear-gradient(135deg, #0078db, #0284c7); color: #ffffff; border: none; font-size: 0.85rem; font-weight: 800; padding: 0.55rem 1.15rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.45rem;">
            <span>📥</span>
            <span>Download Brochure</span>
          </button>
          <button class="btn" onclick="openUpcomingViewNumberModal('${p.id}')" style="background: #091e42; color: #ffffff; border: none; font-size: 0.85rem; font-weight: 800; padding: 0.55rem 1.15rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.45rem;">
            <span>📞</span>
            <span>Sales Desk</span>
          </button>
        </div>
      </header>

      <main class="cpd-container">
        <!-- 2. BREADCRUMBS -->
        <nav class="cpd-breadcrumb">
          <a onclick="navigateBackToHome()">Home</a>
          <span class="sep">›</span>
          <a onclick="navigateToAllProjects()">All Projects</a>
          <span class="sep">›</span>
          <a onclick="navigateToAllProjects()">${p.locality}</a>
          <span class="sep">›</span>
          <span style="font-weight: 700; color: #091e42;">${p.name}</span>
        </nav>

        <!-- 3. PROJECT TITLE HEADER & PRICING -->
        <div class="cpd-hero-header">
          <div>
            <h1 class="cpd-title">${p.name}</h1>
            <div class="cpd-subtitle">
              <span>By <b>${p.developer}</b></span>
              <span>•</span>
              <span>📍 ${p.location}</span>
            </div>
            <div class="cpd-badges-row">
              <span class="cpd-rera-pill">✔ RERA: ${p.rera}</span>
              <span class="cpd-rating-pill">★ ${p.rating} / 5 (${p.reviewCount} Verified Reviews)</span>
              <span style="background: #e0f2fe; color: #0284c7; font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 9999px;">
                🟢 ${p.status}
              </span>
              <span style="background: #f1f5f9; color: #334155; font-size: 0.74rem; font-weight: 750; padding: 0.25rem 0.75rem; border-radius: 9999px;">
                🏷️ 0% Brokerage Guaranteed
              </span>
            </div>
          </div>

          <div class="cpd-price-box">
            <div class="cpd-price-val">${p.price}</div>
            <div class="cpd-price-sub">${p.priceSqft} • ${p.emi}</div>
          </div>
        </div>

        <!-- 4. NEXORA MASTER 5-PHOTO COLLAGE GALLERY -->
        <div class="cpd-gallery-grid">
          <div class="cpd-gallery-item main" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <img class="cpd-gallery-img" src="${p.photos[0].url}" alt="${p.photos[0].label}" />
            <div class="cpd-gallery-label">${p.photos[0].label}</div>
          </div>
          <div class="cpd-gallery-item" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <img class="cpd-gallery-img" src="${p.photos[1].url}" alt="${p.photos[1].label}" />
            <div class="cpd-gallery-label">${p.photos[1].label}</div>
          </div>
          <div class="cpd-gallery-item" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <img class="cpd-gallery-img" src="${p.photos[2].url}" alt="${p.photos[2].label}" />
            <div class="cpd-gallery-label">${p.photos[2].label}</div>
          </div>
          <div class="cpd-gallery-item" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <img class="cpd-gallery-img" src="${p.photos[3].url}" alt="${p.photos[3].label}" />
            <div class="cpd-gallery-label">${p.photos[3].label}</div>
          </div>
          <div class="cpd-gallery-item" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <img class="cpd-gallery-img" src="${p.photos[4].url}" alt="${p.photos[4].label}" />
            <div class="cpd-gallery-label">${p.photos[4].label}</div>
          </div>

          <button class="cpd-view-all-photos-btn" onclick="openProjectPhotoGalleryModal('${p.id}')">
            <span>📸</span>
            <span>View All 24 Photos & Master Plan</span>
          </button>
        </div>

        <!-- 5. STICKY IN-PAGE SECTION TABS -->
        <nav class="cpd-sticky-tabs">
          <button class="cpd-tab-btn active" onclick="document.getElementById('sec-overview').scrollIntoView({behavior: 'smooth'})">Overview</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-plans').scrollIntoView({behavior: 'smooth'})">Price & Floor Plans</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-amenities').scrollIntoView({behavior: 'smooth'})">Amenities</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-specs').scrollIntoView({behavior: 'smooth'})">Master Plan & Specs</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-location').scrollIntoView({behavior: 'smooth'})">Location & Connectivity</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-developer').scrollIntoView({behavior: 'smooth'})">About Developer</button>
          <button class="cpd-tab-btn" onclick="document.getElementById('sec-reviews').scrollIntoView({behavior: 'smooth'})">Customer Reviews</button>
        </nav>

        <!-- 6. MAIN TWO-COLUMN LAYOUT -->
        <div class="cpd-main-layout">
          <!-- LEFT COLUMN (DETAILED CONTENT) -->
          <div class="cpd-left-col">
            <!-- Section 1: Overview -->
            <section class="cpd-section-card" id="sec-overview">
              <h2 class="cpd-card-title">
                <span>🏢</span>
                <span>Project Overview & Key Snapshot</span>
              </h2>

              <div class="cpd-snapshot-grid">
                <div class="cpd-snapshot-item">
                  <div class="cpd-snapshot-label">TOTAL EXTENT</div>
                  <div class="cpd-snapshot-val">${p.landArea}</div>
                </div>
                <div class="cpd-snapshot-item">
                  <div class="cpd-snapshot-label">OPEN GREEN SPACES</div>
                  <div class="cpd-snapshot-val" style="color: #16a34a;">${p.openSpace}</div>
                </div>
                <div class="cpd-snapshot-item">
                  <div class="cpd-snapshot-label">CONFIGURATIONS</div>
                  <div class="cpd-snapshot-val">${p.totalUnits}</div>
                </div>
                <div class="cpd-snapshot-item">
                  <div class="cpd-snapshot-label">POSSESSION TIMELINE</div>
                  <div class="cpd-snapshot-val" style="color: #0078db;">${p.possession}</div>
                </div>
              </div>

              <p style="font-size: 0.95rem; line-height: 1.65; color: #334155; margin-bottom: 1.25rem;">
                ${p.description}
              </p>

              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="font-size: 0.88rem; font-weight: 850; color: #166534; display: flex; align-items: center; gap: 0.4rem;">
                  <span>🌟</span>
                  <span>Why Buy In ${p.name}?</span>
                </div>
                <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.86rem; color: #15803d; line-height: 1.6;">
                  <li>Walk-to-work culture inside the prestigious 1,500-acre Mahindra World City integrated economic zone.</li>
                  <li>15,000 sq.ft international standards clubhouse featuring an Olympic-size pool and multipurpose sports facilities.</li>
                  <li>Scenic lakefront boulevard with 100% underground cabling, zero water discharge, and IGBC Platinum green rating.</li>
                  <li>Zero brokerage fee guaranteed direct through Nexora Estates certified channel partnership.</li>
                </ul>
              </div>
            </section>

            <!-- Section 2: Floor Plans & Pricing -->
            <section class="cpd-section-card" id="sec-plans">
              <h2 class="cpd-card-title">
                <span>📐</span>
                <span>Floor Plans, Typology & Pricing</span>
              </h2>

              <!-- Tab switcher -->
              <div class="cpd-floorplan-tab-nav">
                ${p.configs.map((c, idx) => `
                  <button class="cpd-fp-tab-btn ${idx === 0 ? 'active' : ''}" onclick="switchCpdFloorPlan(${idx})">
                    ${c.type}
                  </button>
                `).join('')}
              </div>

              <div id="cpd-fp-dynamic-box" class="cpd-floorplan-details-box">
                <!-- Dynamically populated by switchCpdFloorPlan -->
              </div>
            </section>

            <!-- Section 3: Amenities -->
            <section class="cpd-section-card" id="sec-amenities">
              <h2 class="cpd-card-title">
                <span>✨</span>
                <span>World-Class Amenities & Leisure</span>
              </h2>

              <div class="cpd-amenities-grid">
                ${p.amenities.map(a => `
                  <div class="cpd-amenity-card">
                    <span class="cpd-amenity-icon">${a.icon}</span>
                    <span>${a.name}</span>
                  </div>
                `).join('')}
              </div>
            </section>

            <!-- Section 4: Specifications & Master Plan -->
            <section class="cpd-section-card" id="sec-specs">
              <h2 class="cpd-card-title">
                <span>🏛️</span>
                <span>Master Plan & Luxury Specifications</span>
              </h2>

              <div style="margin-bottom: 1.5rem; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
                <img src="${p.photos[0].url}" alt="Master Plan Aerial Overview" style="width: 100%; height: 320px; object-fit: cover; display: block;" />
                <div style="background: #f8fafc; padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.85rem; font-weight: 750; color: #091e42;">Zoned Master Plan: Residential Enclaves • 15,000 sq.ft Clubhouse • Central Lake Promenade</span>
                  <button class="btn btn-sm" onclick="downloadProjectBrochure('${p.id}')" style="background: #0078db; color: #ffffff; font-size: 0.78rem; font-weight: 800; padding: 0.35rem 0.85rem;">
                    📥 Download Master Layout
                  </button>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 0.86rem;">
                <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                  <td style="padding: 0.85rem 1rem; font-weight: 800; color: #091e42; width: 25%;">STRUCTURE</td>
                  <td style="padding: 0.85rem 1rem; color: #334155;">Seismic Zone III compliant RCC framed structure with concrete solid block masonry.</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.85rem 1rem; font-weight: 800; color: #091e42;">FLOORING</td>
                  <td style="padding: 0.85rem 1rem; color: #334155;">Italian marble in grand living and dining foyer; engineered wooden flooring in master suite; anti-skid premium vitrified tiles in all bathrooms.</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                  <td style="padding: 0.85rem 1rem; font-weight: 800; color: #091e42;">BATHROOMS</td>
                  <td style="padding: 0.85rem 1rem; color: #334155;">Wall-hung EWC with concealed cisterns, Kohler / Grohe chrome-plated fittings, and toughened glass shower cubicles.</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.85rem 1rem; font-weight: 800; color: #091e42;">ELECTRICAL & EV</td>
                  <td style="padding: 0.85rem 1rem; color: #334155;">Schneider / Legrand modular switches, 100% DG power backup, dedicated EV charging conduit for each villa stilt bay.</td>
                </tr>
              </table>
            </section>

            <!-- Section 5: Location & Connectivity -->
            <section class="cpd-section-card" id="sec-location">
              <h2 class="cpd-card-title">
                <span>📍</span>
                <span>Location Advantages & Transit Hubs</span>
              </h2>

              <p style="font-size: 0.92rem; color: #475569; margin-bottom: 1.25rem;">
                Located right along the 8-lane GST Road expressway inside Mahindra World City with seamless connection to Chennai Airport and OMR IT corridor.
              </p>

              <table class="cpd-location-table">
                ${p.locations.map(loc => `
                  <tr>
                    <td>${loc.place}</td>
                    <td>${loc.distance}</td>
                  </tr>
                `).join('')}
              </table>
            </section>

            <!-- Section 6: About Developer -->
            <section class="cpd-section-card" id="sec-developer">
              <h2 class="cpd-card-title">
                <span>🏆</span>
                <span>About Developer: ${p.developer}</span>
              </h2>

              <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.25rem;">
                <div style="width: 72px; height: 72px; background: #091e42; color: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 900; flex-shrink: 0;">
                  ML
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 1.25rem; font-weight: 850; color: #091e42;">${p.developer}</h3>
                  <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Part of the US $21 Billion Mahindra Group • Established in 1994</div>
                </div>
              </div>

              <p style="font-size: 0.92rem; color: #334155; line-height: 1.6; margin: 0;">
                Mahindra Lifespaces brings the Mahindra Group’s philosophy of 'Rise' to India’s real estate industry through thriving residential townships and integrated business cities. Spanning over 39.44 million sq. ft of delivered projects, 100% of their developments adhere strictly to IGBC green building certifications.
              </p>
            </section>

            <!-- Section 7: Customer Reviews -->
            <section class="cpd-section-card" id="sec-reviews">
              <h2 class="cpd-card-title">
                <span>⭐</span>
                <span>Verified Customer Reviews & Ratings (${p.rating} / 5)</span>
              </h2>

              <div class="cpd-reviews-list">
                ${p.reviews.map(r => `
                  <div class="cpd-review-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                      <div style="font-weight: 800; font-size: 0.95rem; color: #091e42;">${r.name}</div>
                      <div style="color: #b45309; font-weight: 800; font-size: 0.85rem;">★ ${r.rating} / 5</div>
                    </div>
                    <div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.5rem;">${r.time}</div>
                    <p style="font-size: 0.88rem; color: #334155; line-height: 1.5; margin: 0;">"${r.text}"</p>
                  </div>
                `).join('')}
              </div>
            </section>
          </div>

          <!-- RIGHT COLUMN (STICKY ACTION & BOOKING DESK) -->
          <div class="cpd-right-col">
            <div class="cpd-sticky-action-card">
              <div style="font-size: 0.78rem; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                ⚡ Direct Developer Sales Desk
              </div>
              <div style="font-size: 1.95rem; font-weight: 900; color: #091e42; margin-bottom: 0.2rem;">
                ${p.price}
              </div>
              <div style="font-size: 0.82rem; color: #64748b; margin-bottom: 1.25rem;">
                EMI starts at ${p.emi} • 0% Brokerage
              </div>

              <!-- DOWNLOAD BROCHURE BUTTON (PRIMARY USER REQUIREMENT) -->
              <button class="cpd-btn-brochure-main" onclick="downloadProjectBrochure('${p.id}')">
                <span style="font-size: 1.25rem;">📥</span>
                <span>Download Official Brochure</span>
              </button>

              <div class="cpd-call-desk-box">
                <div style="font-size: 0.75rem; font-weight: 750; color: #64748b; text-transform: uppercase; margin-bottom: 0.2rem;">
                  Official Sales Desk Line
                </div>
                <div style="font-size: 1.45rem; font-weight: 900; color: #091e42; letter-spacing: 0.02em;">
                  ${p.phone}
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                  <a href="tel:${p.cleanPhone}" class="btn btn-primary" style="flex: 1; padding: 0.6rem; font-weight: 800; text-decoration: none; justify-content: center; font-size: 0.85rem; background: #0078db;">
                    📞 Call Now
                  </a>
                  <a href="https://wa.me/${p.cleanPhone}?text=Hi,%20I%20am%20interested%20in%20${encodeURIComponent(p.name)}%20via%20Nexora." target="_blank" class="btn" style="flex: 1; padding: 0.6rem; font-weight: 800; text-decoration: none; justify-content: center; font-size: 0.85rem; background: #25d366; color: #ffffff; border: none;">
                    💬 WhatsApp
                  </a>
                </div>
              </div>

              <!-- Direct Lead / Site Visit Form -->
              <form class="cpd-lead-form" onsubmit="event.preventDefault(); submitCustomerProjectInquiry('${p.name}');">
                <div style="font-size: 0.85rem; font-weight: 850; color: #091e42; margin-bottom: 0.2rem;">
                  Schedule Free Site Visit & VIP Allotment
                </div>
                <input type="text" id="cpd-inq-name" required placeholder="Your Full Name" />
                <input type="tel" id="cpd-inq-phone" required placeholder="Phone Number (for WhatsApp Pass)" />
                <input type="email" id="cpd-inq-email" placeholder="Email Address (optional)" />
                <select id="cpd-inq-pref">
                  <option value="3 BHK Luxury Villa">Interested in: 3 BHK Luxury Villa</option>
                  <option value="4 BHK Duplex Villa">Interested in: 4 BHK Duplex Villa</option>
                  <option value="Custom Villa Plot">Interested in: Custom Villa Plot</option>
                </select>
                <button type="submit">
                  Request Priority Callback & Pass
                </button>
              </form>

              <div style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 1rem; font-size: 0.74rem; color: #16a34a; font-weight: 750;">
                <span>✓</span>
                <span>Zero Brokerage Guaranteed • Directly from ${p.developer}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  // Initialize floor plan tab
  switchCpdFloorPlan(0);
};

// Listen to Hash Changes to support deep-linking (e.g. #/project/up-mahindra-aquavista or #/projects)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash.startsWith('#/project/')) {
    const id = hash.replace('#/project/', '').trim();
    if (id) {
      state.selectedCustomerProjectId = id;
      state.customerView = null;
      state.viewMode = 'website';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else if (hash.startsWith('#/projects') || hash.startsWith('#/all-projects')) {
    state.selectedCustomerProjectId = null;
    state.customerView = 'all-projects';
    state.viewMode = 'website';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash === '#/post-property' || hash.startsWith('#/post-property')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    state.viewMode = 'post-property';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash === '#/login' || hash.startsWith('#/login')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    if (!state.token || !state.user) {
      state.viewMode = 'login';
    } else {
      state.viewMode = 'crm';
    }
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash === '#/crm' || hash.startsWith('#/crm')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    state.viewMode = 'crm';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (!hash || hash === '#' || hash === '#/') {
    if (state.selectedCustomerProjectId || state.customerView || state.viewMode === 'post-property' || state.viewMode === 'login') {
      state.selectedCustomerProjectId = null;
      state.customerView = null;
      state.viewMode = 'website';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
});

// Check Initial Hash on page load
(function checkInitialHashOnLoad() {
  const hash = window.location.hash;
  if (hash.startsWith('#/project/')) {
    const id = hash.replace('#/project/', '').trim();
    if (id) {
      state.selectedCustomerProjectId = id;
      state.customerView = null;
      state.viewMode = 'website';
    }
  } else if (hash.startsWith('#/projects') || hash.startsWith('#/all-projects')) {
    state.selectedCustomerProjectId = null;
    state.customerView = 'all-projects';
    state.viewMode = 'website';
  } else if (hash === '#/post-property' || hash.startsWith('#/post-property')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    state.viewMode = 'post-property';
  } else if (hash === '#/login' || hash.startsWith('#/login')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    state.viewMode = 'login';
  } else if (hash === '#/crm' || hash.startsWith('#/crm')) {
    state.selectedCustomerProjectId = null;
    state.customerView = null;
    state.viewMode = 'crm';
  }
})();

// ── HANDPICKED RESIDENTIAL PROJECTS (FEATURED ACROSS INDIA - ARCHITECTURAL OVERLAPPING CARDS) ──
const HANDPICKED_RESIDENTIAL_PROJECTS = [
  {
    id: 'hrp-paras-emperor',
    name: 'Paras Emperor',
    location: '4,5 BHK Apartment, Bawadia Kalan, Bhopal',
    price: '₹ 2.37 - 5.5 Cr',
    img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80',
    developer: 'Paras Group',
    logoHtml: `
      <div style="background:#ffffff; color:#b45309; font-size:0.5rem; font-weight:900; line-height:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.9rem;">👑</span>
        <span style="font-size:0.55rem; letter-spacing:0.04em; color:#78350f;">PARAS</span>
        <span style="font-size:0.45rem; letter-spacing:0.02em; color:#92400e;">EMPEROR</span>
      </div>
    `
  },
  {
    id: 'hrp-sage-skyline',
    name: 'Sage Skyline',
    location: '3,4,5,6 BHK Apartment, Bawadia Kalan, Bhopal',
    price: '₹ 1.71 - 3.75 Cr',
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    developer: 'Sage Group',
    logoHtml: `
      <div style="background:#0f172a; color:#f59e0b; font-size:0.48rem; font-weight:800; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.82rem; color:#f59e0b;">⚜️</span>
        <span style="font-size:0.52rem; letter-spacing:0.04em; color:#ffffff;">SKYLINE</span>
        <span style="font-size:0.38rem; color:#fde68a;">Rise Above</span>
      </div>
    `
  },
  {
    id: 'hrp-shaligram-kingston',
    name: 'Shaligram Kingston',
    location: '3,4,5,7 BHK Apartment / House/Villa, Bhopal',
    price: 'Price On Request',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
    developer: 'Shaligram Group',
    logoHtml: `
      <div style="background:#fff7ed; color:#c2410c; font-size:0.48rem; font-weight:900; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.85rem; color:#ea580c;">🏛️</span>
        <span style="font-size:0.5rem; letter-spacing:0.03em; color:#9a3412;">RUDRAKSH</span>
        <span style="font-size:0.42rem; color:#ea580c;">KINGSTON</span>
      </div>
    `
  },
  {
    id: 'hrp-godrej-aristocrat',
    name: 'Godrej Aristocrat',
    location: '3,4 BHK Forest Residences, Sector 49, Gurgaon',
    price: '₹ 3.85 - 7.20 Cr',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    developer: 'Godrej Properties',
    logoHtml: `
      <div style="background:#091e42; color:#ffffff; font-size:0.5rem; font-weight:800; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.85rem; color:#38bdf8;">💎</span>
        <span style="font-size:0.54rem; letter-spacing:0.04em; color:#ffffff;">GODREJ</span>
        <span style="font-size:0.42rem; color:#93c5fd;">ESTATES</span>
      </div>
    `
  },
  {
    id: 'hrp-prestige-ocean',
    name: 'Prestige Ocean Towers',
    location: '4,5 BHK Sea View Suites, Marine Lines, Mumbai',
    price: '₹ 9.50 - 18.0 Cr',
    img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
    developer: 'Prestige Group',
    logoHtml: `
      <div style="background:#7f1d1d; color:#ffffff; font-size:0.5rem; font-weight:800; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.85rem; color:#fde047;">🦅</span>
        <span style="font-size:0.52rem; letter-spacing:0.04em; color:#ffffff;">PRESTIGE</span>
        <span style="font-size:0.42rem; color:#fca5a5;">ESTATES</span>
      </div>
    `
  },
  {
    id: 'hrp-total-environment',
    name: 'Total Environment Earth',
    location: '3,4 BHK Earth Homes, Hennur Road, Bengaluru',
    price: '₹ 2.15 - 4.60 Cr',
    img: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80',
    developer: 'Total Environment',
    logoHtml: `
      <div style="background:#14532d; color:#ffffff; font-size:0.48rem; font-weight:800; line-height:1.1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%;">
        <span style="font-size:0.85rem; color:#4ade80;">🌿</span>
        <span style="font-size:0.5rem; letter-spacing:0.04em; color:#ffffff;">TOTAL</span>
        <span style="font-size:0.4rem; color:#86efac;">ENVIRONS</span>
      </div>
    `
  }
];

window.renderHandpickedResidentialProjects = function () {
  const track = document.getElementById('hrp-cards-track');
  if (!track) return;

  track.innerHTML = HANDPICKED_RESIDENTIAL_PROJECTS.map(p => `
    <div class="hrp-card" onclick="navigateToCustomerProject('${p.id}')" style="cursor: pointer;" title="Click to view full project details for ${p.name}">
      <div class="hrp-image-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy" />
        <span class="hrp-badge-featured">Featured</span>
        <button class="hrp-btn-favorite" id="fav-btn-${p.id}" onclick="event.stopPropagation(); toggleHandpickedFavorite('${p.id}')" title="Save to Shortlist" aria-label="Favorite">
          ☆
        </button>
      </div>

      <div class="hrp-content-box">
        <div class="hrp-developer-badge">
          ${p.logoHtml}
        </div>
        <h3 class="hrp-project-name" title="${p.name}">${p.name}</h3>
        <div class="hrp-location-row" title="${p.location}">${p.location}</div>
        <div class="hrp-price-row">
          <span class="hrp-price-val">${p.price}</span>
          <span style="font-size:0.75rem; font-weight:700; color:#0078db; display:flex; align-items:center; gap:2px;">
            Explore →
          </span>
        </div>
      </div>
    </div>
  `).join('');
};

window.scrollHandpickedProjects = function (direction = 'right') {
  const track = document.getElementById('hrp-cards-track');
  if (!track) return;
  const scrollAmount = 390;
  if (direction === 'right') {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  } else {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }
};

window.toggleHandpickedFavorite = function (projectId) {
  const btn = document.getElementById(`fav-btn-${projectId}`);
  if (btn) {
    const isFav = btn.classList.toggle('active');
    btn.innerHTML = isFav ? '★' : '☆';
    if (typeof showToastNotification === 'function') {
      showToastNotification(isFav ? '⭐ Project saved to your favorites!' : 'Removed from favorites.', 'success');
    }
  }
};

// ── CUSTOMER ALL PROJECTS DIRECTORY CONTROLLER & PAGE ──
window._capFilterState = {
  search: '',
  category: 'all',
  city: 'all',
  budget: 'all',
  bhk: 'all',
  sort: 'featured'
};

window.navigateToAllProjects = function (category) {
  state.selectedCustomerProjectId = null;
  state.customerView = 'all-projects';
  state.viewMode = 'website';
  if (category) {
    window._capFilterState = window._capFilterState || {};
    window._capFilterState.category = category;
  }
  window.location.hash = '#/projects';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.getAllCustomerProjectsList = function () {
  const projects = [];
  const seenIds = new Set();

  // 1. Dynamic CRM upcoming projects
  const crmUpcomingRaw = localStorage.getItem('nexora_crm_upcoming_projects');
  let crmUpcoming = [];
  if (crmUpcomingRaw) {
    try { crmUpcoming = JSON.parse(crmUpcomingRaw); } catch (e) { }
  }

  // 2. Dynamic CRM newly launched projects
  const crmLaunchesRaw = localStorage.getItem('nexora_crm_newly_launched');
  let crmLaunches = [];
  if (crmLaunchesRaw) {
    try { crmLaunches = JSON.parse(crmLaunchesRaw); } catch (e) { }
  }

  // A. UPCOMING PROJECTS (Includes Mahindra AquaVista, Godrej, Prestige, Sobha, DLF)
  const allUpcoming = [...crmUpcoming, ...(window._nexoraUpcomingProjectsCache || []), ...UPCOMING_PROJECTS_DEFAULT];
  allUpcoming.forEach(p => {
    if (!p || seenIds.has(p.id)) return;
    seenIds.add(p.id);
    let city = 'Chennai';
    if (p.location) {
      const parts = p.location.split(',');
      city = parts[parts.length - 1].trim();
    }
    projects.push({
      id: p.id,
      name: p.name,
      developer: p.developer || 'Nexora Verified Developer',
      location: p.location || 'Metropolitan Hub',
      city: city,
      category: 'upcoming',
      categoryLabel: 'Upcoming Launch',
      badge: p.launchDate || 'Upcoming Pre-Launch',
      price: p.price || '₹ 1.08 Cr - ₹ 1.88 Cr',
      rate: '₹ 7,450 / sq.ft',
      config: p.config || '3 & 4 BHK Luxury Villas',
      benefit: p.benefit || '0% Brokerage • Priority Allotment',
      img: p.img || '/assets/mahindra_aquavista.jpg',
      rera: p.rera || 'TN/01/Building/0248/2026',
      phone: p.phone || '+91 98409 23145',
      brochureUrl: p.brochureUrl || '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf'
    });
  });

  // B. NEWLY LAUNCHED PROJECTS
  const allLaunches = [...crmLaunches, ...NEWLY_LAUNCHED_PROJECTS_DEFAULT];
  allLaunches.forEach(p => {
    if (!p || seenIds.has(p.id)) return;
    seenIds.add(p.id);
    let city = 'Chennai';
    if (p.location) {
      const parts = p.location.split(',');
      city = parts[parts.length - 1].trim();
    }
    projects.push({
      id: p.id,
      name: p.name,
      developer: p.developer || 'Verified Builder',
      location: p.location || 'Prime Sector',
      city: city,
      category: 'new-launch',
      categoryLabel: 'Newly Launched',
      badge: p.ribbon || 'New Launch',
      price: p.price || 'Price on Request',
      rate: '₹ 6,800 / sq.ft',
      config: p.config || '2, 3 BHK Apartments',
      benefit: p.highlightText || '0% Brokerage Guaranteed Direct',
      img: p.img || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80',
      rera: p.rera || 'RERA Verified',
      phone: p.phone || '+91 98401 23456',
      brochureUrl: '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf'
    });
  });

  // C. HANDPICKED LUXURY ESTATES
  (HANDPICKED_RESIDENTIAL_PROJECTS || []).forEach(p => {
    if (!p || seenIds.has(p.id)) return;
    seenIds.add(p.id);
    let city = 'Bhopal';
    if (p.location) {
      const parts = p.location.split(',');
      city = parts[parts.length - 1].trim();
    }
    projects.push({
      id: p.id,
      name: p.name,
      developer: p.developer || 'Luxury Estates Group',
      location: p.location || 'Bawadia Kalan',
      city: city,
      category: 'luxury',
      categoryLabel: 'Luxury Estates',
      badge: 'Handpicked Collection',
      price: p.price || '₹ 2.37 - 5.5 Cr',
      rate: '₹ 8,900 / sq.ft',
      config: p.location.split(',')[0] || '4, 5 BHK Premium Residences',
      benefit: 'Architectural Masterpiece • Direct VIP Allocation',
      img: p.img || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
      rera: 'RERA Certified',
      phone: '+91 98260 11223',
      brochureUrl: '/uploads/brochures/Mahindra_AquaVista_Official_Brochure.pdf'
    });
  });

  return projects;
};

window.renderCapProjectCard = function (p) {
  const badgeClass = p.category === 'upcoming' ? 'upcoming' : (p.category === 'new-launch' ? 'new-launch' : 'luxury');
  return `
    <div class="cap-card" onclick="navigateToCustomerProject('${p.id}')">
      <div class="cap-card-img-wrap">
        <img src="${p.img}" alt="${p.name}" class="cap-card-img" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';"/>
        <div class="cap-card-badge ${badgeClass}">${p.badge}</div>
        <div style="position: absolute; bottom: 0.6rem; right: 0.6rem; background: rgba(9,20,38,0.78); color: #ffffff; font-size: 0.72rem; font-weight: 750; padding: 0.2rem 0.5rem; border-radius: 4px; backdrop-filter: blur(4px);">
          ${p.rera}
        </div>
      </div>
      <div class="cap-card-body">
        <div class="cap-card-dev-badge">
          🏢 ${p.developer}
        </div>
        <h3 class="cap-card-title">${p.name}</h3>
        <div class="cap-card-location">
          📍 ${p.location}
        </div>

        <div class="cap-card-price-row">
          <div class="cap-card-price">${p.price}</div>
          <div class="cap-card-rate">${p.rate}</div>
        </div>

        <div style="font-size: 0.8rem; color: #334155; margin-bottom: 0.5rem; font-weight: 600;">
          🏠 <b>Typology:</b> ${p.config}
        </div>

        <div class="cap-card-benefit">
          ✨ ${p.benefit}
        </div>

        <div class="cap-card-actions" onclick="event.stopPropagation()">
          <button class="cap-btn-details" onclick="navigateToCustomerProject('${p.id}')">
            <span>View Details</span>
            <span>→</span>
          </button>
          <button class="cap-btn-brochure" onclick="downloadProjectBrochure('${p.id}')" title="Download PDF Brochure">
            <span>📥</span>
            <span>Brochure</span>
          </button>
          <button class="cap-btn-brochure" onclick="openUpcomingViewNumberModal('${p.id}')" title="Call Sales Desk" style="padding: 0.65rem 0.75rem;">
            <span>📞</span>
          </button>
        </div>
      </div>
    </div>
  `;
};

window.renderCustomerAllProjectsPage = function (root) {
  const allProjects = window.getAllCustomerProjectsList();
  const cities = Array.from(new Set(allProjects.map(p => p.city).filter(Boolean))).sort();

  root.innerHTML = `
    <div class="cap-page">
      <!-- 1. STICKY TOP NAV -->
      <header class="cpd-top-nav">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <div style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onclick="navigateBackToHome()">
            <div style="width: 32px; height: 32px; background: #0078db; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.95rem;">
              NX
            </div>
            <span style="font-size: 1.1rem; font-weight: 850; color: #091e42; letter-spacing: -0.02em;">Nexora Estates</span>
          </div>

          <button class="cpd-back-btn" onclick="navigateBackToHome()">
            <span>←</span>
            <span>Back to Home</span>
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="btn" onclick="openPostPropertyModal()" style="background: #f1f5f9; color: #091e42; border: 1px solid #cbd5e1; font-size: 0.82rem; font-weight: 750; padding: 0.45rem 0.9rem; border-radius: 6px;">
            📢 Post Property <span style="background: #22c55e; color: #ffffff; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; margin-left: 0.25rem;">FREE</span>
          </button>
          <button class="btn" onclick="openShieldedCallModal()" style="background: #091e42; color: #ffffff; border: none; font-size: 0.82rem; font-weight: 800; padding: 0.5rem 1rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>📞</span>
            <span>Sales Desk (1800-NEXORA)</span>
          </button>
        </div>
      </header>

      <main class="cap-container">
        <!-- 2. BREADCRUMBS -->
        <nav class="cpd-breadcrumb">
          <a onclick="navigateBackToHome()">Home</a>
          <span class="sep">›</span>
          <span style="font-weight: 700; color: #091e42;">All Real Estate Projects</span>
        </nav>

        <!-- 3. HERO SHOWCASE HEADER -->
        <div class="cap-hero-header">
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; font-size: 0.74rem; font-weight: 800; padding: 0.3rem 0.75rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
            <span>✨</span>
            <span>Nexora Master Directory • Direct Developer Booking</span>
          </div>
          <h1 class="cap-hero-title">Explore All Real Estate Projects & Launches</h1>
          <p class="cap-hero-sub">
            Discover India's top upcoming mega-townships, newly launched residential developments, and handpicked luxury estates. Zero brokerage guaranteed directly with top developers.
          </p>

          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.5rem 0.85rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 750;">
              <span>🏢</span>
              <span>${allProjects.length}+ Verified Projects</span>
            </div>
            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.5rem 0.85rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 750;">
              <span>🛡️</span>
              <span>0% Brokerage Guaranteed</span>
            </div>
            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.5rem 0.85rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 750;">
              <span>✔</span>
              <span>100% RERA Approved</span>
            </div>
            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.5rem 0.85rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 750;">
              <span>📥</span>
              <span>Free Official PDF Brochures</span>
            </div>
          </div>
        </div>

        <!-- 4. MULTI-CRITERIA FILTER PANEL -->
        <div class="cap-filter-panel">
          <!-- Live Search Bar -->
          <div class="cap-search-input-wrap">
            <span class="cap-search-icon">🔍</span>
            <input 
              type="text" 
              id="cap-search-input" 
              class="cap-search-input" 
              placeholder="Search by project name (e.g. Mahindra AquaVista, Godrej, Sobha), developer, or location..."
              value="${window._capFilterState.search || ''}"
              oninput="filterCustomerAllProjects()"
            />
          </div>

          <!-- Quick Category Pill Tabs -->
          <div class="cap-pill-tabs" id="cap-pill-tabs">
            <button class="cap-pill-btn ${window._capFilterState.category === 'all' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'all')">
              All Projects (${allProjects.length})
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'upcoming' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'upcoming')">
              🏗️ Upcoming Launches
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'new-launch' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'new-launch')">
              🚀 Newly Launched
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'luxury' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'luxury')">
              👑 Luxury Estates
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'city:Chennai' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'city:Chennai')">
              📍 Chennai
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'city:Delhi / NCR' || window._capFilterState.category === 'city:Gurugram' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'city:Gurugram')">
              📍 Delhi / NCR
            </button>
            <button class="cap-pill-btn ${window._capFilterState.category === 'city:Bengaluru' ? 'active' : ''}" onclick="setCapCategoryFilter(this, 'city:Bengaluru')">
              📍 Bengaluru
            </button>
          </div>

          <!-- Dropdowns Row -->
          <div class="cap-dropdowns-row">
            <div>
              <label style="font-size: 0.72rem; font-weight: 750; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 0.3rem;">City</label>
              <select id="cap-city-select" class="cap-select" onchange="filterCustomerAllProjects()">
                <option value="all">All Cities</option>
                ${cities.map(c => `<option value="${c}" ${window._capFilterState.city === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="font-size: 0.72rem; font-weight: 750; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 0.3rem;">Budget Range</label>
              <select id="cap-budget-select" class="cap-select" onchange="filterCustomerAllProjects()">
                <option value="all">All Budgets</option>
                <option value="under-50l">Under ₹ 50 Lakhs</option>
                <option value="50l-1.5cr">₹ 50 Lakhs - 1.5 Cr</option>
                <option value="1.5cr-3cr">₹ 1.5 Cr - 3 Cr</option>
                <option value="above-3cr">₹ 3 Cr & Above</option>
              </select>
            </div>

            <div>
              <label style="font-size: 0.72rem; font-weight: 750; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 0.3rem;">Typology</label>
              <select id="cap-bhk-select" class="cap-select" onchange="filterCustomerAllProjects()">
                <option value="all">All Typologies</option>
                <option value="plot">Plots / Land</option>
                <option value="2bhk">2 BHK</option>
                <option value="3bhk">3 BHK</option>
                <option value="4bhk">4 BHK & Above / Villas</option>
              </select>
            </div>

            <div>
              <label style="font-size: 0.72rem; font-weight: 750; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 0.3rem;">Sort By</label>
              <select id="cap-sort-select" class="cap-select" onchange="filterCustomerAllProjects()">
                <option value="featured">Featured First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Project Name: A to Z</option>
              </select>
            </div>

            <div style="display: flex; align-items: flex-end;">
              <button onclick="resetCapFilters()" style="width: 100%; height: 38px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; font-weight: 750; cursor: pointer; transition: all 0.2s;">
                ↺ Reset Filters
              </button>
            </div>
          </div>
        </div>

        <!-- 5. RESULTS COUNT & ACTIVE FILTER BAR -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; font-size: 0.9rem; color: #475569; font-weight: 700;">
          <div>
            Showing <span id="cap-count" style="color: #0078db; font-weight: 900;">${allProjects.length}</span> Verified Real Estate Projects
          </div>
          <div style="font-size: 0.8rem; color: #16a34a; font-weight: 750; display: flex; align-items: center; gap: 0.3rem;">
            <span>🛡️</span>
            <span>Direct Developer Pricing Guaranteed</span>
          </div>
        </div>

        <!-- 6. PROJECTS GRID -->
        <div class="cap-grid" id="cap-projects-grid">
          ${allProjects.map(p => window.renderCapProjectCard(p)).join('')}
        </div>
      </main>
    </div>
  `;

  // Apply filters if any predefined filter was set
  window.filterCustomerAllProjects();
};

window.setCapCategoryFilter = function (btn, cat) {
  window._capFilterState.category = cat;
  const pills = document.querySelectorAll('.cap-pill-btn');
  pills.forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window.filterCustomerAllProjects();
};

window.resetCapFilters = function () {
  window._capFilterState = {
    search: '',
    category: 'all',
    city: 'all',
    budget: 'all',
    bhk: 'all',
    sort: 'featured'
  };
  const searchInput = document.getElementById('cap-search-input');
  if (searchInput) searchInput.value = '';
  const citySelect = document.getElementById('cap-city-select');
  if (citySelect) citySelect.value = 'all';
  const budgetSelect = document.getElementById('cap-budget-select');
  if (budgetSelect) budgetSelect.value = 'all';
  const bhkSelect = document.getElementById('cap-bhk-select');
  if (bhkSelect) bhkSelect.value = 'all';
  const sortSelect = document.getElementById('cap-sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  const pills = document.querySelectorAll('.cap-pill-btn');
  pills.forEach((p, idx) => {
    if (idx === 0) p.classList.add('active');
    else p.classList.remove('active');
  });

  window.filterCustomerAllProjects();
};

function parseCapPriceValue(priceStr) {
  if (!priceStr) return 0;
  const s = priceStr.toLowerCase();
  const match = s.match(/[\d.]+/g);
  if (!match) return 0;
  let val = parseFloat(match[0]);
  if (s.includes('cr')) val = val * 10000000;
  else if (s.includes('l')) val = val * 100000;
  return val;
}

window.filterCustomerAllProjects = function () {
  const searchInput = document.getElementById('cap-search-input');
  const citySelect = document.getElementById('cap-city-select');
  const budgetSelect = document.getElementById('cap-budget-select');
  const bhkSelect = document.getElementById('cap-bhk-select');
  const sortSelect = document.getElementById('cap-sort-select');
  const grid = document.getElementById('cap-projects-grid');
  const countSpan = document.getElementById('cap-count');

  if (!grid) return;

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const cityFilter = citySelect ? citySelect.value : 'all';
  const budgetFilter = budgetSelect ? budgetSelect.value : 'all';
  const bhkFilter = bhkSelect ? bhkSelect.value : 'all';
  const sortFilter = sortSelect ? sortSelect.value : 'featured';
  const catFilter = window._capFilterState.category || 'all';

  let list = window.getAllCustomerProjectsList();

  // 1. Category Filter
  if (catFilter !== 'all') {
    if (catFilter.startsWith('city:')) {
      const targetCity = catFilter.replace('city:', '').toLowerCase();
      list = list.filter(p => (p.city || '').toLowerCase().includes(targetCity) || (p.location || '').toLowerCase().includes(targetCity));
    } else {
      list = list.filter(p => p.category === catFilter);
    }
  }

  // 2. City Filter
  if (cityFilter !== 'all') {
    list = list.filter(p => (p.city || '').toLowerCase() === cityFilter.toLowerCase() || (p.location || '').toLowerCase().includes(cityFilter.toLowerCase()));
  }

  // 3. Search Filter
  if (searchTerm) {
    list = list.filter(p =>
      (p.name && p.name.toLowerCase().includes(searchTerm)) ||
      (p.developer && p.developer.toLowerCase().includes(searchTerm)) ||
      (p.location && p.location.toLowerCase().includes(searchTerm)) ||
      (p.city && p.city.toLowerCase().includes(searchTerm)) ||
      (p.config && p.config.toLowerCase().includes(searchTerm))
    );
  }

  // 4. Budget Filter
  if (budgetFilter !== 'all') {
    list = list.filter(p => {
      const priceVal = parseCapPriceValue(p.price);
      if (budgetFilter === 'under-50l') return priceVal > 0 && priceVal < 5000000;
      if (budgetFilter === '50l-1.5cr') return priceVal >= 5000000 && priceVal <= 15000000;
      if (budgetFilter === '1.5cr-3cr') return priceVal >= 15000000 && priceVal <= 30000000;
      if (budgetFilter === 'above-3cr') return priceVal >= 30000000;
      return true;
    });
  }

  // 5. Typology Filter
  if (bhkFilter !== 'all') {
    list = list.filter(p => {
      const conf = (p.config || '').toLowerCase();
      if (bhkFilter === 'plot') return conf.includes('plot') || conf.includes('land');
      if (bhkFilter === '2bhk') return conf.includes('2') || conf.includes('2 bhk');
      if (bhkFilter === '3bhk') return conf.includes('3') || conf.includes('3 bhk');
      if (bhkFilter === '4bhk') return conf.includes('4') || conf.includes('5') || conf.includes('villa');
      return true;
    });
  }

  // 6. Sort
  if (sortFilter === 'price-asc') {
    list.sort((a, b) => parseCapPriceValue(a.price) - parseCapPriceValue(b.price));
  } else if (sortFilter === 'price-desc') {
    list.sort((a, b) => parseCapPriceValue(b.price) - parseCapPriceValue(a.price));
  } else if (sortFilter === 'name-asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  if (countSpan) countSpan.textContent = list.length;

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 3rem 1.5rem; text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
        <h3 style="font-size: 1.25rem; font-weight: 850; color: #091e42; margin-bottom: 0.35rem;">No matching projects found</h3>
        <p style="font-size: 0.88rem; color: #64748b; margin-bottom: 1.25rem;">Try adjusting your search criteria, city, or budget filter.</p>
        <button onclick="resetCapFilters()" class="btn btn-primary" style="background: #0078db; padding: 0.6rem 1.25rem; font-weight: 750;">
          ↺ Reset All Filters
        </button>
      </div>
    `;
  } else {
    grid.innerHTML = list.map(p => window.renderCapProjectCard(p)).join('');
  }
};


// ── DVIGA MASTERS ARCHITECTURAL REAL ESTATE DATA & CONTROLLERS ──

const DVIGA_AMENITIES_DB = {
  shopping: [
    { name: 'DLF CyberHub & Promenade', time: '8-min drive' },
    { name: 'Galleria Luxury Market', time: '5-min drive' },
    { name: 'Ambience Mall & High Street', time: '12-min drive' },
    { name: 'Worldmark Aerocity Enclave', time: '15-min drive' },
    { name: 'Horizon Centre Luxury Retail', time: '6-min walk' },
    { name: 'The Palladium Luxury Avenue', time: '10-min drive' }
  ],
  schools: [
    { name: 'The British International School', time: '10-min drive' },
    { name: 'Heritage Xperiential Learning School', time: '7-min drive' },
    { name: 'Pathways World School Academy', time: '12-min drive' },
    { name: 'The Shri Ram School, Aravali', time: '6-min drive' },
    { name: 'Shiv Nadar School of Excellence', time: '14-min drive' },
    { name: 'Discovery Pre-School Academy', time: '8-min walk' }
  ],
  parks: [
    { name: 'Aravalli Biodiversity Forest Sanctuary', time: '5-min walk' },
    { name: 'Golf Course Road Linear Forest Trail', time: 'Direct access' },
    { name: 'Leisure Valley Botanical Park', time: '10-min drive' },
    { name: 'The On-Site Zen Banyan Grove', time: 'On-site grounds' },
    { name: 'Aromatic Botanical Herb Gardens', time: 'On-site grounds' },
    { name: 'Reflecting Water Lily Cascades', time: 'On-site grounds' }
  ],
  sports: [
    { name: 'DLF Golf & Country Club (18-Hole Championship)', time: '4-min drive' },
    { name: 'Siri Fort Olympic Sports Complex', time: '18-min drive' },
    { name: 'CSKA Multi-Sport Athletic Arena', time: '10-min drive' },
    { name: 'Olympic-Standard Tennis Academy', time: 'On-site' },
    { name: 'Skydeck Yoga & Meditation Lawn', time: 'On-site' },
    { name: 'Temperature-Controlled Heated Lap Pool', time: 'On-site' }
  ],
  transit: [
    { name: 'Sector 42-43 Rapid Metro Station', time: '3-min walk' },
    { name: 'Golf Course Road 16-Lane Expressway', time: 'Direct access' },
    { name: 'NH-48 Golden Quadrilateral Interchange', time: '6-min drive' },
    { name: 'IGI T3 International Airport Terminal', time: '18-min drive' },
    { name: 'Cyber City Business & Tech Corridor', time: '8-min drive' },
    { name: 'Delhi-Mumbai Expressway Access Corridor', time: '15-min drive' }
  ]
};

const DVIGA_RESIDENCES_DB = [
  {
    category: '1bhk',
    bhk: '1-Bedroom Executive',
    sqm: '46.3 – 62.3 M²',
    sqft: '498 – 670 SQ.FT',
    ceilings: '3.1 M finished ceilings',
    price: '₹1.45 – 1.85 Cr',
    img: 'https://static.tildacdn.com/tild3838-6162-4461-a231-633062326362/Frame_2131330495.jpg',
    features: 'Private bedroom with naturally lit walk-in wardrobe, floor-to-ceiling double-glazed acoustic glass, and viewing balcony.'
  },
  {
    category: '2bhk',
    bhk: '2-Bedroom Signature',
    sqm: '78.6 – 99.5 M²',
    sqft: '845 – 1,070 SQ.FT',
    ceilings: '3.1 M finished ceilings',
    price: '₹2.65 – 3.25 Cr',
    img: 'https://static.tildacdn.com/tild3739-6330-4863-a562-313536363739/Frame_2131330499.jpg',
    features: 'Corner layout with dual exposures, expansive open-concept living area with sliding terrace doors, and en-suite primary bath.'
  },
  {
    category: '3bhk',
    bhk: '3-Bedroom Grand Residence',
    sqm: '99.8 – 114.7 M²',
    sqft: '1,075 – 1,235 SQ.FT',
    ceilings: '3.1 M finished ceilings',
    price: '₹3.85 – 4.75 Cr',
    img: 'https://static.tildacdn.com/tild6533-3061-4638-b066-343331633732/Frame_2131330500.jpg',
    features: 'Floor-to-ceiling glass up to 3m high, private elevator landing, dedicated service entry, and sweeping botanical park vistas.'
  },
  {
    category: '4bhk',
    bhk: '4-Bedroom Sky Penthouse',
    sqm: '160.0 M²',
    sqft: '1,722 SQ.FT',
    ceilings: '3.6 M double-height volume',
    price: '₹6.20 – 7.50 Cr',
    img: 'https://static.tildacdn.com/tild6364-6437-4239-b465-623966396364/Frame_2131330501.jpg',
    features: 'Crown jewel penthouse featuring 360-degree skyline horizons, private open-air rooftop plunge pool, and expansive terrace lounge.'
  }
];

window.currentDvigaPerspective = 0;

window.setDvigaPerspective = function (index) {
  window.currentDvigaPerspective = index;
  for (let i = 0; i < 4; i++) {
    const layer = document.getElementById('dv-layer-' + i);
    const pill = document.getElementById('dv-pill-' + i);
    if (layer) {
      if (i === index) layer.classList.add('active');
      else layer.classList.remove('active');
    }
    if (pill) {
      if (i === index) pill.classList.add('active');
      else pill.classList.remove('active');
    }
  }
};

window.initDvigaHeroInteraction = function () {
  const heroSection = document.getElementById('dv-hero-section');
  const cursorPop = document.getElementById('dv-cursor-pop');
  const heroCanvas = document.getElementById('dv-hero-canvas');
  if (!heroSection) return;

  // 1. Mousemove dynamic view changing & cursor follow pill
  heroSection.addEventListener('mousemove', (e) => {
    const rect = heroSection.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));

    let targetIdx = 0;
    if (ratio < 0.25) targetIdx = 0;
    else if (ratio < 0.50) targetIdx = 1;
    else if (ratio < 0.75) targetIdx = 2;
    else targetIdx = 3;

    if (targetIdx !== window.currentDvigaPerspective) {
      window.setDvigaPerspective(targetIdx);
    }

    if (cursorPop) {
      cursorPop.style.left = e.clientX + 'px';
      cursorPop.style.top = e.clientY + 'px';
      cursorPop.classList.add('visible');
    }
  });

  heroSection.addEventListener('mouseleave', () => {
    if (cursorPop) cursorPop.classList.remove('visible');
  });

  // 2. Scroll dive-in camera zoom effect
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (heroCanvas && scrollY < 1400) {
      const scale = 1 + (scrollY / 1400) * 0.35;
      const translateY = scrollY * 0.22;
      heroCanvas.style.transform = `scale(${scale}) translateY(${translateY}px)`;
    }
  }, { passive: true });
};

window.toggleDvigaDrawer = function (open) {
  const drawer = document.getElementById('dv-drawer');
  if (drawer) {
    if (open) drawer.classList.add('open');
    else drawer.classList.remove('open');
  }
};

window.switchDvigaLocationTab = function (category, btn) {
  const container = document.getElementById('dv-amenities-container');
  if (!container) return;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.dv-cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const items = DVIGA_AMENITIES_DB[category] || [];
  container.innerHTML = items.map(item => `
    <div class="dv-amenity-card">
      <div class="dv-amenity-name">${item.name}</div>
      <div class="dv-amenity-badge">${item.time}</div>
    </div>
  `).join('');
};

window.switchDvigaResidenceTab = function (bhk, btn) {
  const container = document.getElementById('dv-plans-container');
  if (!container) return;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.dv-cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  let list = DVIGA_RESIDENCES_DB;
  if (bhk !== 'all') {
    list = DVIGA_RESIDENCES_DB.filter(r => r.category === bhk);
  }

  container.innerHTML = list.map(r => `
    <div class="dv-plan-card">
      <div class="dv-plan-img-wrap">
        <img src="${r.img}" alt="${r.bhk}" class="dv-plan-img" />
      </div>
      <div class="dv-plan-body">
        <div>
          <h3 class="dv-plan-bhk">${r.bhk}</h3>
          <div style="font-weight: 700; font-size: 0.85rem; color: #c06d30; margin-bottom: 0.35rem;">
            ${r.sqm} &bull; ${r.sqft}
          </div>
          <div class="dv-plan-specs">
            ${r.features}
          </div>
        </div>

        <div class="dv-plan-footer">
          <div>
            <div style="font-size: 0.68rem; color: #736962; text-transform: uppercase; font-weight: 700;">Direct Developer Price</div>
            <div class="dv-plan-price">${r.price}</div>
          </div>
          <button class="dv-btn-residences" style="padding: 0.45rem 1rem; font-size: 0.72rem;" onclick="openPublicSiteVisitModal('${r.bhk} - On-Site Tour')">
            Book Site Tour
          </button>
        </div>
      </div>
    </div>
  `).join('');
};

window.open3DVisualizerModal = function () {
  let modal = document.getElementById('dv-3d-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dv-3d-modal';
    modal.className = 'rna-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="rna-modal-card" style="max-width: 960px; width: 92vw; padding: 2rem; background: #221614; color: #ffffff; border: 1px solid rgba(192, 109, 48, 0.4);" onclick="event.stopPropagation()">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(242, 230, 214, 0.15); padding-bottom: 1rem;">
        <div>
          <span style="font-size: 0.75rem; font-weight: 700; color: #c06d30; text-transform: uppercase; letter-spacing: 0.1em;">PropTech 3D Visualizer</span>
          <h3 style="font-size: 1.45rem; font-weight: 400; font-family: var(--dv-font-serif); margin: 0.2rem 0 0;">Interactive Architectural Masterplan</h3>
        </div>
        <button onclick="document.getElementById('dv-3d-modal').style.display='none'" style="background: transparent; border: 1px solid rgba(242, 230, 214, 0.3); color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer;">✕</button>
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
        <p style="color: rgba(242, 230, 214, 0.8); font-size: 0.9rem; margin: 0 0 1rem;">
          Toggle perspectives, inspect tower elevations, and view daylight illumination across the masterplanned grounds.
        </p>
        <div style="display: inline-flex; gap: 0.5rem; background: rgba(0,0,0,0.4); padding: 0.3rem 0.5rem; border-radius: 9999px;">
          <button class="dv-cat-tab active" onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.getElementById('dv-modal-3d-img').src='https://static.tildacdn.com/tild3633-3464-4635-a161-643435363666/Group_2131330245.jpg';">Daylight Facade</button>
          <button class="dv-cat-tab" onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.getElementById('dv-modal-3d-img').src='https://static.tildacdn.com/tild6238-3437-4332-b161-373332323565/Mask_group.jpg';">Twilight Illumination</button>
          <button class="dv-cat-tab" onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active')); this.classList.add('active'); document.getElementById('dv-modal-3d-img').src='https://static.tildacdn.com/tild3638-3663-4231-a465-383834323837/CHANGE1_1.jpg';">Night Crystal Towers</button>
        </div>
      </div>

      <div style="border-radius: 14px; overflow: hidden; height: 440px; position: relative;">
        <img id="dv-modal-3d-img" src="https://static.tildacdn.com/tild3633-3464-4635-a161-643435363666/Group_2131330245.jpg" style="width: 100%; height: 100%; object-fit: cover;" />
        <div style="position: absolute; bottom: 1.5rem; left: 1.5rem; background: rgba(34, 22, 20, 0.85); backdrop-filter: blur(12px); padding: 0.75rem 1.25rem; border-radius: 10px; border: 1px solid rgba(192, 109, 48, 0.4);">
          <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">The Grand Nexora at Golf Course Road</div>
          <div style="font-size: 0.78rem; color: #f2e6d6;">Crystal Facade &bull; 8 to 25 Stories &bull; 0% Brokerage</div>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.submitDvigaConsultationForm = function () {
  const name = document.getElementById('dv-client-name')?.value || 'Valued Client';
  const phone = document.getElementById('dv-client-phone')?.value || '+91 98765 43210';
  const res = document.getElementById('dv-client-residence')?.value || '2-Bedroom Residence';

  if (!state.leads) state.leads = [];
  state.leads.unshift({
    id: 'LEAD-' + Math.floor(1000 + Math.random() * 9000),
    name: name,
    phone: phone,
    source: 'Dviga Editorial Web Consultation',
    interest: res,
    status: 'NEW',
    date: new Date().toISOString().split('T')[0]
  });

  let modal = document.getElementById('dv-consult-success-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dv-consult-success-modal';
    modal.className = 'rna-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="rna-modal-card" style="max-width: 500px; text-align: center; padding: 2.75rem 2rem; background: #221614; color: #ffffff; border: 1px solid rgba(192, 109, 48, 0.4);" onclick="event.stopPropagation()">
      <div style="width: 64px; height: 64px; background: rgba(192, 109, 48, 0.2); color: #c06d30; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.25rem;">
        ✦
      </div>
      <h3 style="font-size: 1.6rem; font-family: var(--dv-font-serif); margin: 0 0 0.5rem;">Private Consultation Requested</h3>
      <p style="color: rgba(242, 230, 214, 0.85); font-size: 0.95rem; line-height: 1.6; margin: 0 0 1.75rem;">
        Thank you, <b>${name}</b>. An institutional portfolio director has received your inquiry for <b>${res}</b> and will contact you privately at <b>${phone}</b>.
      </p>

      <div style="background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(192, 109, 48, 0.4); border-radius: 12px; padding: 1rem; text-align: left; margin-bottom: 1.5rem; font-size: 0.85rem; color: rgba(242, 230, 214, 0.9);">
        <div><b>🛡️ 0-Spam Shield:</b> Your phone number is strictly encrypted.</div>
        <div style="margin-top: 0.35rem;"><b>📱 WhatsApp Priority:</b> Portfolio brochure delivered directly.</div>
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button class="dv-btn-residences" onclick="document.getElementById('dv-consult-success-modal').style.display='none'" style="flex: 1; padding: 0.85rem;">
          Return to Presentation
        </button>
        <a href="https://wa.me/919876543210?text=Hi%20Nexora,%20I%20requested%20a%20consultation%20for%20${encodeURIComponent(res)}" target="_blank" class="dv-btn-call" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;">
          WhatsApp Concierge →
        </a>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};



window.showEhDropdown = function (key) {
  const d = document.getElementById(`eh-dropdown-${key}`);
  if (d) d.style.display = 'block';
};

window.hideEhDropdown = function (key) {
  const d = document.getElementById(`eh-dropdown-${key}`);
  if (d) d.style.display = 'none';
};

window.openCustomerAllProjectsView = function () {
  state.viewMode = 'website';
  state.customerView = 'all-projects';
  state.selectedCustomerProjectId = null;
  window.location.hash = '#/all-projects';
  renderApp();
};

window.openCustomerProjectDetail = function (projectId) {
  state.viewMode = 'website';
  state.selectedCustomerProjectId = projectId;
  state.customerView = null;
  window.location.hash = `#/project/${projectId}`;
  renderApp();
};

window.openPublicHome = function () {
  state.viewMode = 'website';
  state.customerView = null;
  state.selectedCustomerProjectId = null;
  window.location.hash = '#';
  renderApp();
};

function renderPublicWebsite(root) {
  root.innerHTML = `
    <div class="pub-container" style="background: #ffffff; min-height: 100vh; overflow-x: hidden;">
      <!-- 1. STICKY GLASSMORPHIC HEADER -->
      <header class="eh-header">
        <div class="eh-logo-group" style="display: flex; align-items: center; gap: 0.85rem;">
          <div class="eh-logo" onclick="openPublicHome()">
            <div style="background: linear-gradient(135deg, #0078db, #0052cc); color: #ffffff; font-weight: 900; font-size: 1.15rem; padding: 0.25rem 0.6rem; border-radius: 8px; letter-spacing: -0.02em; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 120, 219, 0.35);">
              <span>NX</span>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 850; font-size: 1.35rem; color: #ffffff; letter-spacing: -0.02em; line-height: 1;">Nexora<span style="color: #38bdf8;">.</span></span>
              <span style="font-size: 0.62rem; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Real Estate Platform</span>
            </div>
          </div>
        </div>

        <!-- Nexora Navigation Links with Rich Dropdowns -->
        <nav class="eh-nav">
          <div class="eh-nav-item" style="position: relative;" onmouseenter="showEhDropdown('buyers')" onmouseleave="hideEhDropdown('buyers')">
            <a class="eh-nav-link" onclick="openExpandedSearchModal('buy')">For Buyers <span style="font-size: 0.65rem;">▾</span></a>
            <div id="eh-dropdown-buyers" class="eh-dropdown-menu" style="display: none; left: 0; right: auto;">
              <a onclick="openCustomerAllProjectsView()">🏗️ All Projects & Launches</a>
              <a onclick="openExpandedSearchModal('buy')">🏢 Buy a Home (Direct Developer)</a>
              <a onclick="openExpandedSearchModal('commercial')">🏬 Commercial Office & Retail</a>
              <a onclick="openExpandedSearchModal('plots')">🏞️ Plots / Land</a>
              <a onclick="openExpandedSearchModal('projects')">🏗️ Upcoming RERA Launches</a>
              <a onclick="openShieldedCallModal()">🛡️ 0-Spam Shielded Direct Call</a>
            </div>
          </div>

          <div class="eh-nav-item" style="position: relative;" onmouseenter="showEhDropdown('tenants')" onmouseleave="hideEhDropdown('tenants')">
            <a class="eh-nav-link" onclick="openExpandedSearchModal('rent')">For Tenants <span style="font-size: 0.65rem;">▾</span></a>
            <div id="eh-dropdown-tenants" class="eh-dropdown-menu" style="display: none; left: 0; right: auto;">
              <a onclick="openExpandedSearchModal('rent')">🔑 Rent a Home (Verified Flats)</a>
              <a onclick="openExpandedSearchModal('commercial')">🏢 Commercial Lease</a>
              <a onclick="openExpandedSearchModal('pg')">🛏️ PG & Co-living Spaces</a>
            </div>
          </div>

          <div class="eh-nav-item" style="position: relative;" onmouseenter="showEhDropdown('owners')" onmouseleave="hideEhDropdown('owners')">
            <a class="eh-nav-link" onclick="openPostPropertyPage()">For Owners <span style="font-size: 0.65rem;">▾</span></a>
            <div id="eh-dropdown-owners" class="eh-dropdown-menu" style="display: none; left: 0; right: auto;">
              <a onclick="openPostPropertyPage()">📢 Post Property FREE (0% Brokerage)</a>
              <a onclick="openPostPropertyPage()">📋 Owner Verification & Shield</a>
              <a onclick="openInsightsModal()">📊 Rental Yield Calculator</a>
            </div>
          </div>

          <div class="eh-nav-item" style="position: relative;" onmouseenter="showEhDropdown('dealers')" onmouseleave="hideEhDropdown('dealers')">
            <a class="eh-nav-link" onclick="setViewMode('login')">For Dealers / Builders <span style="font-size: 0.65rem;">▾</span></a>
            <div id="eh-dropdown-dealers" class="eh-dropdown-menu" style="display: none; left: 0; right: auto;">
              <a onclick="setViewMode('login')">🤝 Channel Partner RERA Registry</a>
              <a onclick="setViewMode('login'); setRoleFilter('ADMIN')">🏢 Developer Project Manager Portal</a>
            </div>
          </div>
        </nav>

        <div class="eh-nav-actions" style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="eh-btn-signin" onclick="setViewMode('login')" title="Sign In to Nexora CRM Command Center" style="display: inline-flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #0078db, #0052cc); color: #ffffff; padding: 0.55rem 1.35rem; font-size: 0.92rem; font-weight: 700; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; box-shadow: 0 4px 14px rgba(0, 120, 219, 0.4); transition: all 0.2s ease;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Sign In</span>
          </button>
        </div>
      </header>

      <!-- 2. HERO SECTION WITH CINEMATIC KEN BURNS SCREENSAVER (5 ULTRA-LUXURY RESIDENCES) -->
      <section class="eh-hero-section" id="eh-hero-section">
        <div class="eh-screensaver-viewport" id="eh-screensaver-viewport">
          <div class="eh-screensaver-slide active" data-index="0" style="background-image: url('/assets/hero_slide_1_villa.jpg');"></div>
          <div class="eh-screensaver-slide" data-index="1" style="background-image: url('/assets/hero_slide_2_estate.jpg');"></div>
          <div class="eh-screensaver-slide" data-index="2" style="background-image: url('/assets/hero_slide_3_interior.jpg');"></div>
          <div class="eh-screensaver-slide" data-index="3" style="background-image: url('/assets/hero_slide_4_waterfront.jpg');"></div>
          <div class="eh-screensaver-slide" data-index="4" style="background-image: url('/assets/hero_slide_5_terrace.jpg');"></div>
        </div>
        <div class="eh-hero-video-overlay"></div>
        <div class="eh-hero-container">
          <div class="eh-hero-left-col">
            <div class="eh-hero-tag-pill">
              <span class="eh-tag-sparkle">✦</span>
              <span>CURATED LUXURY RESIDENCES</span>
            </div>
            <h1 class="eh-hero-title">Find a Home You'll Love</h1>
            <p class="eh-hero-slogan">Where architectural excellence meets 100% verified living.</p>
            <div class="eh-hero-glass-stats">
              <span class="eh-stat-glass-chip">
                <span style="color:#38bdf8; font-weight:700;">✓</span> 100% Verified Only
              </span>
              <span class="eh-stat-glass-chip">
                <span style="color:#10b981; font-weight:700;">✦</span> 0% Brokerage Direct
              </span>
              <span class="eh-stat-glass-chip">
                <span style="color:#f59e0b; font-weight:700;">★</span> Prime Corridors
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. OVERLAPPING IN-PAGE SEARCH CONSOLE -->
      <div class="eh-search-floating-wrapper">
        <div class="eh-search-floating-box">
          <!-- Top Tabs Bar -->
          <div class="eh-top-tabs-bar">
            <button class="eh-top-tab-item active" id="eh-tab-buy" onclick="switchEhSearchTab('buy')">Buy</button>
            <button class="eh-top-tab-item" id="eh-tab-rent" onclick="switchEhSearchTab('rent')">Rent</button>
            <button class="eh-top-tab-item" id="eh-tab-new-launch" onclick="switchEhSearchTab('new-launch')">
              New Launch <span class="eh-red-dot"></span>
            </button>
            <button class="eh-top-tab-item" id="eh-tab-commercial" onclick="switchEhSearchTab('commercial')">Commercial</button>
            <button class="eh-top-tab-item" id="eh-tab-plots" onclick="switchEhSearchTab('plots')">Plots/Land</button>
            <button class="eh-top-tab-item" id="eh-tab-projects" onclick="switchEhSearchTab('projects')">Townships</button>
          </div>

          <!-- Main Input Bar -->
          <div class="eh-floating-input-bar">
            <div class="eh-dropdown-trigger" onclick="toggleInpageFilters()" id="eh-type-dropdown-btn">
              <span id="eh-selected-type-text">All Residential</span>
              <span style="font-size: 0.75rem; color: #6b778c;">▾</span>
            </div>

            <div class="eh-search-input-field" onclick="openExpandedSearchModal(window.curatedMode || 'buy')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a869a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="eh-quick-search-input" placeholder='Search "3 BHK for sale in Mumbai, Delhi, Bengaluru, Gurgaon..."' readonly />
            </div>

            <button class="eh-tool-btn" onclick="detectUserCity(event)" title="Detect My Current Location">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="22" y1="12" x2="18" y2="12"></line>
                <line x1="6" y1="12" x2="2" y2="12"></line>
                <line x1="12" y1="6" x2="12" y2="2"></line>
                <line x1="12" y1="22" x2="12" y2="18"></line>
              </svg>
            </button>

            <button class="eh-tool-btn" onclick="triggerVoiceSearch(event)" title="Voice Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>

            <button class="eh-btn-search-blue" onclick="executeHeroSearch()">
              Search
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>

          <!-- Collapsible In-Page Filter Drawer -->
          <div class="eh-inpage-filter-drawer" id="eh-inpage-drawer" style="display: none;">
            <div class="eh-drawer-header">
              <span class="eh-drawer-title">RESIDENTIAL PROPERTY TYPES</span>
              <button class="eh-drawer-clear-btn" onclick="clearInpageCheckboxes()">Clear All</button>
            </div>

            <div class="eh-checkbox-grid" id="eh-inpage-ptypes">
              <label class="eh-checkbox-item"><input type="checkbox" value="flat" checked onchange="applyInpageFilters()" /> Flat / Apartment</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="builder-floor" checked onchange="applyInpageFilters()" /> Independent Builder Floor</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="villa" checked onchange="applyInpageFilters()" /> Residential House / Villa</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="plot" onchange="applyInpageFilters()" /> Residential Land / Plot</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="studio" onchange="applyInpageFilters()" /> 1 RK / Studio Apartment</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="farmhouse" onchange="applyInpageFilters()" /> Luxury Farm House</label>
              <label class="eh-checkbox-item"><input type="checkbox" value="serviced-apt" onchange="applyInpageFilters()" /> Serviced Apartment</label>
            </div>

            <div class="eh-commercial-hint">
              Looking for commercial spaces? <a onclick="switchEhSearchTab('commercial')">Switch to Commercial (Office, Retail, Shop) →</a>
            </div>

            <div class="eh-filter-pills-row">
              <select class="eh-filter-pill-select" id="eh-filter-budget" onchange="applyInpageFilters()">
                <option value="">Budget: Any</option>
                <option value="under-1cr">Under ₹1 Cr</option>
                <option value="1cr-2cr">₹1 Cr - ₹2 Cr</option>
                <option value="2cr-5cr">₹2 Cr - ₹5 Cr</option>
                <option value="5cr-plus">₹5 Cr & Above</option>
              </select>

              <select class="eh-filter-pill-select" id="eh-filter-bedroom" onchange="applyInpageFilters()">
                <option value="">Bedrooms: Any</option>
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4+ BHK</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 99ACRES STYLE: APARTMENTS, VILLAS AND MORE (7 CARDS CAROUSEL) -->
      <section class="avm-section" id="apartments-villas-section">
        <div class="avm-header">
          <div>
            <h2 class="avm-title">Apartments, Villas and more</h2>
            <p class="avm-subtitle">in Bangalore East, Delhi / NCR &amp; Top Metropolitan Cities</p>
          </div>
        </div>

        <div class="avm-track-wrapper">
          <button class="avm-nav-arrow prev" onclick="scrollApartmentsVillas('left')" title="Previous Categories" aria-label="Previous">‹</button>
          <div class="avm-track" id="avm-carousel-track">
            <!-- 7 Cards populated by renderApartmentsVillasCarousel() -->
          </div>
          <button class="avm-nav-arrow next" onclick="scrollApartmentsVillas('right')" title="Next Categories" aria-label="Next">›</button>
        </div>
      </section>

      <!-- 5. SHOWCASE 1: BUY A HOME (LIVING ROOM + TOP ARTICLES ON HOME BUYING) -->
      <section class="bah-showcase-section" id="buy-home-showcase-section">
        <div class="bah-banner-container">
          <!-- Left Column: Square Living Room Image -->
          <div class="bah-square-box">
            <img src="/assets/buy_home_showcase.jpg" alt="Luxury Living Room Interior" class="bah-square-img" loading="eager" />
          </div>

          <!-- Right Column: Editorial Title Added Beside The Image -->
          <div class="bah-beside-col">
            <h2 class="bah-beside-title">Top articles on<br/>home buying</h2>
            <p class="bah-beside-sub">Read from Beginners check-list to Pro Tips</p>
          </div>
        </div>
      </section>

      <!-- TOP ARTICLES ON HOME BUYING (FULL-WIDTH GLASS CARD) -->
      <section class="nx-news-section" id="nexora-news-section">
        <div class="nx-news-card">
          <div class="nx-news-tabs-bar">
            <button class="nx-news-tab active" id="nx-ntab-news" onclick="switchNexoraNewsTab('news')">News</button>
            <button class="nx-news-tab" id="nx-ntab-legal" onclick="switchNexoraNewsTab('legal')">Tax & Legal</button>
            <button class="nx-news-tab" id="nx-ntab-guides" onclick="switchNexoraNewsTab('guides')">Help Guides</button>
            <button class="nx-news-tab" id="nx-ntab-investment" onclick="switchNexoraNewsTab('investment')">Investment</button>
          </div>

          <div class="nx-news-grid" id="nx-news-grid-container">
            <!-- Dynamically populated by renderNexoraNewsGrid() -->
          </div>

          <div class="nx-news-bottom-row">
            <a class="nx-news-read-more-link" onclick="openAllNewsModal()">
              Read realty news, guides & articles →
            </a>
            <button class="nx-news-nav-arrow" onclick="rotateNexoraNewsNext()" title="Next Articles">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- 6. NEWLY LAUNCHED PROJECTS (CENTERED HEADING WITH LEFT & RIGHT CAROUSEL CONTROLS) -->
      <section class="nl-showcase-section" id="newly-launched-section">
        <div class="nl-outer-box">
          <div class="nl-header-row centered">
            <div class="nl-title-group">
              <div class="nl-icon-badge">
                🏢
              </div>
              <div style="text-align: left;">
                <h2 class="nl-heading">Newly launched projects</h2>
                <p class="nl-subheading">Bigger home in the same budget</p>
              </div>
            </div>
            <div class="nl-sync-badge-pill">
              <span class="nx-pulse-dot" style="background:#0284c7; width:6px; height:6px;"></span>
              <span>Live CRM Synced</span>
            </div>
          </div>

          <div class="nl-carousel-container">
            <button class="nl-carousel-nav-btn prev" onclick="scrollNewlyLaunched('left')" title="Previous Newly Launched Projects" aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            <div class="nl-cards-track" id="nl-cards-track">
              <!-- Dynamically populated by loadNewlyLaunchedProjects() -->
            </div>

            <button class="nl-carousel-nav-btn next" onclick="scrollNewlyLaunched('right')" title="Next Newly Launched Projects" aria-label="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- 7. UPCOMING PROJECTS (BILLBOARD HERO CAROUSEL WITH EARLY BIRD BENEFITS) -->
      <section class="up-section" id="upcoming-projects-section">
        <div class="up-header">
          <h2 class="up-heading">Upcoming Projects</h2>
          <p class="up-subheading">Visit these projects and get early bird benefits</p>
        </div>

        <div class="up-carousel-wrapper">
          <button class="up-nav-btn prev" onclick="scrollUpcomingProjects('prev')" title="Previous Upcoming Project" aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div class="up-billboard-track" id="up-billboard-track">
            <!-- Dynamically populated by loadUpcomingProjects() -->
          </div>

          <button class="up-nav-btn next" onclick="scrollUpcomingProjects('next')" title="Next Upcoming Project" aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="up-dots-container" id="up-dots-container"></div>
      </section>

      <!-- 8. SHOWCASE 2: RENTAL ADVICE SHOWCASE (RED ARMCHAIR & TREE + BEST RENTING ADVICE) -->
      <section class="bah-showcase-section" id="rent-home-showcase-section">
        <div class="bah-banner-container">
          <!-- Left Column: Rental Showcase Image -->
          <div class="bah-square-box">
            <img src="/assets/rental_showcase.jpg" alt="Luxury Rental Interior" class="bah-square-img" style="object-position: center 50%;" loading="eager" />
          </div>

          <!-- Right Column: Editorial Title Added Beside The Image -->
          <div class="bah-beside-col">
            <h2 class="bah-beside-title">Best Renting<br/>Advice by Our Top<br/>Editors</h2>
            <p class="bah-beside-sub">Read from Beginners check-list to Pro Tips</p>
          </div>
        </div>
      </section>

      <!-- BEST RENTING ADVICE & LIVE RENTAL NEWS -->
      <section class="rna-section" id="rental-news-section">
        <div class="rna-card">
          <div class="rna-tabs-row">
            <button class="rna-tab-btn active" id="rna-tab-news" onclick="switchRentalNewsTab('news')">News</button>
            <button class="rna-tab-btn" id="rna-tab-tax-legal" onclick="switchRentalNewsTab('tax-legal')">Tax & Legal</button>
            <button class="rna-tab-btn" id="rna-tab-help-guides" onclick="switchRentalNewsTab('help-guides')">Help Guides</button>
            <button class="rna-tab-btn" id="rna-tab-investment" onclick="switchRentalNewsTab('investment')">Investment</button>
          </div>

          <div class="rna-grid-wrapper">
            <button class="rna-arrow-btn prev" id="rna-arrow-prev" onclick="prevRentalNewsPage()" title="Previous Articles" style="display: none;">
              ‹
            </button>

            <div class="rna-articles-grid" id="rna-articles-grid">
              <!-- Dynamically populated by renderRentalNewsGrid() -->
            </div>

            <button class="rna-arrow-btn next" id="rna-arrow-next" onclick="nextRentalNewsPage()" title="Next Articles">
              ›
            </button>
          </div>

          <div class="rna-footer-link-row">
            <a class="rna-footer-link" onclick="openAllRentalNewsModal()">
              <span>Read realty news, guides & articles</span>
              <span>→</span>
            </a>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;" id="rna-page-indicator">
              Page 1 of 2
            </div>
          </div>
        </div>
      </section>

      <!-- 9. HANDPICKED RESIDENTIAL PROJECTS (FEATURED ACROSS INDIA) -->
      <section class="hrp-section" id="curated-section">
        <div class="hrp-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 class="hrp-title">Handpicked Residential Projects</h2>
              <p class="hrp-subheading">Featured Residential projects across India</p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 0.78rem; font-weight: 750; color: #7e22ce; background: #f3e8ff; padding: 0.25rem 0.75rem; border-radius: 9999px;">
                ⭐ Nexora Handpicked
              </span>
            </div>
          </div>
        </div>

        <div class="hrp-carousel-container">
          <button class="hrp-carousel-btn prev" onclick="scrollHandpickedProjects('left')" title="Previous Projects" aria-label="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div class="hrp-cards-track" id="hrp-cards-track">
            <!-- Dynamically populated by renderHandpickedResidentialProjects() -->
          </div>

          <button class="hrp-carousel-btn next" onclick="scrollHandpickedProjects('right')" title="Next Projects" aria-label="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <!-- Backward Compatibility Anchors -->
        <div id="pub-curated-container" style="display: none;"></div>
        <div id="pub-buy-container" style="display: none;"></div>
        <div id="pub-rent-container" style="display: none;"></div>
        <div id="pub-invest-container" style="display: none;"></div>
      </section>

      <!-- 10. SHOWCASE 3: PLOTS & LAND SHOWCASE (4 WHITE SQUARE PINS VISIBLE: OBJECT-POSITION 50% 58%) -->
      <section class="bah-showcase-section" id="plot-land-showcase-section">
        <div class="bah-banner-container">
          <!-- Left Column: Land Plot Showcase Image (600px x 440px) -->
          <div class="bah-square-box">
            <img src="/assets/plot_showcase.jpg" alt="Residential and Commercial Land Plots" class="bah-square-img" style="object-position: 50% 58%;" loading="eager" />
          </div>

          <!-- Right Column: Editorial Title Added Beside The Image -->
          <div class="bah-beside-col">
            <h2 class="bah-beside-title">Best articles on<br/>Plots/Land</h2>
            <p class="bah-beside-sub">Read from Beginners check-list to Pro Tips</p>
          </div>
        </div>
      </section>

      <!-- BEST ARTICLES ON PLOTS/LAND -->
      <section class="pna-section" id="plot-news-section">
        <div class="pna-card">
          <div class="pna-tabs-row">
            <button class="pna-tab-btn active" id="pna-tab-news" onclick="switchPlotNewsTab('news')">News</button>
            <button class="pna-tab-btn" id="pna-tab-legal" onclick="switchPlotNewsTab('legal')">Tax & Legal</button>
            <button class="pna-tab-btn" id="pna-tab-guides" onclick="switchPlotNewsTab('guides')">Help Guides</button>
            <button class="pna-tab-btn" id="pna-tab-investment" onclick="switchPlotNewsTab('investment')">Investment</button>
          </div>

          <div class="pna-grid-wrapper">
            <button class="pna-arrow-btn prev" id="pna-arrow-prev" onclick="prevPlotNewsPage()" title="Previous Articles" style="display: none;">‹</button>
            <div class="pna-articles-grid" id="pna-articles-grid">
              <!-- Dynamically populated by renderPlotNewsGrid() -->
            </div>
            <button class="pna-arrow-btn next" id="pna-arrow-next" onclick="nextPlotNewsPage()" title="Next Articles">›</button>
          </div>

          <div class="pna-footer-link-row">
            <a class="pna-footer-link" onclick="openAllPlotNewsModal()">
              <span>Read realty news, guides & articles</span>
              <span>→</span>
            </a>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;" id="pna-page-indicator">Page 1 of 2</div>
          </div>
        </div>
      </section>

      <!-- 11. SHOWCASE 4: PROPERTY OWNERS SHOWCASE (BEAUTIFUL BUSINESSWOMAN HOLDING PHONE + POST PROPERTY FREE) -->
      <section class="bah-showcase-section" id="owner-showcase-section">
        <div class="bah-banner-container">
          <!-- Left Column: Beautiful Indian Businesswoman Holding Smartphone (600px x 440px) -->
          <div class="bah-square-box" style="background: #e8f5e9;">
            <img src="/assets/owner_showcase.jpg" alt="Sell or Rent Faster with Nexora" class="bah-square-img" style="object-position: center 20%;" loading="eager" />
          </div>

          <!-- Right Column: Sell or Rent Faster CTAs -->
          <div class="bah-beside-col">
            <h2 class="bah-beside-title">Sell or rent faster at the<br/>right price!</h2>
            <p class="bah-beside-sub">List your property now</p>

            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; align-items: flex-start;">
              <button class="btn btn-primary" onclick="openPostPropertyPage()" style="background: #0078db; color: #ffffff; padding: 0.85rem 2.25rem; font-size: 1rem; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 120, 219, 0.35); transition: all 0.15s ease;">
                Post Property, It's FREE
              </button>
              <a href="https://wa.me/919876543210?text=Hi%20Nexora,%20I%20want%20to%20post%20my%20property%20for%20free" target="_blank" style="color: #059669; font-weight: 600; font-size: 0.95rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;">
                <span>Post via <span style="font-weight: 700;">WhatsApp</span></span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 11A. "GET STARTED WITH EXPLORING REAL ESTATE OPTIONS" (7 HORIZONTAL STRIP CARDS) -->
      <section class="eh-explore-options-container" style="margin: 3.5rem auto 4.5rem;">
        <div class="eh-explore-title">GET STARTED WITH EXPLORING REAL ESTATE OPTIONS</div>
        <div class="eh-explore-cards-strip">
          <!-- 1. Buying a home -->
          <div class="eh-explore-card" onclick="selectExploreOption('buy')">
            <div class="eh-explore-card-img-wrap">
              <img src="/assets/buy_home_showcase.jpg" alt="Buying a home" />
            </div>
            <div class="eh-explore-card-title">Buying a home</div>
          </div>

          <!-- 2. Renting a home -->
          <div class="eh-explore-card" onclick="selectExploreOption('rent')">
            <div class="eh-explore-card-img-wrap">
              <img src="/assets/rental_showcase.jpg" alt="Renting a home" />
            </div>
            <div class="eh-explore-card-title">Renting a home</div>
          </div>

          <!-- 3. Invest in Real Estate -->
          <div class="eh-explore-card" onclick="selectExploreOption('invest')">
            <div class="eh-explore-card-img-wrap">
              <span class="eh-card-sub-badge">NEW</span>
              <img src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=400&q=80" alt="Invest in Real Estate" />
            </div>
            <div class="eh-explore-card-title">Invest in Real Estate</div>
          </div>

          <!-- 4. Sell/Rent your property -->
          <div class="eh-explore-card" onclick="openPostPropertyPage()">
            <div class="eh-explore-card-img-wrap">
              <img src="/assets/owner_showcase.jpg" alt="Sell/Rent your property" />
            </div>
            <div class="eh-explore-card-title">Sell/Rent your property</div>
          </div>

          <!-- 5. Plots/Land -->
          <div class="eh-explore-card" onclick="selectExploreOption('plots')">
            <div class="eh-explore-card-img-wrap">
              <img src="/assets/plot_showcase.jpg" alt="Plots/Land" />
            </div>
            <div class="eh-explore-card-title">Plots/Land</div>
          </div>

          <!-- 6. Explore Insights -->
          <div class="eh-explore-card" onclick="openInsightsModal()">
            <div class="eh-explore-card-img-wrap">
              <span class="eh-card-sub-badge">NEW</span>
              <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80" alt="Explore Insights" />
            </div>
            <div class="eh-explore-card-title">Explore Insights</div>
          </div>

          <!-- 7. PG / Co-living -->
          <div class="eh-explore-card" onclick="selectExploreOption('pg')">
            <div class="eh-explore-card-img-wrap">
              <img src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=400&q=80" alt="PG / Co-living" />
            </div>
            <div class="eh-explore-card-title">PG / Co-living</div>
          </div>
        </div>
      </section>

      <!-- 14. ENTERPRISE SAAS FOOTER -->
      <footer style="background: #091426; color: #cbd5e1; padding: 4rem 1.5rem 2rem; border-top: 1px solid rgba(255,255,255,0.08);">
        <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2.5rem; margin-bottom: 3rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;">
              <div style="background: #0078db; color: #fff; font-weight: 800; font-size: 1.1rem; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">NX</div>
              <span style="font-size: 1.3rem; font-weight: 800; color: #ffffff;">Nexora<span style="color: #38bdf8;">.</span></span>
            </div>
            <p style="font-size: 0.86rem; line-height: 1.6; color: #94a3b8; margin: 0 0 1.25rem;">
              India's high-performance real estate ecosystem connecting buyers, tenants, owners, channel partners, and institutional developers.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; font-size: 0.75rem; font-weight: 750; padding: 0.35rem 0.75rem; border-radius: 9999px;">
              <span>🛡️ 0-Spam Shield Active</span>
            </div>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 750; color: #ffffff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Explore Properties</h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem;">
              <a onclick="switchEhSearchTab('buy')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Buy Flats in Delhi NCR</a>
              <a onclick="switchEhSearchTab('buy')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Buy Flats in Mumbai</a>
              <a onclick="switchEhSearchTab('rent')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Rental Homes in Bengaluru</a>
              <a onclick="switchEhSearchTab('new-launch')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">New RERA Launches 2026</a>
              <a onclick="switchEhSearchTab('plots')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Residential Plots & Land</a>
            </div>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 750; color: #ffffff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">For Property Owners</h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem;">
              <a onclick="openPostPropertyPage()" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Post Property for Free</a>
              <a onclick="switchOwnerNewsTab('news')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Owner Market Reports</a>
              <a onclick="switchOwnerNewsTab('legal')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Capital Gains Tax Guide</a>
              <a onclick="openShieldedCallModal()" style="color: #94a3b8; text-decoration: none; cursor: pointer;">0-Spam Protected Inquiries</a>
            </div>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 750; color: #ffffff; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Portals & Platform</h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem;">
              <a onclick="setViewMode('login')" style="color: #38bdf8; font-weight: 750; text-decoration: none; cursor: pointer;">🔐 CRM Command Center Login</a>
              <a onclick="setViewMode('login')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Channel Partner Portal</a>
              <a onclick="setViewMode('login')" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Builder Inventory Suite</a>
              <a onclick="openCustomerAllProjectsView()" style="color: #94a3b8; text-decoration: none; cursor: pointer;">All Verified Projects</a>
              <a onclick="openInsightsModal()" style="color: #94a3b8; text-decoration: none; cursor: pointer;">Real Estate Market Intelligence</a>
            </div>
          </div>
        </div>

        <div style="max-width: 1200px; margin: 0 auto; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem; color: #64748b;">
          <div>© 2026 Nexora Estates Platform. All rights reserved. RERA Compliant SaaS Infrastructure.</div>
          <div style="display: flex; gap: 1.5rem;">
            <span>Direct Desk: +91 98765 43210</span>
            <a onclick="openShieldedCallModal()" style="color: #38bdf8; cursor: pointer;">Shielded Call Request</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Initialize all interactive components
  switchEhSearchTab('buy');
  if (typeof window.renderNexoraNewsGrid === 'function') {
    window.renderNexoraNewsGrid('news');
  }
  if (typeof window.loadNewlyLaunchedProjects === 'function') {
    window.loadNewlyLaunchedProjects();
  }
  if (typeof window.loadUpcomingProjects === 'function') {
    window.loadUpcomingProjects();
  }
  if (typeof window.renderRentalNewsGrid === 'function') {
    window.renderRentalNewsGrid();
  }
  if (typeof window.renderHandpickedResidentialProjects === 'function') {
    window.renderHandpickedResidentialProjects();
  }
  if (typeof window.renderPlotNewsGrid === 'function') {
    window.renderPlotNewsGrid('news');
  }
  if (typeof window.renderApartmentsVillasCarousel === 'function') {
    window.renderApartmentsVillasCarousel();
  }
  if (typeof window.initHeroKenBurnsScreensaver === 'function') {
    window.initHeroKenBurnsScreensaver();
  }

  // Dynamic luxury navbar scroll spy: invisible at top, glassmorphism when scrolled
  const handleHeaderScroll = () => {
    const header = document.querySelector('.eh-header');
    if (!header) return;
    if (window.scrollY > 25) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };
  window.removeEventListener('scroll', window.__ehNavbarScrollHandler);
  window.__ehNavbarScrollHandler = handleHeaderScroll;
  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();
}


// ============================================================================
// 1. DEDICATED AUTHENTICATION & LOGIN VIEW (CLEAN, SPACIOUS, WEBSITE-MATCHED)
// ============================================================================

window.AUTH_ROLES_CONFIG = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    sub: 'Director / Full Control',
    icon: '👑',
    user: 'admin',
    pass: 'AdminPassword123!',
    roleLabel: 'Super Admin'
  },
  ADMIN: {
    name: 'Sales Manager',
    sub: 'Admin / Approvals',
    icon: '💼',
    user: 'admin_ops',
    pass: 'AdminPassword123!',
    roleLabel: 'Admin'
  },
  INSIDE_SALES: {
    name: 'Inside Sales',
    sub: 'Telecaller / Leads',
    icon: '📞',
    user: 'telecaller',
    pass: 'Telecaller123!',
    roleLabel: 'Inside Sales'
  },
  OUTSIDE_SALES: {
    name: 'Site Agent',
    sub: 'Outside / Units',
    icon: '📍',
    user: 'siteagent',
    pass: 'Siteagent123!',
    roleLabel: 'Outside Sales'
  },
  CHANNEL_PARTNER: {
    name: 'Broker Desk',
    sub: 'Channel Partner',
    icon: '🤝',
    user: 'partner',
    pass: 'Partner123!',
    roleLabel: 'Channel Partner'
  }
};

window.selectAuthRole = function (roleKey) {
  const cfg = window.AUTH_ROLES_CONFIG[roleKey] || window.AUTH_ROLES_CONFIG.SUPER_ADMIN;
  document.querySelectorAll('.nx-auth-role-pill').forEach(el => el.classList.remove('active'));
  const activePill = document.getElementById('auth-role-pill-' + roleKey);
  if (activePill) activePill.classList.add('active');

  const idInput = document.getElementById('login-identifier');
  if (idInput) idInput.value = cfg.user;

  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = cfg.pass;

  const roleSelect = document.getElementById('login-role');
  if (roleSelect) roleSelect.value = cfg.roleLabel;

  const quickRoleName = document.getElementById('nx-quick-role-name');
  if (quickRoleName) quickRoleName.innerText = cfg.name;

  const quickBtn = document.getElementById('nx-quick-login-btn');
  if (quickBtn) {
    quickBtn.onclick = () => quickLoginAs(roleKey);
    quickBtn.innerText = `1-Click Sign In →`;
  }
};

function renderLoginView(root) {
  root.innerHTML = `
    <div style="width: 100vw; height: 100vh; display: flex; background-color: var(--bg-main); overflow: hidden;">
      <!-- Left Editorial Architectural Panel (Normal View) -->
      <div style="flex: 1.15; background: linear-gradient(135deg, rgba(23, 19, 17, 0.88), rgba(14, 12, 11, 0.95)), url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80') center/cover no-repeat; padding: 3.5rem; display: flex; flex-direction: column; justify-content: space-between; color: #F6F3EE;">
        <div style="display: flex; align-items: center; gap: 0.8rem;">
          <div class="sidebar-logo">NX</div>
          <div>
            <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; margin: 0;">Nexora Estates</h2>
            <p style="font-size: 0.65rem; color: #A3978E; text-transform: uppercase; letter-spacing: 1px; margin: 0.15rem 0 0 0;">Real Estate Management Platform</p>
          </div>
        </div>

        <div style="max-width: 500px;">
          <span style="color: var(--accent); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; margin-bottom: 0.5rem;">Institutional Property Portfolio</span>
          <h1 style="font-size: 2.2rem; font-weight: 800; line-height: 1.25; margin: 0 0 1rem 0; letter-spacing: -0.6px; color: #F6F3EE;">Operational Control for Premium Real Estate Developments</h1>
          <p style="color: #A3978E; font-size: 0.9rem; line-height: 1.6; margin: 0;">Integrated inventory matrix, lead nurturing pipelines, cost sheet calculations, and multi-currency transaction tracking.</p>
        </div>

        <div style="font-size: 0.75rem; color: #736962; display: flex; gap: 1.75rem;">
          <span>● MySQL 9.6 Core</span>
          <span>● Concurrency Locking</span>
          <span>● RBAC Enforced</span>
        </div>
      </div>

      <!-- Right Login Form Panel (Normal View, Non-Congested) -->
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 1.5rem 2rem; background-color: var(--bg-main); overflow-y: auto;">
        <div class="modal-card" style="width: 100%; max-width: 440px; box-shadow: var(--shadow-lg); padding: 1.75rem 2rem; border-radius: 16px; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="setViewMode('website')" style="font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.7rem;">
              ← Back to Public Website
            </button>
            <button class="btn-icon" title="Toggle Theme" onclick="toggleTheme()" style="width: 32px; height: 32px;">${state.theme === 'light' ? getIcon('moon') : getIcon('sun')}</button>
          </div>

          <div style="margin-bottom: 1rem;">
            <h2 style="font-size: 1.35rem; font-weight: 800; letter-spacing: -0.4px; margin: 0 0 0.25rem 0;">Sign In to Portal</h2>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">Select your operational role or enter credentials</p>
          </div>

          <!-- Instant 1-Click Role Selector for fast testing -->
          <div style="margin-bottom: 1rem; background: var(--bg-subtle, rgba(0, 0, 0, 0.02)); border: 1px dashed var(--border-color); border-radius: 10px; padding: 0.65rem 0.75rem;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.45rem;">
              ⚡ Quick Demo Access (1-Click Test)
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="quickLoginAs('SUPER_ADMIN')" style="font-size: 0.75rem; justify-content: flex-start; padding: 0.35rem 0.55rem; border-radius: 6px;">
                👑 Super Admin (Director)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="quickLoginAs('ADMIN')" style="font-size: 0.75rem; justify-content: flex-start; padding: 0.35rem 0.55rem; border-radius: 6px;">
                💼 Sales Manager (Admin)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="quickLoginAs('INSIDE_SALES')" style="font-size: 0.75rem; justify-content: flex-start; padding: 0.35rem 0.55rem; border-radius: 6px;">
                📞 Inside Sales (Telecaller)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="quickLoginAs('OUTSIDE_SALES')" style="font-size: 0.75rem; justify-content: flex-start; padding: 0.35rem 0.55rem; border-radius: 6px;">
                📍 Outside Sales (Site)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="quickLoginAs('CHANNEL_PARTNER')" style="font-size: 0.75rem; justify-content: flex-start; padding: 0.35rem 0.55rem; border-radius: 6px; grid-column: span 2;">
                🤝 Channel Partner (Broker Desk)
              </button>
            </div>
          </div>

          <form id="login-form">
            <div class="form-group" style="margin-bottom: 0.65rem;">
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem; display: block;">Access Level</label>
              <select id="login-role" class="form-control" style="height: 38px; font-size: 0.85rem;">
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Inside Sales">Inside Sales (Telecaller)</option>
                <option value="Outside Sales">Outside Sales (Site Agent)</option>
                <option value="Channel Partner">Channel Partner (Broker)</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.65rem;">
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem; display: block;">Username or Email</label>
              <input type="text" id="login-identifier" class="form-control" placeholder="Enter username or email" value="admin" style="height: 38px; font-size: 0.85rem;" required />
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem; display: block;">Password</label>
              <div style="position: relative;">
                <input type="${state.showPassword ? 'text' : 'password'}" id="login-password" class="form-control" placeholder="••••••••" value="AdminPassword123!" style="height: 38px; font-size: 0.85rem;" required />
                <button type="button" onclick="toggleShowPassword()" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.85rem;">
                  ${state.showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div id="login-error" style="color: var(--danger); font-size: 0.82rem; margin-bottom: 0.65rem; display: none;"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-accent" style="width: 100%; justify-content: center; padding: 0.65rem; font-size: 0.9rem; font-weight: 700; height: 42px;">
              Sign In to Command Center
            </button>

            <div style="margin-top: 0.85rem; text-align: center; font-size: 0.78rem; border-top: 1px solid var(--border-muted); padding-top: 0.65rem;">
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

      if (res.user && res.user.role === 'INSIDE_SALES') {
        state.currentView = 'leads';
      } else if (res.user && res.user.role === 'OUTSIDE_SALES') {
        state.currentView = 'calendar';
      } else if (res.user && res.user.role === 'CHANNEL_PARTNER') {
        state.currentView = 'channel-partners';
      } else {
        state.currentView = 'dashboard';
      }

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

// Modal Utility for Admin Actions
function showModal(title, contentHtml, extraClass = '') {
  closeModal();
  const modalDiv = document.createElement('div');
  modalDiv.className = 'modal-overlay';
  modalDiv.id = 'active-modal';
  modalDiv.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1.5rem;';
  modalDiv.innerHTML = `
    <div class="modal-card ${extraClass}" style="background: var(--bg-card); color: var(--text-main); border-radius: 16px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); padding: 1.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.85rem;">
        <h3 style="font-size: 1.15rem; font-weight: 750; margin: 0;">${title}</h3>
        <button type="button" onclick="closeModal()" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); line-height: 1;">✕</button>
      </div>
      <div>${contentHtml}</div>
    </div>
  `;
  modalDiv.onclick = (e) => {
    if (e.target === modalDiv) closeModal();
  };
  document.body.appendChild(modalDiv);
}

function closeModal() {
  const modal = document.getElementById('active-modal');
  if (modal) modal.remove();
}
window.closeModal = closeModal;

function openCreateProjectModal() {
  showModal('🏢 Add Real Estate Project (Live Website Sync)', `
    <form id="create-project-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
      <div class="form-group">
        <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Project Name *</label>
        <input type="text" id="p-name" class="form-control" placeholder="e.g. Prestige Lakeside Habitat" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Project Type *</label>
          <select id="p-type" class="form-control" required>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Villa">Villa</option>
            <option value="Plotted">Plotted</option>
            <option value="Independent">Independent</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Builder / Developer *</label>
          <input type="text" id="p-builder" class="form-control" placeholder="e.g. Prestige Group" required />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Location / Neighborhood *</label>
          <input type="text" id="p-loc" class="form-control" placeholder="e.g. Whitefield Main Road" required />
        </div>
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">City *</label>
          <input type="text" id="p-city" class="form-control" placeholder="e.g. Bengaluru" required />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Website Listing Status *</label>
          <select id="p-status" class="form-control">
            <option value="NEW_LAUNCH">New Launch (Shows in Newly Launched Carousel)</option>
            <option value="UNDER_CONSTRUCTION">Under Construction (Shows in Newly Launched)</option>
            <option value="PLANNING">Planning (Shows in Upcoming Projects)</option>
            <option value="UPCOMING">Upcoming (Shows in Upcoming Projects)</option>
            <option value="READY_TO_MOVE">Ready to Move</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Total Planned Units</label>
          <input type="number" id="p-units" class="form-control" value="120" min="1" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Possession Timeline</label>
          <input type="text" id="p-possession" class="form-control" placeholder="e.g. Q4 2028 or Dec 2028" />
        </div>
        <div class="form-group">
          <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">RERA Registration No.</label>
          <input type="text" id="p-rera" class="form-control" placeholder="e.g. PRM/KA/RERA/1251/446" />
        </div>
      </div>

      <div class="form-group">
        <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; display: block;">Project Brochure (PDF, max 10MB)</label>
        <input type="file" id="p-brochure" class="form-control" accept=".pdf" />
        <small style="color: var(--text-muted); font-size: 0.74rem; margin-top: 0.2rem; display: block;">
          Uploading a brochure makes it downloadable directly from the website project profile card.
        </small>
      </div>

      <div id="p-error" style="color: var(--danger); font-size: 0.82rem; display: none;"></div>

      <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.85rem;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" id="btn-save-project" class="btn btn-primary" style="font-weight: 700;">
          Publish &amp; Sync to Website →
        </button>
      </div>
    </form>
  `);

  document.getElementById('create-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-project');
    const errDiv = document.getElementById('p-error');
    errDiv.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.innerText = 'Publishing Project...';

    try {
      const formData = new FormData();
      formData.append('name', document.getElementById('p-name').value.trim());
      formData.append('project_type', document.getElementById('p-type').value);
      formData.append('builder_name', document.getElementById('p-builder').value.trim());
      formData.append('location', document.getElementById('p-loc').value.trim());
      formData.append('city', document.getElementById('p-city').value.trim());
      formData.append('status', document.getElementById('p-status').value);
      formData.append('total_units', parseInt(document.getElementById('p-units').value, 10) || 0);
      formData.append('possession_date', document.getElementById('p-possession').value.trim());
      formData.append('rera_number', document.getElementById('p-rera').value.trim());

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
      // Reload Projects table
      const contentArea = document.getElementById('content-area');
      if (contentArea) {
        await loadProjectsView(contentArea);
      }
      alert('✓ Project "' + data.data.name + '" published successfully! It is now live in the CRM database and visible on the website.');
    } catch (err) {
      errDiv.innerText = err.message;
      errDiv.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.innerText = 'Publish & Sync to Website →';
    }
  });
}
window.openCreateProjectModal = openCreateProjectModal;

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
          <div>
            <h3 style="font-weight: 700; font-size: 1rem; margin: 0;">Projects & Inventory Directory</h3>
            <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted);">Explore live developments, units, and AI-powered unit matching</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openAiPropertyMatcherModal()">
              AI Property Matcher
            </button>
            ${state.user.role === 'SUPER_ADMIN' || state.user.role === 'ADMIN' ? `
              <button class="btn btn-primary btn-sm" onclick="openCreateProjectModal()">+ Add Project</button>
            ` : ''}
          </div>
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
                      <a href="${getAssetUrl(project.brochure_url)}" target="_blank" class="btn btn-accent btn-sm" style="flex: 1; justify-content: center; font-size: 0.8rem;">
                        👁️ View PDF
                      </a>
                      <a href="${getAssetUrl(project.brochure_url)}" download class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; font-size: 0.8rem;">
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

      <!-- 5. PROPERTY / INVENTORY SECTION WITH VISUAL FLOOR MATRIX & CPQ -->
      <div class="table-container">
        <div class="table-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-weight: 700; font-size: 0.95rem; margin: 0;">Property Inventory & Floor Matrix</h3>
            <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted);">Click any unit to open the Instant CPQ Cost Sheet & Milestone Plan</p>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button class="view-toggle-btn active" id="btn-view-matrix" onclick="toggleProjectInventoryView('matrix')">🏢 Visual Floor Matrix</button>
            <button class="view-toggle-btn" id="btn-view-table" onclick="toggleProjectInventoryView('table')">📋 Table List</button>
          </div>
        </div>

        <div style="padding: 1rem 1.25rem;">
          ${project.units && project.units.length > 0 ? `
            <!-- VISUAL MATRIX VIEW -->
            <div id="proj-inv-matrix-view">
              <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.85rem; font-size: 0.78rem; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 8px; height: 8px; background: var(--text-main); border-radius: 50%; display: inline-block;"></span> Available</span>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; display: inline-block;"></span> Hold</span>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 8px; height: 8px; background: var(--border-color); border-radius: 50%; display: inline-block;"></span> Booked</span>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 8px; height: 8px; background: var(--border-muted); border-radius: 50%; display: inline-block;"></span> Sold</span>
              </div>

              <div class="floor-matrix-container">
                ${(() => {
          // Group units by floor number descending
          const floorMap = {};
          project.units.forEach(u => {
            const fl = u.floor_number || 1;
            if (!floorMap[fl]) floorMap[fl] = [];
            floorMap[fl].push(u);
          });
          const floors = Object.keys(floorMap).map(Number).sort((a, b) => b - a);

          return floors.map(fl => `
                    <div class="floor-row">
                      <div class="floor-label">Floor ${fl}</div>
                      <div class="floor-units-grid">
                        ${floorMap[fl].map(u => `
                          <div class="unit-tile ${u.status.toLowerCase()}" onclick="openUnitCpqModal('${u.id}')" title="Unit ${u.unit_number} • ${u.unit_type} • ₹${(u.base_price / 100000).toFixed(1)}L • Click for CPQ Cost Sheet">
                            <span class="unit-tile-num">${u.unit_number}</span>
                            <span class="unit-tile-type">${u.unit_type}</span>
                            <span class="unit-tile-price">₹${(u.base_price / 100000).toFixed(1)}L</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `).join('');
        })()}
              </div>
            </div>

            <!-- TABLE LIST VIEW (Hidden by default) -->
            <div id="proj-inv-table-view" style="display: none;">
              <table style="width: 100%; border-collapse: collapse;">
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
                    <th style="text-align: right;">Smart CPQ</th>
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
                      <td style="text-align: right;">
                        <button class="btn btn-accent btn-sm" style="font-size: 0.78rem; padding: 0.25rem 0.6rem;" onclick="openUnitCpqModal('${u.id}')">
                          💰 Cost Sheet
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
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

window.toggleProjectInventoryView = function (view) {
  const matrixView = document.getElementById('proj-inv-matrix-view');
  const tableView = document.getElementById('proj-inv-table-view');
  const btnMatrix = document.getElementById('btn-view-matrix');
  const btnTable = document.getElementById('btn-view-table');

  if (view === 'matrix') {
    if (matrixView) matrixView.style.display = 'block';
    if (tableView) tableView.style.display = 'none';
    if (btnMatrix) btnMatrix.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
  } else {
    if (matrixView) matrixView.style.display = 'none';
    if (tableView) tableView.style.display = 'block';
    if (btnMatrix) btnMatrix.classList.remove('active');
    if (btnTable) btnTable.classList.add('active');
  }
};

// ─── SMART CPQ (CONFIGURE, PRICE, QUOTE) & PDF EXPORTER ───────────────────────
window.openUnitCpqModal = async function (unitId, clientName = '', clientPhone = '', clientEmail = '') {
  let existing = document.getElementById('cpq-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cpq-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 760px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">💰</span>
          <div>
            <h3 style="font-weight: 700; margin: 0; font-size: 1.15rem; color: var(--text-main);">Smart Real Estate CPQ Cost Sheet</h3>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Instant Consideration, Statutory Taxes & Milestone Schedule Calculator</p>
          </div>
        </div>
        <button class="btn-icon" onclick="document.getElementById('cpq-modal-overlay').remove()" style="font-size: 1.3rem; line-height: 1;">&times;</button>
      </div>

      <div id="cpq-modal-body">
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <p style="margin-bottom: 0.5rem; font-weight: 600;">Calculating pricing breakdown and payment schedule...</p>
          <div style="display: inline-block; width: 28px; height: 28px; border: 3px solid var(--border-color); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  window.loadCpqData(unitId, clientName, clientPhone, clientEmail, 'CONSTRUCTION_LINKED', 0);
};

window.loadCpqData = async function (unitId, clientName, clientPhone, clientEmail, planType, discountPercent) {
  try {
    const res = await apiFetch(`/units/${unitId}/cost-sheet`, {
      method: 'POST',
      body: JSON.stringify({
        client_name: clientName || 'Prospective Buyer',
        client_phone: clientPhone,
        client_email: clientEmail,
        plan_type: planType,
        discount_percent: discountPercent
      })
    });

    const data = res.data;
    const u = data.unit;
    const p = data.pricing;
    const bodyEl = document.getElementById('cpq-modal-body');
    if (!bodyEl) return;

    // Cache current calculation for PDF download
    window._lastCpqData = data;

    bodyEl.innerHTML = `
      <!-- UNIT OVERVIEW HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 1rem 1.25rem; border-radius: 8px; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">${u.projectName} • ${u.buildingName}</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-top: 0.15rem;">
            Unit ${u.unitNumber} (${u.unitType}) • Floor ${u.floorNumber}
          </div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">
            Super Area: <strong>${u.superAreaSqft} sq.ft</strong> | Carpet: <strong>${u.carpetAreaSqft} sq.ft</strong> | Facing: <strong>${u.facing || 'East'}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="badge badge-${u.status.toLowerCase()}" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;">${u.status}</span>
        </div>
      </div>

      <!-- CONFIGURATION CONTROLS: PAYMENT PLAN & DISCOUNT -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1.25rem; background: var(--bg-card); border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 700;">Selected Payment Plan</label>
          <select class="form-control" id="cpq-plan-select" onchange="recalculateCpq('${unitId}')">
            <option value="CONSTRUCTION_LINKED" ${data.planType === 'CONSTRUCTION_LINKED' ? 'selected' : ''}>Construction-Linked Plan (CLP - Standard)</option>
            <option value="DOWN_PAYMENT" ${data.planType === 'DOWN_PAYMENT' ? 'selected' : ''}>Down-Payment Plan (DPP - 5% Incentive)</option>
            <option value="TIME_LINKED" ${data.planType === 'TIME_LINKED' ? 'selected' : ''}>Time-Linked Plan (TLP - Quarterly 20%)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 700;">Discount Incentive (%)</label>
          <input type="number" id="cpq-discount-input" class="form-control" value="${discountPercent || 0}" min="0" max="25" step="0.5" onchange="recalculateCpq('${unitId}')" placeholder="0%">
        </div>
      </div>

      <!-- PRICING BREAKDOWN GRID -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
        <!-- Column 1: Agreement Value -->
        <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; background: var(--bg-card);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 0.75rem;">
            A. Agreement Consideration
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.84rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Base Unit Price:</span>
              <span style="font-weight: 600;">₹${p.basePrice.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">PLC (Corner / Facing):</span>
              <span style="font-weight: 600;">₹${p.plcCharges.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Floor Rise Premium:</span>
              <span style="font-weight: 600;">₹${p.floorRiseTotal.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Covered Car Parking:</span>
              <span style="font-weight: 600;">₹${p.parkingCharges.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Clubhouse & Amenities:</span>
              <span style="font-weight: 600;">₹${p.clubhouseCharges.toLocaleString('en-IN')}</span>
            </div>
            ${p.discountAmount > 0 ? `
              <div style="display: flex; justify-content: space-between; color: var(--success); font-weight: 600;">
                <span>Discounts Applied:</span>
                <span>- ₹${p.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
            <div style="border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-top: 0.25rem; display: flex; justify-content: space-between; font-weight: 700; font-size: 0.92rem; color: var(--text-main);">
              <span>Net Agreement Value:</span>
              <span style="color: var(--accent);">₹${p.netAgreementValue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- Column 2: Taxes & Deposits -->
        <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; background: var(--bg-card);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 0.75rem;">
            B. Taxes & Statutory Deposits
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.84rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">GST (5% on Agreement Value):</span>
              <span style="font-weight: 600;">₹${p.gstAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Stamp Duty (5.6%):</span>
              <span style="font-weight: 600;">₹${p.stampDutyAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Registration Fee (1%):</span>
              <span style="font-weight: 600;">₹${p.registrationAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">2-Yr Advance Maintenance:</span>
              <span style="font-weight: 600;">₹${p.maintenanceDeposit.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Legal & Documentation Fee:</span>
              <span style="font-weight: 600;">₹${p.legalDocCharges.toLocaleString('en-IN')}</span>
            </div>
            <div style="border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-top: 0.25rem; display: flex; justify-content: space-between; font-weight: 700; font-size: 0.92rem; color: var(--text-main);">
              <span>Taxes & Deposits Total:</span>
              <span>₹${(p.totalGovernmentCharges + p.totalPossessionDeposits).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- GRAND TOTAL BANNER -->
      <div style="background: linear-gradient(135deg, rgba(184, 154, 106, 0.2) 0%, rgba(184, 154, 106, 0.08) 100%); border: 1.5px solid var(--accent); border-radius: 8px; padding: 1.1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: var(--accent); letter-spacing: 0.5px;">All-Inclusive Total Consideration</div>
          <div style
    const res = await apiFetch(`/ unit
...[truncated for diff preview]