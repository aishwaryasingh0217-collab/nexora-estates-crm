/* Business Suite — Business owner / CEO portal: company-wide performance, departments, alerts, drill-downs. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, money, num, label, table, kpi, can, charts } = NXS;
  let range = NXS.defaultRange(30);
  const ALERT_TONE = { critical: 'red', warning: 'amber', info: '' };

  const DRILL = {
    revenue: { title: 'Bookings behind the revenue', columns: dealCols },
    bookings: { title: 'Bookings', columns: dealCols },
    collections: {
      title: 'Verified collections',
      columns: () => [
        { key: 'receipt_number', label: 'Receipt', render: (r) => `<strong>${esc(r.receipt_number || r.payment_number)}</strong><span class="sub">${esc(r.deal_number)}</span>` },
        { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.project_name)} · ${esc(r.unit_number)}</span>` },
        { key: 'payment_mode', label: 'Mode', render: (r) => esc(label(r.payment_mode)) },
        { key: 'payment_date', label: 'Date', render: (r) => when(r.payment_date, { dateOnly: true }), text: (r) => NXS.ymd(r.payment_date) },
        { key: 'amount_received', label: 'Amount', num: true, render: (r) => money(r.amount_received, false) }
      ]
    },
    outstanding: {
      title: 'Outstanding by booking',
      columns: () => [
        { key: 'deal_number', label: 'Booking', render: (r) => `<strong>${esc(r.deal_number)}</strong>` },
        { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.project_name)} · ${esc(r.unit_number)}</span>` },
        { key: 'agreed_total_amount', label: 'Value', num: true, render: (r) => money(r.agreed_total_amount) },
        { key: 'collected', label: 'Collected', num: true, render: (r) => money(r.collected) },
        { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => money(r.outstanding) },
        { key: 'overdue', label: 'Overdue', num: true, render: (r) => (r.overdue ? `<strong style="color:var(--sx-red)">${money(r.overdue)}</strong>` : '—') },
        { key: 'next_due_date', label: 'Next due', render: (r) => (r.next_due_date ? when(r.next_due_date, { dateOnly: true }) : '—') }
      ]
    },
    leads: {
      title: 'Leads',
      columns: () => [
        { key: 'client_name', label: 'Lead', render: (r) => `<strong>${esc(r.client_name)}</strong><span class="sub">${esc(r.project_name || '')}</span>` },
        { key: 'source', label: 'Source', render: (r) => esc(label(r.source || '')) },
        { key: 'bucket', label: 'Stage', render: (r) => chip(r.bucket, label(r.stage)) },
        { key: 'agent_name', label: 'Owner', render: (r) => esc(r.agent_name || 'Unassigned') },
        { key: 'created_at', label: 'Created', render: (r) => when(r.created_at), text: (r) => r.created_at }
      ]
    }
  };
  function dealCols() {
    return [
      { key: 'deal_number', label: 'Booking', render: (r) => `<strong>${esc(r.deal_number)}</strong> ${chip(r.status)}` },
      { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.project_name)} · ${esc(r.unit_number)}</span>` },
      { key: 'agent_name', label: 'Sold by', render: (r) => `${esc(r.agent_name || '—')}${r.partner_firm ? `<span class="sub">via ${esc(r.partner_firm)}</span>` : ''}` },
      { key: 'source', label: 'Source', render: (r) => esc(label(r.source || '')) },
      { key: 'agreed_total_amount', label: 'Value', num: true, render: (r) => money(r.agreed_total_amount) },
      { key: 'discount_amount', label: 'Discount', num: true, render: (r) => (Number(r.discount_amount) ? money(r.discount_amount) : '—') },
      { key: 'booked_at', label: 'Booked', render: (r) => when(r.booked_at, { dateOnly: true }), text: (r) => NXS.ymd(r.booked_at) }
    ];
  }

  async function drill(metric, extra = {}) {
    const def = DRILL[metric];
    const d = NXS.drawer(def.title + (extra.projectName ? ` — ${extra.projectName}` : ''));
    try {
      const r = (await api(`/suite/owner/drilldown/${metric}${NXS.qs({ from: range.from, to: range.to, project_id: extra.project_id, overdue: extra.overdue })}`)).data;
      d.body.innerHTML = `<p class="sx-muted">${metric === 'outstanding' ? 'All live bookings with a balance (not limited to the period).' : `${esc(r.range.from)} to ${esc(r.range.to)}`}</p><div data-t></div>`;
      table(d.body.querySelector('[data-t]'), {
        rows: r.rows, exportTitle: `${def.title} ${metric === 'outstanding' ? '' : `${range.from} to ${range.to}`}`.trim(), columns: def.columns(),
        onRow: metric === 'leads' ? (can('leads.view.all') ? (x) => NXS.openLead(x.id) : null) : metric === 'collections' ? (NXS.openReceipt ? (x) => NXS.openReceipt(x.id) : null) : (NXS.openDeal && can('finance.view') ? (x) => NXS.openDeal(x.id) : null),
        empty: { title: 'Nothing in this period' }
      });
    } catch (e) { d.body.innerHTML = NXS.errorBox(e); }
  }

  NXS.page('owner-overview', {
    title: 'Business overview', label: 'Overview', icon: 'home', group: 'Business', order: 1, portals: ['owner'], cap: 'owner.dashboard',
    async render(el) {
      el.innerHTML = `<div class="sx-filters"><span data-range style="display:contents"></span><div class="sx-spacer"></div>${can('ai.use') ? `<button class="sx-btn" data-ai>${NXS.icon('spark')} Ask about the business</button>` : ''}</div><div data-body></div>`;
      const ai = el.querySelector('[data-ai]');
      if (ai) ai.addEventListener('click', () => NXS.openAssistant('Give me an executive summary of this month: revenue, collections, pipeline risks and what needs my attention.'));
      const body = el.querySelector('[data-body]');
      const load = async () => {
        const rc = NXS.rangeControl(range, (x) => { range = x; load(); });
        el.querySelector('[data-range]').innerHTML = rc.html;
        rc.bind(el.querySelector('[data-range]'));
        body.innerHTML = NXS.loading();
        const r = (await api(`/suite/owner/dashboard${NXS.qs({ from: range.from, to: range.to })}`)).data;
        const k = r.kpis;
        const dp = r.departments;
        const inv = r.inventory.byStatus;
        body.innerHTML = `
          ${r.alerts.length ? `<div class="sx-card" style="margin-bottom:16px"><div class="sx-card-head"><h3>Needs attention</h3></div><div class="sx-alerts">${r.alerts.map((a) => `<button class="sx-note ${ALERT_TONE[a.level] || ''}" data-link="${esc(a.link)}">${a.level === 'critical' ? '<strong>Critical · </strong>' : a.level === 'warning' ? '<strong>Warning · </strong>' : ''}${esc(a.title)} →</button>`).join('')}</div></div>` : '<div class="sx-note green" style="margin-bottom:16px">Nothing needs your attention right now.</div>'}
          <div class="sx-kpis">
            <button class="sx-kpi" data-drill="revenue"><div class="lbl">Booked revenue</div><div class="val">${money(k.revenue)}</div>${delta(k.revenueChangePct)}</button>
            <button class="sx-kpi" data-drill="bookings"><div class="lbl">Bookings</div><div class="val">${num(k.bookings)}</div>${delta(k.bookingsChangePct)}</button>
            <button class="sx-kpi" data-drill="collections"><div class="lbl">Collections (verified)</div><div class="val">${money(k.collections)}</div>${delta(k.collectionsChangePct)}</button>
            <button class="sx-kpi ${k.overdueAmount ? 'is-warn' : ''}" data-drill="outstanding"><div class="lbl">Outstanding</div><div class="val">${money(k.outstanding)}</div><div class="hint">${k.overdueAmount ? `${money(k.overdueAmount)} overdue` : 'nothing overdue'}</div></button>
            <button class="sx-kpi" data-drill="leads"><div class="lbl">New leads</div><div class="val">${num(k.leads)}</div>${delta(k.leadsChangePct)}</button>
            ${kpi('Lead → booking', `${k.conversionPct}%`, { hint: `${num(k.visits)} site visits completed` })}
            ${kpi('Marketing spend', money(k.marketingSpend), { hint: k.costPerBooking ? `${money(k.costPerBooking)} per booking` : 'recorded spend', go: can('marketing.view') ? 'mkt-overview' : '' })}
            ${kpi('Cancellations', num(k.cancellations), { tone: k.cancellations ? 'warn' : '' })}
          </div>
          <div class="sx-grid" style="margin-top:16px">
            <div class="sx-card"><div class="sx-card-head"><h3>Booked revenue vs collections — last 12 months</h3></div><div data-c="money"></div></div>
            <div class="sx-card"><div class="sx-card-head"><h3>Bookings per month</h3></div><div data-c="count"></div></div>
          </div>
          <h3 style="margin:20px 0 10px">Departments</h3>
          <div class="sx-dept">
            ${dept('Sales', 'sales-dashboard', [['Open leads', num(dp.sales.openLeads)], ['Overdue follow-ups', num(dp.sales.overdueFollowups), dp.sales.overdueFollowups ? 'warn' : ''], ['Never contacted', num(dp.sales.untouchedLeads), dp.sales.untouchedLeads ? 'warn' : ''], ['Visits done', num(dp.sales.visits)], ['Bookings', num(dp.sales.bookings)]])}
            ${dept('Finance', 'finance-overview', [['Collected', money(dp.finance.collections)], ['Awaiting verification', num(dp.finance.pendingVerification), dp.finance.pendingVerification ? 'warn' : ''], ['Overdue', money(dp.finance.overdueAmount), dp.finance.overdueAmount ? 'bad' : ''], ['Open refunds', num(dp.finance.openRefunds)]])}
            ${dept('Marketing', 'mkt-overview', [['Spend', money(dp.marketing.spend)], ['Active campaigns', num(dp.marketing.activeCampaigns)], ['Leads', num(dp.marketing.leads)], ['Cost per lead', dp.marketing.costPerLead ? money(dp.marketing.costPerLead) : '—']])}
            ${dept('Customer care', 'crm-overview', [['Open requests', num(dp.customerCare.openTickets)], ['Open complaints', num(dp.customerCare.openComplaints), dp.customerCare.openComplaints ? 'warn' : ''], ['Past SLA', num(dp.customerCare.slaBreached), dp.customerCare.slaBreached ? 'bad' : ''], ['Onboarding', num(dp.customerCare.onboarding)], ['Satisfaction', dp.customerCare.csat == null ? '—' : `${dp.customerCare.csat} / 5`]])}
            ${dept('Inventory', 'inv-overview', [['Available', num(dp.inventory.available)], ['Reserved', num(dp.inventory.reserved)], ['Booked', num(dp.inventory.booked)], ['Sold', num(dp.inventory.sold)], ['Unsold value', money(r.inventory.availableValue)]])}
            ${dept('Governance', 'approvals', [['Approvals pending', num(r.approvalsPending), r.approvalsPending ? 'warn' : ''], ['Open escalations', num(r.openEscalations), r.openEscalations ? 'warn' : '']], [['Audit trail', 'audit'], ['People', 'people']])}
          </div>
          <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Projects</h3><span class="sx-muted" style="font-size:.8rem">Bookings, revenue and leads are for the selected period; collected and outstanding are to date. Click a project for its bookings.</span></div><div data-p></div></div>
          <div class="sx-grid" style="margin-top:16px"><div class="sx-card"><div class="sx-card-head"><h3>Units by status</h3></div><div data-inv></div></div><div class="sx-card"><div class="sx-card-head"><h3>Leads per month</h3></div><div data-c="leads"></div></div></div>`;
        const months = r.trend.map((t) => t.month);
        charts.columns(body.querySelector('[data-c="money"]'), { labels: months, series: [{ name: 'Booked revenue', values: r.trend.map((t) => t.revenue) }, { name: 'Collections (verified)', values: r.trend.map((t) => t.collections) }], format: (v) => money(v) });
        charts.columns(body.querySelector('[data-c="count"]'), { labels: months, series: [{ name: 'Bookings', values: r.trend.map((t) => t.bookings) }], format: (v) => num(Math.round(v)), integer: true });
        charts.columns(body.querySelector('[data-c="leads"]'), { labels: months, series: [{ name: 'Leads', values: r.trend.map((t) => t.leads) }], format: (v) => num(Math.round(v)), integer: true });
        charts.hbars(body.querySelector('[data-inv]'), [['AVAILABLE', 'Available'], ['HOLD', 'Reserved'], ['BOOKED', 'Booked'], ['SOLD', 'Sold']].map(([s, l]) => ({ label: l, value: (inv[s] || {}).units || 0, sub: money((inv[s] || {}).value || 0) })), { format: num });
        table(body.querySelector('[data-p]'), {
          rows: r.projects, exportTitle: `Projects ${range.from} to ${range.to}`, onRow: (p) => drill('bookings', { project_id: p.id, projectName: p.name }),
          columns: [
            { key: 'name', label: 'Project', render: (p) => `<strong>${esc(p.name)}</strong><span class="sub">${esc(p.city || '')} · ${esc(label(p.status))}</span>` },
            { key: 'leads', label: 'Leads', num: true }, { key: 'bookings', label: 'Bookings', num: true },
            { key: 'revenue', label: 'Revenue', num: true, render: (p) => money(p.revenue) },
            { key: 'collected_total', label: 'Collected', num: true, render: (p) => money(p.collected_total) },
            { key: 'outstanding', label: 'Outstanding', num: true, render: (p) => money(p.outstanding) },
            { key: 'available', label: 'Unsold units', num: true, render: (p) => `${num(p.available)}<span class="sub">of ${num(p.units)}</span>` },
            { key: 'soldPct', label: 'Sold', num: true, render: (p) => `${p.soldPct}%` }
          ]
        });
        body.querySelectorAll('[data-drill]').forEach((b) => b.addEventListener('click', () => drill(b.dataset.drill)));
        body.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => NXS.go(b.dataset.link)));
        body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => NXS.go(b.dataset.open)));
      };
      await load();
    }
  });

  function delta(v) {
    if (v == null) return '<div class="hint">no earlier period to compare</div>';
    return `<span class="sx-delta ${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}% vs previous period</span>`;
  }
  function dept(title, home, rows, links = []) {
    return `<div class="sx-card sx-dept-card"><div class="sx-card-head"><h3>${esc(title)}</h3><div class="sx-spacer"></div><button class="sx-btn sm" data-open="${esc(home)}">Open</button></div>
      <dl class="sx-kv">${rows.map(([l, v, tone]) => `<dt>${esc(l)}</dt><dd class="${tone ? `is-${tone}` : ''}">${v}</dd>`).join('')}</dl>
      ${links.length ? `<div class="sx-row" style="margin-top:8px">${links.map(([l, v]) => `<button class="sx-btn sm" data-open="${esc(v)}">${esc(l)}</button>`).join('')}</div>` : ''}</div>`;
  }

  NXS.page('owner-employees', {
    title: 'People & activity', label: 'People & activity', icon: 'users', group: 'Business', order: 2, portals: ['owner'], cap: 'owner.dashboard',
    async render(el) {
      const r = (await api('/suite/owner/employees')).data;
      const active = r.byRole.reduce((a, x) => a + x.active, 0);
      const week = r.byRole.reduce((a, x) => a + x.activeThisWeek, 0);
      el.innerHTML = `<div class="sx-kpis">${kpi('Active accounts', num(active))}${kpi('Signed in this week', num(week), { hint: active ? `${Math.round((week / active) * 100)}% of active accounts` : '' })}${kpi('Deactivated', num(r.byRole.reduce((a, x) => a + x.inactive, 0)))}</div>
        <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>By role</h3>${can('users.manage') ? '<div class="sx-spacer"></div><button class="sx-btn sm" data-go="people">Manage users</button>' : ''}</div><div data-roles></div></div>
        <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Everyone</h3><span class="sx-muted" style="font-size:.8rem">Actions = recorded changes in the audit trail in the last 7 days.</span></div><div data-people></div></div>`;
      table(el.querySelector('[data-roles]'), { rows: r.byRole, exportTitle: 'Accounts by role', columns: [{ key: 'department', label: 'Department' }, { key: 'label', label: 'Role' }, { key: 'active', label: 'Active', num: true }, { key: 'heads', label: 'Heads', num: true }, { key: 'activeThisWeek', label: 'Signed in this week', num: true }, { key: 'inactive', label: 'Deactivated', num: true }] });
      table(el.querySelector('[data-people]'), {
        rows: r.people, exportTitle: 'People and activity', pageSize: 100,
        columns: [
          { key: 'name', label: 'Name', render: (p) => `<strong>${esc(p.name)}</strong>${p.job_level === 'HEAD' ? ' <span class="sx-muted">· head</span>' : ''}` },
          { key: 'department', label: 'Department' }, { key: 'roleLabel', label: 'Role' },
          { key: 'last_login', label: 'Last sign-in', render: (p) => (p.last_login ? ago(p.last_login) : 'never'), text: (p) => p.last_login || '' },
          { key: 'actions_week', label: 'Actions (7 days)', num: true },
          { key: 'is_available', label: 'Available', render: (p) => (p.is_available ? 'Yes' : 'No') }
        ]
      });
    }
  });
})();
