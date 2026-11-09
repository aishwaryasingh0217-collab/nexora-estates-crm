/* Business Suite — shared pages: approvals, escalations, audit history, people, workflow rules. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, money, label, toast, table, formDialog, can } = NXS;

  // ------------------------------------------------------------------ approvals
  NXS.page('approvals', {
    title: 'Approval centre', label: 'Approvals', icon: 'check', group: 'Control', order: 80,
    portals: ['owner', 'sales-head', 'sales-manager', 'finance'], cap: ['approvals.view', 'finance.refund.request'],
    async render(el) {
      let status = 'PENDING';
      el.innerHTML = `<div class="sx-filters"><div class="sx-seg" data-s>${['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => `<button data-v="${s}" class="${s === status ? 'is-on' : ''}">${label(s)}</button>`).join('')}</div></div><div class="sx-card" data-list></div>`;
      const list = el.querySelector('[data-list]');
      const t = table(list, {
        exportTitle: 'Approvals',
        columns: [
          { key: 'request_type', label: 'Type', render: (r) => chip(r.request_type, label(r.request_type)) },
          { key: 'title', label: 'Request', render: (r) => `<strong>${esc(r.title)}</strong><span class="sub">${esc(r.details || '')}</span>` },
          { key: 'amount', label: 'Amount', num: true, render: (r) => (r.amount ? money(r.amount, false) : '—') },
          { key: 'requested_by_name', label: 'Asked by', render: (r) => `${esc(r.requested_by_name)}<span class="sub">${ago(r.created_at)}</span>` },
          { key: 'status', label: 'Status', render: (r) => `${chip(r.status)}${r.decided_by_name ? `<span class="sub">${esc(r.decided_by_name)}${r.decision_note ? `: ${esc(r.decision_note)}` : ''}</span>` : ''}` },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (r.can_decide ? `<div class="sx-row"><button class="sx-btn sm good" data-ok="${r.id}">Approve</button><button class="sx-btn sm danger" data-no="${r.id}">Reject</button></div>` : r.status === 'PENDING' && r.requested_by === NXS.state.me.id ? '<span class="sx-muted">Your request</span>' : '') }
        ],
        empty: { title: 'Nothing waiting', text: 'Bookings, refunds and visits that need a second person’s yes appear here.' },
        afterDraw: (root) => {
          root.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.ok, 'APPROVE')));
          root.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.no, 'REJECT')));
        }
      });
      async function load() { t.update((await api(`/suite/approvals?status=${status}`)).data); }
      async function decide(id, decision) {
        formDialog({
          title: decision === 'APPROVE' ? 'Approve request' : 'Reject request', submit: decision === 'APPROVE' ? 'Approve' : 'Reject', danger: decision !== 'APPROVE',
          sub: decision === 'APPROVE' ? 'This runs the action straight away (e.g. the booking is confirmed and the unit marked booked).' : 'The requester is told your reason.',
          fields: [{ name: 'note', label: decision === 'APPROVE' ? 'Note (optional)' : 'Reason', type: 'textarea', required: decision !== 'APPROVE' }],
          onSubmit: async (v) => { const r = await api(`/suite/approvals/${id}/decide`, { body: { decision, note: v.note } }); load(); return r.message; }
        });
      }
      el.querySelectorAll('[data-s] [data-v]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.v; el.querySelectorAll('[data-s] button').forEach((x) => x.classList.toggle('is-on', x === b)); load(); }));
      await load();
    }
  });

  // ------------------------------------------------------------------ escalations
  NXS.page('escalations', {
    title: 'Escalations', label: 'Escalations', icon: 'alert', group: 'Control', order: 81,
    portals: ['owner', 'sales-head', 'sales-manager', 'finance', 'crm'],
    async render(el) {
      let status = 'OPEN';
      el.innerHTML = `<div class="sx-filters"><div class="sx-seg" data-s>${['OPEN', 'RESOLVED', 'ALL'].map((s) => `<button data-v="${s}" class="${s === status ? 'is-on' : ''}">${label(s)}</button>`).join('')}</div><div class="sx-spacer"></div><button class="sx-btn primary" data-new>Raise escalation</button></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Escalations',
        columns: [
          { key: 'severity', label: 'Severity', render: (r) => chip(r.severity) },
          { key: 'title', label: 'Issue', render: (r) => `<strong>${esc(r.title)}</strong><span class="sub">${esc(r.reason || '')}</span>${r.lead_id ? `<button class="sx-link" data-lead="${r.lead_id}">Open lead</button>` : ''}` },
          { key: 'escalated_to_role', label: 'For', render: (r) => esc(label(r.escalated_to_role)) },
          { key: 'raised_by_name', label: 'Raised by', render: (r) => `${esc(r.raised_by_name || '')}<span class="sub">${ago(r.created_at)}</span>` },
          { key: 'status', label: 'Status', render: (r) => `${chip(r.status)}${r.resolution ? `<span class="sub">${esc(r.resolution)}</span>` : ''}` },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (r.status !== 'RESOLVED' ? `<div class="sx-row">${r.status === 'OPEN' ? `<button class="sx-btn sm" data-ack="${r.id}">Acknowledge</button>` : ''}<button class="sx-btn sm good" data-res="${r.id}">Resolve</button></div>` : '') }
        ],
        empty: { title: 'No escalations', text: 'Overdue follow-ups, untouched leads and visits nobody updated are escalated here automatically.' },
        afterDraw: (root) => {
          root.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => NXS.openLead(b.dataset.lead)));
          root.querySelectorAll('[data-ack]').forEach((b) => b.addEventListener('click', async () => { try { toast((await api(`/suite/escalations/${b.dataset.ack}`, { method: 'PATCH', body: { action: 'acknowledge' } })).message); load(); } catch (e) { toast(e.message, 'err'); } }));
          root.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Resolve escalation', submit: 'Resolve', fields: [{ name: 'note', label: 'How was it resolved?', type: 'textarea', required: true }], onSubmit: async (v) => { const r = await api(`/suite/escalations/${b.dataset.res}`, { method: 'PATCH', body: { action: 'resolve', note: v.note } }); load(); return r.message; } })));
        }
      });
      async function load() { t.update((await api(`/suite/escalations?status=${status}`)).data); }
      el.querySelectorAll('[data-s] [data-v]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.v; el.querySelectorAll('[data-s] button').forEach((x) => x.classList.toggle('is-on', x === b)); load(); }));
      el.querySelector('[data-new]').addEventListener('click', () => formDialog({
        title: 'Raise an escalation', submit: 'Raise',
        fields: [{ name: 'title', label: 'What needs attention?', required: true }, { name: 'reason', label: 'Details', type: 'textarea' },
          [{ name: 'severity', label: 'Severity', type: 'select', value: 'MEDIUM', options: [['LOW', 'Low'], ['MEDIUM', 'Medium'], ['HIGH', 'High'], ['CRITICAL', 'Critical']] }, { name: 'to_role', label: 'Send to', type: 'select', options: [['ADMIN', 'Sales managers'], ['SUPER_ADMIN', 'Sales head'], ['BUSINESS_OWNER', 'Business owner'], ['FINANCE', 'Finance'], ['CUSTOMER_RELATIONS', 'Customer care']] }]],
        onSubmit: async (v) => { const r = await api('/suite/escalations', { body: v }); load(); return r.message; }
      }));
      await load();
    }
  });

  // ------------------------------------------------------------------ audit history
  NXS.page('audit', {
    title: 'Activity & audit history', label: 'Audit history', icon: 'shield', group: 'Control', order: 90,
    portals: ['owner', 'sales-head', 'sales-manager', 'finance', 'inventory', 'marketing', 'crm'],
    async render(el, params) {
      const f = { q: params.q || '', source: '', result: '', entity_type: params.entity_type || '', entity_id: params.entity_id || '', from: '', to: '', offset: 0 };
      el.innerHTML = `
        <div class="sx-note" data-scope></div>
        <div class="sx-filters" style="margin-top:12px">
          <input type="search" placeholder="Search summary or person" data-f="q" value="${esc(f.q)}">
          <select data-f="source"><option value="">Any source</option><option>HUMAN</option><option>AI</option><option>SYSTEM</option><option>INTEGRATION</option></select>
          <select data-f="result"><option value="">Any result</option><option>SUCCESS</option><option>FAILED</option><option>PENDING</option></select>
          <select data-f="entity_type"><option value="">Any record</option>${['LEAD', 'DEAL', 'PAYMENT', 'REFUND', 'SITE_VISIT', 'UNIT', 'PROJECT', 'CUSTOMER', 'TICKET', 'CAMPAIGN', 'USER', 'CALL', 'APPROVAL', 'ESCALATION', 'SETTINGS', 'AI'].map((x) => `<option ${x === f.entity_type ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <input type="date" data-f="from" aria-label="From"><input type="date" data-f="to" aria-label="To">
          ${can('audit.view.all') ? '<button class="sx-btn" data-verify>Check integrity</button>' : ''}
        </div>
        <div class="sx-card" data-list></div>
        <div class="sx-row" style="margin-top:10px;justify-content:flex-end"><button class="sx-btn sm" data-prev>Newer</button><button class="sx-btn sm" data-next>Older</button></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Audit history', pageSize: 100,
        columns: [
          { key: 'created_at', label: 'When', render: (r) => `<span class="sx-nowrap">${when(r.created_at)}</span>`, text: (r) => new Date(r.created_at).toLocaleString('en-IN') },
          { key: 'actor_name', label: 'Who', render: (r) => `${esc(r.actor_name || 'System')}<span class="sub">${esc(label(r.actor_role || ''))}</span>` },
          { key: 'action', label: 'Action', render: (r) => `<strong>${esc(label(r.action))}</strong><span class="sub">${esc(r.entity_type || '')}${r.entity_id ? ` · ${esc(String(r.entity_id).slice(0, 8))}` : ''}</span>` },
          { key: 'summary', label: 'Details', render: (r) => `${esc(r.summary || '')}${r.after_data && typeof r.after_data === 'object' && r.before_data && typeof r.before_data === 'object' ? `<span class="sub">${esc(Object.keys(r.after_data).slice(0, 6).map((k) => `${label(k)}: ${JSON.stringify(r.before_data[k] ?? null)} → ${JSON.stringify(r.after_data[k] ?? null)}`).join(' · '))}</span>` : ''}` },
          { key: 'source', label: 'Source', render: (r) => chip(r.source === 'AI' ? 'VIOLET' : r.source === 'HUMAN' ? 'NEW' : '', label(r.source)) },
          { key: 'result', label: 'Result', render: (r) => chip(r.result) }
        ],
        empty: { title: 'No events match', text: 'Every important action across the portals is recorded here and cannot be edited or deleted.' }
      });
      async function load() {
        const r = (await api(`/suite/audit${NXS.qs({ ...f, limit: 100 })}`)).data;
        el.querySelector('[data-scope]').textContent = r.scope === 'all' ? `Showing every portal’s activity (${NXS.num(r.total)} events). History is append-only.` : r.scope === 'department' ? `Showing your department’s activity (${NXS.num(r.total)} events). History is append-only.` : `Showing your own activity (${NXS.num(r.total)} events).`;
        t.update(r.rows);
        el.querySelector('[data-prev]').disabled = f.offset === 0;
        el.querySelector('[data-next]').disabled = f.offset + 100 >= r.total;
      }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.tagName === 'INPUT' && i.type === 'search' ? 'input' : 'change', () => { f[i.dataset.f] = i.value; f.offset = 0; clearTimeout(i._t); i._t = setTimeout(load, 300); }));
      el.querySelector('[data-prev]').addEventListener('click', () => { f.offset = Math.max(f.offset - 100, 0); load(); });
      el.querySelector('[data-next]').addEventListener('click', () => { f.offset += 100; load(); });
      const v = el.querySelector('[data-verify]');
      if (v) v.addEventListener('click', async () => { try { const r = await api('/suite/audit/verify'); toast(r.message, r.data.ok ? 'ok' : 'err'); } catch (e) { toast(e.message, 'err'); } });
      await load();
    }
  });

  // ------------------------------------------------------------------ people (users, roles, sessions)
  NXS.page('people', {
    title: 'People & access', label: 'People & access', icon: 'users', group: 'Control', order: 92,
    portals: ['owner', 'sales-head'], cap: 'users.manage',
    async render(el) {
      el.innerHTML = `<div class="sx-filters"><input type="search" placeholder="Search name or username" data-q><select data-role><option value="">All roles</option></select><select data-status><option value="">Active & inactive</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><div class="sx-spacer"></div><button class="sx-btn primary" data-new>Add person</button></div><div class="sx-card" data-list></div>`;
      let meta = { roles: [] };
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'People',
        columns: [
          { key: 'name', label: 'Person', render: (r) => `<strong>${esc(r.name)}</strong>${NXS.testChip(r)}<span class="sub">${esc(r.username)} · ${esc(r.email || '')}</span>` },
          { key: 'roleLabel', label: 'Role', render: (r) => `${esc(r.roleLabel)}${r.job_level === 'HEAD' ? ' · head' : ''}<span class="sub">${esc(r.firm_name || (r.manager_name ? `Reports to ${r.manager_name}` : ''))}</span>` },
          { key: 'status', label: 'Status', render: (r) => chip(r.status) },
          { key: 'last_login', label: 'Last sign-in', render: (r) => ago(r.last_login) },
          { key: 'active_sessions', label: 'Devices', num: true },
          { key: 'open_leads', label: 'Open leads', num: true },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => `<button class="sx-btn sm" data-manage="${r.id}">Manage</button>` }
        ],
        afterDraw: (root) => root.querySelectorAll('[data-manage]').forEach((b) => b.addEventListener('click', () => manage(rows.find((x) => x.id === b.dataset.manage))))
      });
      let rows = [];
      const q = { q: '', role: '', status: '' };
      async function load() {
        const r = (await api(`/suite/users${NXS.qs(q)}`)).data;
        meta = r;
        rows = r.rows;
        const sel = el.querySelector('[data-role]');
        if (sel.options.length === 1) r.roles.forEach((x) => sel.add(new Option(x.label, x.role)));
        t.update(rows);
      }
      el.querySelector('[data-q]').addEventListener('input', (e) => { q.q = e.target.value; clearTimeout(e.target._t); e.target._t = setTimeout(load, 300); });
      el.querySelector('[data-role]').addEventListener('change', (e) => { q.role = e.target.value; load(); });
      el.querySelector('[data-status]').addEventListener('change', (e) => { q.status = e.target.value; load(); });
      el.querySelector('[data-new]').addEventListener('click', async () => {
        const firms = (await api('/suite/partner-firms')).data;
        const managers = rows.filter((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r.role) && r.status === 'ACTIVE');
        formDialog({
          title: 'Add a person', submit: 'Create account', sub: 'They get a temporary password to change after signing in.',
          fields: [
            [{ name: 'first_name', label: 'First name', required: true }, { name: 'last_name', label: 'Last name' }],
            [{ name: 'username', label: 'Username', required: true, hint: 'Letters, numbers, dots' }, { name: 'email', label: 'Email' }],
            [{ name: 'phone', label: 'Mobile (used for click-to-call)' }, { name: 'role', label: 'Role', type: 'select', required: true, options: [['', 'Choose…'], ...meta.roles.filter((x) => x.assignable).map((x) => [x.role, x.label])] }],
            [{ name: 'job_level', label: 'Level', type: 'select', options: [['EXECUTIVE', 'Executive'], ['HEAD', 'Head / manager']] }, { name: 'manager_id', label: 'Reports to (sales)', type: 'select', options: [['', '—'], ...managers.map((m) => [m.id, m.name])] }],
            { name: 'channel_partner_id', label: 'Partner firm (channel partner logins only)', type: 'select', options: [['', '—'], ...firms.map((x) => [x.id, x.firm_name])] }
          ],
          onSubmit: async (v) => {
            const r = await api('/suite/users', { body: v });
            load();
            if (r.data.temporaryPassword) NXS.modal(`<h2>Account created</h2><p class="sx-sub">Share these securely — the password is shown only once.</p><dl class="sx-kv"><dt>Username</dt><dd><strong>${esc(r.data.username)}</strong></dd><dt>Temporary password</dt><dd><strong>${esc(r.data.temporaryPassword)}</strong></dd></dl><div class="sx-actions"><button class="sx-btn primary" data-close>Done</button></div>`);
            return r.message;
          }
        });
      });
      function manage(u) {
        const d = NXS.drawer(u.name, { narrow: true });
        d.body.innerHTML = `<div class="sx-card"><dl class="sx-kv"><dt>Role</dt><dd>${esc(u.roleLabel)}${u.job_level === 'HEAD' ? ' (head)' : ''}</dd><dt>Status</dt><dd>${chip(u.status)}</dd><dt>Username</dt><dd>${esc(u.username)}</dd><dt>Phone</dt><dd>${esc(u.phone || '—')}</dd><dt>Last sign-in</dt><dd>${when(u.last_login)}</dd><dt>Signed-in devices</dt><dd>${u.active_sessions}</dd><dt>Open leads</dt><dd>${u.open_leads}</dd></dl></div>
          <div class="sx-stack">
            <button class="sx-btn" data-x="edit">Edit details</button>
            <button class="sx-btn" data-x="role">Change role</button>
            <button class="sx-btn" data-x="reset">Reset password</button>
            <button class="sx-btn" data-x="sessions">Sign out of all devices</button>
            <button class="sx-btn ${u.status === 'ACTIVE' ? 'danger' : 'good'}" data-x="status">${u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
            <button class="sx-btn" data-x="audit">View their activity</button>
          </div>`;
        d.body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async () => {
          const x = b.dataset.x;
          try {
            if (x === 'edit') return formDialog({ title: `Edit ${u.name}`, submit: 'Save', fields: [[{ name: 'first_name', label: 'First name', value: u.first_name, required: true }, { name: 'last_name', label: 'Last name', value: u.last_name }], [{ name: 'phone', label: 'Mobile', value: u.phone }, { name: 'email', label: 'Email', value: u.email }], { name: 'job_level', label: 'Level', type: 'select', value: u.job_level, options: [['EXECUTIVE', 'Executive'], ['HEAD', 'Head / manager']] }], onSubmit: async (v) => { const r = await api(`/suite/users/${u.id}`, { method: 'PATCH', body: v }); d.close(); load(); return r.message; } });
            if (x === 'role') return formDialog({ title: `Change ${u.name}'s role`, sub: 'They are signed out everywhere and get the new role’s permissions when they sign in again.', submit: 'Change role', fields: [{ name: 'role', label: 'New role', type: 'select', required: true, options: [['', 'Choose…'], ...meta.roles.filter((r) => r.assignable && r.role !== u.role).map((r) => [r.role, r.label])] }, { name: 'reason', label: 'Reason (kept in the audit history)', type: 'textarea', required: true }], onSubmit: async (v) => { const r = await api(`/suite/users/${u.id}/role`, { body: v }); d.close(); load(); return r.message; } });
            if (x === 'reset') { if (!(await NXS.confirm(`Reset ${u.name}'s password?`, 'They are signed out everywhere and get a temporary password.'))) return null; const r = await api(`/suite/users/${u.id}/reset-password`, { method: 'POST', body: {} }); NXS.modal(`<h2>Temporary password</h2><p class="sx-sub">Shown only once.</p><p><strong>${esc(r.data.temporaryPassword)}</strong></p><div class="sx-actions"><button class="sx-btn primary" data-close>Done</button></div>`); return null; }
            if (x === 'sessions') { toast((await api(`/suite/users/${u.id}/sessions/revoke`, { method: 'POST', body: {} })).message); return null; }
            if (x === 'status') { if (!(await NXS.confirm(u.status === 'ACTIVE' ? `Deactivate ${u.name}?` : `Activate ${u.name}?`, u.status === 'ACTIVE' ? 'They are signed out at once and can’t sign in again until reactivated.' : '', { danger: u.status === 'ACTIVE' }))) return null; const r = await api(`/suite/users/${u.id}/status`, { body: { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }); toast(r.message); d.close(); load(); return null; }
            if (x === 'audit') { d.close(); NXS.go('audit', { q: u.name }); }
          } catch (e) { toast(e.message, 'err'); }
          return null;
        }));
      }
      await load();
    }
  });

  // ------------------------------------------------------------------ workflow rules
  NXS.page('settings', {
    title: 'Workflow rules', label: 'Workflow rules', icon: 'gear', group: 'Control', order: 95,
    portals: ['owner', 'sales-head'], cap: 'settings.manage',
    async render(el) {
      const rules = (await api('/suite/settings/workflow')).data;
      const tel = (await api('/suite/telephony/status')).data;
      const ai = (await api('/suite/ai/status')).data;
      el.innerHTML = `<div class="sx-grid">
        <div class="sx-card"><div class="sx-card-head"><h2>Approvals, reservations and alerts</h2></div>
          <form class="sx-form" data-rules>${rules.map((r) => `<label class="sx-field"><span>${esc(r.label)}</span>${r.options ? `<select name="${r.key}">${r.options.map((o) => `<option value="${o}" ${String(r.value) === o ? 'selected' : ''}>${esc(o === '0' ? 'No' : o === '1' ? 'Yes' : label(o))}</option>`).join('')}</select>` : `<input type="number" name="${r.key}" value="${esc(r.value)}" min="${r.min}" max="${r.max}">`}</label>`).join('')}
          <div class="sx-actions"><button class="sx-btn primary">Save rules</button></div></form></div>
        <div class="sx-card"><div class="sx-card-head"><h2>Integrations</h2></div>
          <dl class="sx-kv"><dt>Cloud calling</dt><dd>${tel.ready ? `${chip('ACTIVE', 'Connected')} ${esc(label(tel.provider))} · caller ID ${esc(tel.callerId || '')}${tel.recording ? ' · recording on' : ''}` : `${chip('PENDING', 'Not set up')}<span class="sub">Missing: ${esc((tel.missing || []).join(', '))}</span>`}</dd>
          ${tel.webhooks ? `<dt>Give the provider</dt><dd><span class="sub">Status callback: ${esc(tel.webhooks.status)}</span><span class="sub">Incoming calls (Passthru): ${esc(tel.webhooks.incoming)}</span></dd>` : ''}
          <dt>AI assistant</dt><dd>${ai.configured ? `${chip('ACTIVE', 'Connected')} ${esc(ai.model)}` : `${chip('PENDING', 'Not set up')}<span class="sub">Add ANTHROPIC_API_KEY on the server</span>`}</dd></dl>
          <p class="sx-muted" style="margin-top:10px;font-size:.84rem">Credentials are server settings and are never shown here.</p></div></div>`;
      el.querySelector('[data-rules]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        try { toast((await api('/suite/settings/workflow', { method: 'PUT', body })).message); } catch (ex) { toast(ex.message, 'err'); }
      });
    }
  });
})();
