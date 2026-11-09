/* ==========================================================================
   Website enquiries → CRM.
   Every form a visitor can fill on the public site ends up as a lead (or warms up an existing one)
   via POST /api/leads/webhook. A visitor who picks a date gets a real site visit booked with a
   field agent; the telecaller, sales manager and owner are notified straight away.
   ========================================================================== */
(function () {
  'use strict';

  const NX = (window.NX = window.NX || {});
  const apiBase = () => (NX.apiBase ? NX.apiBase() : '/api');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Visiting hours shown to clients (kept inside the team's 9–20 working hours)
  const SLOTS = [['10:00', '10 am'], ['11:30', '11:30 am'], ['13:00', '1 pm'], ['15:00', '3 pm'], ['16:30', '4:30 pm'], ['18:00', '6 pm']];

  // ---- Campaign tracking ------------------------------------------------------
  // Keep the UTM tags of the tracking link the visitor arrived with (first touch, this browser tab),
  // so the enquiry is attributed to the right marketing campaign.
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  function readUtm() {
    const found = {};
    [window.location.search, (window.location.hash.split('?')[1] || '')].forEach((q) => {
      const p = new URLSearchParams(q);
      UTM_KEYS.forEach((k) => { if (p.get(k) && !found[k]) found[k] = p.get(k).slice(0, 100); });
    });
    try {
      if (Object.keys(found).length) sessionStorage.setItem('nx_utm', JSON.stringify(found));
      return JSON.parse(sessionStorage.getItem('nx_utm') || '{}');
    } catch (e) { return found; }
  }
  const utmTags = readUtm();

  // ---- Shared sender ----------------------------------------------------------
  async function sendWebsiteEnquiry(payload) {
    const ref = typeof window.getShareReferrer === 'function' ? window.getShareReferrer() : null;
    const res = await fetch(`${apiBase()}/leads/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'WEBSITE', ref, ...utmTags, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Could not send your request. Please try again.');
    return data;
  }
  window.sendWebsiteEnquiry = sendWebsiteEnquiry;

  /** "YYYY-MM-DDTHH:mm" — local site time; the server reads it in the business timezone. */
  const visitAt = (day, time) => (day && time ? `${day}T${time}` : null);

  function upcomingDays(n = 7) {
    const out = [];
    const now = new Date();
    const lastSlot = SLOTS[SLOTS.length - 1][0].split(':').map(Number);
    for (let i = 0; out.length < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (i === 0 && (now.getHours() > lastSlot[0] - 1)) continue; // too late for today
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      out.push({ value: ymd(d), label, sub: i < 2 ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : d.toLocaleDateString('en-IN', { month: 'short' }) });
    }
    return out;
  }

  function slotsFor(day) {
    const isToday = day === ymd(new Date());
    const now = new Date();
    return SLOTS.filter(([t]) => {
      if (!isToday) return true;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 90; // at least 90 minutes' notice
    });
  }

  // ---- Toast ------------------------------------------------------------------
  function toast(msg, kind = 'ok') {
    let el = document.getElementById('nxq-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxq-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = `nxq-toast is-${kind} is-on`;
    el.textContent = msg;
    clearTimeout(el.__t);
    el.__t = setTimeout(() => el.classList.remove('is-on'), 6000);
  }
  NX.toast = toast;

  // ---- Floating "Enquire" panel -------------------------------------------------
  let projectsCache = null;
  async function loadProjects() {
    if (projectsCache) return projectsCache;
    try {
      const res = await fetch(`${apiBase()}/projects`);
      const j = await res.json();
      projectsCache = (j.data || j.projects || []).filter((p) => p && p.id && p.name).map((p) => ({ id: p.id, name: p.name, city: p.city || '' }));
    } catch (e) {
      projectsCache = [];
    }
    return projectsCache;
  }

  function currentProjectId() {
    // app.js declares `const state` — a global binding, but not a property of window
    try { return (typeof state !== 'undefined' && state.selectedCustomerProjectId) || null; } catch (e) { return null; }
  }

  function onWebsite() {
    try { return typeof state !== 'undefined' && state.viewMode === 'website'; } catch (e) { return false; }
  }

  function ensureLauncher() {
    let btn = document.getElementById('nxq-launch');
    if (!onWebsite()) { if (btn) btn.hidden = true; closePanel(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'nxq-launch';
      btn.type = 'button';
      btn.className = 'nxq-launch';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>Enquire</span>`;
      btn.addEventListener('click', () => openPanel());
      document.body.appendChild(btn);
    }
    btn.hidden = false;
  }

  function closePanel() {
    const host = document.getElementById('nxq-panel');
    if (host) host.remove();
    document.documentElement.classList.remove('nxq-lock');
  }

  async function openPanel(opts = {}) {
    closePanel();
    const host = document.createElement('div');
    host.id = 'nxq-panel';
    host.className = 'nxq-host';
    const days = upcomingDays(7);
    const firstDay = days[0] ? days[0].value : '';
    host.innerHTML = `
      <div class="nxq-scrim" data-nxq="close"></div>
      <section class="nxq-panel" role="dialog" aria-modal="true" aria-labelledby="nxq-title">
        <header class="nxq-head">
          <div>
            <h2 id="nxq-title">Talk to a property advisor</h2>
            <p>Free, no obligation. We reply within working hours.</p>
          </div>
          <button type="button" class="nxq-x" data-nxq="close" aria-label="Close">&times;</button>
        </header>
        <form class="nxq-form" novalidate>
          <div class="nxq-seg" role="radiogroup" aria-label="What would you like?">
            <label><input type="radio" name="intent" value="CALLBACK" ${opts.visit ? '' : 'checked'} /><span>Call me back</span></label>
            <label><input type="radio" name="intent" value="SITE_VISIT" ${opts.visit ? 'checked' : ''} /><span>Book a site visit</span></label>
          </div>
          <label class="nxq-field">Your name<input name="full_name" autocomplete="name" required maxlength="80" /></label>
          <label class="nxq-field">Mobile number
            <span class="nxq-phone"><span>+91</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" required maxlength="14" placeholder="10-digit mobile" /></span>
          </label>
          <label class="nxq-field"><span>Project <span class="nxq-opt" data-nxq-optional>(optional)</span></span>
            <select name="project_id"><option value="">Any / not sure yet</option></select>
          </label>
          <div class="nxq-visit" ${opts.visit ? '' : 'hidden'}>
            <p class="nxq-label">Pick a day</p>
            <div class="nxq-chips" data-nxq="days">${days.map((d, i) => `<label class="nxq-chip"><input type="radio" name="day" value="${d.value}" ${i === 0 ? 'checked' : ''} /><span><b>${esc(d.label)}</b><small>${esc(d.sub)}</small></span></label>`).join('')}</div>
            <p class="nxq-label">Time</p>
            <div class="nxq-chips" data-nxq="slots">${slotChips(firstDay)}</div>
          </div>
          <label class="nxq-field"><span>Anything we should know? <span class="nxq-opt">(optional)</span></span><textarea name="message" rows="2" maxlength="500" placeholder="e.g. 3BHK, budget ₹1 Cr, prefer east facing"></textarea></label>
          <input class="nxq-hp" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <p class="nxq-error" role="alert" hidden></p>
          <button class="nxq-submit" type="submit">Request a call back</button>
          <p class="nxq-fine">By submitting, you agree to be contacted about your enquiry by call or WhatsApp.</p>
        </form>
      </section>`;
    document.body.appendChild(host);
    document.documentElement.classList.add('nxq-lock');

    const form = host.querySelector('form');
    const select = form.project_id;
    const projects = await loadProjects();
    const pre = opts.projectId || currentProjectId();
    select.insertAdjacentHTML('beforeend', projects.map((p) => `<option value="${esc(p.id)}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}${p.city ? ` · ${esc(p.city)}` : ''}</option>`).join(''));
    syncIntent(form);
    setTimeout(() => form.full_name.focus(), 80);

    host.addEventListener('click', (e) => { if (e.target.closest('[data-nxq="close"]')) closePanel(); });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'intent') syncIntent(form);
      if (e.target.name === 'day') form.querySelector('[data-nxq="slots"]').innerHTML = slotChips(e.target.value);
    });
    form.addEventListener('submit', (e) => submitPanel(e, form));
  }
  NX.openEnquiry = openPanel;
  window.openEnquiryPanel = openPanel;

  function slotChips(day) {
    const slots = slotsFor(day);
    if (!slots.length) return '<p class="nxq-muted">No slots left today — pick another day.</p>';
    return slots.map(([v, l], i) => `<label class="nxq-chip is-slot"><input type="radio" name="time" value="${v}" ${i === 0 ? 'checked' : ''} /><span><b>${l}</b></span></label>`).join('');
  }

  function syncIntent(form) {
    const visit = form.intent.value === 'SITE_VISIT';
    form.querySelector('.nxq-visit').hidden = !visit;
    form.querySelector('[data-nxq-optional]').hidden = visit;
    form.project_id.required = visit;
    form.querySelector('.nxq-submit').textContent = visit ? 'Book my site visit' : 'Request a call back';
  }

  async function submitPanel(e, form) {
    e.preventDefault();
    const err = form.querySelector('.nxq-error');
    const btn = form.querySelector('.nxq-submit');
    const visit = form.intent.value === 'SITE_VISIT';
    const phone = form.phone.value.replace(/\D/g, '');
    err.hidden = true;
    if (!form.full_name.value.trim()) { err.textContent = 'Please tell us your name.'; err.hidden = false; return form.full_name.focus(); }
    if (phone.length < 10) { err.textContent = 'Please enter a valid 10-digit mobile number.'; err.hidden = false; return form.phone.focus(); }
    if (visit && !form.project_id.value) { err.textContent = 'Choose the project you would like to visit.'; err.hidden = false; return form.project_id.focus(); }
    const time = form.querySelector('input[name="time"]:checked');
    if (visit && !time) { err.textContent = 'Pick a time for your visit.'; err.hidden = false; return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const data = await sendWebsiteEnquiry({
        full_name: form.full_name.value.trim(),
        phone: phone.length === 10 ? `+91 ${phone}` : form.phone.value.trim(),
        project_id: form.project_id.value || null,
        message: form.message.value.trim() || null,
        visit_at: visit ? visitAt(form.day.value, time.value) : null,
        company_website: form.company_website.value,
        temperature: visit ? 'HOT' : null
      });
      form.innerHTML = `
        <div class="nxq-done">
          <div class="nxq-tick" aria-hidden="true">✓</div>
          <h3>${visit && data.visitBooked ? 'Visit request received' : 'Request received'}</h3>
          <p>${esc(data.message || 'Thanks! Our advisor will call you shortly.')}</p>
          <button type="button" class="nxq-submit is-ghost" data-nxq="close">Done</button>
        </div>`;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      syncIntent(form);
    }
  }

  // ---- Real submissions for the site's existing forms ----------------------------
  // (They used to show a success screen without sending anything to the CRM.)
  async function submitFrom({ button, payload, onDone }) {
    const label = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    try {
      const data = await sendWebsiteEnquiry(payload);
      if (onDone) onDone();
      toast(data.message || 'Thanks! Our advisor will call you shortly.', 'ok');
      return data;
    } catch (ex) {
      toast(ex.message, 'err');
      return null;
    } finally {
      if (button && document.body.contains(button)) { button.disabled = false; button.textContent = label; }
    }
  }
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const closeAppModal = () => { if (typeof window.closeModal === 'function') window.closeModal(); };

  function cabVisitTime(dayWord, timeLabel) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = { Today: 0, Tomorrow: 1 }[dayWord];
    if (target !== undefined) d.setDate(d.getDate() + target);
    else {
      const dow = { Saturday: 6, Sunday: 0 }[dayWord];
      if (dow !== undefined) d.setDate(d.getDate() + (((dow - d.getDay()) + 7) % 7 || 7));
    }
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(timeLabel || '');
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/PM/i.test(m[3])) h += 12;
    return visitAt(ymd(d), `${pad(h)}:${m[2]}`);
  }

  window.handleFreeCabSubmit = function (e, projectName) {
    e.preventDefault();
    const pickup = val('cab-pickup');
    submitFrom({
      button: e.target.querySelector('button[type="submit"]'),
      payload: {
        full_name: val('cab-name'), phone: val('cab-phone'), project_name: projectName, temperature: 'HOT',
        visit_at: cabVisitTime(val('cab-date'), val('cab-time')),
        message: `Site visit with free cab pickup from: ${pickup || 'not given'} (${val('cab-date')} ${val('cab-time')})`
      },
      onDone: closeAppModal
    });
  };

  window.handleShieldedCallSubmit = function (e) {
    e.preventDefault();
    submitFrom({
      button: e.target.querySelector('button[type="submit"]'),
      payload: { full_name: val('shield-name'), phone: val('shield-phone'), project_name: val('shield-project'), message: 'Asked for a private call back (number not to be shared with brokers)' },
      onDone: closeAppModal
    });
  };

  window.handleTenancySubmit = function (e, propertyName) {
    e.preventDefault();
    submitFrom({
      button: e.target.querySelector('button[type="submit"]'),
      payload: { full_name: val('tenant-name'), phone: val('tenant-phone'), source: 'WEBSITE_RENTAL', message: `Wants to rent: ${propertyName}` },
      onDone: closeAppModal
    });
  };

  window.submitEarlyBirdInquiry = function (projectName, developer) {
    const btn = document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
    submitFrom({
      button: btn,
      payload: { full_name: val('up-inq-name'), phone: val('up-inq-phone'), project_name: projectName, temperature: 'WARM', message: `Early-bird / pre-launch enquiry for ${projectName}${developer ? ` (${developer})` : ''}` },
      onDone: () => { if (typeof window.closeUpcomingDeveloperModal === 'function') window.closeUpcomingDeveloperModal(); }
    });
  };

  window.submitCustomerProjectInquiry = function (projectName) {
    const form = document.querySelector('.cpd-lead-form');
    submitFrom({
      button: form && form.querySelector('button[type="submit"]'),
      payload: {
        full_name: val('cpd-inq-name'), phone: val('cpd-inq-phone'), email: val('cpd-inq-email') || null,
        project_id: currentProjectId(), project_name: projectName, temperature: 'WARM',
        message: `Wants a site visit & priority callback${val('cpd-inq-pref') ? ` — interested in ${val('cpd-inq-pref')}` : ''}`
      },
      onDone: () => { if (form) form.reset(); }
    });
  };

  // ---- Wire up -----------------------------------------------------------------
  if (NX.afterRender) NX.afterRender.push(ensureLauncher);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  window.addEventListener('hashchange', () => setTimeout(ensureLauncher, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureLauncher);
  else ensureLauncher();
})();
