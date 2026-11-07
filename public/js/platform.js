/* ==========================================================================
   Platform glue shared by the website, CRM and Sales Workspace.
   - after-render hooks (app.js re-renders #app wholesale)
   - server flags (demo logins only in demo mode)
   - installable app (PWA): service worker + "Install app" on Android, iPhone, Windows, Mac
   Loaded after app.js and before workspace.js / enquiry.js.
   ========================================================================== */
(function () {
  'use strict';

  const NX = (window.NX = window.NX || {});
  NX.afterRender = NX.afterRender || [];

  NX.apiBase = function () {
    return typeof getApiBase === 'function' ? getApiBase() : '/api';
  };

  // ---- After-render hooks ---------------------------------------------------
  if (typeof window.renderApp === 'function' && !window.renderApp.__nxWrapped) {
    const original = window.renderApp;
    window.renderApp = function () {
      const out = original.apply(this, arguments);
      NX.afterRender.forEach((fn) => {
        try { fn(); } catch (e) { console.error('[afterRender]', e); }
      });
      return out;
    };
    window.renderApp.__nxWrapped = true;
  }
  NX.runAfterRender = function () {
    NX.afterRender.forEach((fn) => {
      try { fn(); } catch (e) { console.error('[afterRender]', e); }
    });
  };
  // app.js may have painted before this file loaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => NX.runAfterRender());
  else setTimeout(() => NX.runAfterRender(), 0);

  // ---- CRM sidebar → slide-out menu on phones ---------------------------------
  function mountCrmMenu() {
    document.body.classList.remove('nx-nav-open'); // every navigation closes the menu
    const bar = document.querySelector('#app .top-bar');
    if (!bar || !document.querySelector('#app .sidebar') || bar.querySelector('.nx-menu-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nx-menu-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    btn.addEventListener('click', () => document.body.classList.add('nx-nav-open'));
    const titleBlock = bar.firstElementChild;
    titleBlock.insertBefore(btn, titleBlock.firstChild);
    if (!document.querySelector('.nx-nav-scrim')) {
      const scrim = document.createElement('div');
      scrim.className = 'nx-nav-scrim';
      scrim.addEventListener('click', () => document.body.classList.remove('nx-nav-open'));
      document.body.appendChild(scrim);
    }
  }
  NX.afterRender.push(mountCrmMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('nx-nav-open'); });

  // ---- White-label: the owner's company name instead of the template brand ------
  // The public site ships with "Nexora" copy; once the owner saves their company name in
  // Company & branding, every visible mention (including content loaded later) uses it.
  const TEMPLATE_NAME = 'Nexora Estates';
  const TEMPLATE_SHORT = 'Nexora';
  let brandRules = null;
  let brandObserver = null;
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };
  function rebrand(root) {
    if (!brandRules || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode && !SKIP[n.parentNode.nodeName] && n.nodeValue.includes(TEMPLATE_SHORT) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const v = n.nodeValue.split(TEMPLATE_NAME).join(brandRules.name).split(TEMPLATE_SHORT).join(brandRules.short);
      if (v !== n.nodeValue) n.nodeValue = v;
    });
  }
  NX.applyBrand = function (company) {
    NX.company = company || NX.company;
    const name = NX.company && NX.company.company_name;
    const short = (NX.company && NX.company.short_name) || (name || '').split(/\s+/)[0];
    // Nothing to swap for the template brand itself (or a name built on it — that would re-match forever)
    if (!name || name.includes(TEMPLATE_SHORT) || short.includes(TEMPLATE_SHORT)) { brandRules = null; return; }
    brandRules = { name, short };
    document.title = document.title.split(TEMPLATE_NAME).join(name).split(TEMPLATE_SHORT).join(brandRules.short);
    const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appTitle) appTitle.setAttribute('content', brandRules.short);
    const app = document.getElementById('app');
    rebrand(app);
    if (app && !brandObserver && 'MutationObserver' in window) {
      let queued = false;
      brandObserver = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; rebrand(app); });
      });
      brandObserver.observe(app, { childList: true, subtree: true, characterData: true });
    }
  };
  fetch(`${NX.apiBase()}/settings/public`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j && j.data) NX.applyBrand(j.data); })
    .catch(() => {});

  // ---- Server flags & Role Portals ---------------------------------------------
  window.NX_DEMO_LOGINS = true;
  function applyDemoFlag() {
    const box = document.getElementById('demo-login-box');
    if (box) box.hidden = false;
  }
  NX.afterRender.push(applyDemoFlag);
  fetch(`${NX.apiBase()}/auth/config`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      window.NX_DEMO_LOGINS = (j && j.data && j.data.demoLogins !== false);
      applyDemoFlag();
    })
    .catch(() => { window.NX_DEMO_LOGINS = true; applyDemoFlag(); });

  // ---- Installable app (PWA) ------------------------------------------------
  const ua = navigator.userAgent || '';
  NX.isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  NX.isStandalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  };

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.dispatchEvent(new CustomEvent('nx:installable'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.dispatchEvent(new CustomEvent('nx:installed'));
  });

  /** 'prompt' (Chrome/Edge/Android), 'ios' (Safari: Share → Add to Home Screen), or null (installed / unsupported) */
  NX.installMode = function () {
    if (NX.isStandalone()) return null;
    if (deferredPrompt) return 'prompt';
    if (NX.isIOS) return 'ios';
    return null;
  };

  NX.install = async function () {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    return Boolean(choice && choice.outcome === 'accepted');
  };

  // Service workers need HTTPS (or localhost). The worker is network-first, so new releases
  // show up on the next load — it only answers from cache when the device is offline.
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[PWA] service worker not registered:', err.message));
    });
  }
})();
