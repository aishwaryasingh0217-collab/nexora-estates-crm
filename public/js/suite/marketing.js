/* Business Suite — Marketing portal: channels, campaigns, spend, attribution, ROI and lead import. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, money, num, label, toast, table, formDialog, kpi, can, charts } = NXS;
  const MKT = ['marketing', 'sales-head'];
  let range = NXS.defaultRange(90);
  let opts = null;
  const options = async (fresh) => (opts && !fresh ? opts : (opts = (await api('/suite/marketing/options')).data));
  const pctTxt = (v) => (v == null ? '—' : `${v}%`);
  const roiTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);

  function rangeBar(el, onChange) {
    const rc = NXS.rangeControl(range, (r) => { range = r; onChange(); });
    el.innerHTML = rc.html;
    rc.bind(el);
  }

  // ------------------------------------------------------------------ overview / analytics
  NXS.page('mkt-overview', {
    title: 'Marketing overview', label: 'Overview', icon: 'chart', group: 'Marketing', order: 1, portals: MKT, cap: 'marketing.view',
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-range></div><div data-body></div>';
      const body = el.querySelector('[data-body]');
      const load = async () => {
        rangeBar(el.querySelector('[data-range]'), load);
        body.innerHTML = NXS.loading();
        const r = (await api(`/suite/marketing/analytics${NXS.qs({ from: range.from, to: range.to })}`)).data;
        const t = r.totals;
        body.innerHTML = `
          <div class="sx-kpis">
            ${kpi('Leads', num(t.leads), { go: 'mkt-attribution' })}
            ${kpi('Recorded spend', money(t.spend), { hint: 'from spend entries in this period' })}
            ${kpi('Cost per lead', t.costPerLead == null ? '—' : money(t.costPerLead))}
            ${kpi('Bookings', num(t.bookings), { hint: `${pctTxt(t.conversionPct)} of leads` })}
            ${kpi('Booked value', money(t.revenue), { hint: 'confirmed bookings only' })}
            ${kpi('Return on spend', roiTxt(t.roiPct), { tone: t.roiPct == null ? '' : t.roiPct >= 0 ? 'good' : 'bad' })}
          </div>
          <div class="sx-grid" style="margin-top:16px">
            <div class="sx-card"><div class="sx-card-head"><h3>Leads by month</h3></div><div data-c="month"></div></div>
            <div class="sx-card"><div class="sx-card-head"><h3>Leads by source</h3></div><div data-c="source"></div></div>
          </div>
          <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Source performance</h3><span class="sx-muted" style="font-size:.8rem">Revenue counts confirmed bookings of leads created in the period; spend comes from campaigns linked to the source’s channel.</span></div><div data-t></div></div>`;
        if (r.byMonth.length) {
          charts.columns(body.querySelector('[data-c="month"]'), { labels: r.byMonth.map((m) => m.month), series: [{ name: 'All leads', values: r.byMonth.map((m) => m.leads) }, { name: 'From campaigns', values: r.byMonth.map((m) => m.campaignLeads) }], format: (v) => num(Math.round(v)), integer: true });
        } else body.querySelector('[data-c="month"]').innerHTML = '<div class="sx-empty"><h3>No leads in this period</h3></div>';
        charts.hbars(body.querySelector('[data-c="source"]'), r.sources.slice(0, 10).map((s) => ({ label: label(s.source), value: s.leads, sub: `${s.bookings} booked · ${pctTxt(s.conversionPct)}`, key: s.source })), { format: num, onClick: (row) => NXS.go('mkt-attribution', { source: row.key }) });
        table(body.querySelector('[data-t]'), {
          rows: r.sources, exportTitle: `Source performance ${range.from} to ${range.to}`,
          columns: [
            { key: 'source', label: 'Source', render: (s) => esc(label(s.source)), text: (s) => label(s.source) },
            { key: 'leads', label: 'Leads', num: true }, { key: 'contacted', label: 'Contacted', num: true }, { key: 'qualified', label: 'Qualified', num: true },
            { key: 'visited', label: 'Visited', num: true }, { key: 'bookings', label: 'Bookings', num: true },
            { key: 'conversionPct', label: 'Conversion', num: true, render: (s) => pctTxt(s.conversionPct) },
            { key: 'spend', label: 'Spend', num: true, render: (s) => (s.spend ? money(s.spend) : '—') },
            { key: 'costPerLead', label: 'Cost / lead', num: true, render: (s) => (s.costPerLead == null ? '—' : money(s.costPerLead)) },
            { key: 'revenue', label: 'Booked value', num: true, render: (s) => money(s.revenue) },
            { key: 'roiPct', label: 'ROI', num: true, render: (s) => roiTxt(s.roiPct) }
          ]
        });
      };
      await load();
    }
  });

  // ------------------------------------------------------------------ campaigns
  async function campaignForm(c, after) {
    const o = await options();
    const projects = o.projects;
    formDialog({
      title: c ? `Edit ${c.name}` : 'New campaign', submit: c ? 'Save' : 'Create campaign',
      sub: c ? `Tracking code ${c.code} stays fixed so links already shared keep working.` : 'A tracking code and UTM tags are generated if you leave them empty.',
      fields: [
        [{ name: 'name', label: 'Campaign name', required: true, value: c && c.name }, ...(c ? [] : [{ name: 'code', label: 'Tracking code', placeholder: 'auto' }])],
        [{ name: 'channel_id', label: 'Channel', type: 'select', value: c && c.channel_id, options: [['', '—'], ...o.channels.map((x) => [x.id, x.name])] }, { name: 'project_id', label: 'Project', type: 'select', value: c && c.project_id, options: [['', 'All projects'], ...projects.map((p) => [p.id, p.name])] }],
        { name: 'objective', label: 'Objective', value: c && c.objective },
        [{ name: 'budget', label: 'Budget (₹)', type: 'number', value: c ? c.budget : '' }, { name: 'status', label: 'Status', type: 'select', value: c ? c.status : 'PLANNED', options: o.statuses.map((s) => [s, label(s)]) }],
        [{ name: 'start_date', label: 'Starts', type: 'date', value: c && c.start_date ? NXS.ymd(c.start_date) : '' }, { name: 'end_date', label: 'Ends', type: 'date', value: c && c.end_date ? NXS.ymd(c.end_date) : '' }],
        { name: 'landing_url', label: 'Landing page', placeholder: 'https://…', value: c && c.landing_url },
        [{ name: 'utm_source', label: 'utm_source', value: c && c.utm_source }, { name: 'utm_medium', label: 'utm_medium', value: c && c.utm_medium }, { name: 'utm_campaign', label: 'utm_campaign', value: c && c.utm_campaign }],
        { name: 'notes', label: 'Notes', type: 'textarea', value: c && c.notes }
      ],
      onSubmit: async (v) => {
        const r = c ? await api(`/suite/marketing/campaigns/${c.id}`, { method: 'PATCH', body: v }) : await api('/suite/marketing/campaigns', { body: v });
        opts = null;
        if (after) after(r);
        return r.message;
      }
    });
  }

  function trackingLink(c, extra = {}) {
    if (!c.landing_url) return '';
    try {
      const u = new URL(c.landing_url);
      const tags = { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign, ...extra };
      Object.entries(tags).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
      return u.toString();
    } catch (e) { return ''; }
  }

  async function openCampaign(id, afterChange) {
    const d = NXS.drawer('Campaign');
    const draw = async () => {
      const r = (await api(`/suite/marketing/campaigns/${id}`)).data;
      const c = r.campaign;
      d.setTitle(c.name);
      const manage = can('marketing.manage');
      const link = trackingLink(c);
      const over = c.budget > 0 && c.spend > c.budget;
      d.body.innerHTML = `
        <div class="sx-row">${chip(c.status)}${NXS.testChip(c)}<span class="sx-muted">${esc(c.code)} · ${esc(c.channel_name || 'No channel')} · ${esc(c.project_name || 'All projects')}</span><div class="sx-spacer"></div>${manage ? '<button class="sx-btn sm" data-edit>Edit</button><button class="sx-btn sm primary" data-spend>Record spend</button>' : ''}</div>
        ${over ? `<div class="sx-note red">Over budget: ${money(c.spend)} spent of ${money(c.budget)}.</div>` : ''}
        <div class="sx-kpis">
          ${kpi('Spend', money(c.spend), { hint: c.budget ? `${pctTxt(c.budgetUsedPct)} of ${money(c.budget)}` : 'no budget set' })}
          ${kpi('Leads', num(c.leads), { hint: c.costPerLead == null ? '' : `${money(c.costPerLead)} per lead` })}
          ${kpi('Bookings', num(c.bookings), { hint: c.costPerBooking == null ? pctTxt(c.conversionPct) : `${money(c.costPerBooking)} per booking` })}
          ${kpi('ROI', roiTxt(c.roiPct), { hint: `${money(c.revenue)} booked`, tone: c.roiPct == null ? '' : c.roiPct >= 0 ? 'good' : 'bad' })}
        </div>
        <div class="sx-card"><div class="sx-card-head"><h3>Funnel</h3></div><div data-funnel></div></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Tracking link</h3></div>
          ${link ? `<div class="sx-row"><input type="text" readonly value="${esc(link)}" style="flex:1;min-width:0" data-link><button class="sx-btn sm" data-copy>Copy</button></div>
            <div class="sx-form-row" style="margin-top:8px"><label class="sx-field"><span>utm_content (optional, e.g. ad name)</span><input data-content></label><label class="sx-field"><span>utm_term (optional)</span><input data-term></label></div>
            <p class="sx-muted" style="font-size:.8rem">Enquiries from the website form keep these tags and are linked to this campaign by utm_campaign = <code>${esc(c.utm_campaign || '')}</code>.</p>`
            : '<p class="sx-muted">Add a landing page URL to build the tracking link.</p>'}
        </div>
        <div class="sx-card"><div class="sx-card-head"><h3>Spend entries</h3></div><div data-spends></div></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Leads from this campaign</h3></div><div data-leads></div></div>`;
      charts.hbars(d.body.querySelector('[data-funnel]'), [['Leads', c.leads], ['Contacted', c.contacted], ['Qualified', c.qualified], ['Visited site', c.visited], ['Booked', c.bookings]].map(([l, v]) => ({ label: l, value: v, sub: c.leads ? `${Math.round((v / c.leads) * 100)}% of leads` : '' })), { format: num });
      table(d.body.querySelector('[data-spends]'), { rows: r.spend, exportTitle: `${c.code} spend`, columns: [{ key: 'spend_date', label: 'Date', render: (s) => when(s.spend_date, { dateOnly: true }), text: (s) => NXS.ymd(s.spend_date) }, { key: 'amount', label: 'Amount', num: true, render: (s) => money(s.amount, false) }, { key: 'note', label: 'Note' }, { key: 'recorded_by_name', label: 'Recorded by' }], empty: { title: 'No spend recorded' } });
      table(d.body.querySelector('[data-leads]'), { rows: r.leads, exportTitle: `${c.code} leads`, onRow: can('leads.view.all') ? (l) => NXS.openLead(l.id) : null, columns: [{ key: 'client_name', label: 'Lead' }, { key: 'bucket', label: 'Stage', render: (l) => chip(l.bucket, label(l.stage)) }, { key: 'agent_name', label: 'Owner' }, { key: 'created_at', label: 'Created', render: (l) => when(l.created_at), text: (l) => l.created_at }], empty: { title: 'No leads yet' } });
      const on = (sel, fn) => { const b = d.body.querySelector(sel); if (b) b.addEventListener('click', fn); };
      on('[data-edit]', () => campaignForm(c, () => { draw(); if (afterChange) afterChange(); }));
      on('[data-spend]', () => formDialog({
        title: `Record spend — ${c.name}`, sub: 'Enter what was actually billed (from the ad platform invoice or statement).', submit: 'Record',
        fields: [[{ name: 'amount', label: 'Amount (₹)', type: 'number', required: true }, { name: 'spend_date', label: 'Date', type: 'date', value: NXS.ymd(Date.now()) }], { name: 'note', label: 'Note', placeholder: 'e.g. Meta invoice #…' }],
        onSubmit: async (v) => { const x = await api(`/suite/marketing/campaigns/${c.id}/spend`, { body: v }); draw(); if (afterChange) afterChange(); if (x.data && x.data.overBudget) setTimeout(() => toast(x.message, 'err'), 50); return x.message; }
      }));
      const linkEl = d.body.querySelector('[data-link]');
      if (linkEl) {
        const rebuild = () => { linkEl.value = trackingLink(c, { utm_content: d.body.querySelector('[data-content]').value.trim(), utm_term: d.body.querySelector('[data-term]').value.trim() }); };
        d.body.querySelector('[data-content]').addEventListener('input', rebuild);
        d.body.querySelector('[data-term]').addEventListener('input', rebuild);
        on('[data-copy]', async () => { try { await navigator.clipboard.writeText(linkEl.value); toast('Link copied.'); } catch (e) { linkEl.select(); toast('Press Ctrl+C to copy.'); } });
      }
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openCampaign = openCampaign;

  NXS.page('mkt-campaigns', {
    title: 'Campaigns', label: 'Campaigns', icon: 'megaphone', group: 'Marketing', order: 2, portals: MKT, cap: 'marketing.view',
    async render(el, params) {
      el.innerHTML = `<div class="sx-filters"><select data-status><option value="">All statuses</option>${['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'].map((s) => `<option value="${s}">${label(s)}</option>`).join('')}</select><div class="sx-spacer"></div>${can('marketing.manage') ? '<button class="sx-btn primary" data-new>New campaign</button>' : ''}</div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Campaigns', onRow: (c) => openCampaign(c.id, load),
        columns: [
          { key: 'name', label: 'Campaign', render: (c) => `<strong>${esc(c.name)}</strong>${NXS.testChip(c)}<span class="sub">${esc(c.code)} · ${esc(c.channel_name || '—')}</span>` },
          { key: 'status', label: 'Status', render: (c) => chip(c.status) },
          { key: 'budget', label: 'Budget', num: true, render: (c) => (c.budget ? money(c.budget) : '—') },
          { key: 'spend', label: 'Spend', num: true, render: (c) => `${money(c.spend)}${c.budget ? `<span class="sub"${c.spend > c.budget ? ' style="color:var(--sx-red);font-weight:650"' : ''}>${pctTxt(c.budgetUsedPct)} used${c.spend > c.budget ? ' — over budget' : ''}</span>` : ''}` },
          { key: 'leads', label: 'Leads', num: true },
          { key: 'costPerLead', label: 'Cost / lead', num: true, render: (c) => (c.costPerLead == null ? '—' : money(c.costPerLead)) },
          { key: 'bookings', label: 'Bookings', num: true },
          { key: 'conversionPct', label: 'Conversion', num: true, render: (c) => pctTxt(c.conversionPct) },
          { key: 'revenue', label: 'Booked value', num: true, render: (c) => money(c.revenue) },
          { key: 'roiPct', label: 'ROI', num: true, render: (c) => roiTxt(c.roiPct) }
        ],
        empty: { title: 'No campaigns yet', text: can('marketing.manage') ? 'Create one to start tracking its leads and spend.' : '' }
      });
      const statusSel = el.querySelector('[data-status]');
      async function load() { t.update((await api(`/suite/marketing/campaigns${NXS.qs({ status: statusSel.value })}`)).data); }
      statusSel.addEventListener('change', load);
      const nb = el.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => campaignForm(null, (r) => { load(); if (r && r.data) openCampaign(r.data.id, load); }));
      await load();
      if (params.id) openCampaign(params.id, load);
    }
  });

  // ------------------------------------------------------------------ channels
  NXS.page('mkt-channels', {
    title: 'Advertising channels', label: 'Channels', icon: 'share', group: 'Marketing', order: 3, portals: MKT, cap: 'marketing.view',
    async render(el) {
      const o = await options();
      el.innerHTML = `<div class="sx-filters"><span class="sx-muted">Each channel maps to the lead source code its leads arrive with, so leads, spend and bookings line up.</span><div class="sx-spacer"></div>${can('marketing.manage') ? '<button class="sx-btn primary" data-new>Add channel</button>' : ''}</div><div class="sx-card" data-list></div>`;
      const form = (ch) => formDialog({
        title: ch ? `Edit ${ch.name}` : 'Add channel', submit: ch ? 'Save' : 'Add',
        fields: [
          [{ name: 'name', label: 'Name', required: true, value: ch && ch.name }, { name: 'lead_source', label: 'Lead source code', required: true, value: ch && ch.lead_source, placeholder: 'e.g. FACEBOOK_ADS', hint: 'Must match the source on incoming leads' }],
          [{ name: 'channel_type', label: 'Type', type: 'select', value: ch && ch.channel_type, options: o.channelTypes.map((x) => [x, label(x)]) }, { name: 'cost_model', label: 'Cost model', type: 'select', value: ch && ch.cost_model, options: o.costModels.map((x) => [x, x]) }],
          { name: 'notes', label: 'Notes', value: ch && ch.notes },
          { name: 'is_active', label: 'Active', type: 'checkbox', value: ch ? Boolean(ch.is_active) : true }
        ],
        onSubmit: async (v) => { const r = ch ? await api(`/suite/marketing/channels/${ch.id}`, { method: 'PATCH', body: v }) : await api('/suite/marketing/channels', { body: v }); opts = null; load(); return r.message; }
      });
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Advertising channels', onRow: can('marketing.manage') ? form : null,
        columns: [{ key: 'name', label: 'Channel', render: (c) => `<strong>${esc(c.name)}</strong><span class="sub">${esc(c.notes || '')}</span>` }, { key: 'lead_source', label: 'Lead source', render: (c) => `<code>${esc(c.lead_source)}</code>` }, { key: 'channel_type', label: 'Type', render: (c) => esc(label(c.channel_type)) }, { key: 'cost_model', label: 'Cost model' }, { key: 'campaigns', label: 'Campaigns', num: true }, { key: 'leads', label: 'Leads (all time)', num: true }, { key: 'is_active', label: 'Status', render: (c) => chip(c.is_active ? 'ACTIVE' : 'INACTIVE', c.is_active ? 'Active' : 'Inactive') }]
      });
      async function load() { t.update((await api('/suite/marketing/channels')).data); }
      const nb = el.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => form(null));
      await load();
    }
  });

  // ------------------------------------------------------------------ lead-level attribution
  NXS.page('mkt-attribution', {
    title: 'Lead attribution', label: 'Attribution', icon: 'list', group: 'Marketing', order: 4, portals: MKT, cap: 'marketing.view',
    async render(el, params) {
      const o = await options();
      const f = { campaign_id: params.campaign_id || '', source: params.source || '' };
      el.innerHTML = `<div class="sx-filters"><span data-range style="display:contents"></span><select data-f="campaign_id"><option value="">Any campaign</option>${o.campaigns.map((c) => `<option value="${c.id}" ${c.id === f.campaign_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><input placeholder="Source code" data-f="source" value="${esc(f.source)}"></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Lead attribution', pageSize: 100, onRow: can('leads.view.all') ? (l) => NXS.openLead(l.id) : null,
        columns: [
          { key: 'client_name', label: 'Lead', render: (l) => `<strong>${esc(l.client_name)}</strong><span class="sub">${esc(l.project_name || '')}</span>` },
          { key: 'source', label: 'Source', render: (l) => esc(label(l.source || '')) , text: (l) => l.source },
          { key: 'campaign_name', label: 'Campaign', render: (l) => (l.campaign_name ? `${esc(l.campaign_name)}<span class="sub">${esc(l.campaign_code)}</span>` : '—'), text: (l) => l.campaign_code || '' },
          { key: 'utm_source', label: 'UTM', render: (l) => esc([l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(' / ') || '—'), text: (l) => [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(' / ') },
          { key: 'bucket', label: 'Stage', render: (l) => chip(l.bucket, label(l.stage)), text: (l) => l.stage },
          { key: 'booked_value', label: 'Booked value', num: true, render: (l) => (l.booked_value == null ? '—' : money(l.booked_value)) },
          { key: 'created_at', label: 'Created', render: (l) => when(l.created_at), text: (l) => l.created_at }
        ],
        empty: { title: 'No leads in this period' }
      });
      const load = async () => {
        rangeBar(el.querySelector('[data-range]'), load);
        t.update((await api(`/suite/marketing/attribution${NXS.qs({ from: range.from, to: range.to, ...f })}`)).data.rows);
      };
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.tagName === 'INPUT' ? 'input' : 'change', () => { f[i.dataset.f] = i.value.trim(); clearTimeout(i._t); i._t = setTimeout(load, 300); }));
      await load();
    }
  });

  // ------------------------------------------------------------------ import
  NXS.page('mkt-import', {
    title: 'Import leads', label: 'Import leads', icon: 'upload', group: 'Marketing', order: 5, portals: ['marketing'], cap: 'leads.import',
    async render(el) {
      el.innerHTML = `<div class="sx-card" style="max-width:720px">
        <h3>Bring in leads from an event, a portal export or a list</h3>
        <p class="sx-muted">Upload a CSV or Excel sheet, or paste messy text and let the AI read it into rows${can('ai.use') ? '' : ' (AI paste is not available for your role)'}. You review every row before anything is saved. Leads whose phone number already exists are skipped and listed with their current owner. New leads are shared fairly across the sales team unless a manager assigns them.</p>
        <div class="sx-actions" style="justify-content:flex-start"><button class="sx-btn primary" data-imp>Import leads</button></div></div>`;
      el.querySelector('[data-imp]').addEventListener('click', () => NXS.importLeadsDialog(() => toast('Import finished — see Attribution for the new leads.')));
    }
  });
})();
