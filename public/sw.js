/* Nexora service worker — makes the CRM installable and lets the app shell open offline.
   Network-first for everything: users always get the latest release when online.
   API responses are never cached (lead data must be live); the cache only serves the shell offline. */
const CACHE = 'nexora-shell-v8';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './workspace.css',
  './enquiry.css',
  './suite.css',
  './app.js',
  './js/apartment-listings.js',
  './js/platform.js',
  './js/workspace.js',
  './js/enquiry.js',
  './js/ai-bot.js',
  './js/suite/core.js',
  './js/suite/charts.js',
  './js/suite/governance.js',
  './js/suite/sales.js',
  './js/suite/field.js',
  './js/suite/finance.js',
  './js/suite/inventory.js',
  './js/suite/marketing.js',
  './js/suite/crm.js',
  './js/suite/owner.js',
  './js/suite/testing.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/uploads/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});

// ---- Push alerts: shown even when the app is closed ----------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'New update';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || './#/crm', leadId: data.leadId || null }
  }));
});

// Tapping an alert opens the lead — in the already-open app if there is one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, leadId } = event.notification.data || {};
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if (leadId) open.postMessage({ type: 'open-lead', leadId });
      return;
    }
    const target = new URL(url || './#/crm', self.registration.scope);
    if (leadId) target.searchParams.set('lead', leadId);
    await self.clients.openWindow(target.href);
  })());
});
