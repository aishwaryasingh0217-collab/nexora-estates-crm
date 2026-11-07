/* ==========================================================================
   NEXORA SALES WORKSPACE
   One mobile-first workspace for the people who actually sell:
     • Sales agents (telecallers + field agents)  → "Today" queue, leads, visits, inventory
     • Channel partners (brokers)                 → register clients, track status, earnings
     • Sales managers                             → team board, assignment, everything above
   Talks only to /api/workspace/* (scoped server-side) and /api/notifications/*.
   Loaded after app.js; uses its globals: state, getApiBase, logout, renderApp, toggleTheme, setViewMode.
   ========================================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // Website hook: remember who shared the link (?ref=<user id>) so the enquiry
  // the visitor submits is credited to that agent / partner.
  // ------------------------------------------------------------------------
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[0-9a-f-]{20,40}$/i.test(ref)) sessionStorage.setItem('nx_ref', ref);
  } catch (e) { /* storage blocked — attribution is best-effort */ }
  window.getShareReferrer = function () {
    try { return sessionStorage.getItem('nx_ref'); } catch (e) { return null; }
  };

  const FIELD_ROLES = ['INSIDE_SALES', 'OUTSIDE_SALES', 'CHANNEL_PARTNER'];
  const brand = () => (W.me && W.me.company && W.me.company.company_name) || 'Nexora Estates';
  const shortBrand = () => (W.me && W.me.company && W.me.company.short_name) || brand().split(' ')[0];

  const BUCKETS = [
    ['NEW', 'New'], ['CONTACTED', 'Follow-up'], ['VISIT', 'Visit fixed'], ['VISITED', 'Visited'],
    ['NEGOTIATION', 'Negotiation'], ['BOOKED', 'Booked'], ['LOST', 'Lost']
  ];
  const BUCKET_LABEL = Object.fromEntries(BUCKETS);
  const PIPELINE = ['NEW', 'CONTACTED', 'VISIT', 'VISITED', 'NEGOTIATION', 'BOOKED'];

  const SOURCES = [
    ['WALK_IN', 'Walk-in'], ['DIRECT_CALL', 'Direct call'], ['REFERRAL', 'Referral'],
    ['WHATSAPP', 'WhatsApp'], ['SOCIAL_MEDIA', 'Social media'], ['OTHER', 'Other']
  ];
  const SOURCE_LABEL = {
    WEBSITE: 'Website', WEBSITE_FORM: 'Website', FACEBOOK_ADS: 'Facebook ads', GOOGLE_ADS: 'Google ads',
    '99ACRES': '99acres', MAGICBRICKS: 'MagicBricks', CHANNEL_PARTNER: 'Partner', WALK_IN: 'Walk-in', 'WALK IN': 'Walk-in',
    DIRECT_CALL: 'Direct call', REFERRAL: 'Referral', WHATSAPP: 'WhatsApp', SOCIAL_MEDIA: 'Social media', INSTAGRAM: 'Instagram', OTHER: 'Other',
    PRIORITY_PASS: 'Priority pass', GROUP_BUY: 'Group buy', RESALE_OFFER: 'Resale offer', WEBSITE_RENTAL: 'Website (rent)', HOUSING_COM: 'Housing.com'
  };
  const LOST_REASONS = ['Budget mismatch', 'Location', 'Bought elsewhere', 'Not reachable', 'Just browsing', 'Loan not approved'];

  const W = {
    me: null,
    tab: null,
    today: null,
    leads: { bucket: 'OPEN', q: '', view: '', agentId: '', data: null, counts: {} },
    cal: { start: null, day: null, agentId: '', data: null },
    reports: { days: 30, data: null },
    activity: null,
    visitIndex: {},
    pulseV: null,
    projects: null,
    team: null,
    members: null,
    earnings: null,
    notif: { open: false, list: [], unread: 0, timer: null },
    sheetStack: [],
    searchTimer: null,
    renderedAt: 0,
    meReq: null,
    projectsReq: null
  };

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fullName = (a, b) => [a, b].filter(Boolean).join(' ');
  const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const digits = (p) => String(p || '').replace(/\D/g, '');
  const waNumber = (p) => { const d = digits(p); return d.length === 10 ? '91' + d : d; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function money(v) {
    const n = Number(v) || 0;
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2).replace(/\.?0+$/, '')} Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1).replace(/\.0$/, '')} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  }
  const moneyFull = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;

  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dayDiff = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  const timeStr = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

  function dayLabel(d) {
    const diff = dayDiff(d);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const fmtWhen = (d) => (d ? `${dayLabel(d)}, ${timeStr(d)}` : '—');

  function fmtAgo(d) {
    if (!d) return '';
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function dueBadge(d) {
    if (!d) return '';
    const ms = new Date(d).getTime() - Date.now();
    if (ms < 0) {
      const h = Math.floor(-ms / 3600000);
      const label = h < 1 ? 'Due now' : h < 24 ? `${h}h overdue` : `${Math.floor(h / 24)}d overdue`;
      return `<span class="ws-due is-late">${label}</span>`;
    }
    return `<span class="ws-due">${dayDiff(d) === 0 ? timeStr(d) : fmtWhen(d)}</span>`;
  }

  const toLocalInput = (d) => {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 16);
  };

  /** Keep suggested follow-up times inside working hours (mirrors the server rule). */
  function smartTime(date) {
    const cfg = (W.me && W.me.config) || { workStartHour: 9, workEndHour: 20 };
    const d = new Date(date);
    if (d.getHours() < cfg.workStartHour) d.setHours(cfg.workStartHour + 1, 0, 0, 0);
    else if (d.getHours() >= cfg.workEndHour) { d.setDate(d.getDate() + 1); d.setHours(cfg.workStartHour + 1, 0, 0, 0); }
    return d;
  }
  const daysAt = (days, hour, min = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, min, 0, 0); return d; };

  function followUpPresets() {
    const now = new Date();
    const list = [['In 1 hour', smartTime(new Date(Date.now() + 3600000))]];
    if (now.getHours() < 17) list.push(['This evening', daysAt(0, 18)]);
    list.push(['Tomorrow 11 AM', daysAt(1, 11)], ['In 2 days', daysAt(2, 11)], ['Next week', daysAt(7, 11)]);
    return list;
  }

  // ------------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------------
  async function api(path, options = {}) {
    const base = typeof getApiBase === 'function' ? getApiBase() : '/api';
    const res = await fetch(`${base}/workspace${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (res.status === 401) { logout(); throw new Error('Session expired. Please sign in again.'); }
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      Object.assign(err, { status: res.status, code: data.code, leadId: data.lead_id });
      throw err;
    }
    return data;
  }

  async function notifApi(path, method = 'GET') {
    const base = typeof getApiBase === 'function' ? getApiBase() : '/api';
    const res = await fetch(`${base}/notifications${path}`, { method, headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Notifications unavailable');
    return res.json();
  }

  // ------------------------------------------------------------------------
  // Icons (inline, stroke-based)
  // ------------------------------------------------------------------------
  const ICONS = {
    today: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    visits: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    projects: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/>',
    team: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    earnings: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    nav: '<path d="m3 11 19-9-9 19-2-8-8-2z"/>',
    note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    key: '<path d="M2 18v3h3l9.6-9.6a5.5 5.5 0 1 0-3-3L2 18z"/><circle cx="16.5" cy="7.5" r="1.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16h5M7 12h9M7 8h12"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    sync: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    install: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>'
  };
  const icon = (name, cls = '') => `<svg class="ws-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // ------------------------------------------------------------------------
  // Shell
  // ------------------------------------------------------------------------
  function tabsFor(kind) {
    if (kind === 'partner') return [['today', 'Home', 'home'], ['leads', 'Clients', 'leads'], ['calendar', 'Calendar', 'calendar'], ['projects', 'Projects', 'projects'], ['earnings', 'Earnings', 'earnings']];
    if (kind === 'manager') return [['team', 'Team', 'team'], ['leads', 'Leads', 'leads'], ['calendar', 'Calendar', 'calendar'], ['reports', 'Reports', 'chart'], ['projects', 'Projects', 'projects']];
    return [['today', 'Today', 'today'], ['leads', 'Leads', 'leads'], ['calendar', 'Calendar', 'calendar'], ['projects', 'Projects', 'projects']];
  }
  const kindFromRole = (role) => (role === 'CHANNEL_PARTNER' ? 'partner' : ['INSIDE_SALES', 'OUTSIDE_SALES'].includes(role) ? 'agent' : 'manager');
  const roleLabel = (role) => ({ INSIDE_SALES: 'Sales agent', OUTSIDE_SALES: 'Field agent', CHANNEL_PARTNER: 'Channel partner', ADMIN: 'Sales manager', SUPER_ADMIN: 'Super admin' }[role] || role);

  window.shouldRenderWorkspace = function () {
    const role = state.user && state.user.role;
    if (!state.token || !role) return false;
    let surface = null;
    try { surface = localStorage.getItem('crm_surface'); } catch (e) { /* ignore */ }
    if (surface === 'crm') return false; // Full CRM explicitly chosen by user
    if (FIELD_ROLES.includes(role)) return surface !== 'crm';
    if (role === 'ADMIN') return surface !== 'crm';
    if (role === 'SUPER_ADMIN') return surface === 'workspace';
    return false;
  };

  window.openWorkspace = function () {
    try { localStorage.setItem('crm_surface', 'workspace'); } catch (e) { /* ignore */ }
    renderApp();
  };
  window.openFullCrm = function () {
    try { localStorage.setItem('crm_surface', 'crm'); } catch (e) { /* ignore */ }
    state.currentView = 'dashboard';
    stopPolling();
    renderApp();
  };

  window.renderWorkspace = function (root) {
    const kind = kindFromRole(state.user.role);
    const existing = root.querySelector(':scope > .ws');
    if (existing && existing.dataset.uid === String(state.user.id) && Date.now() - W.renderedAt < 800) return;
    W.renderedAt = Date.now();
    const tabs = tabsFor(kind);
    if (!W.tab || !tabs.some((t) => t[0] === W.tab)) {
      let saved = null;
      try { saved = sessionStorage.getItem(`ws_tab_${kind}`); } catch (e) { /* ignore */ }
      W.tab = tabs.some((t) => t[0] === saved) ? saved : tabs[0][0];
    }
    const name = state.user.firstName || state.user.first_name || state.user.username;
    const canCrm = true; // All roles can access CRM views
    const isStaff = kind !== 'partner';

    root.innerHTML = `
      <div class="ws" data-kind="${kind}" data-uid="${esc(String(state.user.id))}">
        <header class="ws-top">
          <div class="ws-brand">
            <div class="ws-logo" id="ws-logo">${logoHtml()}</div>
            <div class="ws-brand-text">
              <strong id="ws-brand-name">${esc(brand())}</strong>
              <span id="ws-subtitle">${esc(roleLabel(state.user.role))}</span>
            </div>
          </div>
          <div class="ws-top-actions">
            <!-- 🔀 Workspace Role Portal Switcher -->
            <div class="portal-switcher-wrapper" style="position: relative; display: inline-block;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="togglePortalSwitcher()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; font-weight: 700; padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer; background: #0F172A; color: #FFFFFF; border: none;">
                <span>🔀 Portal</span>
                <span style="font-size: 0.6rem;">▼</span>
              </button>
              <div id="portal-switcher-menu" style="display: none; position: absolute; right: 0; top: 125%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 16px 36px rgba(15,23,42,0.18); width: 240px; z-index: 1000; padding: 0.5rem; text-align: left;">
                <div style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #64748b; padding: 0.35rem 0.6rem; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; margin-bottom: 0.35rem;">
                  Switch Role Portal
                </div>
                <button onclick="switchPortalAs('SUPER_ADMIN')" style="width: 100%; text-align: left; padding: 0.45rem 0.6rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                  👑 Super Admin (Director)
                </button>
                <button onclick="switchPortalAs('ADMIN')" style="width: 100%; text-align: left; padding: 0.45rem 0.6rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                  💼 Sales Manager (Admin)
                </button>
                <button onclick="switchPortalAs('INSIDE_SALES')" style="width: 100%; text-align: left; padding: 0.45rem 0.6rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                  📞 Inside Sales (Telecaller)
                </button>
                <button onclick="switchPortalAs('OUTSIDE_SALES')" style="width: 100%; text-align: left; padding: 0.45rem 0.6rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                  📍 Outside Sales (Site Agent)
                </button>
                <button onclick="switchPortalAs('CHANNEL_PARTNER')" style="width: 100%; text-align: left; padding: 0.45rem 0.6rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                  🤝 Channel Partner (Broker Desk)
                </button>
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openFullCrm()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; font-weight: 700; padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer; background: #0284c7; color: #ffffff; border: none;">
              <span>📊 Full CRM</span>
            </button>
            ${isStaff ? `<button class="ws-avail" id="ws-avail" data-action="toggle-availability" aria-pressed="true"><span class="dot"></span><span class="lbl">Available</span></button>` : ''}
            <button class="ws-icon-btn" data-action="toggle-notifs" aria-label="Notifications">${icon('bell')}<span class="ws-badge" id="ws-notif-badge" hidden>0</span></button>
            <button class="ws-icon-btn" data-action="theme" aria-label="Toggle theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
            <button class="ws-me" data-action="toggle-menu" aria-label="Account menu"><span class="ws-avatar sm">${esc(initials(fullName(state.user.firstName, state.user.lastName) || name))}</span></button>
          </div>
          <div class="ws-menu" id="ws-menu" hidden>
            <div class="ws-menu-head"><strong>${esc(fullName(state.user.firstName, state.user.lastName) || name)}</strong><span>${esc(roleLabel(state.user.role))}</span></div>
            ${canCrm ? `<button data-action="open-crm">${icon('grid')} Full CRM &amp; reports</button>` : ''}
            <button data-action="install-app" class="ws-install-item" hidden>${icon('install')} Install app on this device</button>
            <button data-action="enable-alerts" class="ws-alerts-item">${icon('bell')} <span>Turn on phone alerts</span></button>
            <button data-action="sync-calendar">${icon('sync')} Sync visits to my calendar</button>
            ${state.user.role === 'SUPER_ADMIN' ? `<button data-action="company-settings">${icon('key')} Company & branding</button>` : ''}
            <button data-action="open-website">${icon('globe')} View public website</button>
            <button data-action="logout">${icon('logout')} Sign out</button>
          </div>
          <div class="ws-notifs" id="ws-notifs" hidden></div>
        </header>
        <nav class="ws-nav" aria-label="Workspace">
          ${tabs.map(([key, label, ic]) => `<button class="ws-tab ${W.tab === key ? 'is-active' : ''}" data-action="tab" data-tab="${key}">${icon(ic)}<span>${label}</span></button>`).join('')}
        </nav>
        <main class="ws-main" id="ws-main"><div class="ws-loading">Loading…</div></main>
        <button class="ws-fab" data-action="${kind === 'partner' ? 'register-client' : 'add-lead'}">${icon('plus')}<span>${kind === 'partner' ? 'Register client' : 'Add lead'}</span></button>
        <div class="ws-sheet-host" id="ws-sheet-host"></div>
        <div class="ws-toast" id="ws-toast" role="status" aria-live="polite"></div>
      </div>`;

    if (!root.__wsBound) {
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('submit', onSubmit);
      root.addEventListener('change', onChange);
      root.__wsBound = true;
    }
    bootstrap();
  };

  async function bootstrap() {
    try {
      if (!W.me) {
        W.meReq = W.meReq || api('/me').finally(() => { W.meReq = null; });
        W.me = (await W.meReq).data;
      }
      ensureProjects().catch(() => {});
      paintBrand();
      paintAvailability();
      const sub = document.getElementById('ws-subtitle');
      if (sub && W.me.firm) sub.textContent = W.me.firm.name;
    } catch (e) {
      main(`<div class="ws-empty"><h3>Couldn't open your workspace</h3><p>${esc(e.message)}</p></div>`);
      return;
    }
    loadTab();
    startPolling();
    paintInstallEntry();
    paintAlertsEntry();
    if (pushSupported() && Notification.permission === 'granted') subscribePush(false).catch(() => {});
    // Opened from a push alert: ?lead=<id>
    const fromPush = new URLSearchParams(location.search).get('lead');
    if (fromPush) {
      history.replaceState(null, '', location.pathname + location.hash);
      openLead(fromPush).catch(() => {});
    }
  }

  function paintAvailability() {
    const btn = document.getElementById('ws-avail');
    if (!btn || !W.me) return;
    btn.classList.toggle('is-off', !W.me.isAvailable);
    btn.setAttribute('aria-pressed', String(!!W.me.isAvailable));
    btn.querySelector('.lbl').textContent = W.me.isAvailable ? 'Available' : 'On leave';
  }

  function main(html) {
    const el = document.getElementById('ws-main');
    if (el) el.innerHTML = html;
  }

  function setTab(tab) {
    W.tab = tab;
    try { sessionStorage.setItem(`ws_tab_${W.me ? W.me.kind : 'x'}`, tab); } catch (e) { /* ignore */ }
    document.querySelectorAll('.ws-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    window.scrollTo({ top: 0 });
    loadTab();
  }

  function loadTab() {
    const loaders = { today: loadToday, leads: loadLeads, calendar: loadCalendar, reports: loadReports, projects: loadProjects, team: loadTeam, earnings: loadEarnings };
    return (loaders[W.tab] || loadToday)();
  }

  /** Re-loads the open tab. quiet: keep the scroll position (used by live updates). */
  async function refreshCurrent(opts = {}) {
    const y = window.scrollY;
    await loadTab();
    if (opts.quiet) window.scrollTo(0, y);
  }

  // ------------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------------
  let toastTimer = null;
  function toast(msg, kind = 'ok') {
    const el = document.getElementById('ws-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `ws-toast is-show is-${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'ws-toast'; }, kind === 'err' ? 5200 : 3200);
  }

  // ------------------------------------------------------------------------
  // TODAY (agents & managers' own queue)
  // ------------------------------------------------------------------------
  async function loadToday() {
    if (W.me.kind === 'partner') return loadPartnerHome();
    if (W.today) paintToday();
    try {
      W.today = (await api('/today')).data;
      paintToday();
    } catch (e) {
      main(errorBox(e));
    }
  }

  function paintToday() {
    const t = W.today;
    setTimeout(paintSetupCard, 0);
    if (!t) return;
    const s = t.stats;
    const done = s.doneToday;
    const total = done + s.remaining;
    const pct = total ? Math.round((done / total) * 100) : 100;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const visitsLeft = t.visits.filter((v) => v.status === 'SCHEDULED');
    const allClear = s.remaining === 0;

    main(`
      <section class="ws-hero">
        <div>
          <p class="ws-eyebrow">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${greet}, ${esc(W.me.firstName || '')}</h1>
          <p class="ws-hero-sub">${allClear ? 'Nothing pending. Nice work.' : `${plural(s.remaining, 'thing')} to do today${visitsLeft.length ? ` · ${plural(visitsLeft.length, 'visit')}` : ''}`}</p>
        </div>
        <div class="ws-ring" style="--p:${pct}" title="${done} done today">
          <div><strong>${done}</strong><span>done</span></div>
        </div>
      </section>
      ${!W.me.isAvailable ? `<div class="ws-banner">${icon('moon')}<div><strong>You're on leave.</strong> New leads are going to your teammates. Switch back to <em>Available</em> when you return.</div></div>` : ''}
      <div class="ws-stat-row">
        <div class="ws-stat"><strong>${s.openLeads}</strong><span>Open leads</span></div>
        <div class="ws-stat"><strong>${s.visitsMonth}</strong><span>Visits this month</span></div>
        <div class="ws-stat"><strong>${s.bookingsMonth}</strong><span>Bookings this month</span></div>
      </div>
      ${section('Call first — new enquiries', t.fresh, 'fresh', 'Fresh leads convert best when called within the hour.')}
      ${section('Overdue follow-ups', t.overdue, 'late')}
      ${t.visits.length ? `
        <section class="ws-section">
          <header class="ws-section-head"><h2>Site visits today</h2><span class="ws-count">${t.visits.length}</span></header>
          <div class="ws-list">${t.visits.map(visitCard).join('')}</div>
        </section>` : ''}
      ${section('Later today', t.later, 'later')}
      ${allClear ? `
        <div class="ws-empty is-done">
          <div class="ws-empty-ic">${icon('check')}</div>
          <h3>You're all caught up</h3>
          <p>No follow-ups or visits left for today. Log off on time — tomorrow's list will be waiting.</p>
        </div>` : ''}
    `);
  }

  function section(title, leads, tone, hint) {
    if (!leads || !leads.length) return '';
    return `
      <section class="ws-section ${tone ? `is-${tone}` : ''}">
        <header class="ws-section-head"><h2>${title}</h2><span class="ws-count">${leads.length}</span></header>
        ${hint ? `<p class="ws-hint">${hint}</p>` : ''}
        <div class="ws-list">${leads.map((l) => leadCard(l, tone)).join('')}</div>
      </section>`;
  }

  function tempChip(t) {
    if (!t) return '';
    return `<span class="ws-temp is-${t.toLowerCase()}">${t === 'HOT' ? 'Hot' : t === 'WARM' ? 'Warm' : 'Cold'}</span>`;
  }

  function leadCard(l, tone) {
    const name = fullName(l.first_name, l.last_name);
    const isPartner = W.me.kind === 'partner';
    let timing = '';
    if (tone === 'fresh') timing = `<span class="ws-due is-new">${fmtAgo(l.created_at)}</span>`;
    else if (l.next_visit_at) timing = `<span class="ws-due is-visit">${icon('visits')} ${fmtWhen(l.next_visit_at)}</span>`;
    else if (l.next_follow_up_at && !['BOOKED', 'LOST'].includes(l.bucket)) timing = dueBadge(l.next_follow_up_at);

    const meta = [l.project_name, SOURCE_LABEL[l.source] || (l.source || '').toLowerCase()].filter(Boolean).map(esc).join(' · ');
    const extra = [];
    if (l.partner_firm && !isPartner) extra.push(`<span class="ws-tag is-partner">${icon('shield')} ${esc(l.partner_firm)}</span>`);
    if (W.me.kind === 'manager') extra.push(`<span class="ws-tag">${l.agent_name ? esc(l.agent_name) : '<em>Unassigned</em>'}</span>`);
    if (isPartner && l.agent_name) extra.push(`<span class="ws-tag">RM: ${esc(l.agent_name)}</span>`);

    const actions = isPartner
      ? `<button class="ws-act" data-action="open-lead" data-id="${l.id}">${icon('chevron')} Status</button>`
      : ['BOOKED', 'LOST'].includes(l.bucket) ? '' : `
        <a class="ws-act is-call" href="tel:${esc(digits(l.phone))}" data-action="call" data-id="${l.id}">${icon('phone')} Call</a>
        <button class="ws-act is-wa" data-action="whatsapp" data-id="${l.id}">${icon('chat')} WhatsApp</button>
        <button class="ws-act is-log" data-action="log" data-id="${l.id}">${icon('check')} Log</button>`;

    return `
      <article class="ws-card ws-lead" data-bucket="${l.bucket}">
        <button class="ws-lead-main" data-action="open-lead" data-id="${l.id}">
          <span class="ws-avatar">${esc(initials(name))}</span>
          <span class="ws-lead-body">
            <span class="ws-lead-top"><strong>${esc(name)}</strong>${tempChip(l.temperature)}${timing}</span>
            <span class="ws-lead-meta">${meta || '&nbsp;'}</span>
            ${l.last_note ? `<span class="ws-lead-note">“${esc(l.last_note)}”</span>` : ''}
            ${extra.length || W.tab === 'leads' ? `<span class="ws-lead-tags">${W.tab === 'leads' ? `<span class="ws-stage is-${l.bucket.toLowerCase()}">${BUCKET_LABEL[l.bucket]}</span>` : ''}${extra.join('')}</span>` : ''}
          </span>
        </button>
        ${actions ? `<div class="ws-card-actions">${actions}</div>` : ''}
      </article>`;
  }

  function visitCard(v) {
    W.visitIndex[v.id] = v;
    const name = fullName(v.first_name, v.last_name) || 'Client';
    const isPast = new Date(v.scheduled_time).getTime() < Date.now() - 30 * 60000;
    const done = v.status !== 'SCHEDULED';
    const isPartner = W.me.kind === 'partner';
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.project_name, v.location, v.city].filter(Boolean).join(', '))}`;
    const statusChip = { COMPLETED: '<span class="ws-chip is-ok">Done</span>', NO_SHOW: '<span class="ws-chip is-bad">No-show</span>', CANCELLED: '<span class="ws-chip">Cancelled</span>' }[v.status] || (isPast ? '<span class="ws-chip is-warn">Update status</span>' : '');

    return `
      <article class="ws-card ws-visit ${done ? 'is-done' : ''}">
        <div class="ws-visit-time"><strong>${timeStr(v.scheduled_time)}</strong><span>${dayLabel(v.scheduled_time)}</span>${v.ics && !done ? `<button class="ws-addcal" data-action="add-cal" data-id="${v.id}" aria-label="Add to my calendar">${icon('calendar')}<span>Add</span></button>` : ''}</div>
        <button class="ws-visit-body" data-action="open-lead" data-id="${v.lead_id}">
          <span class="ws-lead-top"><strong>${esc(name)}</strong>${tempChip(v.temperature)}${statusChip}</span>
          <span class="ws-lead-meta">${esc(v.project_name)}${v.city ? ` · ${esc(v.city)}` : ''}</span>
          ${v.partner_firm && !isPartner ? `<span class="ws-lead-tags"><span class="ws-tag is-partner">${icon('shield')} ${esc(v.partner_firm)}</span></span>` : ''}
          ${v.agent_name && (isPartner || W.me.kind === 'manager' || v.assigned_agent_id !== W.me.id) ? `<span class="ws-lead-meta">${v.assigned_agent_id === W.me.id ? 'You' : `With ${esc(v.agent_name)}`}</span>` : ''}
        </button>
        ${done ? '' : `
        <div class="ws-card-actions">
          ${isPartner
            ? `${v.agent_phone ? `<a class="ws-act is-call" href="tel:${esc(digits(v.agent_phone))}">${icon('phone')} Call RM</a>` : ''}
               <button class="ws-act" data-action="visit-reschedule" data-id="${v.id}" data-lead="${v.lead_id}">${icon('calendar')} Reschedule</button>`
            : `<a class="ws-act is-call" href="tel:${esc(digits(v.phone))}">${icon('phone')} Call</a>
               <a class="ws-act" href="${maps}" target="_blank" rel="noopener">${icon('nav')} Directions</a>
               <button class="ws-act is-log" data-action="visit-outcome" data-id="${v.id}" data-lead="${v.lead_id}">${icon('check')} Update</button>`}
        </div>`}
      </article>`;
  }

  // ------------------------------------------------------------------------
  // PARTNER HOME
  // ------------------------------------------------------------------------
  async function loadPartnerHome() {
    try {
      W.today = (await api('/today')).data;
    } catch (e) {
      return main(errorBox(e));
    }
    const t = W.today;
    if (t.unlinked) {
      return main(`<div class="ws-empty"><h3>Your login isn't linked to a partner firm yet</h3><p>Ask the sales manager to link your account, then sign in again.</p></div>`);
    }
    const firm = W.me.firm || {};
    setTimeout(paintSetupCard, 0);
    main(`
      <section class="ws-hero">
        <div>
          <p class="ws-eyebrow">${esc(firm.name || 'Partner desk')}${firm.tier ? ` · ${esc(firm.tier.charAt(0) + firm.tier.slice(1).toLowerCase())} partner` : ''}</p>
          <h1>Hello, ${esc(W.me.firstName || '')}</h1>
          <p class="ws-hero-sub">Register a client once — we'll protect them for ${W.me.config.protectionDays} days and keep you posted at every step.</p>
        </div>
      </section>
      <button class="ws-cta" data-action="register-client">${icon('plus')}<span><strong>Register a client</strong><small>Duplicate check is instant</small></span></button>
      <div class="ws-stat-row is-4">
        <button class="ws-stat" data-action="tab" data-tab="leads"><strong>${t.stats.activeClients}</strong><span>Active clients</span></button>
        <div class="ws-stat"><strong>${t.stats.upcomingVisits}</strong><span>Upcoming visits</span></div>
        <div class="ws-stat"><strong>${t.stats.bookings}</strong><span>Bookings</span></div>
        <button class="ws-stat is-money" data-action="tab" data-tab="earnings"><strong>${money(t.stats.pendingEarnings)}</strong><span>Pending payout</span></button>
      </div>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Upcoming site visits</h2><span class="ws-count">${t.visits.length}</span></header>
        ${t.visits.length ? `<div class="ws-list">${t.visits.map(visitCard).join('')}</div>` : '<p class="ws-muted-box">No visits scheduled. Open a client to request one.</p>'}
      </section>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Latest updates on your clients</h2></header>
        ${t.updates.length ? `<ol class="ws-feed">${t.updates.map((u) => `
          <li>
            <button data-action="open-lead" data-id="${u.lead_id}">
              <span class="ws-feed-dot is-${u.type.toLowerCase()}"></span>
              <span><strong>${esc(fullName(u.first_name, u.last_name))}</strong><span class="ws-feed-text">${esc(activityText(u))}</span><small>${fmtAgo(u.created_at)} · ${esc(u.by_name)}</small></span>
            </button>
          </li>`).join('')}</ol>` : '<p class="ws-muted-box">Updates from the sales team will show up here.</p>'}
      </section>
    `);
  }

  const OUTCOME_TEXT = {
    NO_ANSWER: 'Called — no answer', CALLBACK: 'Called — asked to call back', INTERESTED: 'Called — interested',
    NEGOTIATING: 'Discussing price & terms', NOT_INTERESTED: 'Not interested', WHATSAPP_SENT: 'Details sent on WhatsApp',
    SCHEDULED: 'Site visit scheduled', COMPLETE: 'Site visit done', NO_SHOW: 'Missed the site visit', CANCEL: 'Site visit cancelled',
    RESCHEDULE: 'Site visit rescheduled', CREATED: 'Lead created', REGISTERED: 'Registered', RE_ENQUIRY: 'Enquired again', BOOKED: 'Booked!'
  };
  function activityText(a) {
    if (a.type === 'ASSIGN' || a.type === 'STAGE') return a.note || a.type;
    const base = OUTCOME_TEXT[a.outcome] || (a.type === 'NOTE' ? 'Note' : a.type.toLowerCase());
    if (!a.note) return base;
    if (['VISIT', 'BOOKING', 'SYSTEM'].includes(a.type)) return a.note;
    return `${base}: ${a.note}`;
  }

  // ------------------------------------------------------------------------
  // LEADS
  // ------------------------------------------------------------------------
  async function loadLeads() {
    paintLeadsShell();
    const L = W.leads;
    const qs = new URLSearchParams();
    if (L.bucket) qs.set('bucket', L.bucket);
    if (L.q) qs.set('q', L.q);
    if (L.view) qs.set('view', L.view);
    if (L.agentId) qs.set('agent_id', L.agentId);
    try {
      if (W.me.kind === 'manager' && !W.members) W.members = (await api('/team/members')).data;
      const res = await api(`/leads?${qs}`);
      L.data = res.data;
      L.counts = res.counts || {};
      paintLeadsShell();
      paintLeadList();
    } catch (e) {
      const list = document.getElementById('ws-lead-list');
      if (list) list.innerHTML = errorBox(e);
    }
  }

  function paintLeadsShell() {
    if (document.getElementById('ws-leads-shell')) {
      paintLeadChips();
      return;
    }
    const isMgr = W.me.kind === 'manager';
    main(`
      <div id="ws-leads-shell">
        <div class="ws-page-head ws-cal-head">
          <h1>${W.me.kind === 'partner' ? 'My clients' : isMgr ? 'All leads' : 'My leads'}</h1>
          <div class="ws-head-actions">
            ${isMgr ? `<button class="ws-btn is-ghost" data-action="import-leads">${icon('download')} Import</button>` : ''}
            <button class="ws-btn is-ghost" data-action="export-leads">${icon('file')} Export</button>
          </div>
        </div>
        <div class="ws-search">
          ${icon('search')}
          <input id="ws-lead-search" type="search" placeholder="Search name, phone or project" value="${esc(W.leads.q)}" autocomplete="off" />
        </div>
        ${isMgr ? `
          <div class="ws-filter-row">
            <select id="ws-agent-filter" class="ws-select" aria-label="Filter by agent">
              <option value="">Everyone</option>
              ${(W.members || []).map((m) => `<option value="${m.id}" ${W.leads.agentId === m.id ? 'selected' : ''}>${esc(m.name)}${m.is_available ? '' : ' (on leave)'}</option>`).join('')}
            </select>
            <button class="ws-chip-btn ${W.leads.view === 'unassigned' ? 'is-on' : ''}" data-action="lead-view" data-view="unassigned">Unassigned</button>
            <button class="ws-chip-btn ${W.leads.view === 'overdue' ? 'is-on' : ''}" data-action="lead-view" data-view="overdue">Overdue</button>
            <button class="ws-chip-btn ${W.leads.view === 'stale' ? 'is-on' : ''}" data-action="lead-view" data-view="stale">No next step</button>
          </div>` : ''}
        <div class="ws-chips" id="ws-lead-chips"></div>
        <div id="ws-lead-banner"></div>
        <div class="ws-list" id="ws-lead-list"><div class="ws-loading">Loading…</div></div>
      </div>`);
    paintLeadChips();
  }

  function paintLeadChips() {
    const c = W.leads.counts || {};
    const openCount = ['NEW', 'CONTACTED', 'VISIT', 'VISITED', 'NEGOTIATION'].reduce((s, k) => s + (c[k] || 0), 0);
    const chips = [['OPEN', 'Open', openCount], ...BUCKETS.map(([k, label]) => [k, label, c[k] || 0]), ['', 'All', Object.values(c).reduce((a, b) => a + b, 0)]];
    const el = document.getElementById('ws-lead-chips');
    if (el) {
      el.innerHTML = chips.map(([k, label, n]) => `
        <button class="ws-chip-btn ${W.leads.bucket === k ? 'is-on' : ''}" data-action="lead-bucket" data-bucket="${k}">${label}<span>${n}</span></button>`).join('');
    }
  }

  function paintLeadList() {
    const list = document.getElementById('ws-lead-list');
    const banner = document.getElementById('ws-lead-banner');
    if (!list) return;
    const leads = W.leads.data || [];
    if (banner) {
      banner.innerHTML = W.me.kind === 'manager' && W.leads.view === 'unassigned' && leads.length
        ? `<div class="ws-banner is-action"><div><strong>${plural(leads.length, 'lead')} waiting for an owner.</strong> Share them fairly across available agents (fewest open leads first).</div><button class="ws-btn" data-action="distribute">${icon('shuffle')} Distribute</button></div>`
        : '';
    }
    list.innerHTML = leads.length
      ? leads.map((l) => leadCard(l)).join('')
      : `<div class="ws-empty"><h3>No leads here</h3><p>${W.leads.q ? 'Try a different search.' : W.me.kind === 'partner' ? 'Register your first client to get started.' : 'Nothing in this stage right now.'}</p></div>`;
  }

  // ------------------------------------------------------------------------
  // VISITS
  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // CALENDAR — visits + planned calls. Week strip & day agenda on phones, a week grid on desktop.
  // ------------------------------------------------------------------------
  const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

  async function loadCalendar() {
    const C = W.cal;
    if (!C.start) { C.start = startOfWeek(new Date()); C.day = ymd(new Date()); }
    if (!C.data) main('<div class="ws-loading">Loading calendar…</div>');
    try {
      if (W.me.kind === 'manager' && !W.members) W.members = (await api('/team/members').catch(() => ({ data: [] }))).data;
      const qs = `from=${ymd(C.start)}&to=${ymd(addDays(C.start, 7))}${C.agentId ? `&agent_id=${encodeURIComponent(C.agentId)}` : ''}`;
      C.data = (await api(`/calendar?${qs}`)).data;
    } catch (e) {
      return main(errorBox(e));
    }
    paintCalendar();
  }

  function calendarItems() {
    const C = W.cal;
    const byDay = {};
    const push = (key, item) => { (byDay[key] = byDay[key] || []).push(item); };
    for (const v of C.data.visits) push(ymd(v.scheduled_time), { kind: 'visit', at: new Date(v.scheduled_time), v });
    for (const f of C.data.followups) push(ymd(f.next_follow_up_at), { kind: 'call', at: new Date(f.next_follow_up_at), f });
    Object.values(byDay).forEach((list) => list.sort((a, b) => a.at - b.at));
    return byDay;
  }

  function paintCalendar() {
    const C = W.cal;
    const byDay = calendarItems();
    const days = Array.from({ length: 7 }, (_, i) => addDays(C.start, i));
    const today = ymd(new Date());
    if (!days.some((d) => ymd(d) === C.day)) C.day = ymd(days[0]);
    const monthLabel = (() => {
      const a = days[0].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const b = days[6].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return a === b ? a : `${days[0].toLocaleDateString('en-IN', { month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    })();
    const isMgr = W.me.kind === 'manager';
    const counts = (key) => {
      const list = byDay[key] || [];
      return { visits: list.filter((x) => x.kind === 'visit' && x.v.status !== 'CANCELLED').length, calls: list.filter((x) => x.kind === 'call').length };
    };

    const strip = days.map((d) => {
      const key = ymd(d);
      const c = counts(key);
      return `<button class="ws-day ${key === C.day ? 'is-on' : ''} ${key === today ? 'is-today' : ''}" data-action="cal-day" data-day="${key}" aria-pressed="${key === C.day}">
        <small>${d.toLocaleDateString('en-IN', { weekday: 'short' })}</small><strong>${d.getDate()}</strong>
        <span class="ws-day-dots">${c.visits ? `<i class="is-visit" title="${plural(c.visits, 'visit')}"></i>` : ''}${c.calls ? `<i class="is-call" title="${plural(c.calls, 'call')}"></i>` : ''}</span>
      </button>`;
    }).join('');

    const agenda = (key) => {
      const list = byDay[key] || [];
      if (!list.length) {
        const msg = key < today ? 'Nothing was planned.' : W.me.kind === 'partner' ? 'No site visits for your clients on this day.' : 'Nothing planned — a good day to call older leads.';
        return `<p class="ws-muted-box">${msg}</p>`;
      }
      const visits = list.filter((x) => x.kind === 'visit');
      const calls = list.filter((x) => x.kind === 'call');
      return `${visits.length ? `<div class="ws-list">${visits.map((x) => visitCard(x.v)).join('')}</div>` : ''}
        ${calls.length ? `<h3 class="ws-subhead">${plural(calls.length, 'planned call')}</h3><ul class="ws-callrows">${calls.map((x) => callRow(x.f)).join('')}</ul>` : ''}`;
    };

    const weekGrid = days.map((d) => {
      const key = ymd(d);
      const list = byDay[key] || [];
      return `<div class="ws-wk-col ${key === today ? 'is-today' : ''}">
        <header><small>${d.toLocaleDateString('en-IN', { weekday: 'short' })}</small><strong>${d.getDate()}</strong></header>
        ${list.map((x) => x.kind === 'visit'
          ? `<button class="ws-wk-item is-visit ${x.v.status !== 'SCHEDULED' ? 'is-closed' : ''}" data-action="open-lead" data-id="${x.v.lead_id}">
              <b>${timeStr(x.at)}</b><span>${esc(fullName(x.v.first_name, x.v.last_name) || 'Client')}</span><small>${esc(x.v.project_name)}${isMgr && x.v.agent_name ? ` · ${esc(x.v.agent_name.split(' ')[0])}` : ''}</small></button>`
          : `<button class="ws-wk-item is-call" data-action="open-lead" data-id="${x.f.id}">
              <b>${timeStr(x.at)}</b><span>${icon('phone')} ${esc(fullName(x.f.first_name, x.f.last_name))}</span>${isMgr && x.f.agent_name ? `<small>${esc(x.f.agent_name.split(' ')[0])}</small>` : ''}</button>`).join('') || '<p class="ws-wk-empty">—</p>'}
      </div>`;
    }).join('');

    const sel = new Date(`${C.day}T00:00:00`);
    main(`
      <div class="ws-page-head ws-cal-head">
        <div><h1>Calendar</h1><p class="ws-hero-sub">${esc(monthLabel)}</p></div>
        <div class="ws-cal-nav">
          <button class="ws-icon-btn" data-action="cal-prev" aria-label="Previous week">${icon('chevronLeft')}</button>
          <button class="ws-btn is-ghost" data-action="cal-today">Today</button>
          <button class="ws-icon-btn" data-action="cal-next" aria-label="Next week">${icon('chevron')}</button>
        </div>
      </div>
      <div class="ws-cal-tools">
        ${isMgr ? `<label class="ws-select-inline">${icon('leads')}<select id="ws-cal-agent" aria-label="Whose calendar"><option value="">Whole team</option>${(W.members || []).map((m) => `<option value="${m.id}" ${m.id === C.agentId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>` : ''}
        <span class="ws-legend"><i class="is-visit"></i>Site visit</span>${W.me.kind !== 'partner' ? '<span class="ws-legend"><i class="is-call"></i>Planned call</span>' : ''}
        <button class="ws-btn is-ghost ws-sync-btn" data-action="sync-calendar">${icon('sync')} Sync to phone calendar</button>
      </div>
      <div class="ws-cal-mobile">
        <div class="ws-week-strip">${strip}</div>
        <section class="ws-section">
          <header class="ws-section-head"><h2>${C.day === today ? 'Today' : sel.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2></header>
          ${agenda(C.day)}
        </section>
      </div>
      <div class="ws-cal-desktop"><div class="ws-week-grid">${weekGrid}</div></div>`);
  }

  function callRow(f) {
    const overdue = new Date(f.next_follow_up_at).getTime() < Date.now();
    return `<li class="ws-callrow">
      <button class="ws-callrow-main" data-action="open-lead" data-id="${f.id}">
        <b class="${overdue ? 'is-late' : ''}">${timeStr(f.next_follow_up_at)}</b>
        <span><strong>${esc(fullName(f.first_name, f.last_name))}</strong>${tempChip(f.temperature)}<small>${esc(f.project_name || 'No project yet')}${W.me.kind === 'manager' && f.agent_name ? ` · ${esc(f.agent_name)}` : ''}</small></span>
      </button>
      <a class="ws-icon-btn is-call" href="tel:${esc(digits(f.phone))}" data-action="call" data-id="${f.id}" aria-label="Call ${esc(fullName(f.first_name, f.last_name))}">${icon('phone')}</a>
    </li>`;
  }

  // ---- Add one visit to a calendar app ----
  function absApi(path) {
    return new URL(`${typeof getApiBase === 'function' ? getApiBase() : '/api'}${path}`, location.href).href;
  }
  function googleCalUrl(v) {
    const start = new Date(v.scheduled_time);
    const end = new Date(start.getTime() + 3600000);
    const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const client = fullName(v.first_name, v.last_name) || 'Client';
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Site visit: ${client} — ${v.project_name}`,
      dates: `${z(start)}/${z(end)}`,
      location: [v.project_name, v.location, v.city].filter(Boolean).join(', '),
      details: `Client: ${client}${v.phone ? ` (${v.phone})` : ''}${v.agent_name ? `\nSite agent: ${v.agent_name}` : ''}`
    });
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
  }
  function openAddToCalendar(visitId) {
    const v = W.visitIndex[visitId];
    if (!v || !v.ics) return toast('Calendar link unavailable for this visit.', 'err');
    const client = fullName(v.first_name, v.last_name) || 'Client';
    openSheet(`
      ${sheetHead('Add to my calendar', `${esc(client)} · ${esc(v.project_name)} · ${fmtWhen(v.scheduled_time)}`)}
      <div class="ws-sheet-body ws-choice-list">
        <a class="ws-choice" href="${esc(absApi(v.ics))}" download="site-visit.ics">${icon('calendar')}<span><strong>iPhone, Mac or Outlook</strong><small>Opens in your calendar with a 1-hour reminder</small></span></a>
        <a class="ws-choice" href="${esc(googleCalUrl(v))}" target="_blank" rel="noopener">${icon('globe')}<span><strong>Google Calendar</strong><small>Android phones and Gmail</small></span></a>
        <p class="ws-muted">Tip: use <b>Sync to phone calendar</b> once and every visit appears automatically.</p>
      </div>`, { key: 'addcal', title: 'Add to calendar' });
  }

  // ---- Subscribe once: every visit shows up in the phone's own calendar ----
  function openCalendarSync() {
    if (!W.me || !W.me.calendarFeed) return;
    const https = absApi(W.me.calendarFeed);
    const webcal = https.replace(/^https?:/, 'webcal:');
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    openSheet(`
      ${sheetHead('Sync visits to my calendar', 'Subscribe once — new, moved and cancelled visits update on their own.')}
      <div class="ws-sheet-body ws-choice-list">
        ${local ? '<p class="ws-banner is-warn">Calendar apps can only subscribe once the app is live on your domain (they can\'t reach localhost). The links below will work after deployment.</p>' : ''}
        <a class="ws-choice" href="${esc(webcal)}">${icon('calendar')}<span><strong>iPhone, iPad or Mac</strong><small>Tap, then “Subscribe”</small></span></a>
        <a class="ws-choice" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener">${icon('globe')}<span><strong>Google Calendar (Android)</strong><small>Adds “${esc(shortBrand())} visits” to your Google account</small></span></a>
        <a class="ws-choice" href="https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(`${shortBrand()} visits`)}" target="_blank" rel="noopener">${icon('grid')}<span><strong>Outlook (Windows)</strong><small>Outlook → Add calendar → Subscribe from web</small></span></a>
        <label class="ws-copyrow"><span>Private link — don't share it</span><input id="ws-feed-url" readonly value="${esc(https)}" /></label>
        <button class="ws-btn is-ghost is-block" data-action="copy-feed">${icon('copy')} Copy link</button>
      </div>`, { key: 'sync', title: 'Calendar sync' });
  }

  // ------------------------------------------------------------------------
  // REPORTS (manager) — five numbers a sales head runs the week on
  // ------------------------------------------------------------------------
  const fmtMins = (m) => {
    if (m === null || m === undefined) return '—';
    if (m < 60) return `${m} min`;
    if (m < 60 * 24) return `${(m / 60).toFixed(m < 600 ? 1 : 0).replace(/\.0$/, '')} h`;
    return `${(m / 1440).toFixed(1).replace(/\.0$/, '')} days`;
  };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  function hbar(label, value, max, tip, sub = '') {
    const w = max ? Math.max(value ? 2 : 0, (value / max) * 100) : 0;
    return `<div class="ws-hbar" tabindex="0" data-tip="${esc(tip)}">
      <span class="ws-hbar-label">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      <span class="ws-hbar-track"><span class="ws-hbar-fill" style="width:${w.toFixed(1)}%"></span></span>
      <span class="ws-hbar-value">${value.toLocaleString('en-IN')}</span>
    </div>`;
  }

  async function loadReports() {
    const R = W.reports;
    if (!R.data) main('<div class="ws-loading">Loading reports…</div>');
    try {
      R.data = (await api(`/reports?days=${R.days}`)).data;
    } catch (e) {
      return main(errorBox(e));
    }
    const { funnel: f, sources, agents, lost } = R.data;
    const steps = [
      ['New leads', f.leads, null],
      ['Contacted', f.contacted, f.leads],
      ['Visit fixed', f.visits_fixed, f.contacted],
      ['Visited', f.visits_done, f.visits_fixed],
      ['Booked', f.bookings, f.visits_done]
    ];
    const maxSource = Math.max(1, ...sources.map((x) => x.leads));
    const maxLost = Math.max(1, ...lost.map((x) => x.n));
    main(`
      <div class="ws-page-head ws-cal-head">
        <div><h1>Reports</h1><p class="ws-hero-sub">Last ${R.days} days · updates live</p></div>
        <div class="ws-seg" role="tablist" aria-label="Period">
          ${[7, 30, 90].map((d) => `<button class="${R.days === d ? 'is-on' : ''}" data-action="report-days" data-days="${d}" role="tab" aria-selected="${R.days === d}">${d} days</button>`).join('')}
        </div>
      </div>
      <div class="ws-stat-row is-4">
        <div class="ws-stat"><strong>${f.leads}</strong><span>New leads</span></div>
        <div class="ws-stat"><strong>${f.visits_done}</strong><span>Site visits done</span></div>
        <div class="ws-stat is-money"><strong>${f.bookings}</strong><span>Bookings · ${money(f.booking_value)}</span></div>
        <div class="ws-stat ${f.first_call_mins > 120 ? 'is-warn' : ''}"><strong>${fmtMins(f.first_call_mins)}</strong><span>Avg. time to first call</span></div>
      </div>
      <section class="ws-section ws-report">
        <header class="ws-section-head"><h2>Lead to booking</h2></header>
        <div class="ws-hbars">${steps.map(([label, v, prev]) => hbar(label, v, f.leads, `${label}: ${v}${prev !== null ? ` — ${pct(v, prev)}% of previous step` : ''}`, prev !== null ? `${pct(v, prev)}% of previous` : '')).join('')}</div>
      </section>
      <section class="ws-section ws-report">
        <header class="ws-section-head"><h2>Where leads come from</h2></header>
        ${sources.length ? `<div class="ws-hbars">${sources.map((x) => hbar(SOURCE_LABEL[x.source] || x.source.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), x.leads, maxSource, `${x.leads} leads · ${x.visited} visited · ${x.booked} booked`, `${x.visited} visited · ${x.booked} booked`)).join('')}</div>` : '<p class="ws-muted-box">No leads in this period.</p>'}
      </section>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Team</h2></header>
        ${agents.length ? `<div class="ws-table-wrap"><table class="ws-table">
          <thead><tr><th>Agent</th><th>Leads</th><th>Calls</th><th>Visits</th><th>Bookings</th><th>First call</th></tr></thead>
          <tbody>${agents.map((a) => `<tr>
            <td><strong>${esc(a.name)}</strong><span>${roleLabel(a.role)}</span></td>
            <td>${a.leads}</td><td>${a.calls}</td><td>${a.visits_done}</td><td>${a.bookings}</td>
            <td class="${a.first_call_mins > 120 ? 'is-warn' : ''}">${fmtMins(a.first_call_mins)}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="ws-muted-box">No active agents.</p>'}
      </section>
      <section class="ws-section ws-report">
        <header class="ws-section-head"><h2>Why leads were lost</h2></header>
        ${lost.length ? `<div class="ws-hbars">${lost.map((x) => hbar(x.reason, x.n, maxLost, `${x.reason}: ${x.n}`)).join('')}</div>` : '<p class="ws-muted-box">No lost leads in this period.</p>'}
      </section>`);
  }

  // ---- Team live feed ----
  function activityFeed(list) {
    if (!list || !list.length) return '<p class="ws-muted-box">Calls, visits and bookings from the whole team appear here as they happen.</p>';
    return `<ol class="ws-feed">${list.map((a) => `
      <li><button data-action="open-lead" data-id="${a.lead_id}">
        <span class="ws-feed-dot is-${a.type.toLowerCase()}"></span>
        <span><strong>${esc(fullName(a.first_name, a.last_name))}</strong><span class="ws-feed-text">${esc(activityText(a))}</span><small>${fmtAgo(a.created_at)} · ${esc(a.by_name)}${a.partner_firm ? ` · ${esc(a.partner_firm)}` : ''}</small></span>
      </button></li>`).join('')}</ol>`;
  }

  // ------------------------------------------------------------------------
  // BRANDING — the owner's company name & logo everywhere the app shows a name
  // ------------------------------------------------------------------------
  function paintBrand() {
    const name = document.getElementById('ws-brand-name');
    if (name) name.textContent = brand();
    const logo = document.getElementById('ws-logo');
    if (logo) logo.innerHTML = logoHtml();
    document.title = `${brand()} · ${roleLabel(state.user.role)}`;
  }
  function logoHtml() {
    const url = W.me && W.me.company && W.me.company.logo_url;
    if (url) return `<img src="${esc(url)}" alt="" />`;
    const words = brand().split(/\s+/).filter(Boolean);
    const mark = words.length > 1 ? initials(brand()) : brand().slice(0, 2).toUpperCase();
    return esc(mark.slice(0, 2) || 'RE');
  }

  function openCompanySettings() {
    const c = (W.me && W.me.company) || {};
    openSheet(`
      ${sheetHead('Company & branding', 'Shown on the app, the website enquiry form, calendar invites and alerts.')}
      <form class="ws-sheet-body ws-form" data-form="company">
        <label>Company name<input name="company_name" required maxlength="80" value="${esc(c.company_name || '')}" /></label>
        <label>Short name <span class="ws-muted">(app icon & alerts)</span><input name="short_name" maxlength="24" value="${esc(c.short_name || '')}" /></label>
        <label>Logo link <span class="ws-muted">(optional, https://…)</span><input name="logo_url" type="url" inputmode="url" maxlength="500" value="${esc(c.logo_url || '')}" placeholder="https://yourcompany.com/logo.png" /></label>
        <div class="ws-row2">
          <label>Sales phone<input name="support_phone" type="tel" maxlength="20" value="${esc(c.support_phone || '')}" /></label>
          <label>Sales email<input name="support_email" type="email" maxlength="120" value="${esc(c.support_email || '')}" /></label>
        </div>
        <label>Website <span class="ws-muted">(optional)</span><input name="website_url" type="url" inputmode="url" maxlength="200" value="${esc(c.website_url || '')}" placeholder="https://" /></label>
        <div class="ws-form-error" hidden></div>
        <button class="ws-btn is-primary is-block" type="submit">Save</button>
      </form>`, { key: 'company', title: 'Company settings' });
  }

  // ------------------------------------------------------------------------
  // PHONE ALERTS (Web Push) — new enquiries & visit changes even when the app is closed
  // ------------------------------------------------------------------------
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const pushNeedsInstall = () => window.NX && NX.isIOS && !NX.isStandalone();
  function keyBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
  }
  async function swReady() {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Alerts need the secure (https) version of the app.')), 5000));
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }
  /** prompt=true asks for permission (must follow a tap); false only refreshes an existing subscription. */
  async function subscribePush(prompt) {
    if (!pushSupported()) throw new Error(pushNeedsInstall() ? 'On iPhone, add the app to your Home Screen first, then turn on alerts.' : 'This browser cannot show alerts.');
    let perm = Notification.permission;
    if (perm === 'default' && prompt) perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Alerts are blocked. Allow notifications for this site in your browser settings.' : 'Alerts were not turned on.');
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = (await api('/push/key')).data;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    }
    const res = await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    if (W.me) W.me.pushDevices = res.data.devices;
    paintAlertsEntry();
    return res;
  }
  const alertsOn = () => pushSupported() && Notification.permission === 'granted' && W.me && W.me.pushDevices > 0;
  function paintAlertsEntry() {
    document.querySelectorAll('.ws-alerts-item').forEach((b) => {
      b.hidden = !pushSupported() && !pushNeedsInstall();
      b.dataset.action = alertsOn() ? 'test-alert' : 'enable-alerts';
      b.querySelector('span').textContent = alertsOn() ? 'Send a test alert' : 'Turn on phone alerts';
    });
  }

  // One setup card at a time on Today/Home: install the app first, then turn on alerts
  function paintSetupCard() {
    const host = document.getElementById('ws-main');
    if (!host || host.querySelector('.ws-install-card')) return;
    const dismissed = (k) => { try { return Boolean(localStorage.getItem(k)); } catch (e) { return false; } };
    if (installMode() && !dismissed('nx_install_dismissed')) return paintInstallCard();
    if (pushSupported() && Notification.permission === 'default' && !dismissed('nx_alerts_dismissed')) {
      host.insertAdjacentHTML('afterbegin', `
        <div class="ws-install-card">
          ${icon('bell')}
          <div><strong>Turn on alerts</strong><span>New enquiries and visit changes on this ${/Mobi/i.test(navigator.userAgent) ? 'phone' : 'computer'}, even when the app is closed.</span></div>
          <button class="ws-btn" data-action="enable-alerts">Turn on</button>
          <button class="ws-icon-btn" data-action="setup-dismiss" data-key="nx_alerts_dismissed" aria-label="Not now">${icon('x')}</button>
        </div>`);
    }
  }

  // ------------------------------------------------------------------------
  // IMPORT / EXPORT — bring leads in from Excel, take them out any time
  // ------------------------------------------------------------------------
  const IMPORT_FIELDS = {
    name: ['name', 'fullname', 'clientname', 'customername', 'leadname', 'contactname', 'buyername'],
    first_name: ['firstname', 'fname'],
    last_name: ['lastname', 'lname', 'surname'],
    phone: ['phone', 'mobile', 'mobileno', 'mobilenumber', 'phonenumber', 'phoneno', 'contact', 'contactno', 'contactnumber', 'number', 'whatsapp', 'whatsappnumber', 'cell'],
    email: ['email', 'emailid', 'emailaddress', 'mail'],
    project: ['project', 'projectname', 'property', 'interestedin', 'site'],
    source: ['source', 'leadsource', 'channel', 'platform', 'medium'],
    budget: ['budget', 'budgetinr', 'budgetrs', 'price', 'budgetrange'],
    stage: ['stage', 'status', 'leadstatus', 'leadstage'],
    notes: ['notes', 'note', 'remarks', 'remark', 'comment', 'comments', 'requirement', 'message', 'description']
  };
  const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : (firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  let sheetJs = null;
  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!sheetJs) {
      sheetJs = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => { sheetJs = null; reject(new Error('Could not load the Excel reader. Save the file as CSV and try again.')); };
        document.head.appendChild(s);
      });
    }
    return sheetJs;
  }

  async function readSpreadsheet(file) {
    if (/\.csv$|\.txt$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
    const XLSX = await loadSheetJs();
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  }

  function mapRows(table) {
    const [header, ...body] = table;
    const cols = {};
    (header || []).forEach((h, i) => {
      const n = normHeader(h);
      for (const [field, names] of Object.entries(IMPORT_FIELDS)) {
        if (cols[field] === undefined && names.includes(n)) { cols[field] = i; break; }
      }
    });
    const unknown = (header || []).filter((h, i) => h && !Object.values(cols).includes(i));
    const rows = body.map((r) => {
      const get = (f) => (cols[f] === undefined ? '' : String(r[cols[f]] == null ? '' : r[cols[f]]).trim());
      const name = get('name') || [get('first_name'), get('last_name')].filter(Boolean).join(' ');
      return { name, phone: get('phone'), email: get('email'), project: get('project'), source: get('source'), budget: get('budget'), stage: get('stage'), notes: get('notes') };
    }).filter((r) => r.name || r.phone);
    return { rows, cols, unknown };
  }

  function sampleCsv() {
    const csv = '﻿Name,Mobile,Email,Project,Source,Budget,Stage,Notes\r\n'
      + 'Ravi Kumar,9876543210,ravi@example.com,Greenfield Heights,Facebook ads,1.2 Cr,New,Wants 3BHK east facing\r\n'
      + 'Anita Shah,+91 98200 11223,,,Walk-in,85 L,Contacted,Call after 6 pm\r\n';
    return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  }

  async function openImport() {
    if (!W.members) W.members = (await api('/team/members').catch(() => ({ data: [] }))).data;
    W.importRows = null;
    openSheet(`
      ${sheetHead('Import leads', 'From Excel (.xlsx) or CSV. Duplicates are skipped automatically.')}
      <form class="ws-sheet-body ws-form" data-form="import">
        <label class="ws-file">
          <input type="file" name="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" required />
          <span>${icon('download')}<strong>Choose a file</strong><small>First row = column names: Name, Mobile, Email, Project, Source, Budget, Stage, Notes</small></span>
        </label>
        <a class="ws-link" href="${sampleCsv()}" download="lead-import-sample.csv">Download a sample file</a>
        <div id="ws-import-preview"></div>
        <label>Give these leads to
          <select name="assign_to">
            <option value="auto">Share fairly among available telecallers</option>
            ${(W.members || []).map((m) => `<option value="${m.id}">${esc(m.name)}${m.is_available ? '' : ' (on leave)'}</option>`).join('')}
          </select>
        </label>
        <div class="ws-form-error" hidden></div>
        <button class="ws-btn is-primary is-block" type="submit" disabled>Import</button>
      </form>`, { key: 'import', title: 'Import leads' });
  }

  async function previewImport(input) {
    const box = document.getElementById('ws-import-preview');
    const form = input.closest('form');
    const submit = form.querySelector('button[type="submit"]');
    const file = input.files && input.files[0];
    W.importRows = null;
    submit.disabled = true;
    if (!file) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="ws-muted">Reading the file…</p>';
    try {
      const { rows, cols, unknown } = mapRows(await readSpreadsheet(file));
      if (cols.phone === undefined) throw new Error('No mobile number column found. Name a column "Mobile" or "Phone".');
      if (!rows.length) throw new Error('The file has no rows under the header.');
      if (rows.length > 5000) throw new Error(`The file has ${rows.length.toLocaleString('en-IN')} rows — import up to 5,000 at a time.`);
      W.importRows = rows;
      W.importFile = file.name;
      const found = Object.keys(cols).filter((k) => k !== 'first_name' && k !== 'last_name').map((k) => k.replace('_', ' '));
      box.innerHTML = `
        <div class="ws-import-ok"><strong>${rows.length.toLocaleString('en-IN')} lead${rows.length === 1 ? '' : 's'} found</strong>
          <span>Using: ${found.join(', ')}${unknown.length ? ` · ignoring: ${esc(unknown.slice(0, 4).join(', '))}${unknown.length > 4 ? '…' : ''}` : ''}</span></div>
        <div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Name</th><th>Mobile</th><th>Project</th></tr></thead>
          <tbody>${rows.slice(0, 3).map((r) => `<tr><td>${esc(r.name || '—')}</td><td>${esc(r.phone || '—')}</td><td>${esc(r.project || '—')}</td></tr>`).join('')}</tbody></table></div>`;
      submit.disabled = false;
      submit.textContent = `Import ${rows.length.toLocaleString('en-IN')} lead${rows.length === 1 ? '' : 's'}`;
    } catch (e) {
      box.innerHTML = `<p class="ws-form-error">${esc(e.message)}</p>`;
    }
  }

  function showImportResult(r) {
    const per = Object.entries(r.perAgent || {});
    openSheet(`
      ${sheetHead('Import finished')}
      <div class="ws-sheet-body">
        <div class="ws-stat-row">
          <div class="ws-stat is-money"><strong>${r.created}</strong><span>Added</span></div>
          <div class="ws-stat ${r.duplicates ? 'is-warn' : ''}"><strong>${r.duplicates}</strong><span>Already existed</span></div>
          <div class="ws-stat ${r.invalid ? 'is-alert' : ''}"><strong>${r.invalid}</strong><span>No valid mobile</span></div>
        </div>
        ${per.length ? `<p class="ws-label">Shared with</p><ul class="ws-plain-list">${per.map(([n, c]) => `<li><span>${esc(n)}</span><b>${c}</b></li>`).join('')}</ul>` : ''}
        ${r.problems && r.problems.length ? `<p class="ws-label">Skipped rows</p><ul class="ws-plain-list is-muted">${r.problems.slice(0, 12).map((p) => `<li><span>Row ${p.row}</span><span>${esc(p.reason)}</span></li>`).join('')}${r.problems.length > 12 ? `<li><span>…and more</span></li>` : ''}</ul>` : ''}
        <button class="ws-btn is-primary is-block" data-action="close-sheet">Done</button>
      </div>`, { key: 'import-done', title: 'Import finished' });
  }

  async function exportLeads() {
    const L = W.leads;
    const qs = new URLSearchParams();
    if (L.bucket) qs.set('bucket', L.bucket);
    if (L.q) qs.set('q', L.q);
    if (L.agentId) qs.set('agent_id', L.agentId);
    const base = typeof getApiBase === 'function' ? getApiBase() : '/api';
    const res = await fetch(`${base}/workspace/leads/export?${qs}`, { headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Export failed. Please try again.');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Downloaded — opens in Excel or Google Sheets.');
  }

  // ------------------------------------------------------------------------
  // INSTALL AS AN APP (PWA) — no app store needed on Android, iPhone, Windows or Mac
  // ------------------------------------------------------------------------
  const installMode = () => (window.NX && NX.installMode ? NX.installMode() : null);
  function paintInstallEntry() {
    document.querySelectorAll('.ws-install-item').forEach((b) => { b.hidden = !installMode(); });
  }
  function paintInstallCard() {
    const host = document.getElementById('ws-main');
    if (!host || host.querySelector('.ws-install-card') || !installMode()) return;
    try { if (localStorage.getItem('nx_install_dismissed')) return; } catch (e) { /* ignore */ }
    host.insertAdjacentHTML('afterbegin', `
      <div class="ws-install-card">
        ${icon('install')}
        <div><strong>Install ${esc(shortBrand())} on this device</strong><span>Opens like an app — one tap to your day's calls and visits.</span></div>
        <button class="ws-btn" data-action="install-app">Install</button>
        <button class="ws-icon-btn" data-action="install-dismiss" aria-label="Not now">${icon('x')}</button>
      </div>`);
  }
  async function installApp() {
    const mode = installMode();
    if (mode === 'prompt') {
      const ok = await NX.install();
      if (ok) { toast(`Installed — find ${shortBrand()} on your home screen.`); document.querySelectorAll('.ws-install-card').forEach((c) => c.remove()); }
      paintInstallEntry();
      return;
    }
    openSheet(`
      ${sheetHead(`Add ${esc(shortBrand())} to your Home Screen`)}
      <div class="ws-sheet-body">
        <ol class="ws-steps">
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button <span class="ws-kbd">⬆︎</span> at the bottom of the screen.</li>
          <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        </ol>
        <p class="ws-muted">It then opens full-screen like any other app — and on iPhone this is also what turns on alerts.</p>
      </div>`, { key: 'install', title: 'Install' });
  }
  document.addEventListener('nx:installable', () => { paintInstallEntry(); paintSetupCard(); });
  // A tapped push alert focuses an open app and asks it to show the lead
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'open-lead' && e.data.leadId && document.querySelector('.ws')) openLead(e.data.leadId).catch(() => {});
    });
  }
  document.addEventListener('nx:installed', () => { paintInstallEntry(); document.querySelectorAll('.ws-install-card').forEach((c) => c.remove()); });

  // ------------------------------------------------------------------------
  // PROJECTS / INVENTORY
  // ------------------------------------------------------------------------
  async function loadProjects() {
    if (!W.projects) main('<div class="ws-loading">Loading projects…</div>');
    try {
      W.projects = (await api('/projects')).data;
    } catch (e) {
      return main(errorBox(e));
    }
    const statusLabel = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    main(`
      <div class="ws-page-head"><h1>Projects</h1><p>Live inventory from the builder — the same data as the public website.</p></div>
      <div class="ws-grid">
        ${W.projects.map((p) => {
          const range = p.min_price ? (p.max_price && p.max_price !== p.min_price ? `${money(p.min_price)} – ${money(p.max_price)}` : money(p.min_price)) : 'Price on request';
          const avail = Number(p.available_units) || 0;
          const img = p.hero_image_url ? (typeof getAssetUrl === 'function' ? getAssetUrl(p.hero_image_url) : p.hero_image_url) : null;
          return `
          <article class="ws-card ws-project">
            <div class="ws-project-media" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : `<span>${esc(initials(p.name))}</span>`}<em>${esc(statusLabel(p.status))}</em></div>
            <div class="ws-project-body">
              <h3>${esc(p.name)}</h3>
              <p class="ws-lead-meta">${esc([p.location, p.city].filter(Boolean).join(', '))}${p.builder_developer ? ` · ${esc(p.builder_developer)}` : ''}</p>
              <p class="ws-project-price"><strong>${range}</strong>${p.unit_types ? ` · ${esc(p.unit_types)}` : ''}</p>
              <p class="ws-project-avail ${avail ? '' : 'is-none'}">${avail ? `${plural(avail, 'unit')} available` : Number(p.listed_units) ? 'Sold out (listed units)' : 'Units not listed yet'}${p.rera_number ? ` · RERA ${esc(p.rera_number)}` : ''}</p>
            </div>
            <div class="ws-card-actions">
              <button class="ws-act" data-action="project-units" data-id="${p.id}">${icon('grid')} Units</button>
              ${p.brochure_url ? `<a class="ws-act" href="${esc(absUrl(p.brochure_url))}" target="_blank" rel="noopener">${icon('file')} Brochure</a>` : ''}
              <button class="ws-act is-wa" data-action="share-project" data-id="${p.id}">${icon('share')} Share</button>
            </div>
          </article>`;
        }).join('') || '<div class="ws-empty"><h3>No projects yet</h3><p>Projects created by the admin appear here automatically.</p></div>'}
      </div>`);
  }

  function absUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const base = window.location.pathname.startsWith('/nexora-crm') ? '/nexora-crm' : '';
    return `${window.location.origin}${base}${u.startsWith('/') ? '' : '/'}${u}`;
  }

  function projectLink(projectId) {
    const path = window.location.pathname.replace(/index\.html$/, '');
    return `${window.location.origin}${path}?ref=${encodeURIComponent(W.me.id)}#/project/${encodeURIComponent(projectId)}`;
  }

  // ------------------------------------------------------------------------
  // TEAM (manager)
  // ------------------------------------------------------------------------
  async function loadTeam() {
    if (!W.team) main('<div class="ws-loading">Loading team…</div>');
    try {
      const [team, activity] = await Promise.all([api('/team'), api('/activity?limit=15').catch(() => ({ data: [] }))]);
      W.team = team.data;
      W.activity = activity.data;
    } catch (e) {
      return main(errorBox(e));
    }
    const { summary: s, agents, partners } = W.team;
    main(`
      <section class="ws-hero">
        <div>
          <p class="ws-eyebrow">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>Team today</h1>
          <p class="ws-hero-sub">${agents.filter((a) => a.is_available).length} of ${agents.length} agents available · ${plural(s.new_today, 'new lead')} today</p>
        </div>
      </section>
      <div class="ws-stat-row is-4">
        <button class="ws-stat ${s.unassigned ? 'is-alert' : ''}" data-action="goto-leads" data-view="unassigned"><strong>${s.unassigned}</strong><span>Unassigned</span></button>
        <button class="ws-stat ${s.overdue ? 'is-warn' : ''}" data-action="goto-leads" data-view="overdue"><strong>${s.overdue}</strong><span>Overdue follow-ups</span></button>
        <button class="ws-stat" data-action="tab" data-tab="calendar"><strong>${s.visits_today}</strong><span>Visits today</span></button>
        <div class="ws-stat"><strong>${s.bookings_month}</strong><span>Bookings this month</span></div>
      </div>
      ${s.unassigned ? `<div class="ws-banner is-action"><div><strong>${plural(s.unassigned, 'lead')} without an owner.</strong> Distribute fairly to agents who are available today.</div><button class="ws-btn" data-action="distribute">${icon('shuffle')} Distribute</button></div>` : ''}
      ${s.stale ? `<div class="ws-banner is-warn"><div><strong>${plural(s.stale, 'open lead')} with no next step.</strong> No follow-up date and no visit planned.</div><button class="ws-btn is-ghost" data-action="goto-leads" data-view="stale">Review</button></div>` : ''}
      <section class="ws-section">
        <header class="ws-section-head"><h2>Agents</h2><span class="ws-count">${agents.length}</span></header>
        ${agents.length ? `<div class="ws-grid is-team">${agents.map((a) => `
          <article class="ws-card ws-agent ${a.is_available ? '' : 'is-off'}">
            <header>
              <span class="ws-avatar">${esc(initials(a.name))}</span>
              <div><strong>${esc(a.name)}</strong><span>${roleLabel(a.role)}${a.phone ? ` · ${esc(a.phone)}` : ''}</span></div>
              <label class="ws-switch" title="${a.is_available ? 'Available' : 'On leave'}">
                <input type="checkbox" data-action="agent-availability" data-id="${a.id}" ${a.is_available ? 'checked' : ''} />
                <span></span>
              </label>
            </header>
            <dl class="ws-metrics">
              <div><dt>Open</dt><dd>${a.open_leads}</dd></div>
              <div class="${a.untouched ? 'is-warn' : ''}"><dt>Not called</dt><dd>${a.untouched}</dd></div>
              <div class="${a.overdue ? 'is-bad' : ''}"><dt>Overdue</dt><dd>${a.overdue}</dd></div>
              <div><dt>Visits today</dt><dd>${a.visits_today}</dd></div>
              <div><dt>Actions today</dt><dd>${a.actions_today}</dd></div>
              <div><dt>Booked (mo.)</dt><dd>${a.bookings_month}</dd></div>
            </dl>
            <div class="ws-card-actions">
              <button class="ws-act" data-action="goto-leads" data-agent="${a.id}">${icon('leads')} View leads</button>
              ${a.phone ? `<a class="ws-act is-call" href="tel:${esc(digits(a.phone))}">${icon('phone')} Call</a>` : ''}
            </div>
          </article>`).join('')}</div>` : `<div class="ws-empty"><h3>No agents yet</h3><p>Add sales agents from <em>Full CRM → User Access Control</em>.</p></div>`}
      </section>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Live activity</h2><span class="ws-live-dot" title="Updates automatically"></span></header>
        <div id="ws-activity">${activityFeed(W.activity)}</div>
      </section>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Channel partners</h2><span class="ws-count">${partners.length}</span></header>
        ${partners.length ? `<div class="ws-table-wrap"><table class="ws-table">
          <thead><tr><th>Firm</th><th>Active clients</th><th>New this month</th><th>Bookings</th><th>Portal</th></tr></thead>
          <tbody>${partners.map((p) => `<tr>
            <td><strong>${esc(p.firm_name)}</strong><span>${esc(p.contact_person || '')}${p.phone ? ` · ${esc(p.phone)}` : ''}</span></td>
            <td>${p.active_clients}</td><td>${p.clients_month}</td><td>${p.bookings}</td>
            <td>${p.logins ? `<span class="ws-chip is-ok">${plural(p.logins, 'login')}</span>` : '<span class="ws-chip is-warn">No login yet</span>'}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="ws-muted-box">No active partner firms.</p>'}
      </section>`);
  }

  // ------------------------------------------------------------------------
  // EARNINGS (partner)
  // ------------------------------------------------------------------------
  async function loadEarnings() {
    main('<div class="ws-loading">Loading earnings…</div>');
    try {
      W.earnings = (await api('/earnings')).data;
    } catch (e) {
      return main(errorBox(e));
    }
    const { commissions, payouts, totals, firm } = W.earnings;
    const statusChip = (s) => ({ FULLY_PAID: '<span class="ws-chip is-ok">Paid</span>', PARTIALLY_PAID: '<span class="ws-chip is-warn">Part paid</span>' }[s] || '<span class="ws-chip">Pending</span>');
    main(`
      <div class="ws-page-head"><h1>Earnings</h1><p>${firm ? `${esc(firm.name)} · commission rate ${firm.rate}% of agreement value` : ''}</p></div>
      <div class="ws-stat-row">
        <div class="ws-stat is-money"><strong>${money(totals.earned)}</strong><span>Total earned</span></div>
        <div class="ws-stat"><strong>${money(totals.paid)}</strong><span>Paid out</span></div>
        <div class="ws-stat ${totals.pending > 0 ? 'is-warn' : ''}"><strong>${money(totals.pending)}</strong><span>Pending</span></div>
      </div>
      <section class="ws-section">
        <header class="ws-section-head"><h2>Commission per booking</h2><span class="ws-count">${commissions.length}</span></header>
        ${commissions.length ? `<div class="ws-list">${commissions.map((c) => `
          <article class="ws-card ws-commission">
            <div>
              <strong>${esc(fullName(c.first_name, c.last_name) || 'Client')}</strong>
              <span class="ws-lead-meta">${esc(c.project_name || '')}${c.unit_number ? ` · Unit ${esc(c.unit_number)}` : ''} · Deal ${esc(c.deal_number)}</span>
              <span class="ws-lead-meta">Agreement ${moneyFull(c.deal_amount)} × ${Number(c.commission_rate)}%</span>
            </div>
            <div class="ws-commission-amt">
              <strong>${moneyFull(c.total_commission)}</strong>
              <span>${Number(c.paid_amount) > 0 ? `${moneyFull(c.paid_amount)} paid` : fmtAgo(c.created_at)}</span>
              ${statusChip(c.status)}
            </div>
          </article>`).join('')}</div>` : '<p class="ws-muted-box">Commission appears here automatically the moment your client books.</p>'}
      </section>
      ${payouts.length ? `
      <section class="ws-section">
        <header class="ws-section-head"><h2>Payouts received</h2></header>
        <div class="ws-table-wrap"><table class="ws-table">
          <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead>
          <tbody>${payouts.map((p) => `<tr><td>${new Date(p.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><strong>${moneyFull(p.payout_amount)}</strong></td><td>${esc(p.payment_mode)}</td><td>${esc(p.transaction_reference)}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}`);
  }

  function errorBox(e) {
    return `<div class="ws-empty is-error"><h3>Something went wrong</h3><p>${esc(e.message)}</p><button class="ws-btn is-ghost" data-action="retry">Try again</button></div>`;
  }

  // ------------------------------------------------------------------------
  // SHEETS (bottom sheet on mobile, side drawer on desktop)
  // ------------------------------------------------------------------------
  function openSheet(html, opts = {}) {
    const host = document.getElementById('ws-sheet-host');
    if (!host) return;
    W.sheetStack.push(opts.key || 'sheet');
    host.innerHTML = `
      <div class="ws-scrim" data-action="close-sheet"></div>
      <div class="ws-sheet ${opts.wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title || 'Details')}">
        <div class="ws-sheet-grip"></div>
        ${html}
      </div>`;
    host.classList.add('is-open');
    document.body.classList.add('ws-no-scroll');
    const first = host.querySelector('[autofocus]');
    if (first) setTimeout(() => first.focus(), 60);
  }

  function closeSheet() {
    const host = document.getElementById('ws-sheet-host');
    if (!host) return;
    host.classList.remove('is-open');
    host.innerHTML = '';
    W.sheetStack = [];
    document.body.classList.remove('ws-no-scroll');
  }

  const sheetHead = (title, sub) => `
    <header class="ws-sheet-head">
      <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      <button class="ws-icon-btn" data-action="close-sheet" aria-label="Close">${icon('x')}</button>
    </header>`;

  // ---------------- Lead detail ----------------
  async function openLead(id) {
    openSheet(`${sheetHead('Loading…')}<div class="ws-loading">Loading…</div>`, { key: 'lead', wide: true });
    let lead;
    try {
      lead = (await api(`/leads/${id}`)).data;
    } catch (e) {
      openSheet(`${sheetHead('Lead')}<div class="ws-sheet-body">${errorBox(e)}</div>`);
      return;
    }
    W.currentLead = lead;
    const name = fullName(lead.first_name, lead.last_name);
    const isPartner = W.me.kind === 'partner';
    const closed = ['BOOKED', 'LOST'].includes(lead.bucket);
    const upcoming = (lead.visits || []).find((v) => v.status === 'SCHEDULED');
    const protDays = lead.cp_protected_until ? Math.ceil((new Date(lead.cp_protected_until) - Date.now()) / 86400000) : null;
    const stepIdx = PIPELINE.indexOf(lead.bucket);

    const stepper = lead.bucket === 'LOST'
      ? `<div class="ws-lost">Lost${lead.lost_reason ? ` — ${esc(lead.lost_reason)}` : ''}</div>`
      : `<ol class="ws-stepper">${PIPELINE.map((k, i) => `<li class="${i < stepIdx ? 'is-done' : i === stepIdx ? 'is-now' : ''}"><span></span>${BUCKET_LABEL[k]}</li>`).join('')}</ol>`;

    const actions = isPartner
      ? `
        ${lead.agent_phone ? `<a class="ws-big-act is-call" href="tel:${esc(digits(lead.agent_phone))}">${icon('phone')}<span>Call RM</span></a>` : ''}
        ${closed ? '' : `<button class="ws-big-act" data-action="schedule-visit" data-id="${lead.id}">${icon('calendar')}<span>${upcoming ? 'New visit' : 'Request visit'}</span></button>`}
        <button class="ws-big-act" data-action="add-note" data-id="${lead.id}">${icon('note')}<span>Note to RM</span></button>
        <button class="ws-big-act is-wa" data-action="share-project" data-id="${lead.preferred_project_id || ''}" data-lead="${lead.id}">${icon('share')}<span>Send project</span></button>`
      : `
        <a class="ws-big-act is-call" href="tel:${esc(digits(lead.phone))}" data-action="call" data-id="${lead.id}">${icon('phone')}<span>Call</span></a>
        <button class="ws-big-act is-wa" data-action="whatsapp" data-id="${lead.id}">${icon('chat')}<span>WhatsApp</span></button>
        ${closed ? '' : `<button class="ws-big-act is-log" data-action="log" data-id="${lead.id}">${icon('check')}<span>Log call</span></button>
        <button class="ws-big-act" data-action="schedule-visit" data-id="${lead.id}">${icon('calendar')}<span>Fix visit</span></button>
        <button class="ws-big-act" data-action="book" data-id="${lead.id}">${icon('key')}<span>Book unit</span></button>`}
        <button class="ws-big-act" data-action="share-project" data-id="${lead.preferred_project_id || ''}" data-lead="${lead.id}">${icon('share')}<span>Share</span></button>`;

    const info = [];
    info.push(['Phone', `<a href="tel:${esc(digits(lead.phone))}">${esc(lead.phone)}</a>`]);
    if (lead.email) info.push(['Email', esc(lead.email)]);
    info.push(['Project', esc(lead.project_name || '—')]);
    info.push(['Source', esc(SOURCE_LABEL[lead.source] || lead.source || '—')]);
    if (lead.budget_min || lead.budget_max) info.push(['Budget', `${lead.budget_min ? money(lead.budget_min) : ''}${lead.budget_min && lead.budget_max ? ' – ' : ''}${lead.budget_max ? money(lead.budget_max) : ''}`]);
    if (!isPartner && !closed) {
      info.push(['Next follow-up', `<input type="datetime-local" class="ws-inline-input" data-action="set-followup" data-id="${lead.id}" value="${lead.next_follow_up_at ? toLocalInput(lead.next_follow_up_at) : ''}" />`]);
    } else if (lead.next_follow_up_at && !closed) {
      info.push(['Next follow-up', fmtWhen(lead.next_follow_up_at)]);
    }
    if (W.me.kind === 'manager') {
      info.push(['Assigned to', `<select class="ws-inline-input" data-action="assign" data-id="${lead.id}">
        <option value="">— Unassigned —</option>
        ${(W.members || []).map((m) => `<option value="${m.id}" ${m.id === lead.assigned_agent_id ? 'selected' : ''}>${esc(m.name)}${m.is_available ? '' : ' (on leave)'}</option>`).join('')}
      </select>`]);
    } else if (isPartner) {
      info.push(['Relationship manager', lead.agent_name ? `${esc(lead.agent_name)}${lead.agent_phone ? ` · <a href="tel:${esc(digits(lead.agent_phone))}">${esc(lead.agent_phone)}</a>` : ''}` : 'Being assigned']);
      if (protDays !== null) info.push(['Protection', protDays > 0 ? `<span class="ws-chip is-ok">${icon('shield')} ${plural(protDays, 'day')} left</span>` : '<span class="ws-chip">Expired</span>']);
    }
    if (lead.partner_firm && !isPartner) {
      const contact = lead.registered_by_name && lead.registered_by_phone ? `${esc(lead.registered_by_name)} · <a href="tel:${esc(digits(lead.registered_by_phone))}">${esc(lead.registered_by_phone)}</a>` : esc(lead.partner_contact || '');
      info.push(['Channel partner', `<strong>${esc(lead.partner_firm)}</strong>${contact ? `<br><span class="ws-muted">${contact}</span>` : ''}`]);
    }

    const tempPicker = isPartner || closed ? '' : `
      <div class="ws-temp-pick" role="group" aria-label="How interested">
        ${['HOT', 'WARM', 'COLD'].map((t) => `<button class="ws-temp is-${t.toLowerCase()} ${lead.temperature === t ? 'is-on' : ''}" data-action="set-temp" data-id="${lead.id}" data-temp="${t}">${t === 'HOT' ? 'Hot' : t === 'WARM' ? 'Warm' : 'Cold'}</button>`).join('')}
      </div>`;

    const visitBlock = upcoming ? `
      <div class="ws-upcoming">
        <div>${icon('visits')}<div><strong>Site visit · ${fmtWhen(upcoming.scheduled_time)}</strong><span>${esc(upcoming.project_name)}${upcoming.agent_name ? ` · with ${esc(upcoming.agent_name)}` : ''}</span></div></div>
        <div class="ws-upcoming-actions">
          ${isPartner
            ? `<button class="ws-btn is-ghost" data-action="visit-reschedule" data-id="${upcoming.id}" data-lead="${lead.id}">Reschedule</button>`
            : `<a class="ws-btn is-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([upcoming.project_name, upcoming.location, upcoming.city].filter(Boolean).join(', '))}">${icon('nav')} Directions</a>
               <button class="ws-btn" data-action="visit-outcome" data-id="${upcoming.id}" data-lead="${lead.id}">Update visit</button>`}
        </div>
      </div>` : '';

    const deals = (lead.deals || []).map((d) => `
      <div class="ws-deal">${icon('key')}<div><strong>Booked · ${esc(d.project_name)} · Unit ${esc(d.unit_number)}</strong><span>Deal ${esc(d.deal_number)} · ${moneyFull(d.agreed_total_amount)} · token ${moneyFull(d.booking_token_amount)}</span></div></div>`).join('');

    const html = `
      ${sheetHead(esc(name), `${tempChip(lead.temperature)} <span class="ws-stage is-${lead.bucket.toLowerCase()}">${BUCKET_LABEL[lead.bucket]}</span> <span class="ws-muted">· added ${fmtAgo(lead.created_at)}</span>`)}
      <div class="ws-sheet-body">
        ${stepper}
        <div class="ws-big-acts">${actions}</div>
        ${deals}
        ${visitBlock}
        ${tempPicker}
        <dl class="ws-info">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${!isPartner && !closed ? `
          <details class="ws-more">
            <summary>Edit details or move stage</summary>
            <form class="ws-form" data-form="edit-lead" data-id="${lead.id}">
              <div class="ws-row2">
                <label>First name<input name="first_name" value="${esc(lead.first_name)}" required /></label>
                <label>Last name<input name="last_name" value="${esc(lead.last_name || '')}" /></label>
              </div>
              <div class="ws-row2">
                <label>Phone<input name="phone" value="${esc(lead.phone)}" inputmode="tel" required /></label>
                <label>Email<input name="email" type="email" value="${esc(lead.email || '')}" /></label>
              </div>
              <div class="ws-row2">
                <label>Budget from (₹)<input name="budget_min" inputmode="numeric" value="${lead.budget_min ? Number(lead.budget_min) : ''}" /></label>
                <label>Budget to (₹)<input name="budget_max" inputmode="numeric" value="${lead.budget_max ? Number(lead.budget_max) : ''}" /></label>
              </div>
              <label>Project${projectSelect('preferred_project_id', lead.preferred_project_id)}</label>
              <label>Stage
                <select name="bucket">${BUCKETS.filter(([k]) => k !== 'BOOKED').map(([k, l]) => `<option value="${k}" ${k === lead.bucket ? 'selected' : ''}>${l}</option>`).join('')}</select>
              </label>
              <label class="ws-lost-reason" hidden>Why was it lost?<input name="lost_reason" placeholder="e.g. Budget mismatch" /></label>
              <button class="ws-btn is-primary" type="submit">Save changes</button>
            </form>
          </details>` : ''}
        <section class="ws-timeline">
          <header class="ws-section-head"><h2>Timeline</h2>${isPartner ? '' : `<button class="ws-btn is-ghost is-sm" data-action="add-note" data-id="${lead.id}">${icon('note')} Note</button>`}</header>
          ${lead.activities.length ? `<ol>${lead.activities.map((a) => `
            <li class="is-${a.type.toLowerCase()}">
              <span class="ws-feed-dot is-${a.type.toLowerCase()}"></span>
              <div><p>${esc(activityText(a))}</p><small>${fmtWhen(a.created_at)} · ${esc(a.mine ? 'You' : a.by_name)}</small></div>
            </li>`).join('')}</ol>` : '<p class="ws-muted-box">No activity yet.</p>'}
        </section>
      </div>`;
    openSheet(html, { key: 'lead', wide: true, title: name });
    if (W.me.kind === 'manager' && !W.members) {
      W.members = (await api('/team/members')).data;
      openLead(id);
    }
    if (!isPartner) ensureProjects().catch(() => {});
  }

  function projectSelect(name, selected, required) {
    const projects = W.projects || [];
    return `<select name="${name}" ${required ? 'required' : ''}>
      <option value="">${required ? 'Choose project' : '— Not decided —'}</option>
      ${projects.map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}${p.city ? ` · ${esc(p.city)}` : ''}</option>`).join('')}
    </select>`;
  }

  function ensureProjects() {
    if (W.projects) return Promise.resolve(W.projects);
    if (!W.projectsReq) {
      W.projectsReq = api('/projects')
        .then((r) => (W.projects = r.data))
        .finally(() => { W.projectsReq = null; });
    }
    return W.projectsReq;
  }

  function findLeadLocal(id) {
    const pools = [];
    if (W.currentLead) pools.push([W.currentLead]);
    if (W.today) pools.push(W.today.fresh || [], W.today.overdue || [], W.today.later || []);
    if (W.leads.data) pools.push(W.leads.data);
    for (const p of pools) { const hit = p.find((l) => l.id === id); if (hit) return hit; }
    return null;
  }

  async function getLead(id) {
    return findLeadLocal(id) || (await api(`/leads/${id}`)).data;
  }

  // ---------------- Log call outcome ----------------
  async function openLog(id) {
    const lead = await getLead(id);
    const name = fullName(lead.first_name, lead.last_name);
    const presets = followUpPresets();
    openSheet(`
      ${sheetHead(`Log call · ${esc(name)}`, 'One tap — we set the next follow-up for you.')}
      <form class="ws-sheet-body ws-form" data-form="log" data-id="${lead.id}">
        <div class="ws-outcomes" role="radiogroup">
          ${[
            ['NO_ANSWER', 'No answer', 'Retry in 3 hours'],
            ['CALLBACK', 'Call back later', 'Pick a time'],
            ['INTERESTED', 'Interested', 'Follow up tomorrow'],
            ['VISIT', 'Fix a site visit', 'Choose date & time'],
            ['NEGOTIATING', 'Negotiating', 'Price / terms discussion'],
            ['NOT_INTERESTED', 'Not interested', 'Close as lost']
          ].map(([k, label, hint], i) => `
            <label class="ws-outcome is-${k.toLowerCase()}">
              <input type="radio" name="outcome" value="${k}" ${i === 0 ? 'checked' : ''} />
              <span><strong>${label}</strong><small>${hint}</small></span>
            </label>`).join('')}
        </div>
        <div class="ws-when" data-when hidden>
          <p class="ws-label">When should you call back?</p>
          <div class="ws-chips">${presets.map(([l, d], i) => `<button type="button" class="ws-chip-btn ${i === 0 ? 'is-on' : ''}" data-action="pick-time" data-value="${d.toISOString()}">${l}</button>`).join('')}</div>
          <input type="datetime-local" name="next_follow_up_at" value="${toLocalInput(presets[0][1])}" />
        </div>
        <div class="ws-reasons" data-reasons hidden>
          <p class="ws-label">Reason</p>
          <div class="ws-chips">${LOST_REASONS.map((r) => `<button type="button" class="ws-chip-btn" data-action="pick-reason" data-value="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          <input type="hidden" name="lost_reason" />
        </div>
        <label>Note <span class="ws-muted">(optional)</span><textarea name="note" rows="2" placeholder="What did the client say?"></textarea></label>
        <div class="ws-temp-pick" role="group" aria-label="How interested">
          <span class="ws-label">Interest</span>
          ${['HOT', 'WARM', 'COLD'].map((t) => `<label class="ws-temp is-${t.toLowerCase()} ${lead.temperature === t ? 'is-on' : ''}"><input type="radio" name="temperature" value="${t}" ${lead.temperature === t ? 'checked' : ''} />${t === 'HOT' ? 'Hot' : t === 'WARM' ? 'Warm' : 'Cold'}</label>`).join('')}
        </div>
        <button class="ws-btn is-primary is-block" type="submit">Save &amp; next</button>
      </form>`, { key: 'log', title: 'Log call' });
  }

  // ---------------- WhatsApp templates ----------------
  async function openWhatsApp(id) {
    const lead = await getLead(id);
    await ensureProjects().catch(() => []);
    const first = lead.first_name;
    const project = (W.projects || []).find((p) => p.id === lead.preferred_project_id);
    const me = W.me.firstName;
    const company = W.me.firm ? W.me.firm.name : brand();
    const projectLine = project ? `*${project.name}*${project.city ? `, ${project.city}` : ''}` : 'our projects';
    const link = project ? projectLink(project.id) : '';
    const visit = lead.next_visit_at ? fmtWhen(lead.next_visit_at) : null;

    const templates = [
      ['Introduction', `Hi ${first}, this is ${me} from ${company}. Thank you for your interest in ${projectLine}. When is a good time for a quick call?`],
      project && ['Share project details', `Hi ${first}, here are the details of ${projectLine}:${project.min_price ? `\n• Starting ${money(project.min_price)}` : ''}${project.unit_types ? `\n• ${project.unit_types}` : ''}${project.brochure_url ? `\n• Brochure: ${absUrl(project.brochure_url)}` : ''}\n• Photos & location: ${link}\n\nHappy to arrange a site visit — just reply with a day that suits you.`],
      visit && ['Confirm site visit', `Hi ${first}, confirming your site visit to ${projectLine} on ${visit}. I'll meet you there. Location: ${link || 'shared shortly'}`],
      ['Follow up', `Hi ${first}, just checking in — did you get a chance to look at the details? Happy to answer any questions or set up a visit this week.`],
      ['Missed you', `Hi ${first}, I tried calling you just now. Please let me know a convenient time to talk.`]
    ].filter(Boolean);

    openSheet(`
      ${sheetHead(`WhatsApp · ${esc(fullName(lead.first_name, lead.last_name))}`, 'Pick a message, tweak it if needed, and send. It is logged automatically.')}
      <div class="ws-sheet-body ws-templates">
        ${templates.map(([title, text], i) => `
          <div class="ws-template">
            <strong>${title}</strong>
            <textarea id="ws-tpl-${i}" rows="${Math.min(8, text.split('\n').length + 2)}">${esc(text)}</textarea>
            <button class="ws-btn is-wa" data-action="send-wa" data-id="${lead.id}" data-tpl="ws-tpl-${i}">${icon('chat')} Send on WhatsApp</button>
          </div>`).join('')}
      </div>`, { key: 'wa', title: 'WhatsApp' });
  }

  // ---------------- Schedule / reschedule visit ----------------
  async function openScheduleVisit(leadId, visitId) {
    const lead = await getLead(leadId);
    await ensureProjects().catch(() => []);
    const now = new Date();
    const days = [];
    if (now.getHours() < 18) days.push(['Today', daysAt(0, 0)]);
    days.push(['Tomorrow', daysAt(1, 0)]);
    for (let i = 2; i < 8 && days.length < 5; i++) {
      const d = daysAt(i, 0);
      if (d.getDay() === 6 || d.getDay() === 0) days.push([d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }), d]);
    }
    const slots = ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];
    const firstDay = days[0][1];
    const firstSlot = slots.find((s) => { const [h, m] = s.split(':').map(Number); const d = new Date(firstDay); d.setHours(h, m); return d > now; }) || slots[0];
    const reschedule = !!visitId;

    openSheet(`
      ${sheetHead(reschedule ? 'Reschedule visit' : W.me.kind === 'partner' ? 'Request a site visit' : 'Fix a site visit', esc(fullName(lead.first_name, lead.last_name)))}
      <form class="ws-sheet-body ws-form" data-form="${reschedule ? 'reschedule' : 'visit'}" data-id="${lead.id}" data-visit="${visitId || ''}">
        ${reschedule ? '' : `<label>Project${projectSelect('project_id', lead.preferred_project_id, true)}</label>`}
        <p class="ws-label">Day</p>
        <div class="ws-chips" data-group="day">${days.map(([l, d], i) => `<button type="button" class="ws-chip-btn ${i === 0 ? 'is-on' : ''}" data-action="pick-day" data-value="${toLocalInput(d).slice(0, 10)}">${l}</button>`).join('')}</div>
        <input type="date" name="date" value="${toLocalInput(firstDay).slice(0, 10)}" min="${toLocalInput(now).slice(0, 10)}" required />
        <p class="ws-label">Time</p>
        <div class="ws-chips" data-group="slot">${slots.map((s) => `<button type="button" class="ws-chip-btn ${s === firstSlot ? 'is-on' : ''}" data-action="pick-slot" data-value="${s}">${new Date(`2000-01-01T${s}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</button>`).join('')}</div>
        <input type="time" name="time" value="${firstSlot}" required />
        ${reschedule ? '' : `<label>Note <span class="ws-muted">(optional)</span><input name="note" placeholder="${W.me.kind === 'partner' ? 'e.g. Coming with family, needs parking' : 'e.g. Pick up from metro station'}" /></label>`}
        ${W.me.kind === 'partner' ? '<p class="ws-hint">The relationship manager is notified instantly and will confirm with you.</p>' : ''}
        <button class="ws-btn is-primary is-block" type="submit">${reschedule ? 'Move visit' : W.me.kind === 'partner' ? 'Send request' : 'Schedule visit'}</button>
      </form>`, { key: 'visit', title: 'Site visit' });
  }

  // ---------------- Visit outcome ----------------
  function openVisitOutcome(visitId, leadId) {
    const presets = followUpPresets().filter(([l]) => l !== 'In 1 hour');
    openSheet(`
      ${sheetHead('How did the visit go?')}
      <form class="ws-sheet-body ws-form" data-form="visit-outcome" data-id="${visitId}" data-lead="${leadId}">
        <div class="ws-outcomes is-3">
          <label class="ws-outcome is-interested"><input type="radio" name="action" value="complete" checked /><span><strong>Visit done</strong><small>Client came</small></span></label>
          <label class="ws-outcome is-no_answer"><input type="radio" name="action" value="no_show" /><span><strong>No-show</strong><small>Client didn't come</small></span></label>
          <label class="ws-outcome is-not_interested"><input type="radio" name="action" value="cancel" /><span><strong>Cancelled</strong><small>Called off</small></span></label>
        </div>
        <div data-complete>
          <div class="ws-temp-pick" role="group" aria-label="Interest after visit">
            <span class="ws-label">Interest now</span>
            ${['HOT', 'WARM', 'COLD'].map((t) => `<label class="ws-temp is-${t.toLowerCase()}"><input type="radio" name="temperature" value="${t}" />${t === 'HOT' ? 'Hot' : t === 'WARM' ? 'Warm' : 'Cold'}</label>`).join('')}
          </div>
          <p class="ws-label">Follow up</p>
          <div class="ws-chips">${presets.map(([l, d], i) => `<button type="button" class="ws-chip-btn ${i === 0 ? 'is-on' : ''}" data-action="pick-time" data-value="${d.toISOString()}">${l}</button>`).join('')}</div>
          <input type="datetime-local" name="next_follow_up_at" value="${toLocalInput(presets[0][1])}" />
        </div>
        <label>Feedback <span class="ws-muted">(optional)</span><textarea name="feedback" rows="2" placeholder="Liked the layout, wants 2nd visit with parents…"></textarea></label>
        <div class="ws-row-actions">
          <button class="ws-btn is-ghost" type="button" data-action="visit-reschedule" data-id="${visitId}" data-lead="${leadId}">${icon('calendar')} Reschedule instead</button>
          <button class="ws-btn is-primary" type="submit">Save</button>
        </div>
      </form>`, { key: 'visit-outcome', title: 'Visit outcome' });
  }

  // ---------------- Book unit ----------------
  async function openBook(leadId) {
    const lead = await getLead(leadId);
    await ensureProjects().catch(() => []);
    const projectId = lead.preferred_project_id || ((W.projects || [])[0] || {}).id;
    openSheet(`
      ${sheetHead('Book a unit', esc(fullName(lead.first_name, lead.last_name)))}
      <form class="ws-sheet-body ws-form" data-form="book" data-id="${lead.id}">
        <label>Project${projectSelect('project_id', projectId, true).replace('<select', '<select data-action="book-project"')}</label>
        <div id="ws-book-units" class="ws-units"><div class="ws-loading">Loading units…</div></div>
        <div class="ws-row2">
          <label>Booking token (₹)<input name="booking_token_amount" inputmode="numeric" placeholder="Default 10%" /></label>
          <label>Discount (₹)<input name="discount_amount" inputmode="numeric" value="0" /></label>
        </div>
        <div class="ws-book-summary" id="ws-book-summary"></div>
        <button class="ws-btn is-primary is-block" type="submit" disabled id="ws-book-submit">Select a unit</button>
        <p class="ws-hint">The unit is locked instantly — the website and every other agent see it as booked.${lead.partner_firm ? ` ${esc(lead.partner_firm)}'s commission is recorded automatically.` : ''}</p>
      </form>`, { key: 'book', title: 'Book unit' });
    if (projectId) loadBookUnits(projectId);
  }

  async function loadBookUnits(projectId) {
    const host = document.getElementById('ws-book-units');
    if (!host) return;
    host.innerHTML = '<div class="ws-loading">Loading units…</div>';
    try {
      const units = (await api(`/projects/${projectId}/units`)).data.filter((u) => u.status === 'AVAILABLE');
      host.innerHTML = units.length ? units.map((u) => `
        <label class="ws-unit">
          <input type="radio" name="unit_id" value="${u.id}" data-price="${Number(u.base_price) + Number(u.plc_charges || 0)}" data-label="${esc(u.unit_number)}" />
          <span>
            <strong>${esc(u.unit_number)}</strong>
            <small>${esc(u.unit_type)}${u.carpet_area_sqft ? ` · ${Number(u.carpet_area_sqft)} sq.ft` : ''}${u.facing ? ` · ${esc(u.facing.replace('_', '-').toLowerCase())}` : ''}${u.floor_number ? ` · floor ${u.floor_number}` : ''}</small>
          </span>
          <em>${money(Number(u.base_price) + Number(u.plc_charges || 0))}</em>
        </label>`).join('') : '<p class="ws-muted-box">No available units in this project.</p>';
    } catch (e) {
      host.innerHTML = errorBox(e);
    }
  }

  function updateBookSummary(form) {
    const unit = form.querySelector('input[name="unit_id"]:checked');
    const btn = document.getElementById('ws-book-submit');
    const sum = document.getElementById('ws-book-summary');
    if (!unit) { if (btn) { btn.disabled = true; btn.textContent = 'Select a unit'; } return; }
    const discount = Number(form.discount_amount.value) || 0;
    const total = Number(unit.dataset.price) - discount;
    const token = Number(form.booking_token_amount.value) || Math.round(total * 0.1);
    sum.innerHTML = `<div><span>Agreement value</span><strong>${moneyFull(total)}</strong></div><div><span>Booking token</span><strong>${moneyFull(token)}</strong></div>`;
    btn.disabled = false;
    btn.textContent = `Confirm booking · Unit ${unit.dataset.label}`;
  }

  // ---------------- Project units / share ----------------
  async function openProjectUnits(projectId) {
    const project = (W.projects || []).find((p) => p.id === projectId) || {};
    openSheet(`${sheetHead(esc(project.name || 'Units'), 'Available & on-hold units')}<div class="ws-sheet-body"><div class="ws-loading">Loading…</div></div>`, { key: 'units' });
    try {
      const units = (await api(`/projects/${projectId}/units`)).data;
      const body = units.length ? `<div class="ws-table-wrap"><table class="ws-table">
        <thead><tr><th>Unit</th><th>Type</th><th>Area</th><th>Facing</th><th>Price</th><th></th></tr></thead>
        <tbody>${units.map((u) => `<tr>
          <td><strong>${esc(u.unit_number)}</strong>${u.building_name ? `<span>${esc(u.building_name)}</span>` : ''}</td>
          <td>${esc(u.unit_type)}</td>
          <td>${u.carpet_area_sqft ? `${Number(u.carpet_area_sqft)} sq.ft` : u.plot_area_sqft ? `${Number(u.plot_area_sqft)} sq.ft` : '—'}</td>
          <td>${u.facing ? esc(u.facing.replace('_', '-').toLowerCase()) : '—'}${u.is_corner ? ' · corner' : ''}</td>
          <td><strong>${money(Number(u.base_price) + Number(u.plc_charges || 0))}</strong></td>
          <td>${u.status === 'HOLD' ? '<span class="ws-chip is-warn">On hold</span>' : '<span class="ws-chip is-ok">Available</span>'}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="ws-muted-box">No units available right now.</p>';
      openSheet(`${sheetHead(esc(project.name || 'Units'), `${plural(units.filter((u) => u.status === 'AVAILABLE').length, 'unit')} available`)}<div class="ws-sheet-body">${body}
        <button class="ws-btn is-wa is-block" data-action="share-project" data-id="${projectId}">${icon('share')} Share this project</button></div>`, { key: 'units', wide: true });
    } catch (e) {
      openSheet(`${sheetHead('Units')}<div class="ws-sheet-body">${errorBox(e)}</div>`);
    }
  }

  async function openShare(projectId, leadId) {
    await ensureProjects().catch(() => []);
    const lead = leadId ? await getLead(leadId).catch(() => null) : null;
    let project = (W.projects || []).find((p) => p.id === projectId);
    if (!project && W.projects && W.projects.length) {
      if (!projectId) {
        openSheet(`${sheetHead('Which project?')}<div class="ws-sheet-body ws-list">${W.projects.map((p) => `<button class="ws-card ws-pick" data-action="share-project" data-id="${p.id}" ${leadId ? `data-lead="${leadId}"` : ''}><strong>${esc(p.name)}</strong><span class="ws-lead-meta">${esc(p.city || '')}</span></button>`).join('')}</div>`);
        return;
      }
      project = W.projects[0];
    }
    if (!project) return toast('No project to share yet.', 'err');
    const first = lead ? lead.first_name : '';
    const company = W.me.firm ? W.me.firm.name : brand();
    const link = projectLink(project.id);
    const text = `Hi${first ? ` ${first}` : ''}, sharing *${project.name}*${project.location ? ` — ${project.location}` : ''}${project.city ? `, ${project.city}` : ''}.${project.min_price ? `\nStarting ${money(project.min_price)}${project.unit_types ? ` · ${project.unit_types}` : ''}` : ''}${project.brochure_url ? `\nBrochure: ${absUrl(project.brochure_url)}` : ''}\nPhotos, floor plans & location: ${link}\n\n— ${W.me.name}, ${company}`;
    const isPartner = W.me.kind === 'partner';
    const target = lead && !isPartner ? waNumber(lead.phone) : '';
    openSheet(`
      ${sheetHead(`Share ${esc(project.name)}`, isPartner ? 'Enquiries from this link are registered under your firm automatically.' : 'Enquiries from this link are assigned to you.')}
      <div class="ws-sheet-body ws-form">
        <textarea id="ws-share-text" rows="8">${esc(text)}</textarea>
        <div class="ws-share-link">${icon('globe')}<span>${esc(link)}</span></div>
        <div class="ws-row-actions">
          <button class="ws-btn is-ghost" data-action="copy-share">${icon('copy')} Copy</button>
          <button class="ws-btn is-wa" data-action="send-share" data-phone="${esc(target)}" ${lead && !isPartner ? `data-id="${lead.id}"` : ''}>${icon('chat')} ${target ? `Send to ${esc(first)}` : 'Open WhatsApp'}</button>
        </div>
      </div>`, { key: 'share', title: 'Share project' });
  }

  // ---------------- Add lead / register client ----------------
  async function openAddLead() {
    await ensureProjects().catch(() => []);
    const isPartner = W.me.kind === 'partner';
    const isMgr = W.me.kind === 'manager';
    if (isMgr && !W.members) W.members = (await api('/team/members').catch(() => ({ data: [] }))).data;
    openSheet(`
      ${sheetHead(isPartner ? 'Register a client' : 'Add a lead', isPartner ? `Protected for ${W.me.config.protectionDays} days · duplicate check is automatic` : 'We check for duplicates before saving.')}
      <form class="ws-sheet-body ws-form" data-form="${isPartner ? 'register' : 'add-lead'}">
        <div class="ws-row2">
          <label>First name<input name="first_name" required autofocus autocomplete="off" /></label>
          <label>Last name<input name="last_name" autocomplete="off" /></label>
        </div>
        <label>Mobile number<input name="phone" inputmode="tel" required placeholder="10-digit mobile" autocomplete="off" /></label>
        ${isPartner ? '' : '<label>Email <span class="ws-muted">(optional)</span><input name="email" type="email" /></label>'}
        <label>Project${isPartner ? '' : ' <span class="ws-muted">(optional)</span>'}${projectSelect('preferred_project_id', null, isPartner)}</label>
        ${isPartner ? '' : `
          <p class="ws-label">Source</p>
          <div class="ws-chips">${SOURCES.map(([k, l], i) => `<label class="ws-chip-btn ${i === 0 ? 'is-on' : ''}"><input type="radio" name="source" value="${k}" ${i === 0 ? 'checked' : ''} />${l}</label>`).join('')}</div>`}
        <div class="ws-row2">
          <label>Budget from (₹)<input name="budget_min" inputmode="numeric" placeholder="e.g. 8000000" /></label>
          <label>Budget to (₹)<input name="budget_max" inputmode="numeric" placeholder="e.g. 12000000" /></label>
        </div>
        ${isMgr ? `<label>Assign to<select name="assigned_agent_id"><option value="">Auto — fair distribution</option>${(W.members || []).map((m) => `<option value="${m.id}">${esc(m.name)}${m.is_available ? '' : ' (on leave)'}</option>`).join('')}</select></label>` : ''}
        <label>${isPartner ? 'Requirement / note for the sales team' : 'Note'} <span class="ws-muted">(optional)</span><textarea name="note" rows="2" placeholder="${isPartner ? 'e.g. 3BHK, east facing, wants to visit this weekend' : 'What are they looking for?'}"></textarea></label>
        <div class="ws-form-error" hidden></div>
        <button class="ws-btn is-primary is-block" type="submit">${isPartner ? 'Register client' : 'Save lead'}</button>
      </form>`, { key: 'add', title: isPartner ? 'Register client' : 'Add lead' });
  }

  function openNote(leadId) {
    const isPartner = W.me.kind === 'partner';
    openSheet(`
      ${sheetHead(isPartner ? 'Note to your relationship manager' : 'Add a note')}
      <form class="ws-sheet-body ws-form" data-form="note" data-id="${leadId}">
        <textarea name="note" rows="4" required autofocus placeholder="${isPartner ? 'e.g. Client is free Sunday morning, prefers 3BHK on a higher floor' : 'Anything worth remembering…'}"></textarea>
        <button class="ws-btn is-primary is-block" type="submit">${isPartner ? 'Send note' : 'Save note'}</button>
      </form>`, { key: 'note', title: 'Note' });
  }

  // ------------------------------------------------------------------------
  // NOTIFICATIONS
  // ------------------------------------------------------------------------
  function paintBadge() {
    const b = document.getElementById('ws-notif-badge');
    if (b) { b.hidden = !W.notif.unread; b.textContent = W.notif.unread > 9 ? '9+' : String(W.notif.unread); }
  }

  /** Nothing is being typed or edited, so the screen can refresh under the user. */
  function canAutoRefresh() {
    if (document.querySelector('.ws-sheet-host.is-open')) return false;
    const a = document.activeElement;
    return !(a && a.closest && a.closest('.ws') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }

  /**
   * Live sync: every 15s ask the server for a fingerprint of everything this person can see.
   * When anyone — the website, a partner, a teammate, a manager — changes it, the open screen
   * refreshes in place, and new notifications pop up as a toast.
   */
  async function pulse() {
    if (!state.token || !document.querySelector('.ws')) return stopPolling();
    if (document.visibilityState !== 'visible') return;
    try {
      const d = (await api('/pulse')).data;
      const prevUnread = W.notif.unread;
      W.notif.unread = d.unread;
      paintBadge();
      if (W.pulseV && d.v !== W.pulseV && canAutoRefresh()) refreshCurrent({ quiet: true });
      if (W.pulseV && d.unread > prevUnread) {
        const latest = await notifApi('?limit=1').catch(() => null);
        const n = latest && latest.data && latest.data[0];
        if (n && !n.is_read) toast(n.title);
      }
      W.pulseV = d.v;
    } catch (e) { /* offline or signed out — try again next tick */ }
  }
  function startPolling() {
    stopPolling();
    W.pulseV = null;
    pulse();
    W.notif.timer = setInterval(pulse, 15000);
  }
  function stopPolling() {
    if (W.notif.timer) clearInterval(W.notif.timer);
    W.notif.timer = null;
  }

  async function toggleNotifs() {
    const panel = document.getElementById('ws-notifs');
    if (!panel) return;
    const menu = document.getElementById('ws-menu');
    if (menu) menu.hidden = true;
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = '<div class="ws-loading">Loading…</div>';
    try {
      const res = await notifApi('?limit=30');
      const list = res.data || [];
      panel.innerHTML = `
        <header><strong>Notifications</strong>${W.notif.unread ? '<button data-action="read-all">Mark all read</button>' : ''}</header>
        ${list.length ? `<ul>${list.map((n) => `
          <li class="${n.is_read ? '' : 'is-unread'}">
            <button data-action="notif" data-id="${n.id}" data-entity="${esc(n.related_entity_type || '')}" data-ref="${esc(n.related_entity_id || '')}">
              <strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${fmtAgo(n.created_at)}</small>
            </button>
          </li>`).join('')}</ul>` : '<p class="ws-muted-box">You\'re all caught up.</p>'}`;
    } catch (e) {
      panel.innerHTML = `<p class="ws-muted-box">${esc(e.message)}</p>`;
    }
  }

  // ------------------------------------------------------------------------
  // EVENT HANDLING (delegated)
  // ------------------------------------------------------------------------
  async function onClick(e) {
    if (!e.target.closest('.ws')) return;
    const el = e.target.closest('[data-action]');

    // Click outside header popovers closes them
    if (!e.target.closest('#ws-menu, [data-action="toggle-menu"]')) { const m = document.getElementById('ws-menu'); if (m) m.hidden = true; }
    if (!e.target.closest('#ws-notifs, [data-action="toggle-notifs"]')) { const n = document.getElementById('ws-notifs'); if (n) n.hidden = true; }
    if (!el) return;

    const a = el.dataset.action;
    const id = el.dataset.id;
    const run = async (fn) => { try { await fn(); } catch (err) { toast(err.message, 'err'); } };

    switch (a) {
      case 'tab': return setTab(el.dataset.tab);
      case 'retry': return refreshCurrent();
      case 'theme': stopPolling(); W.renderedAt = 0; return toggleTheme();
      case 'toggle-menu': { const m = document.getElementById('ws-menu'); m.hidden = !m.hidden; return; }
      case 'toggle-notifs': return toggleNotifs();
      case 'open-crm': return window.openFullCrm();
      case 'open-website': stopPolling(); return setViewMode('website');
      case 'logout': stopPolling(); W.me = null; W.today = null; W.team = null; W.tab = null; W.projects = null; W.members = null; W.leads.data = null; return logout();
      case 'toggle-availability': return run(async () => {
        const next = !W.me.isAvailable;
        await api('/me/availability', { method: 'PATCH', body: { is_available: next } });
        W.me.isAvailable = next;
        paintAvailability();
        toast(next ? 'Welcome back — new leads will come to you again.' : "You're on leave. New leads go to teammates — enjoy your time off.");
        if (W.tab === 'today') paintToday();
      });
      case 'close-sheet': return closeSheet();
      case 'open-lead': if (id) return run(() => openLead(id)); return;
      case 'call':
        // Let the tel: link dial, then have the log sheet ready for when they come back
        setTimeout(() => run(() => openLog(id)), 400);
        return;
      case 'whatsapp': return run(() => openWhatsApp(id));
      case 'log': return run(() => openLog(id));
      case 'add-note': return openNote(id);
      case 'schedule-visit': return run(() => openScheduleVisit(id));
      case 'visit-outcome': return openVisitOutcome(id, el.dataset.lead);
      case 'visit-reschedule': return run(() => openScheduleVisit(el.dataset.lead, id));
      case 'book': return run(() => openBook(id));
      case 'add-lead':
      case 'register-client': return run(openAddLead);
      case 'project-units': return run(() => openProjectUnits(id));
      case 'share-project': return run(() => openShare(id, el.dataset.lead));
      case 'copy-share': {
        const t = document.getElementById('ws-share-text');
        try { await navigator.clipboard.writeText(t.value); toast('Copied — paste it anywhere.'); } catch (err) { t.select(); document.execCommand('copy'); toast('Copied.'); }
        return;
      }
      case 'send-share': {
        const t = document.getElementById('ws-share-text');
        const phone = el.dataset.phone;
        window.open(`https://wa.me/${phone || ''}?text=${encodeURIComponent(t.value)}`, '_blank', 'noopener');
        if (el.dataset.id) api(`/leads/${el.dataset.id}/activities`, { method: 'POST', body: { outcome: 'WHATSAPP_SENT', note: 'Shared project details' } }).catch(() => {});
        closeSheet();
        return;
      }
      case 'send-wa': {
        const lead = findLeadLocal(id);
        const text = document.getElementById(el.dataset.tpl).value;
        const title = el.closest('.ws-template').querySelector('strong').textContent;
        window.open(`https://wa.me/${waNumber(lead ? lead.phone : '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        return run(async () => {
          await api(`/leads/${id}/activities`, { method: 'POST', body: { outcome: 'WHATSAPP_SENT', note: title } });
          closeSheet();
          toast('WhatsApp logged. Follow-up set for tomorrow.');
          refreshCurrent();
        });
      }
      case 'pick-time': {
        const form = el.closest('form');
        el.parentElement.querySelectorAll('.ws-chip-btn').forEach((b) => b.classList.toggle('is-on', b === el));
        form.next_follow_up_at.value = toLocalInput(el.dataset.value);
        return;
      }
      case 'pick-reason': {
        const form = el.closest('form');
        el.parentElement.querySelectorAll('.ws-chip-btn').forEach((b) => b.classList.toggle('is-on', b === el));
        form.lost_reason.value = el.dataset.value;
        return;
      }
      case 'pick-day':
      case 'pick-slot': {
        const form = el.closest('form');
        el.parentElement.querySelectorAll('.ws-chip-btn').forEach((b) => b.classList.toggle('is-on', b === el));
        if (a === 'pick-day') form.date.value = el.dataset.value;
        else form.time.value = el.dataset.value;
        return;
      }
      case 'set-temp': return run(async () => {
        await api(`/leads/${id}`, { method: 'PATCH', body: { temperature: el.dataset.temp } });
        el.parentElement.querySelectorAll('.ws-temp').forEach((b) => b.classList.toggle('is-on', b === el));
        toast('Updated.');
      });
      case 'lead-bucket': W.leads.bucket = el.dataset.bucket; return loadLeads();
      case 'lead-view': W.leads.view = W.leads.view === el.dataset.view ? '' : el.dataset.view; W.leads.bucket = W.leads.view ? '' : 'OPEN'; document.getElementById('ws-leads-shell')?.remove(); return loadLeads();
      case 'goto-leads':
        W.leads = { ...W.leads, view: el.dataset.view || '', agentId: el.dataset.agent || '', bucket: el.dataset.view ? '' : 'OPEN', q: '' };
        return setTab('leads');
      case 'cal-prev': W.cal.start = addDays(W.cal.start, -7); W.cal.day = ymd(W.cal.start); return loadCalendar();
      case 'cal-next': W.cal.start = addDays(W.cal.start, 7); W.cal.day = ymd(W.cal.start); return loadCalendar();
      case 'cal-today': W.cal.start = null; W.cal.day = null; return loadCalendar();
      case 'cal-day': W.cal.day = el.dataset.day; return paintCalendar();
      case 'add-cal': return openAddToCalendar(id);
      case 'sync-calendar': { const m = document.getElementById('ws-menu'); if (m) m.hidden = true; return openCalendarSync(); }
      case 'report-days': W.reports.days = Number(el.dataset.days); return loadReports();
      case 'install-app': return installApp();
      case 'enable-alerts': {
        const m = document.getElementById('ws-menu'); if (m) m.hidden = true;
        if (pushNeedsInstall()) return installApp();
        return run(async () => {
          await subscribePush(true);
          document.querySelectorAll('.ws-install-card').forEach((c) => c.remove());
          toast('Alerts are on for this device.');
        });
      }
      case 'test-alert': { const m = document.getElementById('ws-menu'); if (m) m.hidden = true; return run(async () => toast((await api('/push/test', { method: 'POST' })).message)); }
      case 'setup-dismiss': try { localStorage.setItem(el.dataset.key, '1'); } catch (e) { /* ignore */ } el.closest('.ws-install-card').remove(); return;
      case 'company-settings': { const m = document.getElementById('ws-menu'); if (m) m.hidden = true; return openCompanySettings(); }
      case 'import-leads': return run(openImport);
      case 'export-leads': return run(exportLeads);
      case 'copy-feed': {
        const t = document.getElementById('ws-feed-url');
        try { await navigator.clipboard.writeText(t.value); } catch (err) { t.select(); document.execCommand('copy'); }
        return toast('Link copied. Paste it into your calendar app.');
      }
      case 'install-dismiss': try { localStorage.setItem('nx_install_dismissed', '1'); } catch (e) { /* ignore */ } el.closest('.ws-install-card').remove(); return;
      case 'distribute': return run(async () => {
        el.disabled = true;
        const res = await api('/leads/distribute', { method: 'POST' });
        toast(res.message);
        W.leads.view = '';
        W.leads.bucket = 'OPEN';
        document.getElementById('ws-leads-shell')?.remove();
        refreshCurrent();
      });
      case 'read-all': return run(async () => {
        await notifApi('/read-all', 'PATCH');
        await pulse();
        document.getElementById('ws-notifs').hidden = true;
      });
      case 'notif': {
        notifApi(`/${id}/read`, 'PATCH').then(() => pulse()).catch(() => {});
        document.getElementById('ws-notifs').hidden = true;
        if (el.dataset.entity === 'LEAD' && el.dataset.ref) return run(() => openLead(el.dataset.ref));
        return;
      }
      default:
    }
  }

  function onInput(e) {
    if (!e.target.closest('.ws')) return;
    if (e.target.id === 'ws-lead-search') {
      clearTimeout(W.searchTimer);
      W.searchTimer = setTimeout(() => { W.leads.q = e.target.value.trim(); loadLeads(); }, 280);
    }
    const form = e.target.closest('form[data-form="book"]');
    if (form) updateBookSummary(form);
  }

  async function onChange(e) {
    const t = e.target;
    if (!t.closest('.ws')) return;
    if (t.id === 'ws-cal-agent') { W.cal.agentId = t.value; return loadCalendar(); }
    if (t.type === 'file' && t.closest('form[data-form="import"]')) return previewImport(t);
    const form = t.closest('form');
    if (t.id === 'ws-agent-filter') { W.leads.agentId = t.value; return loadLeads(); }
    if (t.dataset.action === 'agent-availability') {
      try {
        await api(`/team/${t.dataset.id}/availability`, { method: 'PATCH', body: { is_available: t.checked } });
        toast(t.checked ? 'Marked available.' : 'Marked on leave — new leads will skip them.');
        loadTeam();
      } catch (err) { t.checked = !t.checked; toast(err.message, 'err'); }
      return;
    }
    if (t.dataset.action === 'set-followup') {
      try {
        await api(`/leads/${t.dataset.id}`, { method: 'PATCH', body: { next_follow_up_at: t.value ? new Date(t.value).toISOString() : null } });
        toast(t.value ? `Follow-up set for ${fmtWhen(new Date(t.value))}.` : 'Follow-up cleared.');
        refreshCurrent();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.dataset.action === 'assign') {
      if (!t.value) return;
      try {
        const res = await api(`/leads/${t.dataset.id}/assign`, { method: 'POST', body: { agent_id: t.value } });
        toast(res.message);
        refreshCurrent();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if (t.dataset.action === 'book-project') return loadBookUnits(t.value);
    if (form && form.dataset.form === 'book') return updateBookSummary(form);

    if (form && form.dataset.form === 'log' && t.name === 'outcome') {
      form.querySelector('[data-when]').hidden = t.value !== 'CALLBACK';
      form.querySelector('[data-reasons]').hidden = t.value !== 'NOT_INTERESTED';
      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = t.value === 'VISIT' ? 'Next: choose visit time' : 'Save & next';
    }
    if (form && form.dataset.form === 'visit-outcome' && t.name === 'action') {
      form.querySelector('[data-complete]').hidden = t.value !== 'complete';
    }
    if (form && form.dataset.form === 'edit-lead' && t.name === 'bucket') {
      form.querySelector('.ws-lost-reason').hidden = t.value !== 'LOST';
    }
    if (t.type === 'radio' && t.closest('.ws-temp-pick, .ws-chips')) {
      t.closest('.ws-temp-pick, .ws-chips').querySelectorAll('label').forEach((l) => l.classList.toggle('is-on', l.contains(t) && t.checked));
    }
  }

  async function onSubmit(e) {
    if (!e.target.closest('.ws')) return;
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    const kind = form.dataset.form;
    const id = form.dataset.id;
    const errBox = form.querySelector('.ws-form-error');
    const busy = (on) => { if (btn) { btn.disabled = on; btn.classList.toggle('is-busy', on); } };
    busy(true);
    try {
      if (kind === 'company') {
        const res = await api('/settings', { method: 'PUT', body: data });
        W.me.company = res.data;
        paintBrand();
        if (window.NX && NX.applyBrand) NX.applyBrand(res.data);
        closeSheet();
        toast('Saved — your brand is now on the app and website.');
        return;
      }
      if (kind === 'import') {
        if (!W.importRows || !W.importRows.length) throw new Error('Choose a file first.');
        const res = await api('/leads/import', { method: 'POST', body: { rows: W.importRows, assign_to: data.assign_to, file_name: W.importFile } });
        W.importRows = null;
        W.leads.data = null;
        showImportResult(res.data);
        refreshCurrent();
        return;
      }
      if (kind === 'log') {
        if (data.outcome === 'VISIT') {
          if (data.note || data.temperature) await api(`/leads/${id}/activities`, { method: 'POST', body: { outcome: 'INTERESTED', note: data.note || null, temperature: data.temperature } });
          return openScheduleVisit(id);
        }
        const body = { outcome: data.outcome, note: data.note || null, temperature: data.temperature || undefined };
        if (data.outcome === 'CALLBACK' && data.next_follow_up_at) body.next_follow_up_at = new Date(data.next_follow_up_at).toISOString();
        if (data.outcome === 'NOT_INTERESTED') body.lost_reason = data.lost_reason || data.note;
        const res = await api(`/leads/${id}/activities`, { method: 'POST', body });
        closeSheet();
        toast(res.data.next_follow_up_at ? `${res.message} Next call ${fmtWhen(res.data.next_follow_up_at)}.` : res.message);
        refreshCurrent();
      } else if (kind === 'visit' || kind === 'reschedule') {
        const when = new Date(`${data.date}T${data.time}`);
        const res = kind === 'visit'
          ? await api(`/leads/${id}/visits`, { method: 'POST', body: { project_id: data.project_id, scheduled_time: when.toISOString(), note: data.note || null } })
          : await api(`/visits/${form.dataset.visit}`, { method: 'PATCH', body: { action: 'reschedule', scheduled_time: when.toISOString() } });
        closeSheet();
        toast(res.message);
        refreshCurrent();
      } else if (kind === 'visit-outcome') {
        const body = { action: data.action, feedback: data.feedback || null };
        if (data.action === 'complete') {
          body.temperature = data.temperature || undefined;
          if (data.next_follow_up_at) body.next_follow_up_at = new Date(data.next_follow_up_at).toISOString();
        }
        const res = await api(`/visits/${id}`, { method: 'PATCH', body });
        closeSheet();
        toast(res.message);
        refreshCurrent();
      } else if (kind === 'book') {
        if (!data.unit_id) throw new Error('Select a unit.');
        const res = await api(`/leads/${id}/book`, { method: 'POST', body: { unit_id: data.unit_id, booking_token_amount: Number(data.booking_token_amount) || undefined, discount_amount: Number(data.discount_amount) || 0 } });
        closeSheet();
        W.projects = null;
        toast(`🎉 ${res.message}`);
        refreshCurrent();
      } else if (kind === 'add-lead' || kind === 'register') {
        const body = { ...data };
        Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k]; });
        try {
          const res = await api('/leads', { method: 'POST', body });
          closeSheet();
          toast(res.message);
          if (W.tab === 'leads') { W.leads.bucket = 'OPEN'; } else if (W.me.kind !== 'partner') { /* stay */ }
          refreshCurrent();
          if (res.data && res.data.id) setTimeout(() => openLead(res.data.id), 250);
        } catch (err) {
          if (errBox) {
            errBox.hidden = false;
            errBox.innerHTML = `${esc(err.message)}${err.leadId ? ` <button type="button" class="ws-link" data-action="open-lead" data-id="${esc(err.leadId)}">Open existing lead →</button>` : ''}`;
            return;
          }
          throw err;
        }
      } else if (kind === 'note') {
        await api(`/leads/${id}/activities`, { method: 'POST', body: { outcome: 'NOTE', note: data.note } });
        toast(W.me.kind === 'partner' ? 'Sent — your RM has been notified.' : 'Note saved.');
        openLead(id);
      } else if (kind === 'edit-lead') {
        const body = { ...data };
        if (body.bucket !== 'LOST') delete body.lost_reason;
        ['budget_min', 'budget_max', 'email', 'last_name', 'preferred_project_id'].forEach((k) => { if (body[k] === '') body[k] = null; });
        await api(`/leads/${id}`, { method: 'PATCH', body });
        toast('Saved.');
        openLead(id);
        refreshCurrent();
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      busy(false);
    }
  }

  // Refresh the list when the agent comes back to the tab (e.g. after a phone call)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.querySelector('.ws') && !document.querySelector('.ws-sheet-host.is-open')) refreshCurrent();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.ws-sheet-host.is-open')) closeSheet();
  });

  // If app.js already painted (document was parsed before this script ran), repaint into the workspace
  if (document.readyState !== 'loading' && window.shouldRenderWorkspace() && !document.querySelector('.ws') && state.viewMode === 'crm') {
    renderApp();
  }

  // Reset cached identity when a different user signs in
  const origLogin = window.login;
  if (typeof origLogin === 'function') {
    window.login = function (token, user) {
      W.me = null; W.today = null; W.team = null; W.tab = null; W.projects = null; W.members = null;
      W.renderedAt = 0; W.meReq = null; W.projectsReq = null;
      W.leads = { bucket: 'OPEN', q: '', view: '', agentId: '', data: null, counts: {} };
      try { localStorage.removeItem('crm_surface'); } catch (e) { /* ignore */ }
      return origLogin(token, user);
    };
  }
})();
