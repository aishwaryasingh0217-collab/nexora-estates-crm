/* Business Suite — Sales head (SUPER_ADMIN) and Sales manager (ADMIN) portals. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, money, num, label, toast, table, formDialog, kpi, can, charts } = NXS;
  const SALES = ['sales-head', 'sales-manager'];
  const OWNER_TOO = ['sales-head', 'sales-manager'];
  const BUCKET_LABEL = { NEW: 'New', CONTACTED: 'Follow-up', VISIT: 'Visit fixed', VISITED: 'Visited', NEGOTIATION: 'Negotiation', BOOKED: 'Booked', LOST: 'Lost' };
  let range = NXS.defaultRange(30);

  function rangeBar(el, onChange) {
    const rc = NXS.rangeControl(range, (r) => { range = r; onChange(); });
    el.innerHTML = rc.html;
    rc.bind(el);
  }

  // ------------------------------------------------------------------ dashboard
  NXS.page('sales-dashboard', {
    title: 'Sales dashboard', label: 'Dashboard', icon: 'chart', group: 'Sales', order: 1, portals: SALES, cap: 'reports.sales',
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-range></div><div data-body></div>';
      const body = el.querySelector('[data-body]');
      const load = async () => {
        body.innerHTML = NXS.loading();
        const d = (await api(`/suite/sales/dashboard${NXS.qs({ from: range.from, to: range.to })}`)).data;
        const k = d.kpis;
        body.innerHTML = `
          <div class="sx-kpis">
            ${kpi('New leads', num(k.newLeads), { delta: k.leadsChangePct, go: 'sales-leads?view=all' })}
            ${kpi('Contacted', `${k.contactRatePct}%`, { hint: k.avgResponseMin != null ? `first call in ~${k.avgResponseMin} min` : 'of new leads' })}
            ${kpi('Bookings', num(k.bookings), { hint: `${k.conversionPct}% of new leads`, go: 'sales-bookings', tone: k.bookings ? 'good' : '' })}
            ${kpi('Booked value', money(k.revenue), { delta: k.revenueChangePct })}
            ${kpi('Visits done', num(k.visitsDone), { hint: `${k.visitsUpcoming} upcoming`, go: 'sales-visits' })}
            ${kpi('Calls', num(k.calls), { go: can('calls.monitor') ? 'sales-calls' : '' })}
          </div>
          <div class="sx-kpis" style="margin-top:12px">
            ${kpi('Untouched leads', num(k.untouched), { tone: k.untouched ? 'warn' : '', go: 'sales-leads?view=untouched' })}
            ${kpi('Unassigned', num(k.unassigned), { tone: k.unassigned ? 'warn' : '', go: 'sales-leads?view=unassigned' })}
            ${kpi('Overdue follow-ups', num(k.overdue), { tone: k.overdue ? 'bad' : '', go: 'sales-followups' })}
            ${kpi('Due today', num(k.dueToday), { go: 'sales-followups?scope=today' })}
            ${kpi('Visits to allocate', num(k.visitsUnallocated), { tone: k.visitsUnallocated ? 'warn' : '', go: 'sales-visits?status=REQUESTED,PENDING_APPROVAL' })}
            ${kpi('Awaiting approval', num(k.pendingBookings), { tone: k.pendingBookings ? 'warn' : '', go: 'approvals' })}
          </div>
          <div class="sx-grid" style="margin-top:16px">
            <div class="sx-card"><div class="sx-card-head"><h3>New leads per day</h3></div><div data-c="leads"></div></div>
            <div class="sx-card"><div class="sx-card-head"><h3>Bookings per day</h3></div><div data-c="bookings"></div></div>
          </div>
          <div class="sx-grid" style="margin-top:16px">
            <div class="sx-card"><div class="sx-card-head"><h3>Pipeline by stage</h3><span class="sx-sub">all leads now</span></div><div data-c="pipeline"></div></div>
            <div class="sx-card"><div class="sx-card-head"><h3>Leads by source</h3><span class="sx-sub">in this period</span></div><div data-c="sources"></div></div>
          </div>
          <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Top performers</h3><span class="sx-sub">in this period</span></div><div data-c="leaders"></div></div>`;
        const days = d.trend.map((t) => new Date(t.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
        charts.columns(body.querySelector('[data-c="leads"]'), { labels: days, series: [{ name: 'Leads', values: d.trend.map((t) => t.leads) }], format: (v) => num(Math.round(v)), integer: true });
        charts.columns(body.querySelector('[data-c="bookings"]'), { labels: days, series: [{ name: 'Bookings', values: d.trend.map((t) => t.bookings) }], format: (v) => num(Math.round(v)), integer: true });
        charts.hbars(body.querySelector('[data-c="pipeline"]'), d.pipeline.map((p) => ({ label: p.label, value: p.count, key: p.bucket })), { format: num, onClick: (r) => NXS.go('sales-leads', { bucket: r.key, view: 'all' }) });
        charts.hbars(body.querySelector('[data-c="sources"]'), d.sources.map((s) => ({ label: label(s.source), value: s.leads, sub: `${s.booked} booked · ${s.conversionPct}% conversion` })), { format: num });
        table(body.querySelector('[data-c="leaders"]'), {
          columns: [{ key: 'name', label: 'Agent' }, { key: 'role', label: 'Role', render: (r) => esc(label(r.role)) }, { key: 'bookings', label: 'Bookings', num: true }, { key: 'revenue', label: 'Booked value', num: true, render: (r) => money(r.revenue) }, { key: 'visits', label: 'Visits', num: true }, { key: 'calls', label: 'Calls', num: true }],
          rows: d.leaders, empty: { title: 'No activity yet in this period' }
        });
      };
      rangeBar(el.querySelector('[data-range]'), load);
      await load();
    }
  });

  // ------------------------------------------------------------------ leads
  const VIEWS = [['open', 'Open'], ['unassigned', 'Unassigned'], ['untouched', 'Untouched'], ['overdue', 'Overdue'], ['today', 'Due today'], ['hot', 'Hot / priority'], ['booked', 'Booked'], ['lost', 'Lost'], ['duplicates', 'Duplicates'], ['all', 'All']];
  NXS.page('sales-leads', {
    title: 'Leads', label: 'Leads', icon: 'lead', group: 'Sales', order: 2, portals: OWNER_TOO, cap: 'leads.view.all',
    async render(el, params) {
      const f = { view: params.view || 'open', q: '', source: '', agent_id: '', bucket: params.bucket || '', priority: '', sort: 'created', limit: 500 };
      const members = can('team.view') ? (await api('/suite/sales/members')).data : [];
      el.innerHTML = `
        <div class="sx-filters">
          <select data-f="view">${VIEWS.map(([v, l]) => `<option value="${v}" ${v === f.view ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input type="search" data-f="q" placeholder="Name, phone or email">
          <select data-f="bucket"><option value="">Any stage</option>${Object.entries(BUCKET_LABEL).map(([k, v]) => `<option value="${k}" ${k === f.bucket ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <select data-f="source"><option value="">Any source</option>${['WEBSITE', 'FACEBOOK_ADS', 'GOOGLE_ADS', 'WALK_IN', 'REFERRAL', 'CHANNEL_PARTNER', 'DIRECT_CALL', 'INBOUND_CALL', 'IMPORT'].map((s) => `<option value="${s}">${label(s)}</option>`).join('')}</select>
          <select data-f="agent_id"><option value="">Any owner</option><option value="none">Unassigned</option>${members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
          <select data-f="priority"><option value="">Any priority</option>${['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => `<option value="${p}">${label(p)}</option>`).join('')}</select>
          <select data-f="sort"><option value="created">Newest first</option><option value="followup">Follow-up due</option><option value="priority">Priority</option><option value="name">Name</option></select>
          <div class="sx-spacer"></div>
          ${can('leads.assign') ? '<button class="sx-btn" data-bulk disabled>Assign selected</button>' : ''}
          ${can('leads.import') ? '<button class="sx-btn" data-import>Import</button>' : ''}
          ${can('leads.create') ? '<button class="sx-btn primary" data-add>Add lead</button>' : ''}
        </div>
        <div class="sx-card" data-list></div>`;
      const selected = new Set();
      const bulk = el.querySelector('[data-bulk]');
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Leads',
        onRow: (r) => NXS.openLead(r.id),
        columns: [
          ...(can('leads.assign') ? [{ key: 'sel', label: '', nosort: true, noexport: true, render: (r) => `<input type="checkbox" data-sel="${r.id}" ${selected.has(r.id) ? 'checked' : ''} aria-label="Select">` }] : []),
          { key: 'name', label: 'Client', text: (r) => NXS.fullName(r.first_name, r.last_name), sortValue: (r) => r.first_name, render: (r) => `<strong>${esc(NXS.fullName(r.first_name, r.last_name))}</strong>${NXS.testChip(r)}<span class="sub">${esc(r.phone)}${r.duplicate_of_lead_id ? ' · duplicate' : ''}</span>` },
          { key: 'bucket', label: 'Stage', text: (r) => BUCKET_LABEL[r.bucket], render: (r) => chip(r.bucket, BUCKET_LABEL[r.bucket]) },
          { key: 'priority', label: 'Priority', render: (r) => (r.priority ? chip(r.priority) : '—') },
          { key: 'source', label: 'Source', text: (r) => label(r.source), render: (r) => `${esc(label(r.source))}${r.campaign_name ? `<span class="sub">${esc(r.campaign_name)}</span>` : r.partner_firm ? `<span class="sub">${esc(r.partner_firm)}</span>` : ''}` },
          { key: 'project_name', label: 'Project' },
          { key: 'agent_name', label: 'Owner', render: (r) => esc(r.agent_name || 'Unassigned') },
          { key: 'next_follow_up_at', label: 'Follow-up', text: (r) => (r.next_follow_up_at ? new Date(r.next_follow_up_at).toLocaleString('en-IN') : ''), render: (r) => (r.next_follow_up_at ? `<span class="${new Date(r.next_follow_up_at) < new Date() ? 'sx-delta down' : ''}">${when(r.next_follow_up_at)}</span>` : '—') },
          { key: 'created_at', label: 'Created', text: (r) => new Date(r.created_at).toLocaleString('en-IN'), render: (r) => ago(r.created_at) }
        ],
        empty: { title: 'No leads match', text: 'Try another view or filter.' },
        afterDraw: (root) => root.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => { if (c.checked) selected.add(c.dataset.sel); else selected.delete(c.dataset.sel); if (bulk) { bulk.disabled = !selected.size; bulk.textContent = selected.size ? `Assign ${selected.size} selected` : 'Assign selected'; } }))
      });
      async function load() { const r = (await api(`/suite/sales/leads${NXS.qs(f)}`)).data; t.update(r.rows); }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.type === 'search' ? 'input' : 'change', () => { f[i.dataset.f] = i.value; clearTimeout(i._t); i._t = setTimeout(load, 250); }));
      if (bulk) bulk.addEventListener('click', async () => {
        formDialog({
          title: `Assign ${selected.size} lead${selected.size === 1 ? '' : 's'}`, submit: 'Assign',
          fields: [{ name: 'mode', label: 'How', type: 'select', options: [['one', 'All to one person'], ['spread', 'Spread across the team (fewest open leads first)']] }, { name: 'to_user_id', label: 'Person (for "all to one")', type: 'select', options: [['', 'Choose…'], ...(await NXS.memberOptions())] }, { name: 'reason', label: 'Reason', type: 'textarea' }],
          onSubmit: async (v) => {
            const body = { lead_ids: [...selected], reason: v.reason };
            if (v.mode === 'one') { if (!v.to_user_id) throw new Error('Choose the person.'); body.to_user_id = v.to_user_id; } else body.user_ids = members.filter((m) => m.role !== 'ADMIN' && m.is_available).map((m) => m.id);
            const r = await api('/suite/sales/leads/assign', { body });
            selected.clear(); load();
            return `${r.message}${Object.keys(r.data.perAgent || {}).length ? ` (${Object.entries(r.data.perAgent).map(([n, c]) => `${n}: ${c}`).join(', ')})` : ''}`;
          }
        });
      });
      const imp = el.querySelector('[data-import]');
      if (imp) imp.addEventListener('click', () => NXS.importLeadsDialog(load));
      const add = el.querySelector('[data-add]');
      if (add) add.addEventListener('click', () => NXS.addLeadDialog(load));
      await load();
    }
  });

  NXS.addLeadDialog = async function addLeadDialog(after) {
    const projects = (await api('/suite/inventory/directory')).data.rows.reduce((m, u) => m.set(u.project_id, u.project_name), new Map());
    const campaigns = can('marketing.view') || can('leads.import') ? ((await api('/suite/marketing/options').catch(() => ({ data: { campaigns: [] } }))).data.campaigns || []) : [];
    formDialog({
      title: 'Add a lead', sub: 'Duplicates (same phone) are refused with the current owner’s name.', submit: 'Add lead',
      fields: [
        [{ name: 'first_name', label: 'First name', required: true }, { name: 'last_name', label: 'Last name' }],
        [{ name: 'phone', label: 'Mobile', required: true }, { name: 'email', label: 'Email', type: 'email' }],
        [{ name: 'source', label: 'Source', type: 'select', options: ['WALK_IN', 'DIRECT_CALL', 'REFERRAL', 'WEBSITE', 'FACEBOOK_ADS', 'GOOGLE_ADS', 'WHATSAPP', 'SOCIAL_MEDIA', 'OTHER'].map((s) => [s, label(s)]) }, { name: 'campaign_id', label: 'Campaign', type: 'select', options: [['', '—'], ...campaigns.map((c) => [c.id, c.name])] }],
        [{ name: 'preferred_project_id', label: 'Project', type: 'select', options: [['', '—'], ...projects.entries()] }, { name: 'configuration', label: 'Configuration', placeholder: 'e.g. 3BHK' }],
        [{ name: 'budget_min', label: 'Budget from (₹)', type: 'number' }, { name: 'budget_max', label: 'Budget to (₹)', type: 'number' }],
        [{ name: 'preferred_location', label: 'Preferred location' }, { name: 'temperature', label: 'Interest', type: 'select', options: [['', '—'], ['HOT', 'Hot'], ['WARM', 'Warm'], ['COLD', 'Cold']] }],
        ...(can('leads.assign') ? [{ name: 'assigned_agent_id', label: 'Assign to (empty = fair auto-assignment)', type: 'select', options: [['', 'Auto'], ...(await NXS.memberOptions())] }] : []),
        { name: 'note', label: 'Note', type: 'textarea' }
      ],
      onSubmit: async (v) => {
        try {
          const r = await api('/workspace/leads', { body: v });
          if (after) after();
          return r.message;
        } catch (e) {
          if (e.data && e.data.lead_id) setTimeout(() => NXS.openLead(e.data.lead_id), 400);
          throw e;
        }
      }
    });
  };

  /** CSV/Excel import (with campaign) and AI paste-to-leads. */
  NXS.importLeadsDialog = async function importLeadsDialog(after) {
    const opts = can('marketing.view') ? (await api('/suite/marketing/options')).data : { campaigns: [] };
    const members = can('team.view') ? await NXS.memberOptions() : [];
    const m = NXS.modal(`<h2>Import leads</h2><p class="sx-sub">CSV or Excel with columns like name, phone, email, source, project, budget, configuration, location, notes. Invalid rows and duplicates are skipped and listed.</p>
      <div class="sx-tabs"><button class="is-on" data-tab="file">From a file</button>${can('ai.use') ? '<button data-tab="paste">Paste text (AI)</button>' : ''}</div>
      <div data-pane="file" class="sx-form">
        <label class="sx-field"><span>File</span><input type="file" accept=".csv,.xlsx,.xls" data-file></label>
        <div class="sx-form-row"><label class="sx-field"><span>Campaign</span><select data-camp><option value="">—</option>${opts.campaigns.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
        <label class="sx-field"><span>Assign to</span><select data-assign><option value="auto">Fair auto-assignment</option>${members.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></label></div>
        <div data-preview></div>
      </div>
      <div data-pane="paste" class="sx-form" hidden><label class="sx-field"><span>Paste enquiries (WhatsApp, email, notes)</span><textarea data-text style="min-height:140px"></textarea></label><button class="sx-btn" data-parse>Read with AI</button><div data-parsed></div></div>
      <div class="sx-error" hidden></div>
      <div class="sx-actions"><button class="sx-btn" data-close>Close</button><button class="sx-btn primary" data-go disabled>Import</button></div>`);
    let rows = [];
    let fileName = 'import';
    const err = m.el.querySelector('.sx-error');
    const goBtn = m.el.querySelector('[data-go]');
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      m.el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-on', x === b));
      m.el.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    }));
    const norm = (k) => String(k || '').toLowerCase().replace(/[^a-z]/g, '');
    const MAP = { name: ['name', 'fullname', 'clientname', 'customername', 'lead'], phone: ['phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber', 'number'], email: ['email', 'emailaddress', 'mail'], source: ['source', 'leadsource', 'channel'], project: ['project', 'projectname', 'property'], budget: ['budget', 'budgetmax', 'maxbudget'], budget_min: ['budgetmin', 'minbudget'], configuration: ['configuration', 'config', 'bhk', 'type'], location: ['location', 'area', 'locality', 'city'], notes: ['notes', 'note', 'remarks', 'comments'], stage: ['stage', 'status'], campaign: ['campaign', 'utmcampaign'] };
    function mapRows(table) {
      const [head, ...data] = table;
      const idx = {};
      head.forEach((h, i) => { const n = norm(h); Object.entries(MAP).forEach(([k, al]) => { if (al.includes(n) && idx[k] == null) idx[k] = i; }); });
      return data.filter((r) => r.some((c) => String(c || '').trim())).map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, r[i] == null ? '' : String(r[i]).trim()])));
    }
    m.el.querySelector('[data-file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileName = file.name;
      err.hidden = true;
      try {
        let tableRows;
        if (/\.xlsx?$/i.test(file.name)) {
          if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
          const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
          tableRows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
        } else {
          const text = await file.text();
          tableRows = text.split(/\r?\n/).filter(Boolean).map((line) => { const out = []; let cur = ''; let q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; });
        }
        rows = mapRows(tableRows);
        if (!rows.length) throw new Error('No rows found. The first row must be the column names.');
        if (!rows[0].phone && rows[0].phone !== '') throw new Error('No phone column found.');
        m.el.querySelector('[data-preview]').innerHTML = `<div class="sx-note">${rows.length} rows read from ${esc(file.name)}. First: ${esc(rows[0].name || '')} ${esc(rows[0].phone || '')}</div>`;
        goBtn.disabled = false;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; goBtn.disabled = true; }
    });
    const parseBtn = m.el.querySelector('[data-parse]');
    if (parseBtn) parseBtn.addEventListener('click', async () => {
      err.hidden = true;
      parseBtn.disabled = true;
      parseBtn.textContent = 'Reading…';
      try {
        const r = (await api('/suite/ai/parse-leads', { body: { text: m.el.querySelector('[data-text]').value } })).data;
        rows = r.rows.filter((x) => x.importable).map((x) => ({ name: x.name, phone: x.phone, email: x.email, budget_min: x.budget_min, budget: x.budget_max, configuration: x.configuration, location: x.location, project: x.project, source: x.source, notes: x.notes }));
        fileName = 'pasted text';
        m.el.querySelector('[data-parsed]').innerHTML = `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Name</th><th>Phone</th><th>Budget</th><th>Check</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.phone || '—')}</td><td>${x.budget_max ? money(x.budget_max) : '—'}</td><td>${x.importable ? chip('PASS', 'Ready') : x.duplicate ? chip('AMBER', `Duplicate of ${x.duplicate.name}`) : chip('FAIL', x.problems.join(', '))}</td></tr>`).join('')}</tbody></table></div><p class="sx-muted">${rows.length} ready to import. Review before importing.</p>`;
        goBtn.disabled = !rows.length;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
      parseBtn.disabled = false;
      parseBtn.textContent = 'Read with AI';
    });
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      try {
        const r = await api('/suite/sales/leads/import', { body: { rows, file_name: fileName, campaign_id: m.el.querySelector('[data-camp]').value || null, assign_to: m.el.querySelector('[data-assign]').value } });
        const s = r.data;
        m.el.querySelector('[data-preview]').innerHTML = `<div class="sx-note">${esc(r.message)} ${s.duplicates} duplicates and ${s.invalid} invalid rows skipped.</div>${s.problems.length ? `<div class="sx-table-wrap" style="max-height:200px"><table class="sx-table"><tbody>${s.problems.map((p) => `<tr><td>Row ${p.row}</td><td>${esc(p.reason)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
        m.el.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== 'file'; });
        if (after) after();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; goBtn.disabled = false; }
    });
  };

  // ------------------------------------------------------------------ smart distribution
  NXS.page('sales-distribution', {
    title: 'Smart lead distribution', label: 'Smart distribution', icon: 'swap', group: 'Sales', order: 3, portals: SALES, cap: 'leads.assign',
    async render(el) {
      el.innerHTML = `<div class="sx-note">Suggestions for every unassigned open lead, based on each available telecaller's real conversion record for that source and project (last 180 days), their current workload and how fast they make the first call. Nothing is assigned until you apply it.</div><div style="margin-top:14px" data-body>${NXS.loading()}</div>`;
      const body = el.querySelector('[data-body]');
      const r = (await api('/suite/ai/distribution/suggest', { body: {} })).data;
      if (!r.proposals.length) { body.innerHTML = `<div class="sx-card"><div class="sx-empty"><h3>${esc(r.message || 'No unassigned leads')}</h3></div></div>`; return; }
      body.innerHTML = `<div class="sx-card"><div class="sx-card-head"><h3>${r.proposals.length} suggestions</h3><div class="sx-spacer"></div><button class="sx-btn primary" data-apply>Apply selected</button></div><div data-list></div></div>`;
      const chosen = new Set(r.proposals.map((p) => p.lead_id));
      table(body.querySelector('[data-list]'), {
        rows: r.proposals, exportTitle: 'Distribution suggestions',
        columns: [
          { key: 'sel', label: '', nosort: true, noexport: true, render: (p) => `<input type="checkbox" checked data-p="${p.lead_id}" aria-label="Apply">` },
          { key: 'lead_name', label: 'Lead', render: (p) => `<button class="sx-link" data-lead="${p.lead_id}">${esc(p.lead_name)}</button><span class="sub">${esc(label(p.source))}${p.project ? ` · ${esc(p.project)}` : ''}</span>` },
          { key: 'priority', label: 'Priority', render: (p) => (p.priority ? chip(p.priority) : '—') },
          { key: 'to_name', label: 'Suggested owner', render: (p) => `<strong>${esc(p.to_name)}</strong>` },
          { key: 'score', label: 'Fit', num: true },
          { key: 'reasons', label: 'Why', text: (p) => p.reasons.join('; '), render: (p) => `<span class="sub">${esc(p.reasons.join(' · '))}</span>` }
        ],
        afterDraw: (root) => {
          root.querySelectorAll('[data-p]').forEach((c) => c.addEventListener('change', () => { if (c.checked) chosen.add(c.dataset.p); else chosen.delete(c.dataset.p); }));
          root.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => NXS.openLead(b.dataset.lead)));
        }
      });
      body.querySelector('[data-apply]').addEventListener('click', async () => {
        try {
          const res = await api('/suite/ai/distribution/apply', { body: { proposals: r.proposals.filter((p) => chosen.has(p.lead_id)).map((p) => ({ lead_id: p.lead_id, to_user_id: p.to_user_id })) } });
          toast(res.message);
          NXS.refresh();
        } catch (e) { toast(e.message, 'err'); }
      });
    }
  });

  // ------------------------------------------------------------------ team & workload
  NXS.page('sales-team', {
    title: 'Team workload & availability', label: 'Team', icon: 'users', group: 'Sales', order: 4, portals: SALES, cap: 'team.view',
    async render(el) {
      const rows = (await api('/suite/sales/team')).data;
      el.innerHTML = '<div class="sx-card" data-list></div>';
      table(el.querySelector('[data-list]'), {
        rows, exportTitle: 'Team workload',
        columns: [
          { key: 'name', label: 'Team member', render: (r) => `<strong>${esc(r.name)}</strong>${NXS.testChip(r)}<span class="sub">${esc(label(r.role))}${r.manager_name ? ` · reports to ${esc(r.manager_name)}` : ''}</span>` },
          { key: 'workload', label: 'Workload', render: (r) => (r.workload ? chip(r.workload === 'OVERLOADED' ? 'RED' : r.workload === 'ON_LEAVE' ? '' : r.workload === 'LIGHT' ? 'BLUE' : 'GREEN', label(r.workload)) : '—') },
          { key: 'open_leads', label: 'Open leads', num: true },
          { key: 'overdue', label: 'Overdue', num: true, render: (r) => (r.overdue ? `<span class="sx-delta down">${r.overdue}</span>` : '0') },
          { key: 'untouched', label: 'Untouched', num: true },
          { key: 'due_today', label: 'Due today', num: true },
          { key: 'visits_today', label: 'Visits today', num: true },
          { key: 'calls_today', label: 'Calls today', num: true },
          { key: 'bookings_month', label: 'Bookings (month)', num: true },
          { key: 'last_activity_at', label: 'Last activity', render: (r) => ago(r.last_activity_at) },
          { key: 'is_available', label: 'Available', noexport: true, render: (r) => (r.role === 'ADMIN' ? '' : `<button class="sx-btn sm ${r.is_available ? '' : 'danger'}" data-av="${r.id}" data-on="${r.is_available ? 0 : 1}">${r.is_available ? 'Available' : 'On leave'}</button>`) }
        ],
        afterDraw: (root) => root.querySelectorAll('[data-av]').forEach((b) => b.addEventListener('click', async () => {
          try { toast((await api(`/suite/sales/team/${b.dataset.av}/availability`, { method: 'PATCH', body: { is_available: b.dataset.on === '1' } })).message); NXS.refresh(); } catch (e) { toast(e.message, 'err'); }
        }))
      });
    }
  });

  // ------------------------------------------------------------------ follow-ups
  NXS.page('sales-followups', {
    title: 'Follow-up monitoring', label: 'Follow-ups', icon: 'clock', group: 'Sales', order: 5, portals: SALES, cap: 'team.view',
    async render(el, params) {
      let scope = params.scope || 'overdue';
      el.innerHTML = `<div class="sx-filters"><div class="sx-seg" data-s>${[['overdue', 'Overdue'], ['today', 'Due today'], ['upcoming', 'Next 7 days'], ['none', 'No follow-up set']].map(([k, l]) => `<button data-v="${k}" class="${k === scope ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="sx-grid-2 sx-grid-wide"><div class="sx-card" data-list></div><div class="sx-card"><div class="sx-card-head"><h3>Overdue by agent</h3></div><div data-by></div></div></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Follow-ups', onRow: (r) => NXS.openLead(r.id),
        columns: [
          { key: 'client_name', label: 'Client', render: (r) => `<strong>${esc(r.client_name)}</strong><span class="sub">${esc(r.phone)}</span>` },
          { key: 'bucket', label: 'Stage', render: (r) => chip(r.bucket, BUCKET_LABEL[r.bucket]) },
          { key: 'agent_name', label: 'Agent', render: (r) => esc(r.agent_name || 'Unassigned') },
          { key: 'next_follow_up_at', label: 'Due', render: (r) => `${when(r.next_follow_up_at)}${r.hours_overdue > 0 ? `<span class="sub sx-delta down">${r.hours_overdue} h overdue</span>` : ''}` },
          { key: 'last_contacted_at', label: 'Last contact', render: (r) => ago(r.last_contacted_at) }
        ],
        empty: { title: 'Nothing here', text: 'No follow-ups in this view.' }
      });
      async function load() {
        const r = (await api(`/suite/sales/followups?scope=${scope}`)).data;
        t.update(r.rows);
        charts.hbars(el.querySelector('[data-by]'), r.overdueByAgent.map((a) => ({ label: a.name, value: a.overdue })), { format: num, color: 'var(--sx-red)' });
      }
      el.querySelectorAll('[data-s] [data-v]').forEach((b) => b.addEventListener('click', () => { scope = b.dataset.v; el.querySelectorAll('[data-s] button').forEach((x) => x.classList.toggle('is-on', x === b)); load(); }));
      await load();
    }
  });

  // ------------------------------------------------------------------ site visits
  const VISIT_FILTERS = [['open', 'Open'], ['REQUESTED,PENDING_APPROVAL', 'To allocate / approve'], ['ASSIGNED,RESCHEDULED', 'Waiting for agent'], ['ACCEPTED,SCHEDULED', 'Scheduled'], ['IN_PROGRESS', 'In progress'], ['COMPLETED', 'Completed'], ['MISSED,NO_SHOW', 'Missed'], ['CANCELLED', 'Cancelled']];
  NXS.page('sales-visits', {
    title: 'Site visits', label: 'Site visits', icon: 'map', group: 'Sales', order: 6, portals: SALES, cap: 'visits.allocate',
    async render(el, params) {
      let filter = params.status || 'open';
      el.innerHTML = `<div class="sx-kpis" data-counts></div><div class="sx-filters" style="margin-top:14px"><select data-f>${VISIT_FILTERS.map(([v, l]) => `<option value="${v}" ${v === filter ? 'selected' : ''}>${l}</option>`).join('')}</select><input type="date" data-from aria-label="From"><input type="date" data-to aria-label="To"></div><div data-list></div>`;
      const listEl = el.querySelector('[data-list]');
      async function load() {
        const q = filter === 'open' ? { view: 'open' } : { status: filter };
        const from = el.querySelector('[data-from]').value; const to = el.querySelector('[data-to]').value;
        const r = (await api(`/suite/sales/visits${NXS.qs({ ...q, from, to })}`)).data;
        const c = r.counts;
        el.querySelector('[data-counts]').innerHTML = [
          kpi('To allocate', num((c.REQUESTED || 0) + (c.PENDING_APPROVAL || 0)), { tone: (c.REQUESTED || 0) + (c.PENDING_APPROVAL || 0) ? 'warn' : '' }),
          kpi('Waiting for agent', num((c.ASSIGNED || 0) + (c.RESCHEDULED || 0))), kpi('Scheduled', num((c.SCHEDULED || 0) + (c.ACCEPTED || 0))),
          kpi('In progress', num(c.IN_PROGRESS || 0)), kpi('Completed', num(c.COMPLETED || 0), { tone: 'good' }), kpi('Missed', num((c.MISSED || 0) + (c.NO_SHOW || 0)), { tone: (c.MISSED || 0) + (c.NO_SHOW || 0) ? 'bad' : '' })
        ].join('');
        listEl.innerHTML = r.rows.length ? r.rows.map((v) => `<div class="sx-card" style="margin-bottom:10px"><div class="sx-row"><button class="sx-link" data-lead="${v.lead_id}"><strong>${esc(v.client_name)}</strong></button>${chip(v.status)}${v.client_confirmed ? '' : chip('AMBER', 'time not confirmed with client')}<div class="sx-spacer"></div><span class="sx-muted">${when(v.scheduled_time)}</span></div>
          <div class="sx-muted" style="font-size:.84rem">${esc(v.project_name)} · field agent ${esc(v.agent_name || 'not allocated')} · lead owner ${esc(v.owner_name || '—')}${v.partner_firm ? ` · via ${esc(v.partner_firm)}` : ''}${v.check_in_at ? ` · checked in ${when(v.check_in_at)}${v.check_in_distance_m != null ? ` (${v.check_in_distance_m} m from site)` : ''}` : ''}${v.reschedule_count ? ` · rescheduled ${v.reschedule_count}×` : ''}${v.rejection_reason ? ` · agent rejected: ${esc(v.rejection_reason)}` : ''}${v.client_feedback ? ` · “${esc(v.client_feedback)}”` : ''}</div>
          ${NXS.visitActions({ ...v, assigned_agent_id: v.agent_name ? 1 : null })}<button class="sx-link" data-hist="${v.id}" style="font-size:.8rem">History</button></div>`).join('') : '<div class="sx-card"><div class="sx-empty"><h3>No visits in this view</h3></div></div>';
        NXS.bindVisitActions(listEl, load);
        listEl.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => NXS.openLead(b.dataset.lead)));
        listEl.querySelectorAll('[data-hist]').forEach((b) => b.addEventListener('click', async () => {
          const h = (await api(`/suite/sales/visits/${b.dataset.hist}/history`)).data;
          NXS.modal(`<h2>Visit history</h2><ul class="sx-tl">${h.map((x) => `<li><span class="dot"></span><div><div class="meta">${when(x.created_at)} · ${esc(x.by)}</div><div class="txt">${esc(label(x.action))}: ${esc(label(x.previous_status || '—'))} → ${esc(label(x.new_status))}${x.notes ? ` — ${esc(x.notes)}` : ''}</div></div></li>`).join('')}</ul><div class="sx-actions"><button class="sx-btn" data-close>Close</button></div>`);
        }));
      }
      el.querySelector('[data-f]').addEventListener('change', (e) => { filter = e.target.value; load(); });
      el.querySelectorAll('[data-from], [data-to]').forEach((i) => i.addEventListener('change', load));
      await load();
    }
  });

  // ------------------------------------------------------------------ bookings
  NXS.page('sales-bookings', {
    title: 'Booking monitoring', label: 'Bookings', icon: 'key', group: 'Sales', order: 7, portals: OWNER_TOO, cap: 'bookings.view.all',
    async render(el, params) {
      let status = params.status || '';
      el.innerHTML = `<div class="sx-filters"><select data-s><option value="">All bookings</option>${['PENDING_APPROVAL', 'BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON', 'REJECTED', 'CANCELLED'].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${label(s)}</option>`).join('')}</select></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Bookings',
        columns: [
          { key: 'deal_number', label: 'Booking', render: (r) => `<strong>${esc(r.deal_number)}</strong><span class="sub">${when(r.created_at)}</span>` },
          { key: 'client_name', label: 'Customer', render: (r) => `${r.lead_id ? `<button class="sx-link" data-lead="${r.lead_id}">${esc(r.client_name)}</button>` : esc(r.client_name)}<span class="sub">${esc(r.agent_name || '')}${r.partner_firm ? ` · ${esc(r.partner_firm)}` : ''}</span>` },
          { key: 'project_name', label: 'Unit', text: (r) => `${r.project_name} ${r.unit_number}`, render: (r) => `${esc(r.project_name)}<span class="sub">unit ${esc(r.unit_number)} · ${esc(label(r.unit_status))}</span>` },
          { key: 'agreed_total_amount', label: 'Value', num: true, render: (r) => `${money(r.agreed_total_amount)}${Number(r.discount_amount) ? `<span class="sub">disc. ${money(r.discount_amount)}</span>` : ''}` },
          { key: 'collected', label: 'Collected (verified)', num: true, render: (r) => money(r.collected) },
          { key: 'status', label: 'Status', render: (r) => `${chip(r.status)}${r.approved_by_name ? `<span class="sub">by ${esc(r.approved_by_name)}</span>` : ''}${r.rejection_reason || r.cancellation_reason ? `<span class="sub">${esc(r.rejection_reason || r.cancellation_reason)}</span>` : ''}${r.status === 'PENDING_APPROVAL' && r.hold_expires_at ? `<span class="sub">unit held until ${when(r.hold_expires_at)}</span>` : ''}` },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (can('bookings.approve') ? `<div class="sx-row">${r.status === 'PENDING_APPROVAL' && r.approval_id ? `<button class="sx-btn sm" data-go="approvals">Decide</button>` : ''}${r.status === 'BOOKED' ? `<button class="sx-btn sm" data-adv="${r.id}" data-to="AGREEMENT_SIGNED">Agreement signed</button>` : ''}${r.status === 'AGREEMENT_SIGNED' ? `<button class="sx-btn sm" data-adv="${r.id}" data-to="CLOSED_WON">Registered</button>` : ''}${['PENDING_APPROVAL', 'BOOKED', 'AGREEMENT_SIGNED'].includes(r.status) && ['SUPER_ADMIN', 'BUSINESS_OWNER'].includes(NXS.state.me.role) ? `<button class="sx-btn sm danger" data-cancel="${r.id}">Cancel</button>` : ''}</div>` : '') }
        ],
        empty: { title: 'No bookings yet' },
        afterDraw: (root) => {
          root.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => NXS.openLead(b.dataset.lead)));
          root.querySelectorAll('[data-adv]').forEach((b) => b.addEventListener('click', async () => { if (!(await NXS.confirm(b.dataset.to === 'CLOSED_WON' ? 'Mark the sale registered?' : 'Mark the agreement signed?', b.dataset.to === 'CLOSED_WON' ? 'The unit becomes Sold.' : ''))) return; try { toast((await api(`/suite/sales/bookings/${b.dataset.adv}/action`, { body: { action: 'advance', status: b.dataset.to } })).message); load(); } catch (e) { toast(e.message, 'err'); } }));
          root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => { const reason = await NXS.confirm('Cancel this booking?', 'The unit is released. Finance and customer care are told so refunds can be handled.', { reason: true, danger: true, submit: 'Cancel booking' }); if (!reason) return; try { toast((await api(`/suite/sales/bookings/${b.dataset.cancel}/action`, { body: { action: 'cancel', reason } })).message); load(); } catch (e) { toast(e.message, 'err'); } }));
        }
      });
      async function load() { t.update((await api(`/suite/sales/bookings${NXS.qs({ status })}`)).data); }
      el.querySelector('[data-s]').addEventListener('change', (e) => { status = e.target.value; load(); });
      await load();
    }
  });

  // ------------------------------------------------------------------ performance & targets
  NXS.page('sales-performance', {
    title: 'Performance & targets', label: 'Performance', icon: 'chart', group: 'Reports', order: 20, portals: SALES, cap: 'reports.sales',
    async render(el) {
      const now = new Date();
      let period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      el.innerHTML = `<div class="sx-tabs"><button class="is-on" data-t="perf">Productivity</button>${can('targets.set') ? '<button data-t="targets">Targets vs achievement</button>' : ''}</div><div data-pane></div>`;
      const pane = el.querySelector('[data-pane]');
      async function perf() {
        pane.innerHTML = `<div class="sx-filters" data-range></div><div class="sx-card" data-list>${NXS.loading()}</div>`;
        rangeBar(pane.querySelector('[data-range]'), perf);
        const r = (await api(`/suite/sales/performance${NXS.qs({ from: range.from, to: range.to })}`)).data;
        table(pane.querySelector('[data-list]'), {
          rows: r.agents, exportTitle: 'Employee productivity',
          columns: [
            { key: 'name', label: 'Agent', render: (a) => `<strong>${esc(a.name)}</strong><span class="sub">${esc(label(a.role))}${a.is_available ? '' : ' · on leave'}</span>` },
            { key: 'assigned', label: 'Assigned', num: true }, { key: 'contacted', label: 'Contacted', num: true },
            { key: 'avgResponseMin', label: 'First call (min)', num: true, render: (a) => (a.avgResponseMin == null ? '—' : a.avgResponseMin) },
            { key: 'calls', label: 'Calls', num: true }, { key: 'connectedCalls', label: 'Connected', num: true }, { key: 'talkMinutes', label: 'Talk min', num: true },
            { key: 'visitsDone', label: 'Visits', num: true }, { key: 'visitsMissed', label: 'Missed', num: true },
            { key: 'bookings', label: 'Bookings', num: true }, { key: 'revenue', label: 'Value', num: true, render: (a) => money(a.revenue) },
            { key: 'conversionPct', label: 'Conv. %', num: true }, { key: 'openLeads', label: 'Open', num: true }, { key: 'overdue', label: 'Overdue', num: true }
          ]
        });
      }
      async function targets() {
        pane.innerHTML = `<div class="sx-filters"><input type="month" data-period value="${period}"><div class="sx-spacer"></div><button class="sx-btn primary" data-set>Set targets</button></div><div data-body>${NXS.loading()}</div>`;
        const r = (await api(`/suite/sales/targets?period=${period}`)).data;
        const bar = (a, t) => { if (!t) return '<span class="sx-muted">no target</span>'; const p = Math.round((a / t) * 100); return `<div class="sx-row"><div class="sx-progress" style="flex:1;min-width:80px"><i style="width:${Math.min(p, 100)}%"></i></div><span class="sx-num">${num(a)} / ${num(t)}</span></div>`; };
        const c = r.company;
        pane.querySelector('[data-body]').innerHTML = `
          <div class="sx-card"><div class="sx-card-head"><h3>Company — ${esc(period)}</h3></div><dl class="sx-kv"><dt>Bookings</dt><dd>${bar(c.bookings, c.target && c.target.target_bookings)}</dd><dt>Booked value</dt><dd>${c.target && Number(c.target.target_revenue) ? `<div class="sx-row"><div class="sx-progress" style="flex:1;min-width:80px"><i style="width:${Math.min(Math.round((c.revenue / Number(c.target.target_revenue)) * 100), 100)}%"></i></div><span class="sx-num">${money(c.revenue)} / ${money(c.target.target_revenue)}</span></div>` : `${money(c.revenue)} <span class="sx-muted">(no target)</span>`}</dd><dt>Visits</dt><dd>${bar(c.visitsDone, c.target && c.target.target_site_visits)}</dd><dt>Calls</dt><dd>${bar(c.calls, c.target && c.target.target_calls)}</dd></dl></div>
          <div class="sx-card" style="margin-top:14px" data-list></div>`;
        table(pane.querySelector('[data-list]'), {
          rows: r.agents, exportTitle: `Targets ${period}`,
          columns: [
            { key: 'name', label: 'Agent' },
            { key: 'bookings', label: 'Bookings', render: (a) => bar(a.bookings, a.target && a.target.target_bookings), text: (a) => `${a.bookings}/${a.target ? a.target.target_bookings : '-'}` },
            { key: 'revenue', label: 'Value', render: (a) => `${money(a.revenue)}${a.target && Number(a.target.target_revenue) ? ` / ${money(a.target.target_revenue)}` : ''}`, text: (a) => a.revenue },
            { key: 'visitsDone', label: 'Visits', render: (a) => bar(a.visitsDone, a.target && a.target.target_site_visits), text: (a) => a.visitsDone },
            { key: 'calls', label: 'Calls', render: (a) => bar(a.calls, a.target && a.target.target_calls), text: (a) => a.calls }
          ]
        });
        pane.querySelector('[data-period]').addEventListener('change', (e) => { period = e.target.value; targets(); });
        pane.querySelector('[data-set]').addEventListener('click', () => {
          const rows = [...(NXS.state.me.role === 'ADMIN' ? [] : [{ id: null, name: 'Company' }]), ...r.agents];
          const m = NXS.modal(`<h2>Targets for ${esc(period)}</h2><div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Who</th><th>Bookings</th><th>Value (₹)</th><th>Visits</th><th>Calls</th></tr></thead><tbody>${rows.map((a) => { const t = a.id ? a.target : c.target; return `<tr data-u="${a.id || ''}"><td>${esc(a.name)}</td>${['target_bookings', 'target_revenue', 'target_site_visits', 'target_calls'].map((k) => `<td><input type="number" min="0" name="${k}" value="${t ? Number(t[k]) : ''}" style="width:110px" class="sx-input"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div><div class="sx-error" hidden></div><div class="sx-actions"><button class="sx-btn" data-close>Cancel</button><button class="sx-btn primary" data-save>Save</button></div>`);
          m.el.querySelector('[data-save]').addEventListener('click', async () => {
            const list = [...m.el.querySelectorAll('tbody tr')].map((tr) => ({ user_id: tr.dataset.u || null, ...Object.fromEntries([...tr.querySelectorAll('input')].map((i) => [i.name, Number(i.value) || 0])) }));
            try { toast((await api('/suite/sales/targets', { method: 'PUT', body: { period, targets: list } })).message); m.close(); targets(); } catch (e) { const er = m.el.querySelector('.sx-error'); er.textContent = e.message; er.hidden = false; }
          });
        });
      }
      el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { el.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('is-on', x === b)); (b.dataset.t === 'perf' ? perf : targets)(); }));
      await perf();
    }
  });

  // ------------------------------------------------------------------ reports: project-wise + conversion
  NXS.page('sales-reports', {
    title: 'Sales reports', label: 'Project & conversion reports', icon: 'file', group: 'Reports', order: 21, portals: OWNER_TOO, cap: 'reports.sales',
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-range></div><div data-body></div>';
      const body = el.querySelector('[data-body]');
      const load = async () => {
        body.innerHTML = NXS.loading();
        const [p, c] = await Promise.all([api(`/suite/sales/projects${NXS.qs({ from: range.from, to: range.to })}`), api(`/suite/sales/conversion${NXS.qs({ from: range.from, to: range.to })}`)]);
        const f = c.data.funnel;
        body.innerHTML = `
          <div class="sx-card"><div class="sx-card-head"><h3>Project-wise sales</h3></div><div data-proj></div></div>
          <div class="sx-grid" style="margin-top:16px">
            <div class="sx-card"><div class="sx-card-head"><h3>Conversion funnel</h3><span class="sx-sub">leads created in this period</span></div><div data-funnel></div></div>
            <div class="sx-card"><div class="sx-card-head"><h3>Why leads were lost</h3></div><div data-lost></div></div>
          </div>
          <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Conversion by source</h3></div><div data-src></div></div>`;
        table(body.querySelector('[data-proj]'), {
          rows: p.data.projects, exportTitle: 'Project-wise sales',
          columns: [{ key: 'name', label: 'Project', render: (r) => `<strong>${esc(r.name)}</strong><span class="sub">${esc(r.city || '')} · ${esc(label(r.status))}</span>` }, { key: 'leads', label: 'Leads', num: true }, { key: 'visits', label: 'Visits', num: true }, { key: 'bookings', label: 'Bookings', num: true }, { key: 'revenue', label: 'Booked value', num: true, render: (r) => money(r.revenue) }, { key: 'conversionPct', label: 'Conv. %', num: true }, { key: 'available', label: 'Units available', num: true }, { key: 'soldPct', label: 'Sold %', num: true }]
        });
        const steps = [['Leads', f.leads], ['Contacted', f.contacted], ['Qualified', f.qualified], ['Visit fixed', f.visitScheduled], ['Visited', f.visited], ['Negotiation', f.negotiation], ['Booked', f.booked]];
        charts.hbars(body.querySelector('[data-funnel]'), steps.map(([l, v]) => ({ label: l, value: v, sub: f.leads ? `${Math.round((v / f.leads) * 100)}% of leads` : '' })), { format: num });
        charts.hbars(body.querySelector('[data-lost]'), c.data.lostReasons.map((r) => ({ label: r.reason, value: r.count })), { format: num, color: 'var(--sx-slate)' });
        table(body.querySelector('[data-src]'), {
          rows: c.data.bySource, exportTitle: 'Conversion by source',
          columns: [{ key: 'source', label: 'Source', render: (r) => esc(label(r.source)) }, { key: 'leads', label: 'Leads', num: true }, { key: 'contacted', label: 'Contacted', num: true }, { key: 'qualified', label: 'Qualified', num: true }, { key: 'visited', label: 'Visited', num: true }, { key: 'booked', label: 'Booked', num: true }, { key: 'lost', label: 'Lost', num: true }, { key: 'conversionPct', label: 'Conv. %', num: true }]
        });
      };
      rangeBar(el.querySelector('[data-range]'), load);
      await load();
    }
  });

  // ------------------------------------------------------------------ activity & calls
  NXS.page('sales-activity', {
    title: 'Team activity', label: 'Activity timeline', icon: 'clock', group: 'Reports', order: 22, portals: SALES, cap: 'team.view',
    async render(el) {
      const members = (await api('/suite/sales/members')).data;
      let user = '';
      let type = '';
      el.innerHTML = `<div class="sx-filters" data-range></div><div class="sx-filters"><select data-u><option value="">Everyone</option>${members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><select data-ty><option value="">All activity</option>${['CALL', 'WHATSAPP', 'VISIT', 'BOOKING', 'PAYMENT', 'ASSIGN', 'STAGE', 'NOTE', 'QUALIFY', 'APPROVAL', 'AI'].map((x) => `<option value="${x}">${label(x)}</option>`).join('')}</select></div><div class="sx-kpis" data-counts></div><div class="sx-card" style="margin-top:14px" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Team activity', pageSize: 100, onRow: (r) => NXS.openLead(r.lead_id),
        columns: [{ key: 'created_at', label: 'When', render: (r) => when(r.created_at), text: (r) => new Date(r.created_at).toLocaleString('en-IN') }, { key: 'by', label: 'Who', render: (r) => `${esc(r.by)}<span class="sub">${esc(label(r.role || ''))}</span>` }, { key: 'type', label: 'What', render: (r) => `${chip(r.type === 'BOOKING' ? 'GREEN' : '', label(r.type))}${r.outcome ? `<span class="sub">${esc(label(r.outcome))}</span>` : ''}` }, { key: 'client_name', label: 'Client' }, { key: 'note', label: 'Details', render: (r) => `<span class="sub">${esc(r.note || '')}</span>` }]
      });
      const load = async () => {
        const r = (await api(`/suite/sales/activity${NXS.qs({ from: range.from, to: range.to, user_id: user, type })}`)).data;
        el.querySelector('[data-counts]').innerHTML = ['CALL', 'WHATSAPP', 'VISIT', 'BOOKING', 'NOTE'].map((k) => kpi(label(k), num(r.counts[k] || 0))).join('');
        t.update(r.rows);
      };
      rangeBar(el.querySelector('[data-range]'), load);
      el.querySelector('[data-u]').addEventListener('change', (e) => { user = e.target.value; load(); });
      el.querySelector('[data-ty]').addEventListener('change', (e) => { type = e.target.value; load(); });
      await load();
    }
  });

  NXS.page('sales-calls', {
    title: 'Call activity', label: 'Calls', icon: 'phone', group: 'Reports', order: 23, portals: SALES, cap: 'calls.monitor',
    async render(el) {
      el.innerHTML = `<div class="sx-filters" data-range></div><div data-body></div>`;
      const body = el.querySelector('[data-body]');
      const load = async () => {
        const r = (await api(`/suite/sales/calls${NXS.qs({ from: range.from, to: range.to })}`)).data;
        const s = r.summary;
        body.innerHTML = `${NXS.telephonyReady() ? '' : '<div class="sx-note amber" style="margin-bottom:12px">Cloud calling isn’t connected yet, so only calls agents log by hand are counted below. Connect the telephony provider in Workflow rules → Integrations.</div>'}
          <div class="sx-kpis">${kpi('Cloud calls', num(s.total))}${kpi('Connected', num(s.connected), { tone: 'good' })}${kpi('Not connected', num(s.unsuccessful), { tone: s.unsuccessful ? 'warn' : '' })}${kpi('Incoming', num(s.inbound))}${kpi('Talk time', `${num(s.talkMinutes)} min`)}${kpi('Outcome missing', num(s.outcomePending), { tone: s.outcomePending ? 'warn' : '' })}</div>
          <div class="sx-grid" style="margin-top:16px"><div class="sx-card"><div class="sx-card-head"><h3>Logged call outcomes</h3><span class="sx-sub">incl. calls logged by hand</span></div><div data-out></div></div></div>
          <div class="sx-card" style="margin-top:16px" data-list></div>`;
        charts.hbars(body.querySelector('[data-out]'), Object.entries(r.loggedOutcomes).map(([k, v]) => ({ label: label(k), value: v })), { format: num });
        table(body.querySelector('[data-list]'), {
          rows: r.rows, exportTitle: 'Calls',
          columns: [{ key: 'initiated_at', label: 'When', render: (c) => when(c.initiated_at), text: (c) => new Date(c.initiated_at).toLocaleString('en-IN') }, { key: 'agent_name', label: 'Agent' }, { key: 'direction', label: 'Direction', render: (c) => chip(c.direction) }, { key: 'client_name', label: 'Client', render: (c) => `${esc(c.client_name || c.customer_phone || '')}` }, { key: 'status', label: 'Status', render: (c) => `${chip(c.status)}${c.failure_reason ? `<span class="sub">${esc(c.failure_reason)}</span>` : ''}` }, { key: 'duration_sec', label: 'Talk (s)', num: true }, { key: 'outcome', label: 'Outcome', render: (c) => (c.outcome ? esc(label(c.outcome)) : '<span class="sx-muted">—</span>') }],
          empty: { title: 'No cloud calls in this period' }
        });
      };
      rangeBar(el.querySelector('[data-range]'), load);
      await load();
    }
  });
})();
