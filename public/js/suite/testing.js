/* Business Suite — Manual Testing Center. The tester runs every case by hand and records the result here;
   nothing in this module runs a test, fills a result or marks anything passed. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, num, label, toast, table, formDialog, kpi } = NXS;
  const T = ['testing'];
  const CAP = 'testing.use';
  const STATUS_LABEL = { NOT_RUN: 'Not run', PASS: 'Pass', FAIL: 'Fail', BLOCKED: 'Blocked' };
  const STATUS_ICON = { NOT_RUN: '○', PASS: '✓', FAIL: '✕', BLOCKED: '!' };
  const statusChip = (s) => chip(s === 'NOT_RUN' ? 'NOT_RUN' : s, `${STATUS_ICON[s] || ''} ${STATUS_LABEL[s] || label(s)}`);
  const IMG = /\.(png|jpe?g|webp)$/i;

  /** Private files need the auth header, so images load through fetch → object URL. */
  async function authBlobUrl(url) {
    const res = await fetch(url.replace(/^\/api/, typeof getApiBase === 'function' ? getApiBase() : '/api'), { headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Could not load the attachment.');
    return URL.createObjectURL(await res.blob());
  }
  function evidenceGrid(list, onRemove) {
    if (!list.length) return '<p class="sx-muted">No screenshots attached yet.</p>';
    return `<div class="sx-evidence">${list.map((e) => `<figure data-ev="${e.id}">${IMG.test(e.file_url) ? `<img alt="${esc(e.file_name || 'screenshot')}" data-src="${esc(e.file_url)}">` : `<div class="sx-ev-file">${NXS.icon('file')} PDF</div>`}<figcaption>${esc(e.file_name || '')}<br><span class="sx-muted">${when(e.created_at)}</span></figcaption><div class="sx-row"><button class="sx-btn sm" data-ev-open="${esc(e.file_url)}">Open</button>${onRemove && e.uploaded_by === NXS.state.me.id ? `<button class="sx-btn sm danger" data-ev-del="${e.id}">Remove</button>` : ''}</div></figure>`).join('')}</div>`;
  }
  function bindEvidence(root, after) {
    root.querySelectorAll('img[data-src]').forEach((img) => authBlobUrl(img.dataset.src).then((u) => { img.src = u; }).catch(() => { img.alt = 'Could not load'; }));
    root.querySelectorAll('[data-ev-open]').forEach((b) => b.addEventListener('click', () => NXS.openFile(b.dataset.evOpen)));
    root.querySelectorAll('[data-ev-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await NXS.confirm('Remove this attachment?', '', { danger: true, submit: 'Remove' }))) return;
      try { toast((await api(`/suite/testing/evidence/${b.dataset.evDel}`, { method: 'DELETE' })).message); after(); } catch (e) { toast(e.message, 'err'); }
    }));
  }
  /** Upload control: choose files, drop them, or paste a screenshot (Ctrl/Cmd+V) while the drawer is open. */
  function uploadZone(root, endpoint, after) {
    const zone = root.querySelector('[data-zone]');
    if (!zone) return () => {};
    const send = async (files) => {
      for (const f of files) {
        if (!/^image\/(png|jpeg|webp)$|^application\/pdf$/.test(f.type)) { toast(`${f.name || 'File'}: only PNG, JPG, WebP or PDF.`, 'err'); continue; }
        const form = new FormData();
        form.append('file', f, f.name || `screenshot-${Date.now()}.png`);
        try { toast((await api(endpoint, { form, method: 'POST' })).message); } catch (e) { toast(e.message, 'err'); }
      }
      after();
    };
    const input = zone.querySelector('input[type=file]');
    input.addEventListener('change', () => send([...input.files]));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); send([...e.dataTransfer.files]); });
    const onPaste = (e) => {
      if (!document.body.contains(zone)) { document.removeEventListener('paste', onPaste); return; }
      const files = [...(e.clipboardData ? e.clipboardData.items : [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
      if (files.length) { e.preventDefault(); send(files); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }
  const zoneHtml = '<label class="sx-zone" data-zone><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple hidden><strong>Attach screenshots</strong><span>Click to choose, drop files here, or paste a screenshot with Ctrl/⌘ + V</span></label>';

  async function downloadResults() {
    try {
      const res = await api('/suite/testing/export.csv', { raw: true });
      if (!res.ok) throw new Error('Could not export the results.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await res.blob());
      a.download = `nexora-test-results-${NXS.ymd(Date.now())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast(e.message, 'err'); }
  }

  // ------------------------------------------------------------------ summary
  NXS.page('test-summary', {
    title: 'Testing Center', label: 'Summary', icon: 'flask', group: 'Testing', order: 1, portals: T, cap: CAP,
    async render(el) {
      const s = (await api('/suite/testing/summary')).data;
      const t = s.totals;
      el.innerHTML = `
        <div class="sx-note amber" style="margin-bottom:16px"><strong>Environment: ${esc(s.environment)}</strong> — every record here is fictional test data. You run each case yourself and record what actually happened; nothing is marked passed automatically.</div>
        <div class="sx-kpis">
          ${kpi('Progress', `${s.progressPct}%`, { hint: `${num(t.total - t.NOT_RUN)} of ${num(t.total)} cases run` })}
          ${kpi('✓ Passed', num(t.PASS), { tone: 'good', go: 'test-cases?status=PASS' })}
          ${kpi('✕ Failed', num(t.FAIL), { tone: t.FAIL ? 'bad' : '', go: 'test-cases?status=FAIL' })}
          ${kpi('! Blocked', num(t.BLOCKED), { tone: t.BLOCKED ? 'warn' : '', go: 'test-cases?status=BLOCKED' })}
          ${kpi('○ Not run', num(t.NOT_RUN), { go: 'test-cases?status=NOT_RUN' })}
          ${kpi('Open bugs', num(s.bugs.open), { hint: `${num(s.bugs.total)} reported`, tone: s.bugs.open ? 'warn' : '', go: 'test-bugs' })}
          ${kpi('Test leads', num(s.testLeads), { go: 'test-leads' })}
        </div>
        <div class="sx-row" style="margin:16px 0"><button class="sx-btn primary" data-go="test-cases">Open the checklist</button><button class="sx-btn" data-go="test-accounts">Test accounts</button><button class="sx-btn" data-bug>Report a bug</button><div class="sx-spacer"></div><button class="sx-btn" data-export>${NXS.icon('download')} Export results (CSV)</button></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Progress by portal and workflow</h3></div><div data-suites></div></div>
        <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>How to test</h3></div><ol class="sx-howto">
          <li>Open <strong>Test accounts</strong>. Every role has its own login; all use the password shown there.</li>
          <li>Use a separate browser profile or private window per account, so two roles can be signed in side by side (for example a telecaller and the sales manager approving their booking).</li>
          <li>Open a case in the <strong>checklist</strong>, sign in as its login account, go to the page named, and follow the steps with the test data given.</li>
          <li>Compare with the expected result and check where it says to verify (another portal, the notification history or the activity history below).</li>
          <li>Record <strong>Pass</strong>, <strong>Fail</strong> or <strong>Blocked</strong> with what actually happened, attach screenshots (paste them straight in), and report a bug for anything wrong.</li>
          <li>Cross-portal workflows (lead → visit → booking → approval → payment → customer onboarding) are listed under their own group.</li>
        </ol></div>`;
      const rows = s.suites.map((x) => ({ ...x, run: x.total - x.NOT_RUN }));
      table(el.querySelector('[data-suites]'), {
        rows, onRow: (x) => NXS.go('test-cases', { suite: x.suite }), exportTitle: 'Test progress',
        columns: [
          { key: 'suite', label: 'Checklist', render: (x) => `<strong>${esc(x.suite)}</strong><span class="sub">${esc(x.portal)}${x.cross ? ' · cross-portal' : ''}</span>` },
          { key: 'bar', label: 'Progress', nosort: true, noexport: true, render: (x) => progressBar(x) },
          { key: 'PASS', label: 'Pass', num: true }, { key: 'FAIL', label: 'Fail', num: true }, { key: 'BLOCKED', label: 'Blocked', num: true }, { key: 'NOT_RUN', label: 'Not run', num: true }, { key: 'total', label: 'Cases', num: true }
        ],
        empty: { title: 'No checklist loaded', text: 'Run “npm run testenv:setup” (or restart the test server) to load the test cases.' }
      });
      el.querySelector('[data-export]').addEventListener('click', downloadResults);
      el.querySelector('[data-bug]').addEventListener('click', () => bugDialog({}));
    }
  });
  function progressBar(x) {
    const seg = (k, cls) => (x[k] ? `<i class="${cls}" style="flex:${x[k]}" title="${STATUS_LABEL[k]}: ${x[k]}"></i>` : '');
    return `<span class="sx-progress" aria-label="${x.PASS} passed, ${x.FAIL} failed, ${x.BLOCKED} blocked, ${x.NOT_RUN} not run">${seg('PASS', 'pass')}${seg('FAIL', 'fail')}${seg('BLOCKED', 'blocked')}${seg('NOT_RUN', 'notrun')}</span>`;
  }

  // ------------------------------------------------------------------ checklist
  NXS.page('test-cases', {
    title: 'Test checklist', label: 'Checklist', icon: 'check', group: 'Testing', order: 2, portals: T, cap: CAP,
    async render(el, params) {
      const s = (await api('/suite/testing/summary')).data;
      const f = { suite: params.suite || '', status: params.status || '', role: '', q: '' };
      el.innerHTML = `<div class="sx-filters"><input type="search" placeholder="Test ID or title" data-f="q"><select data-f="suite"><option value="">All checklists</option>${s.suites.map((x) => `<option value="${esc(x.suite)}" ${x.suite === f.suite ? 'selected' : ''}>${esc(x.suite)}</option>`).join('')}</select><select data-f="status"><option value="">Any result</option>${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === f.status ? 'selected' : ''}>${v}</option>`).join('')}</select><input placeholder="Role" data-f="role"><div class="sx-spacer"></div><button class="sx-btn" data-export>${NXS.icon('download')} Results CSV</button></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        pageSize: 100, onRow: (c) => openCase(c.id, load),
        columns: [
          { key: 'id', label: 'Test ID', render: (c) => `<strong>${esc(c.id)}</strong>` },
          { key: 'title', label: 'Test', render: (c) => `${esc(c.title)}<span class="sub">${esc(c.suite)}${c.is_cross_portal ? ' · cross-portal' : ''}</span>` },
          { key: 'portal', label: 'Portal' },
          { key: 'role', label: 'Role', render: (c) => `${esc(c.role)}<span class="sub">${esc(c.login_account || '')}</span>` },
          { key: 'status', label: 'Result', render: (c) => `${statusChip(c.status)}${c.tested_at ? `<span class="sub">${esc(c.tested_by_name || '')} · ${ago(c.tested_at)}</span>` : ''}` },
          { key: 'evidence', label: 'Screens', num: true },
          { key: 'open_bugs', label: 'Open bugs', num: true }
        ],
        empty: { title: 'No test cases match', text: s.totals.total ? 'Try another filter.' : 'The checklist has not been loaded into this environment yet.' }
      });
      let rows = [];
      async function load() { rows = (await api(`/suite/testing/cases${NXS.qs(f)}`)).data; t.update(rows); }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.tagName === 'INPUT' ? 'input' : 'change', () => { f[i.dataset.f] = i.value.trim(); clearTimeout(i._t); i._t = setTimeout(load, 250); }));
      el.querySelector('[data-export]').addEventListener('click', downloadResults);
      await load();
      if (params.id) openCase(params.id, load);
    }
  });

  function openCase(id, afterChange) {
    const d = NXS.drawer(id);
    let stopPaste = () => {};
    const close = d.close;
    d.close = () => { stopPaste(); close(); };
    d.el.querySelector('[data-close]').addEventListener('click', () => stopPaste());
    const draw = async () => {
      const c = (await api(`/suite/testing/cases/${encodeURIComponent(id)}`)).data;
      d.setTitle(`${c.id} — ${c.title}`);
      d.body.innerHTML = `
        <div class="sx-row">${statusChip(c.status)}${c.is_cross_portal ? chip('VIOLET', 'Cross-portal') : ''}<span class="sx-muted">${esc(c.suite)}</span>${c.tested_at ? `<span class="sx-muted">· last recorded by ${esc(c.tested_by_name || '—')} ${ago(c.tested_at)}</span>` : ''}</div>
        <div class="sx-card"><dl class="sx-kv">
          <dt>Test ID</dt><dd><strong>${esc(c.id)}</strong></dd>
          <dt>Portal</dt><dd>${esc(c.portal)}</dd>
          <dt>Role</dt><dd>${esc(c.role)}</dd>
          <dt>Sign in as</dt><dd>${c.login_account ? `<code>${esc(c.login_account)}</code> <button class="sx-btn sm" data-copy="${esc(c.login_account)}">Copy</button> <span class="sx-muted">password on the Test accounts page</span>` : '—'}</dd>
          <dt>Page</dt><dd>${esc(c.page_location || '—')}</dd>
        </dl></div>
        <div class="sx-card"><h3 style="margin-top:0">Steps</h3><ol class="sx-steps">${(c.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          ${c.test_data ? `<h4>Test data</h4><p style="white-space:pre-wrap">${esc(c.test_data)}</p>` : ''}
          <h4>Expected result</h4><p style="white-space:pre-wrap">${esc(c.expected_result)}</p>
          ${c.verify_location ? `<h4>Where to verify</h4><p style="white-space:pre-wrap">${esc(c.verify_location)}</p>` : ''}</div>
        <div class="sx-card"><h3 style="margin-top:0">Your result</h3>
          <div class="sx-seg" data-status>${Object.entries(STATUS_LABEL).map(([k, v]) => `<button type="button" data-s="${k}" class="${c.status === k ? 'is-on' : ''}">${STATUS_ICON[k]} ${v}</button>`).join('')}</div>
          <label class="sx-field" style="margin-top:10px"><span>Actual result — what happened (required for Fail / Blocked)</span><textarea data-actual rows="4">${esc(c.actual_result || '')}</textarea></label>
          <label class="sx-field"><span>Bug remarks</span><textarea data-remarks rows="3">${esc(c.bug_remarks || '')}</textarea></label>
          <div class="sx-error" hidden data-err></div>
          <div class="sx-actions"><button class="sx-btn" data-newbug>Report a bug for this case</button><button class="sx-btn primary" data-save>Save result</button></div></div>
        <div class="sx-card"><h3 style="margin-top:0">Evidence</h3>${zoneHtml}<div data-ev style="margin-top:10px">${evidenceGrid(c.evidence, true)}</div></div>
        <div class="sx-card"><h3 style="margin-top:0">Bugs for this case</h3>${c.bugs.length ? c.bugs.map((b) => `<div class="sx-row" style="padding:6px 0;border-bottom:1px solid var(--sx-line)"><a href="#" data-bug="${b.id}"><strong>${esc(b.bug_number)}</strong> ${esc(b.title)}</a>${chip(b.severity)}${chip(b.status)}</div>`).join('') : '<p class="sx-muted">None reported.</p>'}</div>`;
      let picked = c.status;
      d.body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { picked = b.dataset.s; d.body.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('is-on', x === b)); }));
      d.body.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copied.'); } catch (e) { toast(b.dataset.copy); } }));
      d.body.querySelector('[data-save]').addEventListener('click', async (e) => {
        const err = d.body.querySelector('[data-err]');
        err.hidden = true;
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const r = await api(`/suite/testing/cases/${encodeURIComponent(c.id)}`, { method: 'PATCH', body: { status: picked, actual_result: d.body.querySelector('[data-actual]').value, bug_remarks: d.body.querySelector('[data-remarks]').value } });
          toast(r.message);
          if (afterChange) afterChange();
          draw();
        } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
      });
      d.body.querySelector('[data-newbug]').addEventListener('click', () => bugDialog({ testCase: c, after: () => { draw(); if (afterChange) afterChange(); } }));
      d.body.querySelectorAll('[data-bug]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); openBug(a.dataset.bug); }));
      bindEvidence(d.body, () => { draw(); if (afterChange) afterChange(); });
      stopPaste();
      stopPaste = uploadZone(d.body, `/suite/testing/cases/${encodeURIComponent(c.id)}/evidence`, () => { draw(); if (afterChange) afterChange(); });
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }

  // ------------------------------------------------------------------ bugs
  function bugDialog({ testCase = null, after } = {}) {
    formDialog({
      title: testCase ? `Report a bug — ${testCase.id}` : 'Report a bug', submit: 'Report bug',
      sub: 'Attach screenshots after saving (paste them into the bug).',
      fields: [
        { name: 'title', label: 'Short title', required: true },
        [{ name: 'severity', label: 'Severity', type: 'select', value: 'MEDIUM', options: [['CRITICAL', 'Critical — blocks work / wrong money or data'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low / cosmetic']] }, { name: 'portal', label: 'Portal', value: testCase ? testCase.portal : '' }],
        { name: 'steps_to_reproduce', label: 'Steps to reproduce', type: 'textarea', value: testCase ? (testCase.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') : '' },
        { name: 'expected', label: 'Expected', type: 'textarea', value: testCase ? testCase.expected_result : '' },
        { name: 'actual', label: 'Actual', type: 'textarea', required: true },
        { name: 'description', label: 'Other details (browser, account, record IDs)', type: 'textarea', value: testCase && testCase.login_account ? `Signed in as ${testCase.login_account}` : '' }
      ],
      onSubmit: async (v) => {
        const r = await api('/suite/testing/bugs', { body: { ...v, test_case_id: testCase ? testCase.id : null } });
        if (after) after(r);
        setTimeout(() => openBug(r.data.id), 250);
        return r.message;
      }
    });
  }

  function openBug(id, afterChange) {
    const d = NXS.drawer('Bug', { narrow: true });
    let stopPaste = () => {};
    d.el.querySelector('[data-close]').addEventListener('click', () => stopPaste());
    const draw = async () => {
      const b = (await api(`/suite/testing/bugs/${id}`)).data;
      d.setTitle(`${b.bug_number} — ${b.title}`);
      d.body.innerHTML = `
        <div class="sx-row">${chip(b.severity)}${chip(b.status)}${b.test_case_id ? `<a href="#" data-case>${esc(b.test_case_id)}</a>` : ''}<span class="sx-muted">${esc(b.portal || '')} · ${when(b.created_at)}</span><div class="sx-spacer"></div><button class="sx-btn sm" data-edit>Edit</button></div>
        <div class="sx-card">
          ${b.steps_to_reproduce ? `<h4 style="margin-top:0">Steps to reproduce</h4><p style="white-space:pre-wrap">${esc(b.steps_to_reproduce)}</p>` : ''}
          ${b.expected ? `<h4>Expected</h4><p style="white-space:pre-wrap">${esc(b.expected)}</p>` : ''}
          ${b.actual ? `<h4>Actual</h4><p style="white-space:pre-wrap">${esc(b.actual)}</p>` : ''}
          ${b.description ? `<h4>Details</h4><p style="white-space:pre-wrap">${esc(b.description)}</p>` : ''}
        </div>
        <div class="sx-card"><h3 style="margin-top:0">Status</h3><div class="sx-seg" data-status>${['OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'].map((s) => `<button data-s="${s}" class="${b.status === s ? 'is-on' : ''}">${label(s)}</button>`).join('')}</div></div>
        <div class="sx-card"><h3 style="margin-top:0">Screenshots</h3>${zoneHtml}<div style="margin-top:10px">${evidenceGrid(b.evidence, true)}</div></div>`;
      const cl = d.body.querySelector('[data-case]');
      if (cl) cl.addEventListener('click', (e) => { e.preventDefault(); openCase(b.test_case_id); });
      d.body.querySelectorAll('[data-s]').forEach((x) => x.addEventListener('click', async () => { try { toast((await api(`/suite/testing/bugs/${b.id}`, { method: 'PATCH', body: { status: x.dataset.s } })).message); draw(); if (afterChange) afterChange(); } catch (e) { toast(e.message, 'err'); } }));
      d.body.querySelector('[data-edit]').addEventListener('click', () => formDialog({ title: `Edit ${b.bug_number}`, submit: 'Save', fields: [{ name: 'title', label: 'Title', value: b.title, required: true }, { name: 'severity', label: 'Severity', type: 'select', value: b.severity, options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => [s, label(s)]) }, { name: 'steps_to_reproduce', label: 'Steps', type: 'textarea', value: b.steps_to_reproduce }, { name: 'expected', label: 'Expected', type: 'textarea', value: b.expected }, { name: 'actual', label: 'Actual', type: 'textarea', value: b.actual }, { name: 'description', label: 'Details', type: 'textarea', value: b.description }], onSubmit: async (v) => { const r = await api(`/suite/testing/bugs/${b.id}`, { method: 'PATCH', body: v }); draw(); if (afterChange) afterChange(); return r.message; } }));
      bindEvidence(d.body, draw);
      stopPaste();
      stopPaste = uploadZone(d.body, `/suite/testing/bugs/${b.id}/evidence`, () => { draw(); if (afterChange) afterChange(); });
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }

  NXS.page('test-bugs', {
    title: 'Bug reports', label: 'Bug reports', icon: 'bug', group: 'Testing', order: 3, portals: T, cap: CAP,
    async render(el) {
      el.innerHTML = `<div class="sx-filters"><select data-status><option value="">All</option>${['OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'].map((s) => `<option value="${s}">${label(s)}</option>`).join('')}</select><div class="sx-spacer"></div><button class="sx-btn primary" data-new>Report a bug</button></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Bug reports', onRow: (b) => openBug(b.id, load),
        columns: [
          { key: 'bug_number', label: 'Bug', render: (b) => `<strong>${esc(b.bug_number)}</strong><span class="sub">${esc(b.title)}</span>`, text: (b) => `${b.bug_number} ${b.title}` },
          { key: 'severity', label: 'Severity', render: (b) => chip(b.severity) },
          { key: 'status', label: 'Status', render: (b) => chip(b.status) },
          { key: 'test_case_id', label: 'Test case' }, { key: 'portal', label: 'Portal' },
          { key: 'attachments', label: 'Screens', num: true },
          { key: 'reported_by_name', label: 'Reported by' },
          { key: 'created_at', label: 'Reported', render: (b) => when(b.created_at), text: (b) => b.created_at }
        ],
        empty: { title: 'No bugs reported' }
      });
      const sel = el.querySelector('[data-status]');
      async function load() { t.update((await api(`/suite/testing/bugs${NXS.qs({ status: sel.value })}`)).data); }
      sel.addEventListener('change', load);
      el.querySelector('[data-new]').addEventListener('click', () => bugDialog({ after: load }));
      await load();
    }
  });

  // ------------------------------------------------------------------ environment data
  NXS.page('test-accounts', {
    title: 'Test accounts', label: 'Test accounts', icon: 'key', group: 'Test data', order: 4, portals: T, cap: CAP,
    async render(el) {
      const r = (await api('/suite/testing/accounts')).data;
      el.innerHTML = `<div class="sx-note" style="margin-bottom:12px">All test accounts use the password <code>${esc(r.password)}</code>. They exist only in this testing environment. Sign in to each in its own private window or browser profile.</div><div class="sx-card" data-list></div>`;
      table(el.querySelector('[data-list]'), {
        rows: r.rows, exportTitle: 'Test accounts',
        columns: [
          { key: 'ref', label: 'Ref', render: (a) => `<strong>${esc(a.ref)}</strong>` },
          { key: 'username', label: 'Username', render: (a) => `<code>${esc(a.username)}</code> <button class="sx-btn sm" data-copy="${esc(a.username)}">Copy</button>`, text: (a) => a.username },
          { key: 'name', label: 'Name' },
          { key: 'roleLabel', label: 'Role', render: (a) => `${esc(a.roleLabel)}${a.jobLevel === 'HEAD' && !['BUSINESS_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(a.role) ? ' (head)' : ''}<span class="sub">${esc(a.firm || '')}</span>` },
          { key: 'phone', label: 'Phone' },
          { key: 'status', label: 'Status', render: (a) => chip(a.status) },
          { key: 'id', label: 'Record ID', render: (a) => `<span class="sx-muted" style="font-size:.75rem">${esc(a.id)}</span>` }
        ],
        empty: { title: 'No test accounts', text: 'Run “npm run testenv:setup” to create them.' },
        afterDraw: (root) => root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copied.'); } catch (e) { toast(b.dataset.copy); } }))
      });
    }
  });

  NXS.page('test-leads', {
    title: 'Test leads', label: 'Test leads', icon: 'lead', group: 'Test data', order: 5, portals: T, cap: CAP,
    async render(el) {
      const rows = (await api('/suite/testing/leads')).data;
      el.innerHTML = `<div class="sx-filters"><input type="search" placeholder="Ref, name, phone or scenario" data-q><span class="sx-muted">${num(rows.length)} fictional leads marked TEST DATA</span></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        rows, exportTitle: 'Test leads', pageSize: 100,
        columns: [
          { key: 'ref', label: 'Ref', render: (l) => `<strong>${esc(l.ref)}</strong>` },
          { key: 'name', label: 'Lead', render: (l) => `${esc(l.name)} <span class="sx-chip test">TEST</span><span class="sub">${esc(l.phone)} · ${esc(l.email || '')}</span>`, text: (l) => l.name },
          { key: 'phone', label: 'Phone' },
          { key: 'source', label: 'Source', render: (l) => `${esc(label(l.source || ''))}<span class="sub">${esc(l.campaign || '')}</span>` },
          { key: 'stage', label: 'Stage', render: (l) => `${esc(label(l.stage))}<span class="sub">${esc(label(l.priority || ''))}${l.temperature ? ` · ${esc(label(l.temperature))}` : ''}</span>` },
          { key: 'owner', label: 'Owner', render: (l) => `${esc(l.owner || 'Unassigned')}<span class="sub">${esc(l.firm_name || '')}</span>` },
          { key: 'project_name', label: 'Project', render: (l) => `${esc(l.project_name || '—')}<span class="sub">${esc(l.configuration || '')}</span>` },
          { key: 'scenario', label: 'Scenario' },
          { key: 'id', label: 'Record ID', render: (l) => `<span class="sx-muted" style="font-size:.75rem">${esc(l.id)}</span>` }
        ],
        empty: { title: 'No test leads', text: 'Run “npm run testenv:setup” to create the 50 test leads.' }
      });
      const q = el.querySelector('[data-q]');
      q.addEventListener('input', () => { const s = q.value.trim().toLowerCase(); t.update(s ? rows.filter((l) => [l.ref, l.name, l.phone, l.scenario, l.email].join(' ').toLowerCase().includes(s)) : rows); });
    }
  });

  NXS.page('test-notifications', {
    title: 'Notification history', label: 'Notifications sent', icon: 'bell', group: 'Test data', order: 6, portals: T, cap: CAP,
    async render(el) {
      const accounts = (await api('/suite/testing/accounts')).data.rows;
      el.innerHTML = `<div class="sx-filters"><select data-u><option value="">Every recipient</option>${accounts.map((a) => `<option value="${esc(a.username)}">${esc(a.username)} — ${esc(a.roleLabel)}</option>`).join('')}</select><button class="sx-btn" data-reload>Refresh</button><span class="sx-muted">Every notification sent in this environment, newest first — use it to check who was told what.</span></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Notifications sent', pageSize: 100,
        columns: [
          { key: 'created_at', label: 'Sent', render: (n) => when(n.created_at), text: (n) => n.created_at },
          { key: 'username', label: 'To', render: (n) => `${esc(n.username)}<span class="sub">${esc(label(n.role))}</span>` },
          { key: 'category', label: 'Category', render: (n) => esc(label(n.category || '')) },
          { key: 'title', label: 'Notification', render: (n) => `<strong>${esc(n.title)}</strong><span class="sub">${esc(n.message || '')}</span>` },
          { key: 'related_entity_type', label: 'Record', render: (n) => (n.related_entity_type ? `${esc(label(n.related_entity_type))}<span class="sub" style="font-size:.72rem">${esc(n.related_entity_id || '')}</span>` : '—') },
          { key: 'is_read', label: 'Read', render: (n) => (Number(n.is_read) ? 'Yes' : 'No') }
        ],
        empty: { title: 'No notifications yet' }
      });
      const sel = el.querySelector('[data-u]');
      async function load() { t.update((await api(`/suite/testing/notifications${NXS.qs({ username: sel.value })}`)).data); }
      sel.addEventListener('change', load);
      el.querySelector('[data-reload]').addEventListener('click', load);
      await load();
    }
  });

  NXS.page('test-activity', {
    title: 'Activity history', label: 'Activity history', icon: 'shield', group: 'Test data', order: 7, portals: T, cap: CAP,
    async render(el) {
      el.innerHTML = '<div class="sx-filters"><input type="search" placeholder="Search actions, names, numbers" data-q><button class="sx-btn" data-reload>Refresh</button><span class="sx-muted">The audit trail: who did what, from which role, and whether it was a person, the AI, the system or an integration.</span></div><div class="sx-card" data-list></div>';
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Activity history', pageSize: 100,
        columns: [
          { key: 'seq', label: '#', num: true },
          { key: 'created_at', label: 'When', render: (a) => when(a.created_at), text: (a) => a.created_at },
          { key: 'actor_name', label: 'Who', render: (a) => `${esc(a.actor_name || 'System')}<span class="sub">${esc(label(a.actor_role || ''))}</span>` },
          { key: 'source', label: 'Source', render: (a) => chip(a.source === 'AI' ? 'VIOLET' : a.source === 'HUMAN' ? 'BLUE' : '', label(a.source)) },
          { key: 'action', label: 'Action', render: (a) => `<strong>${esc(label(a.action))}</strong><span class="sub">${esc(a.summary || '')}</span>` },
          { key: 'entity_type', label: 'Record', render: (a) => (a.entity_type ? `${esc(label(a.entity_type))}<span class="sub" style="font-size:.72rem">${esc(a.entity_id || '')}</span>` : '—') },
          { key: 'result', label: 'Result', render: (a) => chip(a.result === 'SUCCESS' ? 'GREEN' : 'RED', label(a.result || '')) }
        ],
        empty: { title: 'No activity yet' }
      });
      const q = el.querySelector('[data-q]');
      async function load() { t.update((await api(`/suite/testing/activity${NXS.qs({ q: q.value.trim() })}`)).data); }
      q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(load, 300); });
      el.querySelector('[data-reload]').addEventListener('click', load);
      await load();
    }
  });
})();
