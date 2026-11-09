/* Business Suite — Finance & accounts portal. Money counts only after verification. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, money, num, label, toast, table, formDialog, kpi, can, charts } = NXS;
  const FIN = ['finance'];
  let modes = null;
  const getModes = async () => modes || (modes = (await api('/suite/finance/modes')).data);

  async function recordPayment(deal, after) {
    const ms = deal ? (await api(`/suite/finance/milestones/${deal.id}`)).data : [];
    const deals = deal ? [deal] : (await api('/suite/finance/deals')).data;
    formDialog({
      title: 'Record a payment', sub: 'It counts as received only after another finance team member verifies it against the bank.', submit: 'Record payment',
      fields: [
        { name: 'deal_id', label: 'Booking', type: 'select', required: true, value: deal && deal.id, options: [['', 'Choose…'], ...deals.map((d) => [d.id, `${d.deal_number} — ${d.client_name} · unit ${d.unit_number}`])] },
        ...(ms.length ? [{ name: 'milestone_id', label: 'Towards instalment', type: 'select', options: [['', 'General / advance'], ...ms.filter((m) => m.status !== 'PAID').map((m) => [m.id, `${m.milestone_name} — ${money(m.due_amount)} due ${when(m.due_date, { dateOnly: true })}`])] }] : []),
        [{ name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 1 }, { name: 'payment_date', label: 'Payment date', type: 'date', value: NXS.ymd(Date.now()), required: true }],
        [{ name: 'payment_mode', label: 'Mode', type: 'select', required: true, options: (await getModes()).map((m) => [m, label(m)]) }, { name: 'reference_number', label: 'Cheque / UTR / txn reference', hint: 'Required except for cash' }],
        [{ name: 'payer_name', label: 'Paid by' }, { name: 'notes', label: 'Notes' }]
      ],
      onSubmit: async (v) => { const r = await api('/suite/finance/payments', { body: v }); if (after) after(); return r.message; }
    });
  }

  function openReceipt(id) {
    api(`/suite/finance/payments/${id}/receipt`).then(({ data: p }) => {
      const company = NXS.state.me.company || {};
      NXS.modal(`<h2>Receipt ${esc(p.receipt_number)}</h2><p class="sx-sub">${esc(company.company_name || '')}</p>
        <dl class="sx-kv"><dt>Received from</dt><dd>${esc(p.client_name)}</dd><dt>Amount</dt><dd><strong>${money(p.amount_received, false)}</strong></dd><dt>Mode</dt><dd>${esc(label(p.payment_mode))} ${esc(p.reference_number || '')}</dd><dt>Date</dt><dd>${when(p.payment_date, { dateOnly: true })}</dd>
        <dt>Towards</dt><dd>${esc(p.project_name)} · unit ${esc(p.unit_number)} · ${esc(p.deal_number)}${p.milestone_name ? ` · ${esc(p.milestone_name)}` : ''}</dd><dt>Verified</dt><dd>${when(p.verified_at)}</dd><dt>Total received</dt><dd>${money(p.total_verified, false)} of ${money(p.agreed_total_amount, false)} (balance ${money(p.balance, false)})</dd></dl>
        <div class="sx-actions"><button class="sx-btn" data-close>Close</button><button class="sx-btn primary" data-pdf>Download PDF</button></div>`).el.querySelector('[data-pdf]').addEventListener('click', () => NXS.exportTable({ title: `Receipt ${p.receipt_number}`, columns: ['Field', 'Value'], rows: [['Receipt', p.receipt_number], ['Received from', p.client_name], ['Amount', money(p.amount_received, false)], ['Mode', `${label(p.payment_mode)} ${p.reference_number || ''}`], ['Payment date', when(p.payment_date, { dateOnly: true })], ['Booking', `${p.deal_number} · ${p.project_name} unit ${p.unit_number}`], ['Instalment', p.milestone_name || '—'], ['Verified on', when(p.verified_at)], ['Total received', money(p.total_verified, false)], ['Balance', money(p.balance, false)]] }, 'pdf'));
    }).catch((e) => toast(e.message, 'err'));
  }
  NXS.openReceipt = openReceipt;

  async function openDeal(id) {
    const d = NXS.drawer('Booking');
    const draw = async () => {
      const r = (await api(`/suite/finance/deals/${id}`)).data;
      const deal = r.deal;
      d.setTitle(`${deal.deal_number} — ${deal.client_name}`);
      const verified = r.payments.filter((p) => p.verification_status === 'VERIFIED').reduce((s, p) => s + Number(p.amount_received), 0);
      d.body.innerHTML = `
        <div class="sx-kpis">${kpi('Booking value', money(deal.agreed_total_amount))}${kpi('Verified received', money(verified), { tone: 'good' })}${kpi('Balance', money(Number(deal.agreed_total_amount) - verified))}</div>
        <div class="sx-row">${chip(deal.status)}<span class="sx-muted">${esc(deal.project_name)} · unit ${esc(deal.unit_number)}</span><div class="sx-spacer"></div>${can('finance.record') ? '<button class="sx-btn sm primary" data-rec>Record payment</button>' : ''}${can('finance.refund.request') ? '<button class="sx-btn sm" data-refund>Request refund</button>' : ''}</div>
        <div class="sx-card"><div class="sx-card-head"><h3>Payment schedule</h3></div><div data-ms></div></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Payments</h3></div><div data-pay></div></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Invoices</h3></div><div data-inv></div></div>
        ${r.refunds.length ? `<div class="sx-card"><div class="sx-card-head"><h3>Refunds</h3></div>${r.refunds.map((x) => `<div class="sx-row">${esc(x.refund_number)} · ${money(x.amount)} ${chip(x.status)} <span class="sx-muted">${esc(x.reason)}</span></div>`).join('')}</div>` : ''}`;
      table(d.body.querySelector('[data-ms]'), {
        rows: r.milestones,
        columns: [{ key: 'milestone_name', label: 'Instalment' }, { key: 'due_date', label: 'Due', render: (m) => when(m.due_date, { dateOnly: true }) }, { key: 'due_amount', label: 'Amount', num: true, render: (m) => money(m.due_amount) }, { key: 'verified_paid', label: 'Verified', num: true, render: (m) => money(m.verified_paid) }, { key: 'pending_verification', label: 'Awaiting check', num: true, render: (m) => (Number(m.pending_verification) ? money(m.pending_verification) : '—') }, { key: 'status', label: 'Status', render: (m) => chip(m.status) },
          { key: 'inv', label: '', nosort: true, render: (m) => (can('finance.invoice') && m.status !== 'PAID' ? `<button class="sx-btn sm" data-invoice="${m.id}">Invoice</button>` : '') }],
        afterDraw: (root) => root.querySelectorAll('[data-invoice]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Raise invoice', submit: 'Issue invoice', fields: [{ name: 'tax_amount', label: 'Tax (₹)', type: 'number', value: 0, min: 0 }, { name: 'description', label: 'Description' }], onSubmit: async (v) => { const x = await api('/suite/finance/invoices', { body: { deal_id: deal.id, milestone_id: b.dataset.invoice, ...v } }); draw(); return x.message; } })))
      });
      table(d.body.querySelector('[data-pay]'), { rows: r.payments, columns: payCols(draw), empty: { title: 'No payments yet' }, afterDraw: (root) => bindPayActions(root, draw) });
      table(d.body.querySelector('[data-inv]'), { rows: r.invoices, columns: [{ key: 'invoice_number', label: 'Invoice' }, { key: 'issue_date', label: 'Issued', render: (x) => when(x.issue_date, { dateOnly: true }) }, { key: 'total_amount', label: 'Total', num: true, render: (x) => money(x.total_amount) }, { key: 'status', label: 'Status', render: (x) => chip(x.status) }], empty: { title: 'No invoices' } });
      const rec = d.body.querySelector('[data-rec]');
      if (rec) rec.addEventListener('click', () => recordPayment({ id: deal.id, deal_number: deal.deal_number, client_name: deal.client_name, unit_number: deal.unit_number }, draw));
      const rf = d.body.querySelector('[data-refund]');
      if (rf) rf.addEventListener('click', () => formDialog({ title: 'Request a refund', sub: 'Needs approval by the finance head or the owner before it can be paid.', submit: 'Send for approval', fields: [{ name: 'payment_id', label: 'Against payment', type: 'select', options: [['', 'Any verified payment'], ...r.payments.filter((p) => p.verification_status === 'VERIFIED').map((p) => [p.id, `${p.receipt_number} — ${money(p.amount_received)}`])] }, { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 1 }, { name: 'reason', label: 'Reason', type: 'textarea', required: true }], onSubmit: async (v) => { const x = await api('/suite/finance/refunds', { body: { deal_id: deal.id, ...v } }); draw(); return x.message; } }));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openDeal = openDeal;

  /** Payment table columns with verify / reject / receipt buttons (bound by bindPayActions). */
  const payCols = (after) => withActions(after);
  function withActions(after) {
    const cols = [
      { key: 'payment_number', label: 'Payment', render: (p) => `<strong>${esc(p.payment_number)}</strong><span class="sub">${when(p.created_at)} · by ${esc(p.recorded_by_name || '')}</span>` },
      { key: 'client_name', label: 'Customer', render: (p) => `${esc(p.client_name || '')}<span class="sub">${esc(p.deal_number || '')}${p.milestone_name ? ` · ${esc(p.milestone_name)}` : ''}</span>` },
      { key: 'amount_received', label: 'Amount', num: true, render: (p) => money(p.amount_received, false) },
      { key: 'payment_mode', label: 'Mode', render: (p) => `${esc(label(p.payment_mode))}<span class="sub">${esc(p.reference_number || '')}${p.bank_line_id ? ' · matched to bank' : ''}</span>` },
      { key: 'verification_status', label: 'Status', render: (p) => `${chip(p.verification_status, p.verification_status === 'PENDING' ? 'Awaiting verification' : label(p.verification_status))}${p.verified_by_name ? `<span class="sub">${esc(p.verified_by_name)}${p.verification_note ? `: ${esc(p.verification_note)}` : ''}</span>` : ''}` },
      { key: 'act', label: '', nosort: true, noexport: true, render: (p) => (p.verification_status === 'PENDING' && can('finance.verify') ? (p.received_by === NXS.state.me.id ? '<span class="sx-muted">Another member verifies</span>' : `<div class="sx-row"><button class="sx-btn sm good" data-verify="${p.id}">Verify</button><button class="sx-btn sm danger" data-reject="${p.id}">Reject</button></div>`) : p.verification_status === 'VERIFIED' && p.receipt_number ? `<button class="sx-btn sm" data-receipt="${p.id}">Receipt</button>` : '') }
    ];
    return cols;
  }
  function bindPayActions(root, after) {
    root.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Verify payment', sub: 'Confirm you have seen this money in the bank / cheque cleared. A receipt is issued.', submit: 'Verify', fields: [{ name: 'note', label: 'Note (e.g. seen in statement)' }], onSubmit: async (v) => { const r = await api(`/suite/finance/payments/${b.dataset.verify}/verify`, { body: v }); if (after) after(); return r.message; } })));
    root.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', async () => { const reason = await NXS.confirm('Reject payment?', 'For example a bounced cheque or wrong amount. The sales owner and relationship manager are told.', { reason: true, danger: true, submit: 'Reject' }); if (!reason) return; try { toast((await api(`/suite/finance/payments/${b.dataset.reject}/reject`, { body: { reason } })).message); if (after) after(); } catch (e) { toast(e.message, 'err'); } }));
    root.querySelectorAll('[data-receipt]').forEach((b) => b.addEventListener('click', () => openReceipt(b.dataset.receipt)));
  }

  // ------------------------------------------------------------------ overview
  NXS.page('finance-overview', {
    title: 'Finance overview', label: 'Overview', icon: 'rupee', group: 'Finance', order: 1, portals: FIN, cap: 'finance.view',
    async render(el) {
      const r = (await api('/suite/finance/overview')).data;
      const t = r.totals;
      el.innerHTML = `
        <div class="sx-kpis">
          ${kpi('Booked value', money(t.bookedValue), { hint: 'confirmed bookings' })}
          ${kpi('Collected (verified)', money(t.collected), { tone: 'good', hint: t.refunded ? `after ${money(t.refunded)} refunds` : '' })}
          ${kpi('Outstanding', money(t.outstanding), { go: 'finance-outstanding' })}
          ${kpi('Overdue', money(t.overdueAmount), { tone: t.overdueAmount ? 'bad' : '', hint: `${t.overdueCount} instalment${t.overdueCount === 1 ? '' : 's'}`, go: 'finance-overdue' })}
          ${kpi('Awaiting verification', num(t.pendingVerification), { tone: t.pendingVerification ? 'warn' : '', hint: money(t.pendingVerificationAmount), go: 'finance-payments' })}
          ${kpi('Commission due', money(t.commissionDue), { go: 'finance-commissions' })}
          ${kpi('Open refunds', num(t.openRefunds), { go: 'finance-refunds' })}
          ${kpi('Unmatched bank credits', num(t.unmatchedBankLines), { go: 'finance-bank' })}
        </div>
        <div class="sx-grid" style="margin-top:16px">
          <div class="sx-card"><div class="sx-card-head"><h3>Verified collections by month</h3></div><div data-c></div></div>
          <div class="sx-card"><div class="sx-card-head"><h3>Project-wise</h3></div><div data-p></div></div>
        </div>`;
      charts.columns(el.querySelector('[data-c]'), { labels: r.collectionsByMonth.map((m) => m.month), series: [{ name: 'Collected', values: r.collectionsByMonth.map((m) => m.collected) }], format: (v) => money(v) });
      table(el.querySelector('[data-p]'), { rows: r.projects, columns: [{ key: 'name', label: 'Project' }, { key: 'booked_value', label: 'Booked', num: true, render: (p) => money(p.booked_value) }, { key: 'collected', label: 'Collected', num: true, render: (p) => money(p.collected) }, { key: 'outstanding', label: 'Outstanding', num: true, render: (p) => money(p.outstanding) }], empty: { title: 'No bookings yet' } });
    }
  });

  // ------------------------------------------------------------------ payments
  NXS.page('finance-payments', {
    title: 'Payments & verification', label: 'Payments', icon: 'check', group: 'Finance', order: 2, portals: FIN, cap: 'finance.view',
    badge: () => null,
    async render(el) {
      let status = 'PENDING';
      el.innerHTML = `<div class="sx-filters"><div class="sx-seg" data-s>${[['PENDING', 'Awaiting verification'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected'], ['', 'All']].map(([k, l]) => `<button data-v="${k}" class="${k === status ? 'is-on' : ''}">${l}</button>`).join('')}</div><input type="search" placeholder="Payment, receipt, UTR, booking or name" data-q><div class="sx-spacer"></div>${can('finance.record') ? '<button class="sx-btn primary" data-rec>Record payment</button>' : ''}</div><div class="sx-card" data-list></div>`;
      let q = '';
      const after = () => load();
      const t = table(el.querySelector('[data-list]'), { exportTitle: 'Payments', columns: withActions(after), empty: { title: 'Nothing here', text: 'Payments recorded by the team wait here until verified.' }, afterDraw: (root) => bindPayActions(root, after) });
      async function load() { t.update((await api(`/suite/finance/payments${NXS.qs({ status, q })}`)).data); }
      el.querySelectorAll('[data-s] [data-v]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.v; el.querySelectorAll('[data-s] button').forEach((x) => x.classList.toggle('is-on', x === b)); load(); }));
      el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; clearTimeout(e.target._t); e.target._t = setTimeout(load, 300); });
      const rec = el.querySelector('[data-rec]');
      if (rec) rec.addEventListener('click', () => recordPayment(null, load));
      await load();
    }
  });

  NXS.page('finance-bookings', {
    title: 'Bookings & accounts', label: 'Customer accounts', icon: 'key', group: 'Finance', order: 3, portals: ['finance'], cap: 'finance.view',
    async render(el) {
      el.innerHTML = '<div class="sx-filters"><input type="search" placeholder="Booking, customer, phone or unit" data-q></div><div class="sx-card" data-list></div>';
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Customer accounts', onRow: (r) => openDeal(r.id),
        columns: [{ key: 'deal_number', label: 'Booking', render: (r) => `<strong>${esc(r.deal_number)}</strong><span class="sub">${when(r.created_at, { dateOnly: true })}</span>` }, { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.phone || '')}</span>` }, { key: 'project_name', label: 'Unit', render: (r) => `${esc(r.project_name)}<span class="sub">${esc(r.unit_number)}</span>` }, { key: 'agreed_total_amount', label: 'Value', num: true, render: (r) => money(r.agreed_total_amount) }, { key: 'collected', label: 'Verified', num: true, render: (r) => money(r.collected) }, { key: 'pending', label: 'Awaiting check', num: true, render: (r) => (r.pending ? money(r.pending) : '—') }, { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => money(r.outstanding) }, { key: 'status', label: 'Status', render: (r) => chip(r.status) }]
      });
      const load = async (q = '') => t.update((await api(`/suite/finance/deals${NXS.qs({ q })}`)).data);
      el.querySelector('[data-q]').addEventListener('input', (e) => { clearTimeout(e.target._t); e.target._t = setTimeout(() => load(e.target.value), 300); });
      await load();
    }
  });

  NXS.page('finance-invoices', {
    title: 'Invoices', label: 'Invoices', icon: 'file', group: 'Finance', order: 4, portals: ['finance'], cap: 'finance.view',
    async render(el) {
      el.innerHTML = '<div class="sx-card" data-list></div>';
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Invoices',
        columns: [{ key: 'invoice_number', label: 'Invoice' }, { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.deal_number)}${r.milestone_name ? ` · ${esc(r.milestone_name)}` : ''}</span>` }, { key: 'issue_date', label: 'Issued', render: (r) => when(r.issue_date, { dateOnly: true }) }, { key: 'due_date', label: 'Due', render: (r) => when(r.due_date, { dateOnly: true }) }, { key: 'total_amount', label: 'Total', num: true, render: (r) => money(r.total_amount, false) }, { key: 'status', label: 'Status', render: (r) => chip(r.status) },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (can('finance.invoice') && !['PAID', 'CANCELLED'].includes(r.status) ? `<button class="sx-btn sm danger" data-cancel="${r.id}">Cancel</button>` : '') }],
        empty: { title: 'No invoices yet', text: 'Raise invoices from a customer account’s payment schedule.' },
        afterDraw: (root) => root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => { const reason = await NXS.confirm('Cancel invoice?', '', { reason: true, danger: true }); if (!reason) return; try { toast((await api(`/suite/finance/invoices/${b.dataset.cancel}/cancel`, { body: { reason } })).message); load(); } catch (e) { toast(e.message, 'err'); } }))
      });
      const load = async () => t.update((await api('/suite/finance/invoices')).data);
      await load();
    }
  });

  NXS.page('finance-outstanding', {
    title: 'Outstanding collections', label: 'Outstanding', icon: 'rupee', group: 'Collections', order: 5, portals: FIN, cap: 'finance.view',
    async render(el) {
      el.innerHTML = '<div class="sx-card" data-list></div>';
      table(el.querySelector('[data-list]'), {
        rows: (await api('/suite/finance/outstanding')).data, exportTitle: 'Outstanding collections', onRow: (r) => (can('finance.record') ? openDeal(r.id) : null),
        columns: [{ key: 'deal_number', label: 'Booking' }, { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.phone || '')}</span>` }, { key: 'project_name', label: 'Unit', render: (r) => `${esc(r.project_name)}<span class="sub">${esc(r.unit_number)}</span>` }, { key: 'agreed_total_amount', label: 'Value', num: true, render: (r) => money(r.agreed_total_amount) }, { key: 'collected', label: 'Collected', num: true, render: (r) => money(r.collected) }, { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => money(r.outstanding) }, { key: 'overdue', label: 'Overdue', num: true, render: (r) => (r.overdue ? `<span class="sx-delta down">${money(r.overdue)}</span>` : '—') }, { key: 'next_due_date', label: 'Next due', render: (r) => when(r.next_due_date, { dateOnly: true }) }],
        empty: { title: 'Nothing outstanding' }
      });
    }
  });

  NXS.page('finance-overdue', {
    title: 'Overdue payments', label: 'Overdue', icon: 'alert', group: 'Collections', order: 6, portals: FIN, cap: 'finance.view',
    async render(el) {
      const r = (await api('/suite/finance/overdue')).data;
      el.innerHTML = `<div class="sx-kpis">${['0-30', '31-60', '61-90', '90+'].map((k) => kpi(`${k} days`, money(r.ageing[k] || 0), { tone: r.ageing[k] ? 'bad' : '' })).join('')}</div><div class="sx-card" style="margin-top:14px" data-list></div>`;
      table(el.querySelector('[data-list]'), {
        rows: r.rows, exportTitle: 'Overdue payments',
        columns: [{ key: 'deal_number', label: 'Booking' }, { key: 'client_name', label: 'Customer', render: (x) => `${esc(x.client_name)}<span class="sub">${esc(x.phone || '')}</span>` }, { key: 'milestone_name', label: 'Instalment' }, { key: 'due_date', label: 'Was due', render: (x) => when(x.due_date, { dateOnly: true }) }, { key: 'days_overdue', label: 'Days late', num: true }, { key: 'balance', label: 'Unpaid', num: true, render: (x) => money(x.balance) }],
        empty: { title: 'No overdue payments' }
      });
    }
  });

  NXS.page('finance-refunds', {
    title: 'Refunds', label: 'Refunds', icon: 'swap', group: 'Collections', order: 7, portals: [...FIN, 'crm', 'sales-head'], cap: ['finance.view', 'finance.refund.request'],
    async render(el) {
      el.innerHTML = '<div class="sx-note">Refunds are requested from a customer account, approved by the finance head or owner in the approval centre, then paid out and recorded here.</div><div class="sx-card" style="margin-top:12px" data-list></div>';
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Refunds',
        columns: [{ key: 'refund_number', label: 'Refund' }, { key: 'client_name', label: 'Customer', render: (r) => `${esc(r.client_name)}<span class="sub">${esc(r.deal_number)}</span>` }, { key: 'amount', label: 'Amount', num: true, render: (r) => money(r.amount, false) }, { key: 'reason', label: 'Reason' }, { key: 'requested_by_name', label: 'Requested by' }, { key: 'status', label: 'Status', render: (r) => `${chip(r.status)}${r.decision_note ? `<span class="sub">${esc(r.decision_note)}</span>` : ''}${r.transaction_reference ? `<span class="sub">ref ${esc(r.transaction_reference)}</span>` : ''}` },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (r.status === 'APPROVED' && can('finance.refund.process') ? `<button class="sx-btn sm primary" data-pay="${r.id}">Mark paid</button>` : r.status === 'REQUESTED' ? '<button class="sx-btn sm" data-go-appr>Approval centre</button>' : '') }],
        empty: { title: 'No refunds' },
        afterDraw: (root) => {
          root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Record refund payout', submit: 'Mark paid', fields: [{ name: 'transaction_reference', label: 'Bank transaction reference', required: true }], onSubmit: async (v) => { const r = await api(`/suite/finance/refunds/${b.dataset.pay}/process`, { body: v }); load(); return r.message; } })));
          root.querySelectorAll('[data-go-appr]').forEach((b) => b.addEventListener('click', () => NXS.go('approvals')));
        }
      });
      const load = async () => t.update((await api('/suite/finance/refunds')).data);
      await load();
    }
  });

  NXS.page('finance-bank', {
    title: 'Bank reconciliation', label: 'Reconciliation', icon: 'grid', group: 'Collections', order: 8, portals: ['finance'], cap: 'finance.reconcile',
    async render(el) {
      let status = 'UNMATCHED';
      el.innerHTML = `<div class="sx-filters"><div class="sx-seg" data-s>${[['UNMATCHED', 'Unmatched'], ['MATCHED', 'Matched'], ['IGNORED', 'Ignored'], ['', 'All']].map(([k, l]) => `<button data-v="${k}" class="${k === status ? 'is-on' : ''}">${l}</button>`).join('')}</div><div class="sx-spacer"></div><button class="sx-btn primary" data-import>Import bank statement</button></div>
        <div class="sx-note">Import your bank's statement (CSV with date, amount, reference). Credits are matched to recorded payments by reference and amount. Matching doesn't verify a payment — verify it in Payments.</div><div class="sx-card" style="margin-top:12px" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Bank statement lines',
        columns: [{ key: 'txn_date', label: 'Date', render: (r) => when(r.txn_date, { dateOnly: true }) }, { key: 'amount', label: 'Amount', num: true, render: (r) => money(r.amount, false) }, { key: 'direction', label: 'Type', render: (r) => esc(label(r.direction)) }, { key: 'reference', label: 'Reference', render: (r) => `${esc(r.reference || '—')}<span class="sub">${esc(r.description || '')}</span>` }, { key: 'match_status', label: 'Status', render: (r) => `${chip(r.match_status)}${r.payment_number ? `<span class="sub">${esc(r.payment_number)} · ${esc(label(r.verification_status))}</span>` : ''}` },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (r.match_status === 'UNMATCHED' ? `<div class="sx-row"><button class="sx-btn sm" data-match="${r.id}" data-amt="${r.amount}">Match</button><button class="sx-btn sm" data-ignore="${r.id}">Not a customer payment</button></div>` : '') }],
        empty: { title: 'Nothing here' },
        afterDraw: (root) => {
          root.querySelectorAll('[data-match]').forEach((b) => b.addEventListener('click', async () => {
            const pays = (await api('/suite/finance/payments')).data.filter((p) => !p.bank_line_id && p.verification_status !== 'REJECTED' && Math.abs(Number(p.amount_received) - Number(b.dataset.amt)) < 1);
            if (!pays.length) return toast('No unmatched payment has this amount.', 'err');
            return formDialog({ title: 'Match to a payment', submit: 'Match', fields: [{ name: 'payment_id', label: 'Payment', type: 'select', required: true, options: pays.map((p) => [p.id, `${p.payment_number} — ${p.client_name} ${money(p.amount_received, false)} (${p.reference_number || 'no ref'})`]) }], onSubmit: async (v) => { const r = await api(`/suite/finance/bank/${b.dataset.match}/match`, { body: v }); load(); return r.message; } });
          }));
          root.querySelectorAll('[data-ignore]').forEach((b) => b.addEventListener('click', async () => { try { toast((await api(`/suite/finance/bank/${b.dataset.ignore}/ignore`, { method: 'POST', body: {} })).message); load(); } catch (e) { toast(e.message, 'err'); } }));
        }
      });
      async function load() { t.update((await api(`/suite/finance/bank${NXS.qs({ status })}`)).data); }
      el.querySelectorAll('[data-s] [data-v]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.v; el.querySelectorAll('[data-s] button').forEach((x) => x.classList.toggle('is-on', x === b)); load(); }));
      el.querySelector('[data-import]').addEventListener('click', () => formDialog({
        title: 'Import bank statement', sub: 'CSV with a header row: date, amount, reference (description and direction optional).', submit: 'Import',
        fields: [{ name: 'file', label: 'Statement CSV', type: 'file', accept: '.csv', required: true }],
        onSubmit: async (v) => {
          const text = await v.file.text();
          const lines = text.split(/\r?\n/).filter(Boolean).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
          const head = lines.shift().map((h) => h.toLowerCase());
          const col = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
          const ci = { date: col(['date']), amount: col(['amount', 'credit']), reference: col(['ref', 'utr', 'cheque']), description: col(['desc', 'narration', 'particular']), direction: col(['type', 'dr/cr', 'direction']) };
          if (ci.date < 0 || ci.amount < 0) throw new Error('The file needs date and amount columns.');
          const rows = lines.map((l) => ({ date: l[ci.date], amount: l[ci.amount], reference: ci.reference >= 0 ? l[ci.reference] : '', description: ci.description >= 0 ? l[ci.description] : '', direction: ci.direction >= 0 && /^d/i.test(l[ci.direction]) ? 'DEBIT' : 'CREDIT' }));
          const r = await api('/suite/finance/bank/import', { body: { rows } });
          load();
          return r.message;
        }
      }));
      await load();
    }
  });

  NXS.page('finance-commissions', {
    title: 'Channel partner commissions', label: 'Commissions', icon: 'users', group: 'Collections', order: 9, portals: FIN, cap: 'finance.view',
    async render(el) {
      el.innerHTML = '<div class="sx-card" data-list></div>';
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Partner commissions',
        columns: [{ key: 'firm_name', label: 'Partner' }, { key: 'deal_number', label: 'Booking', render: (r) => `${esc(r.deal_number)}<span class="sub">${esc(r.client_name)} · ${esc(r.project_name)} ${esc(r.unit_number)}</span>` }, { key: 'deal_status', label: 'Booking status', render: (r) => chip(r.deal_status) }, { key: 'commission_rate', label: 'Rate %', num: true }, { key: 'total_commission', label: 'Commission', num: true, render: (r) => money(r.total_commission, false) }, { key: 'paid_amount', label: 'Paid', num: true, render: (r) => money(r.paid_amount, false) }, { key: 'balance', label: 'Due', num: true, render: (r) => money(r.balance, false) }, { key: 'status', label: 'Status', render: (r) => chip(r.status) },
          { key: 'act', label: '', nosort: true, noexport: true, render: (r) => (r.balance > 0 && can('finance.commission.pay') && ['BOOKED', 'AGREEMENT_SIGNED', 'CLOSED_WON'].includes(r.deal_status) ? `<button class="sx-btn sm primary" data-pay="${r.id}" data-bal="${r.balance}">Pay out</button>` : '') }],
        empty: { title: 'No commissions yet', text: 'Commissions are created when a partner-introduced booking is confirmed.' },
        afterDraw: (root) => root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => formDialog({ title: 'Record commission payout', submit: 'Record payout', fields: [[{ name: 'amount', label: 'Amount (₹)', type: 'number', required: true, value: b.dataset.bal }, { name: 'payment_mode', label: 'Mode', type: 'select', options: [['NEFT', 'NEFT'], ['RTGS', 'RTGS'], ['UPI', 'UPI'], ['CHEQUE', 'Cheque']] }], [{ name: 'transaction_reference', label: 'Reference', required: true }, { name: 'payout_date', label: 'Date', type: 'date', value: NXS.ymd(Date.now()) }], { name: 'notes', label: 'Notes' }], onSubmit: async (v) => { const r = await api(`/suite/finance/commissions/${b.dataset.pay}/pay`, { body: v }); load(); return r.message; } })))
      });
      const load = async () => t.update((await api('/suite/finance/commissions')).data);
      await load();
    }
  });

  NXS.page('finance-reports', {
    title: 'Financial reports', label: 'Reports', icon: 'chart', group: 'Reports', order: 20, portals: FIN, cap: 'finance.view',
    async render(el) {
      const r = (await api('/suite/finance/reports?months=12')).data;
      el.innerHTML = `<div class="sx-card"><div class="sx-card-head"><h3>Collections by month (verified)</h3></div><div data-m></div></div><div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Project-wise financial performance</h3></div><div data-p></div></div><div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Receivables by booking</h3></div><div data-o></div></div>`;
      table(el.querySelector('[data-m]'), { rows: r.collectionsByMonth, exportTitle: 'Collections by month', columns: [{ key: 'month', label: 'Month' }, { key: 'payments', label: 'Payments', num: true }, { key: 'collected', label: 'Collected', num: true, render: (x) => money(x.collected, false) }] });
      table(el.querySelector('[data-p]'), { rows: r.projects, exportTitle: 'Project financials', columns: [{ key: 'name', label: 'Project' }, { key: 'bookings', label: 'Bookings', num: true }, { key: 'booked_value', label: 'Booked', num: true, render: (x) => money(x.booked_value, false) }, { key: 'collected', label: 'Collected', num: true, render: (x) => money(x.collected, false) }, { key: 'outstanding', label: 'Outstanding', num: true, render: (x) => money(x.outstanding, false) }, { key: 'commission', label: 'Partner commission', num: true, render: (x) => money(x.commission, false) }] });
      table(el.querySelector('[data-o]'), { rows: r.outstanding, exportTitle: 'Receivables', columns: [{ key: 'deal_number', label: 'Booking' }, { key: 'client_name', label: 'Customer' }, { key: 'project_name', label: 'Project' }, { key: 'outstanding', label: 'Outstanding', num: true, render: (x) => money(x.outstanding, false) }, { key: 'overdue', label: 'Overdue', num: true, render: (x) => money(x.overdue, false) }] });
    }
  });
})();
