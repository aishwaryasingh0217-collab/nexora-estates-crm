/* ==========================================================================
   NEXORA BUSINESS SUITE — shell, shared components and cross-portal features.
   Portals (owner, sales head, sales manager, finance, inventory, marketing,
   customer relationship, testing) register their pages with NXS.page(); this
   file draws the sidebar for the person's portals, the notification centre,
   the AI assistant, click-to-call and the lead drawer that every portal uses.
   Every action calls /api/suite/* — the server checks each permission.
   Loaded after app.js (uses its globals: state, getApiBase, logout, renderApp, toggleTheme).
   ========================================================================== */
(function () {
  'use strict';

  const NXS = (window.NXS = window.NXS || {});
  const S = (NXS.state = { me: null, portal: null, view: null, params: {}, pageToken: 0, notif: { list: [], unread: 0, open: false }, ai: { open: false, log: [] }, telephony: null });
  NXS.pages = NXS.pages || {};

  // ------------------------------------------------------------------ helpers
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fullName = (a, b) => [a, b].filter(Boolean).join(' ');
  const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  function money(v, short = true) {
    const n = Number(v) || 0;
    if (short && Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2)} Cr`;
    if (short && Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)} L`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }
  const num = (v) => (Number(v) || 0).toLocaleString('en-IN');
  function when(d, opts = {}) {
    if (!d) return '—';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleString('en-IN', opts.dateOnly ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function ago(d) {
    if (!d) return '—';
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
    return when(d, { dateOnly: true });
  }
  const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const localInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const label = (code) => String(code || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  Object.assign(NXS, { esc, fullName, money, num, when, ago, ymd, localInput, label, initials });

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    lead: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    key: '<path d="M2 18v3h3l9.6-9.6a5.5 5.5 0 1 0-3-3L2 18z"/><circle cx="16.5" cy="7.5" r="1.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 6V3M8 12H3M21 12h-5M5 7l3 2M19 7l-3 2M5 18l3-2M19 18l-3-2"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/>',
    swap: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'
  };
  const icon = (n, cls = '') => `<svg class="sx-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  NXS.icon = icon;

  // ------------------------------------------------------------------ API
  const base = () => (typeof getApiBase === 'function' ? getApiBase() : '/api');
  async function api(path, opts = {}) {
    const headers = { Authorization: `Bearer ${state.token}` };
    let body;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    const res = await fetch(`${base()}${path}`, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
    if (opts.raw) return res;
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty */ }
    if (res.status === 401) { stopLive(); logout(); throw new Error(data.message || 'Session ended. Please sign in again.'); }
    if (!res.ok) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { status: res.status, code: data.code, data });
    return data;
  }
  NXS.api = api;
  const can = (cap) => Boolean(S.me && S.me.capabilities.includes(cap));
  NXS.can = can;

  // ------------------------------------------------------------------ toast / modal / drawer
  let toastTimer;
  function toast(msg, kind = 'ok') {
    let el = document.getElementById('sx-toast');
    if (!el) { el = document.createElement('div'); el.id = 'sx-toast'; el.className = 'sx-toast sx-layer'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.className = `sx-toast sx-layer is-show ${kind === 'err' ? 'is-err' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'sx-toast sx-layer'; }, kind === 'err' ? 5500 : 3200);
  }
  NXS.toast = toast;

  function closeLayer(id) { document.querySelectorAll(`[data-layer="${id}"]`).forEach((n) => n.remove()); if (!document.querySelector('.sx-drawer, .sx-modal')) document.body.classList.remove('ws-no-scroll'); }
  /** A modal with arbitrary HTML; returns { el, close }. */
  function modal(html, { onClose } = {}) {
    const id = `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const scrim = document.createElement('div'); scrim.className = 'sx-scrim sx-layer'; scrim.dataset.layer = id;
    const box = document.createElement('div'); box.className = 'sx-modal sx-layer'; box.dataset.layer = id; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = html;
    document.body.append(scrim, box);
    const close = () => { closeLayer(id); if (onClose) onClose(); };
    scrim.addEventListener('click', close);
    box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    const first = box.querySelector('input, select, textarea'); if (first) setTimeout(() => first.focus(), 30);
    return { el: box, close };
  }
  function drawer(title, { narrow = false, actions = '' } = {}) {
    const id = `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const scrim = document.createElement('div'); scrim.className = 'sx-scrim sx-layer'; scrim.dataset.layer = id;
    const box = document.createElement('aside'); box.className = `sx-drawer sx-layer ${narrow ? 'narrow' : ''}`; box.dataset.layer = id;
    box.innerHTML = `<div class="sx-drawer-head"><h2>${esc(title)}</h2><div class="sx-spacer"></div>${actions}<button class="sx-icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="sx-drawer-body"><div class="sx-loading">Loading…</div></div>`;
    document.body.append(scrim, box);
    document.body.classList.add('ws-no-scroll');
    const close = () => closeLayer(id);
    scrim.addEventListener('click', close);
    box.querySelector('[data-close]').addEventListener('click', close);
    return { el: box, body: box.querySelector('.sx-drawer-body'), close, setTitle: (t) => { box.querySelector('h2').textContent = t; } };
  }
  Object.assign(NXS, { modal, drawer });

  /**
   * Form dialog. fields: [{ name, label, type: text|number|date|datetime|select|textarea|checkbox|file, options:[[v,l]], value, required, hint, min, max, step, accept }]
   * onSubmit(values, form) may throw (message shown) or return a message (toast).
   */
  function formDialog({ title, sub = '', fields, submit = 'Save', danger = false, onSubmit }) {
    const field = (f) => {
      const req = f.required ? 'required' : '';
      const v = f.value == null ? '' : f.value;
      let input;
      if (f.type === 'select') input = `<select name="${f.name}" ${req}>${(f.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') input = `<textarea name="${f.name}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      else if (f.type === 'checkbox') return `<label class="sx-check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
      else if (f.type === 'html') return f.html;
      else input = `<input name="${f.name}" type="${f.type === 'datetime' ? 'datetime-local' : f.type || 'text'}" value="${esc(v)}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.accept ? `accept="${f.accept}"` : ''} placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
      return `<label class="sx-field"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}${f.hint ? `<small class="sx-muted">${esc(f.hint)}</small>` : ''}</label>`;
    };
    const rows = fields.map((f) => (Array.isArray(f) ? `<div class="sx-form-row">${f.map(field).join('')}</div>` : field(f))).join('');
    const m = modal(`<h2>${esc(title)}</h2>${sub ? `<p class="sx-sub">${sub}</p>` : ''}<form class="sx-form">${rows}<div class="sx-error" hidden></div><div class="sx-actions"><button type="button" class="sx-btn" data-close>Cancel</button><button class="sx-btn ${danger ? 'danger' : 'primary'}" type="submit">${esc(submit)}</button></div></form>`);
    const form = m.el.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.sx-error');
      const btn = form.querySelector('[type=submit]');
      const values = {};
      fields.flat().forEach((f) => {
        if (!f.name) return;
        const el = form.elements[f.name];
        if (!el) return;
        if (f.type === 'checkbox') values[f.name] = el.checked;
        else if (f.type === 'file') values[f.name] = el.files[0] || null;
        else if (f.type === 'number') values[f.name] = el.value === '' ? null : Number(el.value);
        else if (f.type === 'datetime') values[f.name] = el.value ? new Date(el.value).toISOString() : null;
        else values[f.name] = el.value.trim();
      });
      err.hidden = true;
      btn.disabled = true;
      try {
        const msg = await onSubmit(values, form);
        m.close();
        if (msg) toast(msg);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
    return m;
  }
  NXS.formDialog = formDialog;
  NXS.confirm = (title, sub, { submit = 'Confirm', danger = false, reason = false, reasonLabel = 'Reason' } = {}) => new Promise((resolve) => {
    let done = false;
    const m = formDialog({
      title, sub, submit, danger,
      fields: reason ? [{ name: 'reason', label: reasonLabel, type: 'textarea', required: true }] : [],
      onSubmit: (v) => { done = true; resolve(reason ? v.reason : true); }
    });
    m.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!done) resolve(null); }));
  });

  // ------------------------------------------------------------------ exports (CSV, Excel, PDF)
  const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { setTimeout(resolve, 50); return; }
      const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load the export library.')); document.head.appendChild(s);
    });
  }
  async function exportTable({ title, columns, rows }, format) {
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = `${String(title || 'export').replace(/[^\w-]+/g, '_')}_${stamp}`;
    if (format === 'csv') return download(`${safe}.csv`, new Blob([`﻿${[columns.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n')}`], { type: 'text/csv' }));
    if (format === 'xlsx') {
      if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ws = window.XLSX.utils.aoa_to_sheet([columns, ...rows]);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Report');
      return window.XLSX.writeFile(wb, `${safe}.xlsx`);
    }
    if (format === 'pdf') {
      if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf;
      if (!jsPDF.API.autoTable) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
      const brand = (S.me && S.me.company && S.me.company.company_name) || 'Nexora';
      doc.setFontSize(14); doc.text(`${brand} — ${title}`, 14, 16);
      doc.setFontSize(9); doc.text(`Generated ${new Date().toLocaleString('en-IN')} by ${S.me ? S.me.name : ''}`, 14, 22);
      doc.autoTable({ startY: 27, head: [columns], body: rows.map((r) => r.map((c) => (c == null ? '' : String(c).replace(/₹/g, 'Rs ')))), styles: { fontSize: 8 }, headStyles: { fillColor: [29, 29, 31] } });
      return doc.save(`${safe}.pdf`);
    }
  }
  NXS.exportTable = exportTable;
  const exportButtons = (key) => `<div class="sx-row"><button class="sx-btn sm" data-export="${key}" data-format="xlsx">${icon('download')} Excel</button><button class="sx-btn sm" data-export="${key}" data-format="pdf">PDF</button><button class="sx-btn sm" data-export="${key}" data-format="csv">CSV</button></div>`;
  NXS.exportButtons = exportButtons;

  // ------------------------------------------------------------------ tables
  /**
   * table(container, { key, columns:[{ key, label, num, render(row), text(row), sort }], rows, onRow(row), empty, exportTitle, pageSize })
   * Renders a sortable table with export buttons; returns { update(rows) }.
   */
  function table(container, opts) {
    const st = { rows: opts.rows || [], sort: opts.sort || null, dir: opts.dir || 'desc', page: 0 };
    const size = opts.pageSize || 50;
    const key = opts.key || `t${Math.random().toString(36).slice(2, 8)}`;
    const valueOf = (c, r) => (c.text ? c.text(r) : c.sortValue ? c.sortValue(r) : r[c.key]);
    function draw() {
      let rows = st.rows.slice();
      if (st.sort) {
        const c = opts.columns.find((x) => x.key === st.sort);
        rows.sort((a, b) => {
          const x = c && (c.sortValue ? c.sortValue(a) : a[c.key]); const y = c && (c.sortValue ? c.sortValue(b) : b[c.key]);
          const nx = Number(x); const ny = Number(y);
          const cmp = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '' && x != null && y != null ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''));
          return st.dir === 'asc' ? cmp : -cmp;
        });
      }
      const pages = Math.max(Math.ceil(rows.length / size), 1);
      st.page = Math.min(st.page, pages - 1);
      const visible = rows.slice(st.page * size, (st.page + 1) * size);
      container.innerHTML = `
        ${opts.exportTitle ? `<div class="sx-row" style="margin-bottom:8px"><span class="sx-muted" style="font-size:.8rem">${num(rows.length)} row${rows.length === 1 ? '' : 's'}</span><div class="sx-spacer"></div>${exportButtons(key)}</div>` : ''}
        ${rows.length ? `<div class="sx-table-wrap"><table class="sx-table"><thead><tr>${opts.columns.map((c) => `<th class="${c.num ? 'num' : ''}">${c.nosort ? esc(c.label) : `<button data-sort="${c.key}">${esc(c.label)}${st.sort === c.key ? (st.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>`}</th>`).join('')}</tr></thead>
        <tbody>${visible.map((r, i) => `<tr class="${opts.onRow ? 'is-click' : ''}" data-i="${st.page * size + i}">${opts.columns.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : esc(r[c.key] == null ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${pages > 1 ? `<div class="sx-row" style="margin-top:10px;justify-content:flex-end"><button class="sx-btn sm" data-pg="-1" ${st.page === 0 ? 'disabled' : ''}>Previous</button><span class="sx-muted">${st.page + 1} / ${pages}</span><button class="sx-btn sm" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''}>Next</button></div>` : ''}`
        : `<div class="sx-empty"><h3>${esc((opts.empty && opts.empty.title) || 'Nothing here yet')}</h3><p>${esc((opts.empty && opts.empty.text) || '')}</p></div>`}`;
      container.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { st.dir = st.sort === b.dataset.sort && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = b.dataset.sort; draw(); }));
      container.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => { st.page += Number(b.dataset.pg); draw(); }));
      if (opts.onRow) container.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('button, a, input, select')) return; opts.onRow(rows[Number(tr.dataset.i)]); }));
      container.querySelectorAll(`[data-export="${key}"]`).forEach((b) => b.addEventListener('click', () => {
        const cols = opts.columns.filter((c) => !c.noexport);
        exportTable({ title: opts.exportTitle, columns: cols.map((c) => c.label), rows: rows.map((r) => cols.map((c) => { const v = valueOf(c, r); return v == null ? '' : v; })) }, b.dataset.format).catch((err) => toast(err.message, 'err'));
      }));
      if (opts.afterDraw) opts.afterDraw(container, visible);
    }
    draw();
    return { update(rows) { st.rows = rows; st.page = 0; draw(); } };
  }
  NXS.table = table;

  // ------------------------------------------------------------------ small components
  const kpi = (lbl, val, { hint = '', tone = '', go = '', delta = null } = {}) => `
    <${go ? `button class="sx-kpi ${tone ? `is-${tone}` : ''}" data-go="${esc(go)}"` : `div class="sx-kpi ${tone ? `is-${tone}` : ''}"`}>
      <div class="lbl">${esc(lbl)}</div><div class="val">${val}</div>
      ${delta != null ? `<span class="sx-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous period</span>` : ''}
      ${hint ? `<div class="hint">${hint}</div>` : ''}
    </${go ? 'button' : 'div'}>`;
  NXS.kpi = kpi;

  const CHIP_TONES = {
    green: ['COMPLETED', 'PASS', 'VERIFIED', 'BOOKED', 'APPROVED', 'ACTIVE', 'PAID', 'RESOLVED', 'CLOSED_WON', 'SOLD', 'FIXED', 'CONFIRMED', 'MATCHED', 'PROCESSED', 'FULLY_PAID', 'QUALIFIED', 'AVAILABLE', 'SCHEDULED', 'ACCEPTED', 'COMPLETED_ONBOARDING', 'CONNECTED'],
    amber: ['PENDING', 'PENDING_APPROVAL', 'HOLD', 'REQUESTED', 'ASSIGNED', 'RESCHEDULED', 'IN_PROGRESS', 'PARTIAL', 'PARTIALLY_PAID', 'OPEN', 'BLOCKED', 'ACKNOWLEDGED', 'WARM', 'MEDIUM', 'HIGH', 'ISSUED', 'PARTIALLY', 'RINGING_AGENT', 'AGENT_ANSWERED', 'RINGING_CUSTOMER', 'INITIATED', 'UNMATCHED', 'PAUSED', 'PLANNED'],
    red: ['FAIL', 'REJECTED', 'CANCELLED', 'MISSED', 'NO_SHOW', 'OVERDUE', 'LOST', 'FAILED', 'BUSY', 'URGENT', 'CRITICAL', 'HOT', 'INACTIVE', 'NOT_QUALIFIED'],
    blue: ['NOT_RUN', 'DRAFT', 'NEW', 'AGREEMENT_SIGNED', 'CONTACTED', 'VISIT', 'VISITED', 'NEGOTIATION', 'INBOUND', 'OUTBOUND', 'COLD', 'LOW']
  };
  function chip(status, text) {
    const s = String(status || '').toUpperCase();
    const tone = ['RED', 'AMBER', 'GREEN', 'BLUE', 'VIOLET'].includes(s) ? s.toLowerCase() : (Object.keys(CHIP_TONES).find((t) => CHIP_TONES[t].includes(s)) || '');
    return `<span class="sx-chip ${tone}">${esc(text || label(s))}</span>`;
  }
  NXS.chip = chip;
  NXS.testChip = (row) => (row && Number(row.is_test_data) ? ' <span class="sx-chip test">TEST</span>' : '');

  /** Date-range control: presets + custom. Calls onChange({from,to}). */
  function rangeControl(current, onChange) {
    const presets = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']];
    const html = `<div class="sx-seg" data-range>${presets.map(([d, l]) => `<button data-days="${d}" class="${current.days === d ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <input type="date" data-from value="${current.from || ''}" aria-label="From"><input type="date" data-to value="${current.to || ''}" aria-label="To">`;
    return {
      html,
      bind(root) {
        root.querySelectorAll('[data-range] [data-days]').forEach((b) => b.addEventListener('click', () => {
          const days = Number(b.dataset.days);
          onChange({ days, from: ymd(Date.now() - (days - 1) * 86400000), to: ymd(Date.now()) });
        }));
        const f = root.querySelector('[data-from]'); const t = root.querySelector('[data-to]');
        const custom = () => { if (f.value && t.value) onChange({ days: null, from: f.value, to: t.value }); };
        f.addEventListener('change', custom); t.addEventListener('change', custom);
      }
    };
  }
  NXS.rangeControl = rangeControl;
  NXS.defaultRange = (days = 30) => ({ days, from: ymd(Date.now() - (days - 1) * 86400000), to: ymd(Date.now()) });
  NXS.qs = (obj) => { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };
  NXS.errorBox = (e) => `<div class="sx-error">${esc(e.message || e)}</div>`;
  NXS.loading = () => '<div class="sx-loading"><div class="sx-skeleton" style="width:60%"></div><div class="sx-skeleton"></div><div class="sx-skeleton" style="width:80%"></div></div>';

  // ------------------------------------------------------------------ pages & navigation
  /**
   * NXS.page(id, { title, portals: ['owner', ...], group, label, icon, cap, order, render(el, params) })
   */
  NXS.page = (id, def) => { NXS.pages[id] = { id, ...def }; };

  const PORTALS = {
    owner: { label: 'Business owner', home: 'owner-overview' },
    'sales-head': { label: 'Sales head', home: 'sales-dashboard' },
    'sales-manager': { label: 'Sales manager', home: 'sales-dashboard' },
    finance: { label: 'Finance & accounts', home: 'finance-overview' },
    inventory: { label: 'Projects & inventory', home: 'inv-overview' },
    marketing: { label: 'Marketing', home: 'mkt-overview' },
    crm: { label: 'Customer relationship', home: 'crm-overview' },
    testing: { label: 'Testing Center', home: 'test-summary' }
  };
  NXS.PORTALS = PORTALS;

  function pagesFor(portal) {
    return Object.values(NXS.pages)
      .filter((p) => (p.portals || []).includes(portal) || (p.portals || []).includes('*'))
      .filter((p) => !p.cap || (Array.isArray(p.cap) ? p.cap.some(can) : can(p.cap)))
      .filter((p) => !p.hidden)
      .sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  function go(view, params = {}) {
    if (String(view).includes('?')) { const [v, q] = String(view).split('?'); view = v; params = { ...Object.fromEntries(new URLSearchParams(q)), ...params }; }
    if (!NXS.pages[view]) return toast('That page is not available to you.', 'err');
    // A page from another of this person's portals (e.g. opened from a notification) switches portal
    if (!pagesFor(S.portal).some((p) => p.id === view)) {
      // prefer the page's own department portal (listed first), then any other portal of this person's that has it
      const owns = (p) => (S.allowed || []).includes(p) && pagesFor(p).some((x) => x.id === view);
      const other = (NXS.pages[view].portals || []).find(owns) || (S.allowed || []).find(owns);
      if (!other) return toast('That page is not available to you.', 'err');
      S.portal = other;
      const pick = document.getElementById('sx-portal');
      if (pick) pick.value = other;
    }
    S.view = view;
    S.params = params;
    try { sessionStorage.setItem('sx_view', JSON.stringify({ portal: S.portal, view, params })); } catch (e) { /* ignore */ }
    document.body.classList.remove('sx-nav-open');
    paintNav();
    renderPage();
  }
  NXS.go = go;

  function setPortal(p) {
    S.portal = p;
    go(PORTALS[p] ? PORTALS[p].home : pagesFor(p)[0].id);
  }

  async function renderPage() {
    const page = NXS.pages[S.view];
    const el = document.getElementById('sx-content');
    if (!page || !el) return;
    document.getElementById('sx-title').textContent = page.title || page.label;
    const token = ++S.pageToken;
    el.innerHTML = NXS.loading();
    try {
      await page.render(el, S.params || {}, { stale: () => token !== S.pageToken });
    } catch (e) {
      if (token === S.pageToken) el.innerHTML = NXS.errorBox(e);
    }
    // Links inside pages (KPI tiles, buttons) use data-go="page?param=x"; delegated so content redrawn later still works
    if (!el.dataset.goBound) {
      el.dataset.goBound = '1';
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b && b.dataset.go && el.contains(b)) go(b.dataset.go); });
    }
  }
  NXS.refresh = renderPage;

  function paintNav() {
    const nav = document.getElementById('sx-nav');
    if (!nav) return;
    const pages = pagesFor(S.portal);
    const groups = [];
    pages.forEach((p) => { const g = p.group || ''; let grp = groups.find((x) => x.name === g); if (!grp) groups.push((grp = { name: g, items: [] })); grp.items.push(p); });
    nav.innerHTML = groups.map((g) => `<div class="sx-nav-group">${g.name ? `<div class="sx-nav-title">${esc(g.name)}</div>` : ''}${g.items.map((p) => `<button class="sx-nav-item ${S.view === p.id ? 'is-active' : ''}" data-nav="${p.id}">${icon(p.icon || 'grid')}<span>${esc(p.label || p.title)}</span>${p.badge && p.badge() ? `<span class="sx-count">${p.badge()}</span>` : ''}</button>`).join('')}</div>`).join('');
    nav.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));
  }
  NXS.paintNav = paintNav;

  // ------------------------------------------------------------------ shell
  const SUITE_ROLES = ['BUSINESS_OWNER', 'FINANCE', 'INVENTORY', 'MARKETING', 'CUSTOMER_RELATIONS'];
  window.shouldRenderSuite = function () {
    const role = state.user && state.user.role;
    if (!state.token || !role) return false;
    let surface = null;
    try { surface = localStorage.getItem('crm_surface'); } catch (e) { /* ignore */ }
    if (SUITE_ROLES.includes(role)) return true;
    if (['SUPER_ADMIN', 'ADMIN'].includes(role)) return surface !== 'crm' && surface !== 'workspace';
    return surface === 'suite'; // agents/partners open the suite only for the Testing Center
  };
  window.openSuite = function (view) {
    try { localStorage.setItem('crm_surface', 'suite'); if (view) sessionStorage.setItem('sx_view', JSON.stringify({ portal: view === 'test-summary' ? 'testing' : null, view })); } catch (e) { /* ignore */ }
    renderApp();
  };
  const leaveSuite = (surface) => {
    try { localStorage.setItem('crm_surface', surface); } catch (e) { /* ignore */ }
    stopLive();
    S.me = null;
    if (surface === 'crm' && typeof state !== 'undefined') state.currentView = 'dashboard';
    renderApp();
  };

  window.renderSuite = function (root) {
    const existing = root.querySelector(':scope > .sx');
    if (existing && existing.dataset.uid === String(state.user.id) && S.me) { return; }
    root.innerHTML = `<div class="sx" data-uid="${esc(String(state.user.id))}"><div class="sx-loading" style="grid-column:1/-1;padding:80px">Opening your portal…</div></div>`;
    boot(root).catch((e) => { root.innerHTML = `<div class="sx" style="display:block;padding:40px">${NXS.errorBox(e)}<p style="margin-top:12px"><button class="sx-btn" onclick="logout()">Sign out</button></p></div>`; });
  };

  async function boot(root) {
    S.me = (await api('/suite/me')).data;
    const allowed = S.me.portals.filter((p) => PORTALS[p] && (p !== 'testing' || S.me.testingCenter));
    S.allowed = allowed;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('sx_view') || 'null'); } catch (e) { /* ignore */ }
    S.portal = saved && allowed.includes(saved.portal) ? saved.portal : (allowed.includes(S.me.homePortal) ? S.me.homePortal : allowed[0]);
    if (saved && saved.view === 'test-summary' && allowed.includes('testing')) S.portal = 'testing';
    if (!S.portal) throw new Error('Your account has no portal yet. Ask the administrator to check your role.');
    S.view = saved && NXS.pages[saved.view] && pagesFor(S.portal).some((p) => p.id === saved.view) ? saved.view : (PORTALS[S.portal] || {}).home;
    S.params = (saved && saved.view === S.view && saved.params) || {};
    if (!pagesFor(S.portal).some((p) => p.id === S.view)) S.view = (pagesFor(S.portal)[0] || {}).id;

    const company = S.me.company || {};
    const isField = ['INSIDE_SALES', 'OUTSIDE_SALES', 'CHANNEL_PARTNER'].includes(S.me.role);
    root.innerHTML = `
      <div class="sx" data-uid="${esc(String(state.user.id))}">
        <div class="sx-side-scrim" data-act="close-nav"></div>
        <aside class="sx-side" aria-label="Portal navigation">
          <div class="sx-brand"><div class="sx-logo">${company.logo_url ? `<img src="${esc(company.logo_url)}" alt="">` : esc(initials(company.short_name || 'NX'))}</div><div><strong>${esc(company.company_name || 'Nexora')}</strong><span>${esc(S.me.roleLabel)}${S.me.jobLevel === 'HEAD' && !['BUSINESS_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(S.me.role) ? ' · head' : ''}</span></div></div>
          ${allowed.length > 1 ? `<label class="sx-portal-pick"><span class="sx-muted" style="font-size:.7rem;font-weight:700;padding:0 4px">PORTAL</span><select id="sx-portal">${allowed.map((p) => `<option value="${p}" ${p === S.portal ? 'selected' : ''}>${esc(PORTALS[p].label)}</option>`).join('')}</select></label>` : ''}
          <nav id="sx-nav"></nav>
          <div class="sx-side-foot">
            ${['SUPER_ADMIN', 'ADMIN'].includes(S.me.role) || isField ? `<button class="sx-nav-item" data-act="workspace">${icon('home')}<span>Sales workspace</span></button>` : ''}
            ${['SUPER_ADMIN', 'ADMIN'].includes(S.me.role) ? `<button class="sx-nav-item" data-act="classic">${icon('grid')}<span>Classic CRM</span></button>` : ''}
            <button class="sx-nav-item" data-act="website">${icon('building')}<span>Public website</span></button>
          </div>
        </aside>
        <div class="sx-main">
          ${S.me.testingCenter ? '<div class="sx-test-banner">TESTING ENVIRONMENT — fictional test data only. Record results in the Testing Center.</div>' : ''}
          <header class="sx-top">
            <button class="sx-icon-btn sx-menu-btn" data-act="open-nav" aria-label="Menu">${icon('menu')}</button>
            <h1 id="sx-title"></h1>
            <div class="sx-top-actions">
              ${can('ai.use') ? `<button class="sx-ai-btn" data-act="ai">${icon('spark')}<span class="lbl">Assistant</span></button>` : ''}
              <div class="sx-pop-wrap"><button class="sx-icon-btn" data-act="notifs" aria-label="Notifications">${icon('bell')}<span class="sx-badge" id="sx-badge" hidden>0</span></button><div id="sx-notif-pop"></div></div>
              <button class="sx-icon-btn" data-act="theme" aria-label="Switch theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
              <div class="sx-pop-wrap"><button class="sx-me" data-act="me"><span class="sx-avatar">${esc(initials(S.me.name))}</span><span class="name">${esc(S.me.firstName || S.me.name)}</span></button><div id="sx-me-pop"></div></div>
            </div>
          </header>
          <main class="sx-content" id="sx-content"></main>
        </div>
      </div>`;
    root.querySelector('.sx').addEventListener('click', onShellClick);
    const pick = root.querySelector('#sx-portal');
    if (pick) pick.addEventListener('change', () => setPortal(pick.value));
    paintNav();
    renderPage();
    startLive();
    loadTelephony();
    if (window.NX && window.NX.applyBrand) window.NX.applyBrand(company);
  }

  function onShellClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'open-nav') document.body.classList.add('sx-nav-open');
    if (act === 'close-nav') document.body.classList.remove('sx-nav-open');
    if (act === 'workspace') leaveSuite('workspace');
    if (act === 'classic') leaveSuite('crm');
    if (act === 'website') { stopLive(); setViewMode('website'); }
    if (act === 'theme') { S.me = null; stopLive(); toggleTheme(); }
    if (act === 'notifs') toggleNotifs();
    if (act === 'me') toggleMeMenu();
    if (act === 'ai') openAssistant();
  }

  function toggleMeMenu() {
    const pop = document.getElementById('sx-me-pop');
    if (pop.innerHTML) { pop.innerHTML = ''; return; }
    pop.innerHTML = `<div class="sx-menu-pop">
      <div style="padding:8px 10px"><strong>${esc(S.me.name)}</strong><div class="sx-muted" style="font-size:.8rem">${esc(S.me.roleLabel)} · ${esc(S.me.username)}</div></div>
      <button data-m="notif-settings">Notification settings</button>
      <button data-m="notif-history">All notifications</button>
      <button data-m="sessions">Signed-in devices</button>
      <button data-m="password">Change password</button>
      ${S.me.testingCenter && S.portal !== 'testing' ? '<button data-m="testing">Testing Center</button>' : ''}
      <button data-m="logout">Sign out</button></div>`;
    pop.querySelectorAll('[data-m]').forEach((x) => x.addEventListener('click', async () => {
      pop.innerHTML = '';
      const m = x.dataset.m;
      if (m === 'logout') { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (e) { /* signed out anyway */ } stopLive(); S.me = null; logout(); }
      if (m === 'notif-settings') openNotifSettings();
      if (m === 'notif-history') openNotifHistory();
      if (m === 'sessions') openSessions();
      if (m === 'password') openPassword();
      if (m === 'testing') setPortal('testing');
    }));
    const close = (ev) => { if (!ev.target.closest('#sx-me-pop') && !ev.target.closest('[data-act="me"]')) { pop.innerHTML = ''; document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function openPassword() {
    formDialog({
      title: 'Change password', submit: 'Change password',
      fields: [{ name: 'current_password', label: 'Current password', type: 'password', required: true }, { name: 'new_password', label: 'New password', type: 'password', required: true, hint: 'At least 8 characters with letters and numbers. Your other devices will be signed out.' }],
      onSubmit: async (v) => (await api('/suite/me/password', { body: v })).message
    });
  }

  async function openSessions() {
    const d = drawer('Signed-in devices', { narrow: true });
    const draw = async () => {
      const rows = (await api('/suite/me/sessions')).data;
      d.body.innerHTML = `<p class="sx-muted">Sign out of a device you don't use or don't recognise. Its access ends immediately.</p>
        <div class="sx-stack">${rows.map((s) => `<div class="sx-card"><div class="sx-row"><strong>${esc((s.user_agent || 'Unknown device').replace(/\(.*?\)/g, '').slice(0, 60))}</strong>${s.current ? chip('ACTIVE', 'This device') : ''}</div>
          <div class="sx-muted" style="font-size:.82rem">Signed in ${when(s.created_at)} · last active ${ago(s.last_seen_at || s.created_at)} · ${esc(s.ip_address || '')}</div>
          ${s.current ? '' : `<div class="sx-actions"><button class="sx-btn sm danger" data-revoke="${s.id}">Sign out</button></div>`}</div>`).join('')}</div>
        ${rows.length > 1 ? '<div class="sx-actions"><button class="sx-btn danger" data-revoke="others">Sign out of all other devices</button></div>' : ''}`;
      d.body.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
        try { toast((await api(`/suite/me/sessions/${b.dataset.revoke}/revoke`, { method: 'POST', body: {} })).message); draw(); } catch (e) { toast(e.message, 'err'); }
      }));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }

  // ------------------------------------------------------------------ notification centre
  const ENTITY_LINKS = {
    LEAD: (id) => openLead(id),
    APPROVAL: () => go('approvals'),
    DEAL: () => (can('finance.view') ? go('finance-payments') : can('bookings.view.all') ? go('sales-bookings') : null),
    PAYMENT: () => (can('finance.view') ? go('finance-payments') : null),
    REFUND: () => (can('finance.view') ? go('finance-refunds') : null),
    CUSTOMER: (id) => (can('crm.view') ? NXS.openCustomer && NXS.openCustomer(id) : null),
    TICKET: (id) => (can('crm.ticket.create') && NXS.openTicket ? NXS.openTicket(id) : null),
    CALL: (id) => openCall(id),
    ESCALATION: () => go('escalations'),
    SITE_VISIT: () => (can('visits.allocate') ? go('sales-visits') : null)
  };
  function openEntity(type, id) {
    const fn = ENTITY_LINKS[String(type || '').toUpperCase()];
    if (fn) fn(id);
  }
  NXS.openEntity = openEntity;

  function paintBadge() {
    const b = document.getElementById('sx-badge');
    if (!b) return;
    b.hidden = !S.notif.unread;
    b.textContent = S.notif.unread > 99 ? '99+' : String(S.notif.unread);
  }
  async function loadNotifs() {
    const r = await api('/notifications?limit=25');
    S.notif.list = r.data || [];
    S.notif.unread = Number(r.unreadCount) || 0;
    paintBadge();
  }
  function notifItem(n) {
    return `<button class="sx-notif ${n.is_read ? '' : 'unread'}" data-n="${n.id}" data-type="${esc(n.related_entity_type || '')}" data-id="${esc(n.related_entity_id || '')}"><span class="pip"></span><span><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><span>${ago(n.created_at)}${n.category ? ` · ${esc(label(n.category))}` : ''}</span></span></button>`;
  }
  function bindNotifItems(container) {
    container.querySelectorAll('[data-n]').forEach((x) => x.addEventListener('click', async () => {
      try { await api(`/notifications/${x.dataset.n}/read`, { method: 'PATCH', body: {} }); } catch (e) { /* already read */ }
      S.notif.list.forEach((n) => { if (n.id === x.dataset.n && !n.is_read) { n.is_read = 1; S.notif.unread = Math.max(S.notif.unread - 1, 0); } });
      paintBadge();
      document.getElementById('sx-notif-pop').innerHTML = '';
      if (x.dataset.type) openEntity(x.dataset.type, x.dataset.id);
    }));
  }
  async function toggleNotifs() {
    const pop = document.getElementById('sx-notif-pop');
    if (pop.innerHTML) { pop.innerHTML = ''; return; }
    pop.innerHTML = `<div class="sx-notifs"><div class="sx-notifs-head"><strong>Notifications</strong><div class="sx-spacer"></div><button class="sx-link" data-all>Mark all read</button></div><div class="sx-loading">Loading…</div></div>`;
    try { await loadNotifs(); } catch (e) { /* keep last */ }
    const list = S.notif.list;
    pop.querySelector('.sx-notifs').innerHTML = `<div class="sx-notifs-head"><strong>Notifications</strong><div class="sx-spacer"></div><button class="sx-link" data-all>Mark all read</button></div>
      ${list.length ? list.map(notifItem).join('') : '<div class="sx-empty"><h3>All caught up</h3></div>'}
      <div style="padding:10px 14px;display:flex;gap:12px"><button class="sx-link" data-history>See all</button><button class="sx-link" data-settings>Settings</button></div>`;
    bindNotifItems(pop);
    pop.querySelector('[data-all]').addEventListener('click', async () => { await api('/notifications/read-all', { method: 'PATCH', body: {} }); S.notif.unread = 0; S.notif.list.forEach((n) => { n.is_read = 1; }); paintBadge(); pop.innerHTML = ''; toast('All marked as read.'); });
    pop.querySelector('[data-history]').addEventListener('click', () => { pop.innerHTML = ''; openNotifHistory(); });
    pop.querySelector('[data-settings]').addEventListener('click', () => { pop.innerHTML = ''; openNotifSettings(); });
    const close = (ev) => { if (!ev.target.closest('#sx-notif-pop') && !ev.target.closest('[data-act="notifs"]')) { pop.innerHTML = ''; document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  async function openNotifHistory() {
    const d = drawer('Notification history', { narrow: true });
    const cats = (await api('/notifications/categories')).data;
    let before = null;
    let category = '';
    let unreadOnly = false;
    const items = [];
    d.body.innerHTML = `<div class="sx-filters"><select data-cat><option value="">All categories</option>${cats.map((c) => `<option value="${c.category}">${esc(c.label)}</option>`).join('')}</select><label class="sx-check"><input type="checkbox" data-unread> Unread only</label></div><div data-list></div><button class="sx-btn" data-more hidden>Load older</button>`;
    const list = d.body.querySelector('[data-list]');
    const more = d.body.querySelector('[data-more]');
    async function load(reset) {
      if (reset) { items.length = 0; before = null; }
      const r = await api(`/notifications${NXS.qs({ limit: 40, category, unreadOnly: unreadOnly ? 'true' : '', before })}`);
      items.push(...r.data);
      before = r.data.length ? r.data[r.data.length - 1].created_at : before;
      list.innerHTML = items.length ? `<div class="sx-card" style="padding:0">${items.map(notifItem).join('')}</div>` : '<div class="sx-empty"><h3>No notifications</h3></div>';
      more.hidden = r.data.length < 40;
      bindNotifItems(list);
    }
    d.body.querySelector('[data-cat]').addEventListener('change', (e) => { category = e.target.value; load(true); });
    d.body.querySelector('[data-unread]').addEventListener('change', (e) => { unreadOnly = e.target.checked; load(true); });
    more.addEventListener('click', () => load(false));
    load(true).catch((e) => { list.innerHTML = NXS.errorBox(e); });
  }

  async function openNotifSettings() {
    const d = drawer('Notification settings', { narrow: true });
    const prefs = (await api('/notifications/preferences')).data;
    d.body.innerHTML = `<p class="sx-muted">Choose what reaches you in the app and as phone alerts. Approvals, escalations and anything assigned to you are on by default.</p>
      <div class="sx-card" style="padding:6px 0"><table class="sx-table"><thead><tr><th>Category</th><th class="num">In app</th><th class="num">Phone</th></tr></thead><tbody>
      ${prefs.map((p) => `<tr><td>${esc(p.label)}</td><td class="num"><input type="checkbox" data-c="${p.category}" data-k="in_app" ${p.in_app ? 'checked' : ''}></td><td class="num"><input type="checkbox" data-c="${p.category}" data-k="push" ${p.push ? 'checked' : ''}></td></tr>`).join('')}
      </tbody></table></div><div class="sx-actions"><button class="sx-btn primary" data-save>Save</button></div>`;
    d.body.querySelector('[data-save]').addEventListener('click', async () => {
      const out = prefs.map((p) => ({ category: p.category, in_app: d.body.querySelector(`[data-c="${p.category}"][data-k="in_app"]`).checked, push: d.body.querySelector(`[data-c="${p.category}"][data-k="push"]`).checked }));
      try { toast((await api('/notifications/preferences', { method: 'PUT', body: { preferences: out } })).message); d.close(); } catch (e) { toast(e.message, 'err'); }
    });
  }
  NXS.openNotifSettings = openNotifSettings;
  NXS.openNotifHistory = openNotifHistory;

  // Live updates: a streamed response (works through most proxies) with polling as the fallback
  let live = { ctrl: null, poll: null, retry: null, stopped: true };
  function stopLive() {
    live.stopped = true;
    if (live.ctrl) live.ctrl.abort();
    clearInterval(live.poll); clearTimeout(live.retry);
    live = { ctrl: null, poll: null, retry: null, stopped: true };
  }
  function onNewNotification(n) {
    S.notif.list.unshift(n);
    if (n.category === 'CALL' && n.related_entity_type === 'CALL' && /Incoming call/.test(n.title)) {
      showIncoming(n);
    } else {
      toast(n.title);
    }
  }
  async function startLive() {
    stopLive();
    live.stopped = false;
    loadNotifs().catch(() => {});
    const poll = () => { live.poll = setInterval(() => { if (!document.hidden) loadNotifs().catch(() => {}); }, 25000); };
    try {
      live.ctrl = new AbortController();
      const res = await fetch(`${base()}/notifications/stream`, { headers: { Authorization: `Bearer ${state.token}` }, signal: live.ctrl.signal });
      if (!res.ok || !res.body) throw new Error('no stream');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let gotFirst = false;
      const watchdog = setTimeout(() => { if (!gotFirst && !live.stopped) { live.ctrl.abort(); } }, 12000);
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (\w+)/.exec(chunk); const data = /data: (.*)/.exec(chunk);
          if (!ev) continue;
          gotFirst = true;
          const payload = data ? JSON.parse(data[1]) : {};
          if (ev[1] === 'ready' || ev[1] === 'unread') { S.notif.unread = Number(payload.unreadCount) || 0; paintBadge(); }
          if (ev[1] === 'notification') onNewNotification(payload);
        }
      }
      clearTimeout(watchdog);
      if (!live.stopped) live.retry = setTimeout(startLive, 1500);
    } catch (e) {
      if (live.stopped) return;
      poll(); // proxy buffering or offline: fall back to polling, retry the stream later
      live.retry = setTimeout(() => { clearInterval(live.poll); startLive(); }, 5 * 60 * 1000);
    }
  }
  NXS.stopLive = stopLive;

  // ------------------------------------------------------------------ click-to-call
  async function loadTelephony() {
    try { S.telephony = (await api('/suite/telephony/status')).data; } catch (e) { S.telephony = null; }
  }
  NXS.telephonyReady = () => Boolean(S.telephony && S.telephony.ready && S.telephony.canCall);
  NXS.loadTelephony = loadTelephony; // the agent workspace uses cloud calling too

  let callTimer = null;
  function callWidget(html) {
    let w = document.getElementById('sx-call');
    if (!w) { w = document.createElement('div'); w.id = 'sx-call'; w.className = 'sx-call sx-layer'; document.body.appendChild(w); }
    w.innerHTML = html;
    return w;
  }
  const CALL_TEXT = {
    INITIATED: 'Placing the call…', RINGING_AGENT: 'Your phone is ringing — answer it', AGENT_ANSWERED: 'Connecting you to the customer…', RINGING_CUSTOMER: 'Ringing the customer…',
    CONNECTED: 'Connected', COMPLETED: 'Call ended', MISSED: 'Not answered', BUSY: 'Line busy', FAILED: 'Call failed', REJECTED: 'Call rejected'
  };
  /** Starts a cloud call to a lead or customer and follows its real status. */
  async function startCall({ leadId = null, customerId = null, name = '' }) {
    if (!NXS.telephonyReady()) { toast(S.telephony && S.telephony.ready === false ? 'Cloud calling isn’t set up yet — ask the administrator.' : 'Calling isn’t available for your role.', 'err'); return; }
    try {
      const r = await api('/suite/telephony/calls', { body: { lead_id: leadId, customer_id: customerId } });
      toast(r.message);
      followCall(r.data.id, name);
    } catch (e) {
      toast(e.message, 'err');
      if (e.code === 'CALL_IN_PROGRESS' && e.data && e.data.call_id) followCall(e.data.call_id, name);
    }
  }
  NXS.startCall = startCall;
  function followCall(callId, name) {
    clearInterval(callTimer);
    const draw = (c) => {
      const final = ['COMPLETED', 'MISSED', 'BUSY', 'FAILED', 'REJECTED'].includes(c.status);
      const w = callWidget(`<div class="sx-row"><strong>${esc(name || c.client_name || c.customer_phone)}</strong><div class="sx-spacer"></div><button class="sx-icon-btn" data-x aria-label="Close">${icon('x')}</button></div>
        <div class="status">${final ? '' : '<span class="sx-pulse"></span>'}${esc(CALL_TEXT[c.status] || c.status)}</div>
        ${c.duration_sec ? `<div class="sx-muted">Talk time ${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s</div>` : ''}
        ${c.failure_reason ? `<div class="sx-muted">${esc(c.failure_reason)}</div>` : ''}
        ${final ? `<button class="sx-btn primary" data-outcome>Add call outcome</button>` : '<div class="sx-muted" style="font-size:.8rem">Status comes from the calling provider.</div>'}`);
      w.querySelector('[data-x]').addEventListener('click', () => { clearInterval(callTimer); w.remove(); });
      const o = w.querySelector('[data-outcome]');
      if (o) o.addEventListener('click', () => { w.remove(); outcomeForm(c); });
      return final;
    };
    const tick = async () => {
      try {
        const c = (await api(`/suite/telephony/calls/${callId}`)).data;
        if (draw(c)) clearInterval(callTimer);
      } catch (e) { clearInterval(callTimer); }
    };
    tick();
    callTimer = setInterval(tick, 3000);
    setTimeout(() => clearInterval(callTimer), 15 * 60 * 1000);
  }
  async function outcomeForm(call) {
    const outcomes = (await api('/suite/telephony/outcomes')).data;
    formDialog({
      title: 'How did the call go?', sub: `${esc(call.client_name || call.customer_phone || '')} · ${esc(CALL_TEXT[call.status] || call.status)}`, submit: 'Save outcome',
      fields: [
        { name: 'outcome', label: 'Outcome', type: 'select', required: true, options: [['', 'Choose…'], ...outcomes.map((o) => [o.key, o.label])] },
        { name: 'remarks', label: 'Remarks', type: 'textarea' },
        [{ name: 'next_follow_up_at', label: 'Next follow-up (optional)', type: 'datetime' }, { name: 'temperature', label: 'Client interest', type: 'select', options: [['', 'No change'], ['HOT', 'Hot'], ['WARM', 'Warm'], ['COLD', 'Cold']] }]
      ],
      onSubmit: async (v) => (await api(`/suite/telephony/calls/${call.id}/outcome`, { body: v })).message
    });
  }
  async function openCall(callId) {
    try {
      const c = (await api(`/suite/telephony/calls/${callId}`)).data;
      if (c.direction === 'INBOUND' && !c.lead_id && !c.customer_id) return unknownCaller(c);
      if (c.needs_outcome) return outcomeForm(c);
      if (c.lead_id) return openLead(c.lead_id);
      toast(`${CALL_TEXT[c.status] || c.status}`);
    } catch (e) { toast(e.message, 'err'); }
  }
  NXS.openCall = openCall;
  function showIncoming(n) {
    const w = callWidget(`<div class="sx-row"><strong>${esc(n.title)}</strong><div class="sx-spacer"></div><button class="sx-icon-btn" data-x aria-label="Close">${icon('x')}</button></div><div class="sx-muted">${esc(n.message)}</div><button class="sx-btn primary" data-open>Open</button>`);
    w.querySelector('[data-x]').addEventListener('click', () => w.remove());
    w.querySelector('[data-open]').addEventListener('click', () => { w.remove(); openCall(n.related_entity_id); });
  }
  function unknownCaller(c) {
    if (!can('leads.create')) return toast(`Call from ${c.customer_phone} — not in the CRM.`);
    formDialog({
      title: `Unknown caller ${c.customer_phone}`, sub: 'Create a lead for this number?', submit: 'Create lead',
      fields: [[{ name: 'first_name', label: 'First name', required: true }, { name: 'last_name', label: 'Last name' }], { name: 'note', label: 'What did they ask about?', type: 'textarea' }],
      onSubmit: async (v) => { const r = await api(`/suite/telephony/calls/${c.id}/create-lead`, { body: v }); setTimeout(() => openLead(r.data.leadId), 300); return r.message; }
    });
  }
  NXS.callButton = (attrs, text = 'Call') => (NXS.telephonyReady() ? `<button class="sx-btn sm" ${attrs}>${icon('phone')} ${esc(text)}</button>` : '');

  // ------------------------------------------------------------------ AI assistant
  const AI_SUGGEST = {
    BUSINESS_OWNER: ['How is the business doing this month?', 'Which projects have the most unsold value?', 'Show overdue payments'],
    SUPER_ADMIN: ['Team productivity for the last 30 days', 'Suggest owners for unassigned leads', 'Leads by source this month'],
    ADMIN: ['Which follow-ups are overdue?', 'Team productivity this week', 'Suggest owners for unassigned leads'],
    FINANCE: ['Collections summary', 'Show overdue payments'],
    INVENTORY: ['Inventory overview with ageing', 'Available 3BHK units under 1.5 Cr'],
    MARKETING: ['Campaign results for the last 90 days', 'Leads by source this month'],
    CUSTOMER_RELATIONS: ['Customer care summary'],
    INSIDE_SALES: ['My overdue follow-ups', 'Hot leads I should call today'],
    OUTSIDE_SALES: ['My follow-ups today', 'Available 2BHK units in Aurora']
  };
  async function openAssistant(prefill) {
    if (document.getElementById('sx-ai')) return;
    let status = null;
    try { status = (await api('/suite/ai/status')).data; } catch (e) { status = { configured: false }; }
    const scrim = document.createElement('div'); scrim.className = 'sx-scrim sx-layer'; scrim.dataset.layer = 'ai';
    const panel = document.createElement('aside'); panel.className = 'sx-ai sx-layer'; panel.id = 'sx-ai'; panel.dataset.layer = 'ai';
    panel.innerHTML = `<div class="sx-drawer-head">${icon('spark')}<h2>Assistant</h2><div class="sx-spacer"></div><button class="sx-icon-btn" data-x aria-label="Close">${icon('x')}</button></div>
      <div class="sx-ai-log" id="sx-ai-log"></div>
      <form class="sx-ai-form"><textarea placeholder="${status.configured ? 'Ask about your leads, team, inventory, payments…' : 'The assistant isn’t set up yet'}" ${status.configured ? '' : 'disabled'} aria-label="Message"></textarea><button class="sx-btn primary" ${status.configured ? '' : 'disabled'}>Send</button></form>`;
    document.body.append(scrim, panel);
    const close = () => closeLayer('ai');
    scrim.addEventListener('click', close);
    panel.querySelector('[data-x]').addEventListener('click', close);
    const log = panel.querySelector('#sx-ai-log');
    const paint = () => {
      log.innerHTML = (status.configured ? '' : `<div class="sx-note amber">The AI assistant needs the company's Anthropic API key (ANTHROPIC_API_KEY on the server). Everything else in the CRM works without it.</div>`)
        + (S.ai.log.length ? '' : `<div class="sx-muted">Answers come from your live records — only what your role can see. Changes are prepared for you to confirm.</div><div class="sx-ai-suggest">${(AI_SUGGEST[S.me.role] || []).map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`)
        + S.ai.log.map((m, i) => {
          if (m.role === 'user') return `<div class="sx-ai-msg user">${esc(m.content)}</div>`;
          if (m.role === 'thinking') return '<div class="sx-ai-msg bot sx-muted">Looking it up…</div>';
          if (m.role === 'error') return `<div class="sx-error">${esc(m.content)}</div>`;
          return `<div class="sx-ai-msg bot">${esc(m.content)}</div>
            ${(m.tables || []).map((t, j) => `<div class="sx-card" style="padding:10px"><div class="sx-row"><strong style="font-size:.86rem">${esc(t.title)}</strong><div class="sx-spacer"></div><button class="sx-btn sm" data-tx="${i}:${j}" data-f="xlsx">Excel</button><button class="sx-btn sm" data-tx="${i}:${j}" data-f="pdf">PDF</button></div>
              <div class="sx-table-wrap" style="max-height:260px;overflow:auto;margin-top:6px"><table class="sx-table"><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.slice(0, 50).map((r) => `<tr>${r.map((c, k) => `<td>${t.columns[k] === 'Lead ID' ? `<button class="sx-link" data-lead="${esc(c)}">Open</button>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}
            ${(m.pendingActions || []).map((a) => `<div class="sx-ai-action" data-action="${a.id}"><strong>Confirm this change?</strong><span>${esc(a.summary)}</span><div class="sx-row">${a.done ? `<span class="sx-chip ${a.done === 'Confirmed' ? 'green' : ''}">${esc(a.done)}</span>` : `<button class="sx-btn sm primary" data-confirm="${a.id}">Confirm</button><button class="sx-btn sm" data-cancel="${a.id}">Cancel</button>`}</div></div>`).join('')}`;
        }).join('');
      log.scrollTop = log.scrollHeight;
      log.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
      log.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => openLead(b.dataset.lead)));
      log.querySelectorAll('[data-tx]').forEach((b) => b.addEventListener('click', () => { const [i, j] = b.dataset.tx.split(':').map(Number); exportTable(S.ai.log[i].tables[j], b.dataset.f).catch((e) => toast(e.message, 'err')); }));
      log.querySelectorAll('[data-confirm], [data-cancel]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.dataset.confirm || b.dataset.cancel;
        const confirmIt = Boolean(b.dataset.confirm);
        try {
          const r = await api(`/suite/ai/actions/${id}/${confirmIt ? 'confirm' : 'cancel'}`, { method: 'POST', body: {} });
          S.ai.log.forEach((m) => (m.pendingActions || []).forEach((a) => { if (a.id === id) a.done = confirmIt ? 'Confirmed' : 'Cancelled'; }));
          toast(r.message || 'Done.');
          paint();
          if (confirmIt) NXS.refresh();
        } catch (e) { toast(e.message, 'err'); }
      }));
    };
    async function send(text) {
      const q = String(text || '').trim();
      if (!q) return;
      S.ai.log.push({ role: 'user', content: q }, { role: 'thinking' });
      paint();
      try {
        const history = S.ai.log.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));
        const r = (await api('/suite/ai/chat', { body: { messages: history } })).data;
        S.ai.log.pop();
        S.ai.log.push({ role: 'assistant', content: r.reply, tables: r.tables, pendingActions: r.pendingActions });
      } catch (e) {
        S.ai.log.pop();
        S.ai.log.push({ role: 'error', content: e.message });
      }
      paint();
    }
    const form = panel.querySelector('form');
    const ta = form.querySelector('textarea');
    form.addEventListener('submit', (e) => { e.preventDefault(); const v = ta.value; ta.value = ''; send(v); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    paint();
    if (prefill) send(prefill);
  }
  NXS.openAssistant = openAssistant;

  // ------------------------------------------------------------------ lead drawer (shared)
  async function openLead(leadId) {
    if (!can('leads.view.all')) { toast('Open this lead from your workspace.', 'err'); return; }
    const d = drawer('Lead');
    const draw = async () => {
      const r = (await api(`/suite/sales/leads/${leadId}`)).data;
      const l = r.lead;
      d.setTitle(fullName(l.first_name, l.last_name));
      const actions = [
        NXS.callButton('data-a="call"'),
        can('leads.assign') ? `<button class="sx-btn sm" data-a="assign">${l.assigned_agent_id ? 'Reassign' : 'Assign'}</button>` : '',
        can('visits.allocate') ? '<button class="sx-btn sm" data-a="visit">Schedule visit</button>' : '',
        can('bookings.initiate') && !['BOOKED', 'LOST'].includes(l.bucket) ? '<button class="sx-btn sm" data-a="book">Book a unit</button>' : '',
        ['SUPER_ADMIN', 'ADMIN'].includes(S.me.role) ? '<button class="sx-btn sm" data-a="edit">Edit</button><button class="sx-btn sm" data-a="note">Add note</button>' : '',
        can('ai.use') ? `<button class="sx-btn sm" data-a="assist">${icon('spark')} Next step</button>` : '',
        '<button class="sx-btn sm" data-a="escalate">Escalate</button>'
      ].join('');
      d.body.innerHTML = `
        <div class="sx-row">${chip(l.bucket, label(l.bucket))}${l.priority ? chip(l.priority) : ''}${l.temperature ? chip(l.temperature) : ''}${chip(l.qualification_status, l.qualification_status === 'PENDING' ? 'Qualification pending' : label(l.qualification_status))}${NXS.testChip(l)}</div>
        <div class="sx-row">${actions}</div>
        <div class="sx-card"><dl class="sx-kv">
          <dt>Phone</dt><dd>${esc(l.phone)}</dd><dt>Email</dt><dd>${esc(l.email || '—')}</dd>
          <dt>Source</dt><dd>${esc(label(l.source))}${l.campaign_name ? ` · ${esc(l.campaign_name)}` : ''}${l.utm_campaign ? ` <span class="sx-muted">(utm ${esc(l.utm_campaign)})</span>` : ''}</dd>
          <dt>Owner</dt><dd>${esc(l.agent_name || 'Unassigned')}</dd><dt>Partner</dt><dd>${esc(l.partner_firm || '—')}</dd>
          <dt>Project</dt><dd>${esc(l.project_name || '—')}</dd>
          <dt>Requirement</dt><dd>${esc([l.configuration, l.property_type && label(l.property_type), l.preferred_location].filter(Boolean).join(' · ') || '—')}</dd>
          <dt>Budget</dt><dd>${l.budget_min || l.budget_max ? `${money(l.budget_min)} – ${money(l.budget_max)}` : '—'}</dd>
          <dt>Purpose / timeline</dt><dd>${esc([label(l.purpose), label(l.purchase_timeline)].filter(Boolean).join(' · ') || '—')}</dd>
          <dt>Next follow-up</dt><dd>${when(l.next_follow_up_at)}</dd><dt>Created</dt><dd>${when(l.created_at)}</dd>
          ${l.lost_reason ? `<dt>Lost reason</dt><dd>${esc(l.lost_reason)}</dd>` : ''}
          <dt>Suggested priority</dt><dd>${esc(label(l.suggested_priority))}</dd>
        </dl></div>
        ${r.duplicates.length ? `<div class="sx-note amber"><strong>Possible duplicates:</strong> ${r.duplicates.map((x) => `<button class="sx-link" data-dup="${x.id}">${esc(fullName(x.first_name, x.last_name))} (${esc(x.phone)})</button>`).join(', ')}</div>` : ''}
        <div class="sx-tabs"><button class="is-on" data-t="tl">Timeline</button><button data-t="visits">Visits (${r.visits.length})</button><button data-t="deals">Bookings (${r.deals.length})</button><button data-t="owners">Ownership (${r.assignments.length})</button></div>
        <div data-pane></div>`;
      const pane = d.body.querySelector('[data-pane]');
      const panes = {
        tl: () => `<ul class="sx-tl">${r.timeline.map((t) => `<li><span class="dot ${t.kind === 'call' ? 'call' : t.kind === 'audit' ? 'audit' : ''}"></span><div><div class="meta">${when(t.at)} · ${esc(t.by || '')}${t.role ? ` (${esc(label(t.role))})` : ''} · ${esc(label(t.type))}${t.outcome ? ` / ${esc(label(t.outcome))}` : ''}</div><div class="txt">${esc(t.text || '')}</div>${t.before ? `<div class="meta">${esc(Object.entries(t.after || {}).map(([k, v]) => `${label(k)}: ${t.before[k] ?? '—'} → ${v ?? '—'}`).join(' · '))}</div>` : ''}</div></li>`).join('') || '<li class="sx-muted">No activity yet.</li>'}</ul>`,
        visits: () => (r.visits.length ? r.visits.map((v) => `<div class="sx-card"><div class="sx-row"><strong>${esc(v.project_name)}</strong>${chip(v.status)}<div class="sx-spacer"></div><span class="sx-muted">${when(v.scheduled_time)}</span></div>
          <div class="sx-muted" style="font-size:.84rem">Field agent: ${esc(v.agent_name || 'not allocated')}${v.check_in_at ? ` · checked in ${when(v.check_in_at)}${v.check_in_distance_m != null ? ` (${v.check_in_distance_m} m away)` : ''}` : ''}${v.client_feedback ? ` · “${esc(v.client_feedback)}”` : ''}${v.rejection_reason ? ` · rejected: ${esc(v.rejection_reason)}` : ''}</div>
          ${can('visits.allocate') ? NXS.visitActions(v) : ''}</div>`).join('') : '<p class="sx-muted">No visits yet.</p>'),
        deals: () => (r.deals.length ? r.deals.map((x) => `<div class="sx-card"><div class="sx-row"><strong>${esc(x.deal_number)}</strong>${chip(x.status)}<div class="sx-spacer"></div><strong>${money(x.agreed_total_amount)}</strong></div><div class="sx-muted" style="font-size:.84rem">${esc(x.project_name)} · unit ${esc(x.unit_number)} · collected (verified) ${money(x.collected)}${x.rejection_reason ? ` · rejected: ${esc(x.rejection_reason)}` : ''}</div></div>`).join('') : '<p class="sx-muted">No bookings yet.</p>'),
        owners: () => `<ul class="sx-tl">${r.assignments.map((a) => `<li><span class="dot"></span><div><div class="meta">${when(a.created_at)} · by ${esc(a.by)} · ${esc(label(a.method))}</div><div class="txt">${a.from ? `${esc(a.from)} → ` : ''}${esc(a.to || 'Unassigned')}${a.reason ? ` — ${esc(a.reason)}` : ''}</div></div></li>`).join('') || '<li class="sx-muted">Never assigned.</li>'}</ul>`
      };
      const show = (k) => { d.body.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('is-on', b.dataset.t === k)); pane.innerHTML = panes[k](); NXS.bindVisitActions(pane, draw); };
      d.body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => show(b.dataset.t)));
      show('tl');
      d.body.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', () => { d.close(); openLead(b.dataset.dup); }));
      d.body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => leadAction(b.dataset.a, l, draw)));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openLead = openLead;

  async function memberOptions() {
    const m = (await api('/suite/sales/members')).data;
    return m.map((x) => [x.id, `${x.name} — ${label(x.role)}${x.is_available ? '' : ' (on leave)'} · ${x.open_leads} open`]);
  }
  NXS.memberOptions = memberOptions;
  async function projectOptions() {
    const p = (await api('/suite/inventory/directory')).data;
    const seen = new Map();
    p.rows.forEach((u) => seen.set(u.project_id, u.project_name));
    return [...seen.entries()];
  }

  async function leadAction(a, l, redraw) {
    try {
      if (a === 'call') return startCall({ leadId: l.id, name: fullName(l.first_name, l.last_name) });
      if (a === 'assign') {
        return formDialog({
          title: l.assigned_agent_id ? 'Reassign lead' : 'Assign lead', sub: 'The new owner is notified; the history keeps who had it before.', submit: 'Assign',
          fields: [{ name: 'to_user_id', label: 'Team member', type: 'select', required: true, options: [['', 'Choose…'], ...(await memberOptions())] }, { name: 'reason', label: 'Reason', type: 'textarea', required: Boolean(l.assigned_agent_id) }],
          onSubmit: async (v) => { const r = await api('/suite/sales/leads/assign', { body: { lead_ids: [l.id], to_user_id: v.to_user_id, reason: v.reason } }); if (r.data.failed.length) throw new Error(r.data.failed[0].error); redraw(); return r.message; }
        });
      }
      if (a === 'visit') {
        const projects = await projectOptions();
        return formDialog({
          title: 'Schedule a site visit', submit: 'Schedule',
          fields: [
            { name: 'project_id', label: 'Project', type: 'select', required: true, value: l.preferred_project_id, options: [['', 'Choose…'], ...projects] },
            { name: 'scheduled_time', label: 'Date & time', type: 'datetime', required: true },
            { name: 'agent_id', label: 'Field agent (leave empty to pick a free one)', type: 'select', options: [['', 'Auto-pick'], ...(await memberOptions())] },
            { name: 'client_confirmed', label: 'Time already agreed with the client', type: 'checkbox', value: true },
            { name: 'note', label: 'Note', type: 'textarea' }
          ],
          onSubmit: async (v) => { const r = await api(`/suite/sales/leads/${l.id}/visits`, { body: v }); redraw(); return r.message; }
        });
      }
      if (a === 'book') return NXS.bookDialog(l, redraw);
      if (a === 'note') {
        return formDialog({ title: 'Add a note', submit: 'Save', fields: [{ name: 'note', label: 'Note', type: 'textarea', required: true }], onSubmit: async (v) => { const r = await api(`/workspace/leads/${l.id}/activities`, { body: { outcome: 'NOTE', note: v.note } }); redraw(); return r.message; } });
      }
      if (a === 'edit') {
        return formDialog({
          title: 'Edit lead', submit: 'Save',
          fields: [
            [{ name: 'first_name', label: 'First name', value: l.first_name, required: true }, { name: 'last_name', label: 'Last name', value: l.last_name }],
            [{ name: 'phone', label: 'Phone', value: l.phone, required: true }, { name: 'email', label: 'Email', value: l.email }],
            [{ name: 'bucket', label: 'Stage', type: 'select', value: l.bucket, options: [['NEW', 'New'], ['CONTACTED', 'Follow-up'], ['VISIT', 'Visit fixed'], ['VISITED', 'Visited'], ['NEGOTIATION', 'Negotiation'], ['LOST', 'Lost']] }, { name: 'lost_reason', label: 'Lost reason (if lost)', value: l.lost_reason }],
            [{ name: 'priority', label: 'Priority', type: 'select', value: l.priority, options: [['', '—'], ['URGENT', 'Urgent'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']] }, { name: 'qualification_status', label: 'Qualification', type: 'select', value: l.qualification_status, options: [['PENDING', 'Pending'], ['QUALIFIED', 'Qualified'], ['NOT_QUALIFIED', 'Not qualified']] }],
            [{ name: 'configuration', label: 'Configuration', value: l.configuration }, { name: 'preferred_location', label: 'Preferred location', value: l.preferred_location }],
            [{ name: 'budget_min', label: 'Budget from (₹)', type: 'number', value: l.budget_min }, { name: 'budget_max', label: 'Budget to (₹)', type: 'number', value: l.budget_max }],
            [{ name: 'purpose', label: 'Purpose', type: 'select', value: l.purpose, options: [['', '—'], ['SELF_USE', 'Self use'], ['INVESTMENT', 'Investment'], ['RENTAL_INCOME', 'Rental income']] }, { name: 'purchase_timeline', label: 'Timeline', type: 'select', value: l.purchase_timeline, options: [['', '—'], ['IMMEDIATE', 'Immediate'], ['3_MONTHS', '3 months'], ['6_MONTHS', '6 months'], ['12_MONTHS', '12 months'], ['EXPLORING', 'Exploring']] }],
            { name: 'next_follow_up_at', label: 'Next follow-up', type: 'datetime', value: l.next_follow_up_at ? localInput(l.next_follow_up_at) : '' }
          ],
          onSubmit: async (v) => {
            const body = { ...v };
            if (body.bucket === l.bucket) delete body.bucket;
            if (body.bucket !== 'LOST') delete body.lost_reason;
            const r = await api(`/workspace/leads/${l.id}`, { method: 'PATCH', body });
            redraw();
            return r.message;
          }
        });
      }
      if (a === 'assist') {
        const d = drawer('Next step suggestions', { narrow: true });
        try {
          const r = (await api(`/suite/ai/leads/${l.id}/assist`, { method: 'POST', body: {} })).data;
          d.body.innerHTML = `<p class="sx-muted">From this lead's history and available inventory. Read-only — nothing has been changed.</p>
            <div class="sx-card"><strong>Summary</strong><p class="sx-pre">${esc(r.summary)}</p></div>
            <div class="sx-card"><strong>Next best action</strong><p class="sx-pre">${esc(r.next_best_action)}</p>${r.suggested_follow_up ? `<p class="sx-muted">Suggested follow-up: ${when(r.suggested_follow_up)}</p>` : ''}</div>
            <div class="sx-card"><strong>Talking points</strong><ul>${r.talking_points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
            <div class="sx-card"><strong>WhatsApp draft</strong><p class="sx-pre">${esc(r.whatsapp_draft)}</p><div class="sx-actions"><button class="sx-btn sm" data-copy>Copy</button></div></div>
            ${r.risks.length ? `<div class="sx-note amber"><strong>Watch out:</strong> ${r.risks.map(esc).join(' · ')}</div>` : ''}`;
          d.body.querySelector('[data-copy]').addEventListener('click', () => navigator.clipboard.writeText(r.whatsapp_draft).then(() => toast('Copied.')));
        } catch (e) { d.body.innerHTML = NXS.errorBox(e); }
        return null;
      }
      if (a === 'escalate') {
        return formDialog({
          title: 'Escalate this lead', submit: 'Escalate',
          fields: [{ name: 'title', label: 'What needs attention?', required: true, value: `${fullName(l.first_name, l.last_name)}: ` }, { name: 'reason', label: 'Details', type: 'textarea' },
            [{ name: 'severity', label: 'Severity', type: 'select', value: 'MEDIUM', options: [['LOW', 'Low'], ['MEDIUM', 'Medium'], ['HIGH', 'High'], ['CRITICAL', 'Critical']] }, { name: 'to_role', label: 'Send to', type: 'select', value: 'ADMIN', options: [['ADMIN', 'Sales managers'], ['SUPER_ADMIN', 'Sales head'], ['BUSINESS_OWNER', 'Business owner'], ['FINANCE', 'Finance'], ['CUSTOMER_RELATIONS', 'Customer care']] }]],
          onSubmit: async (v) => (await api('/suite/escalations', { body: { ...v, lead_id: l.id } })).message
        });
      }
    } catch (e) { toast(e.message, 'err'); }
    return null;
  }

  NXS.bookDialog = async function bookDialog(l, redraw) {
    const units = (await api(`/suite/inventory/directory${NXS.qs({ project_id: l.preferred_project_id || '' })}`)).data.rows;
    if (!units.length) return toast('No available units to book in this project.', 'err');
    return formDialog({
      title: `Book a unit for ${fullName(l.first_name, l.last_name)}`, sub: 'The unit is reserved at once. Depending on the company’s approval rule the booking is confirmed now or sent for approval.', submit: 'Book',
      fields: [
        { name: 'unit_id', label: 'Unit', type: 'select', required: true, options: [['', 'Choose…'], ...units.map((u) => [u.id, `${u.project_name} · ${u.building_name ? `${u.building_name} · ` : ''}${u.unit_number} · ${u.unit_type} · ${money(Number(u.base_price) + Number(u.plc_charges || 0))}`])] },
        [{ name: 'discount_amount', label: 'Discount (₹)', type: 'number', value: 0, min: 0 }, { name: 'booking_token_amount', label: 'Booking amount (₹)', type: 'number', hint: 'Default 10% of the price' }],
        { name: 'note', label: 'Note', type: 'textarea' }
      ],
      onSubmit: async (v) => { const r = await api(`/suite/sales/leads/${l.id}/book`, { body: v }); if (redraw) redraw(); return r.message; }
    });
  };

  // visit actions (managers): allocate, approve, cancel, reschedule, missed
  NXS.visitActions = (v) => {
    const open = ['REQUESTED', 'PENDING_APPROVAL', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'RESCHEDULED'].includes(v.status);
    if (!open && v.status !== 'IN_PROGRESS') return '';
    return `<div class="sx-actions" style="justify-content:flex-start">
      ${v.status === 'PENDING_APPROVAL' ? `<button class="sx-btn sm good" data-va="approve" data-v="${v.id}">Approve</button>` : ''}
      ${open && v.status !== 'PENDING_APPROVAL' ? `<button class="sx-btn sm" data-va="assign" data-v="${v.id}">${v.assigned_agent_id ? 'Reallocate' : 'Allocate'}</button>` : ''}
      ${open ? `<button class="sx-btn sm" data-va="reschedule" data-v="${v.id}">Reschedule</button>` : ''}
      ${['SCHEDULED', 'ACCEPTED', 'IN_PROGRESS', 'RESCHEDULED'].includes(v.status) ? `<button class="sx-btn sm" data-va="complete" data-v="${v.id}">Mark done</button><button class="sx-btn sm" data-va="missed" data-v="${v.id}">Client didn’t come</button>` : ''}
      ${open ? `<button class="sx-btn sm danger" data-va="cancel" data-v="${v.id}">Cancel</button>` : ''}</div>`;
  };
  NXS.bindVisitActions = (root, after) => {
    root.querySelectorAll('[data-va]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.v;
      const act = b.dataset.va;
      const run = async (body) => { const r = await api(`/suite/sales/visits/${id}/action`, { body: { action: act, ...body } }); if (after) after(); return r.message; };
      try {
        if (act === 'assign') return formDialog({ title: 'Allocate field agent', submit: 'Allocate', fields: [{ name: 'agent_id', label: 'Field agent', type: 'select', required: true, options: [['', 'Choose…'], ...(await memberOptions())] }], onSubmit: (v) => run(v) });
        if (act === 'reschedule') return formDialog({ title: 'Reschedule visit', submit: 'Reschedule', fields: [{ name: 'scheduled_time', label: 'New date & time', type: 'datetime', required: true }, { name: 'client_confirmed', label: 'New time agreed with the client', type: 'checkbox', value: true }, { name: 'reason', label: 'Reason', type: 'textarea' }], onSubmit: (v) => run(v) });
        if (act === 'complete') return formDialog({ title: 'Visit completed', submit: 'Save', fields: [{ name: 'temperature', label: 'Client interest', type: 'select', options: [['WARM', 'Warm'], ['HOT', 'Hot'], ['COLD', 'Cold']] }, { name: 'feedback', label: 'Feedback', type: 'textarea' }, { name: 'next_follow_up_at', label: 'Next follow-up', type: 'datetime' }], onSubmit: (v) => run(v) });
        if (act === 'cancel' || act === 'missed') {
          const reason = await NXS.confirm(act === 'cancel' ? 'Cancel this visit?' : 'Client did not come?', 'Everyone working this client is told.', { reason: true, danger: act === 'cancel', submit: act === 'cancel' ? 'Cancel visit' : 'Mark missed' });
          if (reason) toast(await run({ feedback: reason, reason }));
          return null;
        }
        toast(await run({}));
      } catch (e) { toast(e.message, 'err'); }
      return null;
    }));
  };
})();
