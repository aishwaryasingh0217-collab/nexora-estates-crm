/* Business Suite — Customer relationship portal: onboarding, documents, service requests, complaints,
   communication history and possession updates for booked customers. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, money, num, label, toast, table, formDialog, kpi, can, charts } = NXS;
  const CRM = ['crm'];
  const TICKET_PORTALS = ['crm', 'sales-head', 'sales-manager', 'finance'];
  let opts = null;
  const options = async () => opts || (opts = (await api('/suite/crm/options')).data);
  const isHead = () => NXS.state.me && (NXS.state.me.jobLevel === 'HEAD' || NXS.state.me.role === 'BUSINESS_OWNER');
  const DOC_TONE = { PENDING: 'AMBER', SUBMITTED: 'BLUE', VERIFIED: 'GREEN', REJECTED: 'RED' };

  async function teamOptions() {
    try { return (await api('/suite/crm/team')).data.map((u) => [u.id, `${u.name}${u.job_level === 'HEAD' ? ' (head)' : ''} · ${u.customers} customers`]); } catch (e) { return []; }
  }

  // ------------------------------------------------------------------ overview
  NXS.page('crm-overview', {
    title: 'Customer relationship', label: 'Overview', icon: 'heart', group: 'Customers', order: 1, portals: CRM, cap: 'crm.view',
    async render(el) {
      const s = (await api('/suite/crm/summary')).data;
      el.innerHTML = `
        ${s.scope === 'mine' ? '<div class="sx-note" style="margin-bottom:12px">Showing the customers assigned to you.</div>' : ''}
        <div class="sx-kpis">
          ${kpi('Booked customers', num(s.customers), { go: 'crm-customers' })}
          ${kpi('Onboarding', num(s.onboarding), { go: 'crm-customers?onboarding=IN_PROGRESS', tone: s.onboarding ? 'warn' : '' })}
          ${kpi('Documents to collect / verify', num(s.documentsPending), { tone: s.documentsPending ? 'warn' : '' })}
          ${kpi('Open requests', num(s.openTickets), { go: 'crm-tickets' })}
          ${kpi('Open complaints', num(s.openComplaints), { go: 'crm-tickets?category=COMPLAINT', tone: s.openComplaints ? 'bad' : '' })}
          ${kpi('Past SLA', num(s.slaBreached), { go: 'crm-tickets?overdue=1', tone: s.slaBreached ? 'bad' : 'good' })}
          ${kpi('Average rating', s.avgRating == null ? '—' : `${s.avgRating} / 5`, { hint: 'from resolved requests' })}
          ${kpi('Average resolution', s.avgResolutionHours == null ? '—' : s.avgResolutionHours < 1 ? 'under 1 h' : `${s.avgResolutionHours} h`, { hint: 'last 90 days' })}
        </div>
        <div class="sx-grid" style="margin-top:16px">
          <div class="sx-card"><div class="sx-card-head"><h3>Open requests by category</h3></div><div data-c></div></div>
          <div class="sx-card"><div class="sx-card-head"><h3>Team workload</h3></div><div data-team></div></div>
        </div>`;
      const cats = Object.entries(s.openByCategory).sort((a, b) => b[1] - a[1]);
      if (cats.length) charts.hbars(el.querySelector('[data-c]'), cats.map(([k, v]) => ({ label: label(k), value: v, key: k })), { format: num, onClick: (r) => NXS.go('crm-tickets', { category: r.key }) });
      else el.querySelector('[data-c]').innerHTML = '<div class="sx-empty"><h3>No open requests</h3></div>';
      const tm = (await api('/suite/crm/team')).data;
      table(el.querySelector('[data-team]'), { rows: tm, columns: [{ key: 'name', label: 'Member', render: (u) => `${esc(u.name)}${u.job_level === 'HEAD' ? ' <span class="sx-muted">· head</span>' : ''}` }, { key: 'customers', label: 'Customers', num: true }, { key: 'open_tickets', label: 'Open requests', num: true }], empty: { title: 'No customer relationship staff yet' } });
    }
  });

  // ------------------------------------------------------------------ customers
  NXS.page('crm-customers', {
    title: 'Customers', label: 'Customers', icon: 'users', group: 'Customers', order: 2, portals: CRM, cap: 'crm.view',
    async render(el, params) {
      const f = { onboarding: params.onboarding || '', rm_id: '', q: '' };
      const team = isHead() ? await teamOptions() : [];
      el.innerHTML = `<div class="sx-filters"><input type="search" placeholder="Name, phone or email" data-f="q"><select data-f="onboarding"><option value="">Any onboarding</option>${['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].map((s) => `<option value="${s}" ${s === f.onboarding ? 'selected' : ''}>${label(s)}</option>`).join('')}</select>${team.length ? `<select data-f="rm_id"><option value="">Any relationship manager</option>${team.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select>` : ''}</div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Customers', onRow: (c) => openCustomer(c.id, load),
        columns: [
          { key: 'name', label: 'Customer', render: (c) => `<strong>${esc(c.name)}</strong>${NXS.testChip(c)}<span class="sub">${esc(c.phone || '')}${c.email ? ` · ${esc(c.email)}` : ''}</span>` },
          { key: 'units', label: 'Units', render: (c) => esc(c.units || '—') },
          { key: 'onboarding_status', label: 'Onboarding', render: (c) => chip(c.onboarding_status === 'COMPLETED' ? 'GREEN' : c.onboarding_status === 'IN_PROGRESS' ? 'AMBER' : '', label(c.onboarding_status || 'NOT_STARTED')) },
          { key: 'kyc_status', label: 'KYC', render: (c) => chip(c.kyc_status === 'VERIFIED' ? 'GREEN' : c.kyc_status === 'REJECTED' ? 'RED' : 'AMBER', label(c.kyc_status || 'PENDING')) },
          { key: 'documents_open', label: 'Docs open', num: true },
          { key: 'tickets_open', label: 'Requests open', num: true },
          { key: 'paid', label: 'Paid (verified)', num: true, render: (c) => `${money(c.paid)}<span class="sub">of ${money(c.booked_value)}</span>` },
          { key: 'rm_name', label: 'Relationship manager', render: (c) => esc(c.rm_name || 'Unassigned') },
          { key: 'last_contact_at', label: 'Last contact', render: (c) => (c.last_contact_at ? ago(c.last_contact_at) : '—'), text: (c) => c.last_contact_at || '' }
        ],
        empty: { title: 'No booked customers yet', text: 'Customers appear here when a booking is approved.' }
      });
      async function load() { t.update((await api(`/suite/crm/customers${NXS.qs(f)}`)).data); }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.type === 'search' ? 'input' : 'change', () => { f[i.dataset.f] = i.value; clearTimeout(i._t); i._t = setTimeout(load, 250); }));
      await load();
      if (params.id) openCustomer(params.id, load);
    }
  });

  async function openCustomer(id, afterChange) {
    const d = NXS.drawer('Customer');
    let tab = 'documents';
    const changed = () => { if (afterChange) afterChange(); };
    const draw = async () => {
      const r = (await api(`/suite/crm/customers/${id}`)).data;
      const c = r.customer;
      const o = await options();
      const manage = can('crm.manage');
      d.setTitle(c.name);
      const openDocs = r.documents.filter((x) => x.status !== 'VERIFIED' && x.doc_type !== 'LOAN_SANCTION').length;
      d.body.innerHTML = `
        <div class="sx-row">${chip(c.onboarding_status === 'COMPLETED' ? 'GREEN' : 'AMBER', `Onboarding: ${label(c.onboarding_status || 'NOT_STARTED')}`)}${chip(c.kyc_status === 'VERIFIED' ? 'GREEN' : 'AMBER', `KYC ${label(c.kyc_status || 'PENDING')}`)}${NXS.testChip(c)}<div class="sx-spacer"></div>
          ${NXS.callButton('data-call')}
          ${manage ? '<button class="sx-btn sm" data-x="log">Log contact</button>' : ''}
          ${can('crm.ticket.create') ? '<button class="sx-btn sm" data-x="ticket">New request</button>' : ''}
          ${manage ? '<button class="sx-btn sm" data-x="edit">Edit</button>' : ''}
        </div>
        <div class="sx-card"><dl class="sx-kv">
          <dt>Phone</dt><dd>${esc(c.phone || '—')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd>
          <dt>Address</dt><dd>${esc([c.address_line1, c.city, c.state, c.pincode].filter(Boolean).join(', ') || '—')}</dd>
          <dt>PAN / tax id</dt><dd>${esc(c.pan_tax_id || '—')}</dd>
          <dt>Relationship manager</dt><dd>${esc(c.rm_name || 'Unassigned')} ${manage && isHead() ? '<button class="sx-btn sm" data-x="rm">Change</button>' : ''}</dd>
          <dt>Sales rep</dt><dd>${esc(c.sales_rep_name || '—')}</dd>
          <dt>Onboarded</dt><dd>${c.onboarded_at ? when(c.onboarded_at, { dateOnly: true }) : '—'}</dd>
        </dl>
        ${manage && c.onboarding_status !== 'COMPLETED' ? `<div class="sx-row" style="margin-top:10px">${openDocs ? `<span class="sx-muted">${openDocs} required document${openDocs === 1 ? '' : 's'} still to verify before onboarding can be completed.</span>` : '<span class="sx-muted">All required documents are verified.</span>'}<div class="sx-spacer"></div><button class="sx-btn sm primary" data-x="onboard" ${openDocs ? 'disabled' : ''}>Mark onboarding complete</button></div>` : ''}</div>
        <div class="sx-card"><div class="sx-card-head"><h3>Bookings</h3></div>${r.bookings.length ? `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Booking</th><th>Unit</th><th class="num">Value</th><th class="num">Paid (verified)</th><th class="num">Awaiting verification</th><th>Next due</th>${can('finance.refund.request') ? '<th></th>' : ''}</tr></thead><tbody>${r.bookings.map((b) => `<tr><td>${esc(b.deal_number)} ${chip(b.status)}</td><td>${esc(b.project_name)} · ${esc(b.unit_number)}<span class="sub">possession ${esc(b.possession_date || '—')}</span></td><td class="num">${money(b.agreed_total_amount)}</td><td class="num">${money(b.paid)}</td><td class="num">${b.pending_verification ? money(b.pending_verification) : '—'}</td><td>${b.next_due ? when(b.next_due, { dateOnly: true }) : '—'}</td>${can('finance.refund.request') ? `<td>${b.paid > 0 ? `<button class="sx-btn sm" data-refund="${b.id}">Request refund</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="sx-muted">No bookings.</p>'}</div>
        <div class="sx-tabs">${[['documents', `Documents (${r.documents.length})`], ['tickets', `Requests (${r.tickets.length})`], ['comms', `Communication (${r.communications.length})`], ['possession', `Possession (${r.possession.length})`], ['calls', `Calls (${r.calls.length})`]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
        <div data-pane></div>`;
      const pane = d.body.querySelector('[data-pane]');
      const panes = {
        documents: () => {
          pane.innerHTML = r.documents.length ? `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Document</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>${r.documents.map((x) => `<tr><td>${esc(x.title)}${x.doc_type === 'LOAN_SANCTION' ? '<span class="sub">optional</span>' : ''}</td><td>${chip(DOC_TONE[x.status], label(x.status))}</td><td>${esc(x.notes || '')}<span class="sub">${when(x.updated_at)}</span></td><td style="white-space:nowrap">${x.file_url ? `<button class="sx-btn sm" data-open="${esc(x.file_url)}">Open</button>` : ''}${manage ? `<button class="sx-btn sm" data-up="${x.id}">${x.file_url ? 'Replace' : 'Upload'}</button>${x.status !== 'VERIFIED' ? `<button class="sx-btn sm primary" data-verify="${x.id}">Verify</button>` : ''}${x.status !== 'REJECTED' ? `<button class="sx-btn sm danger" data-reject="${x.id}">Reject</button>` : ''}` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sx-muted">No document checklist (created when the booking is approved).</p>';
          pane.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => NXS.openFile(b.dataset.open)));
          pane.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Attach document', sub: 'PDF or image, up to 15 MB. The file is private — only staff with access can open it.', submit: 'Upload', fields: [{ name: 'file', label: 'File', type: 'file', accept: 'application/pdf,image/png,image/jpeg,image/webp', required: true }], onSubmit: async (v) => { const form = new FormData(); form.append('file', v.file); const x = await api(`/suite/crm/documents/${b.dataset.up}/file`, { form, method: 'POST' }); draw(); changed(); return x.message; } })));
          pane.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', () => {
            const doc = r.documents.find((x) => x.id === b.dataset.verify);
            formDialog({ title: `Verify ${doc.title}`, sub: doc.file_url ? 'Confirm you checked the attached file against the original.' : 'No file is attached — note where the verified original is kept.', submit: 'Mark verified', fields: [{ name: 'notes', label: doc.file_url ? 'Note (optional)' : 'Where the original is kept', required: !doc.file_url }], onSubmit: async (v) => { const x = await api(`/suite/crm/documents/${doc.id}`, { method: 'PATCH', body: { status: 'VERIFIED', notes: v.notes } }); draw(); changed(); return x.message; } });
          }));
          pane.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Reject document', submit: 'Reject', danger: true, fields: [{ name: 'notes', label: 'What is wrong (the customer is told this)', required: true }], onSubmit: async (v) => { const x = await api(`/suite/crm/documents/${b.dataset.reject}`, { method: 'PATCH', body: { status: 'REJECTED', notes: v.notes } }); draw(); changed(); return x.message; } })));
        },
        tickets: () => {
          table(pane, { rows: r.tickets, onRow: (t) => openTicket(t.id, draw), columns: [{ key: 'ticket_number', label: 'Request', render: (t) => `<strong>${esc(t.ticket_number)}</strong><span class="sub">${esc(t.subject)}</span>` }, { key: 'category', label: 'Category', render: (t) => esc(label(t.category || 'GENERAL')) }, { key: 'priority', label: 'Priority', render: (t) => chip(t.priority) }, { key: 'status', label: 'Status', render: (t) => chip(t.status) }, { key: 'assigned_name', label: 'Assigned' }, { key: 'created_at', label: 'Logged', render: (t) => when(t.created_at) }], empty: { title: 'No requests' } });
        },
        comms: () => {
          pane.innerHTML = r.communications.length ? `<ul class="sx-tl">${r.communications.map((m) => `<li><span class="dot ${m.direction === 'INBOUND' ? 'call' : 'note'}"></span><div><div class="meta">${when(m.created_at)} · ${esc(label(m.channel))} · ${esc(label(m.direction))} · ${esc(m.by)}</div>${m.subject ? `<div class="txt"><strong>${esc(m.subject)}</strong></div>` : ''}<div class="txt">${esc(m.summary)}</div></div></li>`).join('')}</ul>` : '<p class="sx-muted">Nothing logged yet.</p>';
        },
        possession: () => {
          pane.innerHTML = r.possession.length ? `<ul class="sx-tl">${r.possession.map((p) => `<li><span class="dot audit"></span><div><div class="meta">${when(p.created_at)} · ${esc(p.project_name || '')} · ${esc(label(p.stage))}${p.expected_date ? ` · expected ${when(p.expected_date, { dateOnly: true })}` : ''}</div><div class="txt"><strong>${esc(p.title)}</strong></div>${p.message ? `<div class="txt">${esc(p.message)}</div>` : ''}</div></li>`).join('')}</ul>` : '<p class="sx-muted">No possession updates yet.</p>';
        },
        calls: () => {
          table(pane, { rows: r.calls, onRow: (x) => NXS.openCall(x.id), columns: [{ key: 'initiated_at', label: 'When', render: (x) => when(x.initiated_at) }, { key: 'direction', label: 'Direction', render: (x) => chip(x.direction) }, { key: 'status', label: 'Status', render: (x) => chip(x.status) }, { key: 'duration_sec', label: 'Talk time', num: true, render: (x) => (x.duration_sec ? `${Math.floor(x.duration_sec / 60)}m ${x.duration_sec % 60}s` : '—') }, { key: 'outcome', label: 'Outcome', render: (x) => `${esc(label(x.outcome || ''))}<span class="sub">${esc(x.remarks || '')}</span>` }], empty: { title: 'No calls recorded' } });
        }
      };
      panes[tab]();
      d.body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; d.body.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-on', x === b)); panes[tab](); }));
      d.body.querySelectorAll('[data-refund]').forEach((b) => b.addEventListener('click', () => {
        const bk = r.bookings.find((x) => x.id === b.dataset.refund);
        formDialog({
          title: `Request a refund — ${bk.deal_number}`, sub: `Verified payments on this booking: ${money(bk.paid, false)}. The finance head or the owner must approve before finance pays it.`, submit: 'Send for approval',
          fields: [{ name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 1, max: bk.paid }, { name: 'reason', label: 'Reason', type: 'textarea', required: true }],
          onSubmit: async (v) => { const x = await api('/suite/finance/refunds', { body: { deal_id: bk.id, ...v } }); changed(); return x.message; }
        });
      }));
      const callBtn = d.body.querySelector('[data-call]');
      if (callBtn) callBtn.addEventListener('click', () => NXS.startCall({ customerId: c.id, name: c.name }));
      d.body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async () => {
        const x = b.dataset.x;
        if (x === 'log') formDialog({ title: `Log contact with ${c.name}`, submit: 'Log', fields: [[{ name: 'channel', label: 'How', type: 'select', options: o.commChannels.map((k) => [k, label(k)]) }, { name: 'direction', label: 'Direction', type: 'select', options: [['OUTBOUND', 'We contacted them'], ['INBOUND', 'They contacted us'], ['INTERNAL', 'Internal note']] }], ...(r.bookings.length > 1 ? [{ name: 'deal_id', label: 'Booking', type: 'select', options: [['', 'All bookings'], ...r.bookings.map((bk) => [bk.id, `${bk.deal_number} · ${bk.unit_number}`])] }] : []), { name: 'subject', label: 'Subject' }, { name: 'summary', label: 'What was discussed', type: 'textarea', required: true }], onSubmit: async (v) => { const y = await api(`/suite/crm/customers/${c.id}/communications`, { body: v }); tab = 'comms'; draw(); changed(); return y.message; } });
        if (x === 'ticket') ticketDialog({ customer: c, bookings: r.bookings, after: () => { tab = 'tickets'; draw(); changed(); } });
        if (x === 'edit') formDialog({ title: `Edit ${c.name}`, submit: 'Save', fields: [{ name: 'email', label: 'Email', type: 'email', value: c.email }, { name: 'address_line1', label: 'Address', value: c.address_line1 }, [{ name: 'city', label: 'City', value: c.city }, { name: 'state', label: 'State', value: c.state }, { name: 'pincode', label: 'PIN', value: c.pincode }], [{ name: 'pan_tax_id', label: 'PAN / tax id', value: c.pan_tax_id }, { name: 'kyc_status', label: 'KYC', type: 'select', value: c.kyc_status || 'PENDING', options: [['PENDING', 'Pending'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected']] }]], onSubmit: async (v) => { const y = await api(`/suite/crm/customers/${c.id}`, { method: 'PATCH', body: v }); draw(); changed(); return y.message; } });
        if (x === 'rm') { const team = await teamOptions(); formDialog({ title: 'Relationship manager', submit: 'Assign', fields: [{ name: 'relationship_manager_id', label: 'Team member', type: 'select', value: c.relationship_manager_id, options: [['', 'Unassigned'], ...team] }], onSubmit: async (v) => { const y = await api(`/suite/crm/customers/${c.id}`, { method: 'PATCH', body: v }); draw(); changed(); return y.message; } }); }
        if (x === 'onboard') { if (!(await NXS.confirm('Complete onboarding?', `${c.name}'s documents are verified. This records the onboarding as complete.`, { submit: 'Complete onboarding' }))) return; try { toast((await api(`/suite/crm/customers/${c.id}`, { method: 'PATCH', body: { onboarding_status: 'COMPLETED' } })).message); draw(); changed(); } catch (e) { toast(e.message, 'err'); } }
      }));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openCustomer = openCustomer;

  // ------------------------------------------------------------------ service requests & complaints
  async function ticketDialog({ customer = null, bookings = [], after } = {}) {
    const o = await options();
    const customers = customer ? [] : (await api('/suite/crm/customers')).data;
    const team = can('crm.view') && isHead() ? await teamOptions() : [];
    formDialog({
      title: customer ? `New request — ${customer.name}` : 'Log a service request or complaint',
      sub: 'The relationship manager is notified; complaints also alert the CRM head. The due time follows the priority’s SLA.',
      submit: 'Log request',
      fields: [
        ...(customer ? [] : [{ name: 'customer_id', label: 'Customer', type: 'select', required: true, options: [['', 'Choose…'], ...customers.map((c) => [c.id, `${c.name}${c.units ? ` — ${c.units}` : ''}`])] }]),
        ...(bookings.length > 1 ? [{ name: 'deal_id', label: 'Booking', type: 'select', options: [['', '—'], ...bookings.map((b) => [b.id, `${b.deal_number} · ${b.unit_number}`])] }] : []),
        [{ name: 'category', label: 'Category', type: 'select', options: o.categories.map((k) => [k, label(k)]) }, { name: 'priority', label: 'Priority', type: 'select', value: '', options: [['', 'Default (complaints high)'], ...o.priorities.map((k) => [k, `${label(k)} · ${o.slaHours[k]} h`])] }],
        [{ name: 'channel', label: 'Received via', type: 'select', options: o.channels.map((k) => [k, label(k)]) }, ...(team.length ? [{ name: 'assigned_to', label: 'Assign to', type: 'select', options: [['', 'Relationship manager'], ...team] }] : [])],
        { name: 'subject', label: 'Subject', required: true },
        { name: 'description', label: 'Details', type: 'textarea' }
      ],
      onSubmit: async (v) => {
        const body = { ...v, customer_id: customer ? customer.id : v.customer_id };
        if (bookings.length === 1) body.deal_id = bookings[0].id;
        if (!body.priority) delete body.priority;
        const r = await api('/suite/crm/tickets', { body });
        if (after) after(r);
        return r.message;
      }
    });
  }
  NXS.ticketDialog = ticketDialog;

  async function openTicket(id, after) {
    const d = NXS.drawer('Request', { narrow: true });
    const draw = async () => {
      const t = (await api(`/suite/crm/tickets${NXS.qs({ id })}`)).data.find((x) => x.id === id);
      if (!t) { d.body.innerHTML = NXS.errorBox('Request not found or not visible to you.'); return; }
      const o = await options();
      const manage = can('crm.manage');
      const closed = ['RESOLVED', 'CLOSED'].includes(t.status);
      d.setTitle(t.ticket_number);
      d.body.innerHTML = `
        <div class="sx-row">${chip(t.status)}${chip(t.priority)}${t.sla_breached ? chip('RED', 'Past SLA') : ''}<span class="sx-muted">${esc(label(t.category || 'GENERAL'))} · via ${esc(label(t.channel || 'PHONE'))}</span></div>
        <div class="sx-card"><h3 style="margin:0 0 6px">${esc(t.subject)}</h3><p style="white-space:pre-wrap;margin:0">${esc(t.description || '')}</p></div>
        <div class="sx-card"><dl class="sx-kv"><dt>Customer</dt><dd>${can('crm.view') && t.customer_id ? `<a href="#" data-cust>${esc(t.customer_name)}</a>` : esc(t.customer_name)}</dd><dt>Booking</dt><dd>${esc(t.deal_number || '—')}</dd><dt>Assigned</dt><dd>${esc(t.assigned_name || 'Unassigned')}</dd><dt>Logged</dt><dd>${when(t.created_at)}</dd><dt>Due</dt><dd>${when(t.due_at)}${t.sla_breached ? ' <strong style="color:var(--sx-red)">overdue</strong>' : ''}</dd>${t.resolved_at ? `<dt>Resolved</dt><dd>${when(t.resolved_at)}</dd>` : ''}${t.resolution_notes ? `<dt>Resolution</dt><dd style="white-space:pre-wrap">${esc(t.resolution_notes)}</dd>` : ''}${t.feedback_rating ? `<dt>Customer rating</dt><dd>${'★'.repeat(t.feedback_rating)}${'☆'.repeat(5 - t.feedback_rating)} ${esc(t.feedback_comment || '')}</dd>` : ''}</dl></div>
        ${manage ? `<div class="sx-stack">
          ${t.status === 'OPEN' ? '<button class="sx-btn" data-x="start">Start working on it</button>' : ''}
          ${!closed ? '<button class="sx-btn primary" data-x="resolve">Resolve</button>' : ''}
          ${t.status === 'RESOLVED' ? '<button class="sx-btn" data-x="close">Close</button><button class="sx-btn" data-x="reopen">Reopen</button>' : ''}
          ${!closed ? '<button class="sx-btn" data-x="priority">Change priority</button>' : ''}
          ${!closed && isHead() ? '<button class="sx-btn" data-x="assign">Reassign</button>' : ''}
          ${closed && !t.feedback_rating ? '<button class="sx-btn" data-x="feedback">Record customer feedback</button>' : ''}
          <button class="sx-btn" data-x="history">History</button>
        </div>` : '<button class="sx-btn" data-x="history">History</button>'}`;
      const cl = d.body.querySelector('[data-cust]');
      if (cl) cl.addEventListener('click', (e) => { e.preventDefault(); openCustomer(t.customer_id); });
      const patch = async (body) => { const r = await api(`/suite/crm/tickets/${t.id}`, { method: 'PATCH', body }); draw(); if (after) after(); return r.message; };
      d.body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async () => {
        const x = b.dataset.x;
        try {
          if (x === 'start') toast(await patch({ status: 'IN_PROGRESS' }));
          if (x === 'close') toast(await patch({ status: 'CLOSED' }));
          if (x === 'reopen') toast(await patch({ status: 'IN_PROGRESS' }));
        } catch (e) { toast(e.message, 'err'); }
        if (x === 'resolve') formDialog({ title: `Resolve ${t.ticket_number}`, submit: 'Resolve', fields: [{ name: 'resolution_notes', label: 'What was done', type: 'textarea', required: true, value: t.resolution_notes }], onSubmit: (v) => patch({ status: 'RESOLVED', resolution_notes: v.resolution_notes }) });
        if (x === 'priority') formDialog({ title: 'Priority', sub: 'The due time is recalculated from when the request was logged.', submit: 'Update', fields: [{ name: 'priority', label: 'Priority', type: 'select', value: t.priority, options: o.priorities.map((k) => [k, `${label(k)} · ${o.slaHours[k]} h`]) }], onSubmit: (v) => patch(v) });
        if (x === 'assign') { const team = await teamOptions(); formDialog({ title: 'Reassign', submit: 'Assign', fields: [{ name: 'assigned_to', label: 'Team member', type: 'select', value: t.assigned_to, options: [['', 'Unassigned'], ...team] }], onSubmit: (v) => patch(v) }); }
        if (x === 'feedback') formDialog({ title: 'Customer feedback', sub: 'Record what the customer told you.', submit: 'Save', fields: [{ name: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => [n, `${n} — ${['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'][n]}`]) }, { name: 'comment', label: 'Comment', type: 'textarea' }], onSubmit: async (v) => { const r = await api(`/suite/crm/tickets/${t.id}/feedback`, { body: v }); draw(); if (after) after(); return r.message; } });
        if (x === 'history') {
          const h = (await api(`/suite/timeline/TICKET/${t.id}`)).data;
          NXS.modal(`<h2>${esc(t.ticket_number)} history</h2><ul class="sx-tl">${h.map((e) => `<li><span class="dot audit"></span><div><div class="meta">${when(e.created_at)} · ${esc(e.actor_name || 'System')}</div><div class="txt">${esc(e.summary || label(e.action))}</div></div></li>`).join('') || '<li class="sx-muted">No changes recorded.</li>'}</ul><div class="sx-actions"><button class="sx-btn" data-close>Close</button></div>`);
        }
      }));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openTicket = openTicket;

  NXS.page('crm-tickets', {
    title: 'Service requests & complaints', label: 'Requests & complaints', icon: 'alert', group: 'Customers', order: 3, portals: TICKET_PORTALS, cap: 'crm.ticket.create',
    async render(el, params) {
      const o = await options();
      const f = { status: params.status || 'OPEN,IN_PROGRESS', category: params.category || '' };
      const overdueOnly = Boolean(params.overdue);
      el.innerHTML = `<div class="sx-filters"><select data-f="status"><option value="OPEN,IN_PROGRESS">Open</option><option value="RESOLVED,CLOSED">Resolved / closed</option><option value="">All</option></select><select data-f="category"><option value="">Any category</option>${o.categories.map((k) => `<option value="${k}" ${k === f.category ? 'selected' : ''}>${label(k)}</option>`).join('')}</select><label class="sx-check"><input type="checkbox" data-overdue ${overdueOnly ? 'checked' : ''}> Past SLA only</label><div class="sx-spacer"></div><button class="sx-btn primary" data-new>Log request</button></div>${can('crm.view') ? '' : '<div class="sx-note" style="margin-bottom:12px">You see the requests you logged. The customer relationship team handles them.</div>'}<div class="sx-card" data-list></div>`;
      el.querySelector('[data-f="status"]').value = f.status;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Service requests', onRow: (x) => openTicket(x.id, load),
        columns: [
          { key: 'ticket_number', label: 'Request', render: (x) => `<strong>${esc(x.ticket_number)}</strong><span class="sub">${esc(x.subject)}</span>` },
          { key: 'customer_name', label: 'Customer', render: (x) => `${esc(x.customer_name || '')}<span class="sub">${esc(x.deal_number || '')}</span>` },
          { key: 'category', label: 'Category', render: (x) => esc(label(x.category || 'GENERAL')) },
          { key: 'priority', label: 'Priority', render: (x) => chip(x.priority) },
          { key: 'status', label: 'Status', render: (x) => chip(x.status) },
          { key: 'assigned_name', label: 'Assigned', render: (x) => esc(x.assigned_name || 'Unassigned') },
          { key: 'due_at', label: 'Due', render: (x) => `${when(x.due_at)}${x.sla_breached ? '<span class="sub" style="color:var(--sx-red)">past SLA</span>' : ''}`, text: (x) => x.due_at || '' },
          { key: 'feedback_rating', label: 'Rating', num: true, render: (x) => (x.feedback_rating ? `${x.feedback_rating}/5` : '—') }
        ],
        empty: { title: 'No requests match' }
      });
      const overdueBox = el.querySelector('[data-overdue]');
      async function load() {
        let rows = (await api(`/suite/crm/tickets${NXS.qs(f)}`)).data;
        if (overdueBox.checked) rows = rows.filter((x) => x.sla_breached);
        t.update(rows);
      }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener('change', () => { f[i.dataset.f] = i.value; load(); }));
      overdueBox.addEventListener('change', load);
      el.querySelector('[data-new]').addEventListener('click', () => ticketDialog({ after: load }));
      await load();
      if (params.id) openTicket(params.id, load);
    }
  });

  // ------------------------------------------------------------------ possession updates
  NXS.page('crm-possession', {
    title: 'Possession updates', label: 'Possession updates', icon: 'key', group: 'Customers', order: 4, portals: CRM, cap: 'crm.view',
    async render(el) {
      const o = await options();
      const projects = (await api('/projects')).data.filter((p) => p.status !== 'ARCHIVED');
      el.innerHTML = `<div class="sx-filters"><select data-p><option value="">All projects</option>${projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><div class="sx-spacer"></div>${can('crm.manage') ? '<button class="sx-btn primary" data-new>Post update</button>' : ''}</div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), { exportTitle: 'Possession updates', columns: [{ key: 'created_at', label: 'Posted', render: (x) => when(x.created_at), text: (x) => x.created_at }, { key: 'project_name', label: 'Project', render: (x) => `${esc(x.project_name || '')}<span class="sub">${x.deal_number ? `Booking ${esc(x.deal_number)}` : 'All buyers'}</span>` }, { key: 'stage', label: 'Stage', render: (x) => esc(label(x.stage)) }, { key: 'title', label: 'Update', render: (x) => `<strong>${esc(x.title)}</strong><span class="sub">${esc((x.message || '').slice(0, 140))}</span>` }, { key: 'expected_date', label: 'Expected', render: (x) => (x.expected_date ? when(x.expected_date, { dateOnly: true }) : '—') }, { key: 'by', label: 'By' }], empty: { title: 'No updates posted yet' } });
      const sel = el.querySelector('[data-p]');
      async function load() { t.update((await api(`/suite/crm/possession${NXS.qs({ project_id: sel.value })}`)).data); }
      sel.addEventListener('change', load);
      const nb = el.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => formDialog({
        title: 'Post a possession update', sub: 'Posted to every booked buyer of the project and added to each customer’s communication history.', submit: 'Post update',
        fields: [{ name: 'project_id', label: 'Project', type: 'select', required: true, value: sel.value, options: [['', 'Choose…'], ...projects.map((p) => [p.id, p.name])] }, [{ name: 'stage', label: 'Stage', type: 'select', options: o.stages.map((k) => [k, label(k)]) }, { name: 'expected_date', label: 'Expected date', type: 'date' }], { name: 'title', label: 'Title', required: true }, { name: 'message', label: 'Message to buyers', type: 'textarea' }],
        onSubmit: async (v) => { const r = await api('/suite/crm/possession', { body: v }); load(); return r.message; }
      }));
      await load();
    }
  });
})();
