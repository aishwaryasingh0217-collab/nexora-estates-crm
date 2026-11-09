/* Business Suite — Projects & inventory portal, plus the property directory every sales role uses. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, money, num, label, toast, table, formDialog, kpi, can, charts } = NXS;
  const INV = ['inventory'];
  let opts = null;
  const options = async () => opts || (opts = (await api('/suite/inventory/options')).data);
  const UNIT_STATUS_KEYS = [{ key: 'available', label: 'Available' }, { key: 'reserved', label: 'Reserved' }, { key: 'booked', label: 'Booked' }, { key: 'sold', label: 'Sold' }];

  NXS.page('inv-overview', {
    title: 'Inventory overview', label: 'Overview', icon: 'building', group: 'Inventory', order: 1, portals: INV, cap: 'inventory.view',
    async render(el) {
      const r = (await api('/suite/inventory/summary')).data;
      const t = r.totals;
      el.innerHTML = `<div class="sx-kpis">${kpi('Units', num(t.total - (t.archived || 0)))}${kpi('Available', num(t.available), { tone: 'good', go: 'inv-units?status=AVAILABLE' })}${kpi('Reserved', num(t.reserved), { tone: t.reserved ? 'warn' : '', go: 'inv-units?status=HOLD' })}${kpi('Booked', num(t.booked))}${kpi('Sold', num(t.sold))}${kpi('Unsold stock value', money(t.available_value), { go: 'inv-ageing' })}</div>
        <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Units by status</h3></div><div data-c></div></div>
        <div class="sx-card" style="margin-top:16px"><div class="sx-card-head"><h3>Projects</h3>${can('inventory.manage') ? '<div class="sx-spacer"></div><button class="sx-btn sm primary" data-go="inv-projects">Manage projects</button>' : ''}</div><div data-p></div></div>`;
      charts.stacked(el.querySelector('[data-c]'), r.projects.filter((p) => p.total).map((p) => ({ label: p.name, parts: p })), UNIT_STATUS_KEYS);
      table(el.querySelector('[data-p]'), { rows: r.projects, exportTitle: 'Inventory by project', onRow: (p) => openProject(p.id), columns: [{ key: 'name', label: 'Project', render: (p) => `<strong>${esc(p.name)}</strong><span class="sub">${esc(p.city || '')} · ${esc(label(p.status))}</span>` }, { key: 'total', label: 'Units', num: true }, { key: 'available', label: 'Available', num: true }, { key: 'reserved', label: 'Reserved', num: true }, { key: 'booked', label: 'Booked', num: true }, { key: 'sold', label: 'Sold', num: true }, { key: 'soldPct', label: 'Sold', num: true, render: (p) => `${p.soldPct}%` }, { key: 'available_value', label: 'Unsold value', num: true, render: (p) => money(p.available_value) }, { key: 'avg_age_days', label: 'Avg days unsold', num: true }] });
    }
  });

  async function projectForm(p, after) {
    const o = await options();
    formDialog({
      title: p ? `Edit ${p.name}` : 'New project', submit: p ? 'Save' : 'Create project',
      fields: [
        [{ name: 'name', label: 'Project name', required: true, value: p && p.name }, { name: 'code', label: 'Code', value: p && p.code }],
        [{ name: 'builder_developer', label: 'Developer', value: p && p.builder_developer }, { name: 'project_type', label: 'Type', type: 'select', value: p && p.project_type, options: o.categories.map((c) => [c, label(c)]) }],
        [{ name: 'location', label: 'Locality', required: true, value: p && p.location }, { name: 'city', label: 'City', required: true, value: p && p.city }],
        { name: 'address', label: 'Address', value: p && p.address },
        [{ name: 'latitude', label: 'Latitude', type: 'number', step: 'any', value: p && p.latitude, hint: 'Used to check field agents in at the site' }, { name: 'longitude', label: 'Longitude', type: 'number', step: 'any', value: p && p.longitude }],
        [{ name: 'status', label: 'Status', type: 'select', value: p ? p.status : 'UNDER_CONSTRUCTION', options: o.projectStatuses.map((s) => [s, label(s)]) }, { name: 'possession_date', label: 'Possession', value: p && p.possession_date }],
        [{ name: 'rera_number', label: 'RERA number', value: p && p.rera_number }, { name: 'total_units', label: 'Planned units', type: 'number', value: p && p.total_units }],
        { name: 'partner_visible', label: 'Show to channel partners', type: 'checkbox', value: p ? Boolean(p.partner_visible) : true }
      ],
      onSubmit: async (v) => { const r = p ? await api(`/suite/inventory/projects/${p.id}`, { method: 'PATCH', body: v }) : await api('/suite/inventory/projects', { body: v }); if (after) after(r); return r.message; }
    });
  }

  NXS.page('inv-projects', {
    title: 'Projects', label: 'Projects', icon: 'building', group: 'Inventory', order: 2, portals: INV, cap: 'inventory.view',
    async render(el) {
      el.innerHTML = `<div class="sx-filters"><label class="sx-check"><input type="checkbox" data-arch> Include archived</label><div class="sx-spacer"></div>${can('inventory.manage') ? `${can('ai.use') ? '<button class="sx-btn" data-ai>New from brochure (AI)</button>' : ''}<button class="sx-btn primary" data-new>New project</button>` : ''}</div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), { exportTitle: 'Projects', onRow: (p) => openProject(p.id), columns: [{ key: 'name', label: 'Project', render: (p) => `<strong>${esc(p.name)}</strong>${NXS.testChip(p)}<span class="sub">${esc(p.code || '')} · ${esc(p.builder_developer || '')}</span>` }, { key: 'city', label: 'Location', render: (p) => `${esc(p.location)}<span class="sub">${esc(p.city)}</span>` }, { key: 'status', label: 'Status', render: (p) => chip(p.status === 'ARCHIVED' ? 'RED' : 'BLUE', label(p.status)) }, { key: 'towers', label: 'Towers', num: true }, { key: 'units', label: 'Units', num: true }, { key: 'available', label: 'Available', num: true }, { key: 'documents', label: 'Docs', num: true }, { key: 'partner_visible', label: 'Partners', render: (p) => (p.partner_visible ? 'Visible' : 'Hidden') }] });
      const load = async () => t.update((await api(`/suite/inventory/projects${el.querySelector('[data-arch]').checked ? '?include_archived=1' : ''}`)).data);
      el.querySelector('[data-arch]').addEventListener('change', load);
      const nb = el.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => projectForm(null, load));
      const ai = el.querySelector('[data-ai]');
      if (ai) ai.addEventListener('click', () => formDialog({
        title: 'Read a project brochure', sub: 'The AI reads the PDF and fills the project form for you to review. Nothing is saved until you save the project.', submit: 'Read brochure',
        fields: [{ name: 'file', label: 'Brochure PDF', type: 'file', accept: 'application/pdf', required: true }],
        onSubmit: async (v) => {
          const form = new FormData(); form.append('file', v.file);
          const x = (await api('/suite/ai/extract-brochure', { form, method: 'POST' })).data;
          setTimeout(() => {
            projectForm({ name: x.name, builder_developer: x.builder_developer, location: x.location, city: x.city, address: x.address, project_type: x.project_type, status: x.status || 'UNDER_CONSTRUCTION', possession_date: x.possession_date, rera_number: x.rera_number, total_units: x.total_units, partner_visible: 1, id: null }, load);
            NXS.modal(`<h2>From the brochure</h2><p class="sx-sub">Check these against the PDF. Configurations and prices can be added as units after saving.</p>${x.configurations.length ? `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Type</th><th>Carpet</th><th>Super</th><th>Price from</th><th>to</th></tr></thead><tbody>${x.configurations.map((c) => `<tr><td>${esc(c.unit_type)}</td><td>${c.carpet_area_sqft || '—'}</td><td>${c.super_area_sqft || '—'}</td><td>${c.price_from ? money(c.price_from) : '—'}</td><td>${c.price_to ? money(c.price_to) : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}${x.amenities.length ? `<p><strong>Amenities:</strong> ${x.amenities.map(esc).join(', ')}</p>` : ''}${x.not_found.length ? `<div class="sx-note amber">Not in the brochure: ${x.not_found.map(esc).join(', ')}</div>` : ''}<div class="sx-actions"><button class="sx-btn" data-close>Close</button></div>`);
          }, 200);
          return 'Brochure read — review the details.';
        }
      }));
      await load();
    }
  });

  async function openProject(id) {
    const d = NXS.drawer('Project');
    const draw = async () => {
      const r = (await api(`/suite/inventory/projects/${id}`)).data;
      const p = r.project;
      d.setTitle(p.name);
      const manage = can('inventory.manage');
      d.body.innerHTML = `
        <div class="sx-row">${chip(p.status === 'ARCHIVED' ? 'RED' : 'BLUE', label(p.status))}${NXS.testChip(p)}<span class="sx-muted">${esc(p.location)}, ${esc(p.city)}</span><div class="sx-spacer"></div>${manage ? '<button class="sx-btn sm" data-edit>Edit</button>' : ''}</div>
        <div class="sx-kpis">${['AVAILABLE', 'HOLD', 'BOOKED', 'SOLD'].map((s) => kpi(s === 'HOLD' ? 'Reserved' : label(s), num(r.unitStatus[s] || 0))).join('')}</div>
        <div class="sx-card"><dl class="sx-kv"><dt>Developer</dt><dd>${esc(p.builder_developer || '—')}</dd><dt>RERA</dt><dd>${esc(p.rera_number || '—')}</dd><dt>Possession</dt><dd>${esc(p.possession_date || '—')}</dd><dt>Site location</dt><dd>${p.latitude != null ? `${p.latitude}, ${p.longitude}` : '<span class="sx-muted">not set — field check-ins can’t measure distance</span>'}</dd><dt>Partners</dt><dd>${p.partner_visible ? 'Visible to channel partners' : 'Hidden from channel partners'}</dd></dl></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Towers / blocks</h3><div class="sx-spacer"></div>${manage ? '<button class="sx-btn sm" data-tower>Add tower</button><button class="sx-btn sm primary" data-gen>Generate units</button>' : ''}</div>
          ${r.towers.length ? `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th>Tower</th><th class="num">Floors</th><th class="num">Per floor</th><th class="num">Units</th><th class="num">Available</th><th class="num">Sold</th></tr></thead><tbody>${r.towers.map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${t.total_floors}</td><td class="num">${t.units_per_floor}</td><td class="num">${t.units}</td><td class="num">${t.available}</td><td class="num">${t.sold}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sx-muted">No towers yet.</p>'}
          <div class="sx-actions" style="justify-content:flex-start"><button class="sx-btn sm" data-units>View units</button></div></div>
        <div class="sx-card"><div class="sx-card-head"><h3>Documents</h3><div class="sx-spacer"></div>${can('inventory.documents') ? '<button class="sx-btn sm" data-doc>Upload</button>' : ''}</div>
          ${r.documents.length ? r.documents.map((x) => `<div class="sx-row" style="padding:6px 0;border-bottom:1px solid var(--sx-line)"><a href="#" data-open-doc="${esc(x.file_url)}">${esc(x.title)}</a>${chip('', label(x.doc_type))}${x.partner_visible ? chip('BLUE', 'partners') : ''}<span class="sx-muted" style="font-size:.8rem">${esc(x.uploaded_by_name || '')} · ${when(x.created_at, { dateOnly: true })}</span><div class="sx-spacer"></div>${can('inventory.documents') ? `<button class="sx-btn sm danger" data-del-doc="${x.id}">Remove</button>` : ''}</div>`).join('') : '<p class="sx-muted">No documents yet.</p>'}</div>`;
      const on = (sel, fn) => { const b = d.body.querySelector(sel); if (b) b.addEventListener('click', fn); };
      on('[data-edit]', () => projectForm(p, draw));
      on('[data-units]', () => { d.close(); NXS.go('inv-units', { project_id: p.id }); });
      on('[data-tower]', () => formDialog({ title: 'Add tower / block', submit: 'Add', fields: [{ name: 'name', label: 'Name', required: true }, [{ name: 'total_floors', label: 'Floors', type: 'number' }, { name: 'units_per_floor', label: 'Units per floor', type: 'number' }]], onSubmit: async (v) => { const x = await api(`/suite/inventory/projects/${p.id}/towers`, { body: v }); draw(); return x.message; } }));
      on('[data-gen]', async () => {
        const o = await options();
        formDialog({
          title: 'Generate units floor by floor', sub: 'Unit numbers like 101, 102 … Existing numbers are skipped.', submit: 'Create units',
          fields: [
            { name: 'building_id', label: 'Tower', type: 'select', options: [['', 'No tower'], ...r.towers.map((t) => [t.id, t.name])] },
            [{ name: 'floor_from', label: 'From floor', type: 'number', value: 1, required: true }, { name: 'floor_to', label: 'To floor', type: 'number', required: true }, { name: 'units_per_floor', label: 'Units per floor', type: 'number', required: true }],
            [{ name: 'unit_type', label: 'Type', type: 'select', required: true, options: o.unitTypes.map((u) => [u, u]) }, { name: 'prefix', label: 'Number prefix', placeholder: 'e.g. A-' }],
            [{ name: 'carpet_area_sqft', label: 'Carpet sq ft', type: 'number' }, { name: 'super_area_sqft', label: 'Super sq ft', type: 'number' }],
            [{ name: 'base_price', label: 'Price per unit (₹)', type: 'number' }, { name: 'rate_per_sqft', label: '…or rate per sq ft', type: 'number' }],
            [{ name: 'floor_rise_per_floor', label: 'Floor rise per floor (₹)', type: 'number' }, { name: 'plc_charges', label: 'PLC (₹)', type: 'number' }]
          ],
          onSubmit: async (v) => { const x = await api('/suite/inventory/units/bulk', { body: { ...v, project_id: p.id } }); draw(); return x.message; }
        });
      });
      on('[data-doc]', async () => {
        const o = await options();
        formDialog({ title: 'Upload project document', submit: 'Upload', fields: [{ name: 'file', label: 'PDF or image (max 15 MB)', type: 'file', accept: 'application/pdf,image/png,image/jpeg,image/webp', required: true }, [{ name: 'title', label: 'Title' }, { name: 'doc_type', label: 'Type', type: 'select', options: o.docTypes.map((x) => [x, label(x)]) }], { name: 'partner_visible', label: 'Partners may see it', type: 'checkbox' }], onSubmit: async (v) => { const form = new FormData(); form.append('file', v.file); form.append('title', v.title || ''); form.append('doc_type', v.doc_type); form.append('partner_visible', v.partner_visible ? '1' : '0'); const x = await api(`/suite/inventory/projects/${p.id}/documents`, { form, method: 'POST' }); draw(); return x.message; } });
      });
      d.body.querySelectorAll('[data-open-doc]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); NXS.openFile(a.dataset.openDoc); }));
      d.body.querySelectorAll('[data-del-doc]').forEach((b) => b.addEventListener('click', async () => { if (!(await NXS.confirm('Remove document?', '', { danger: true }))) return; try { toast((await api(`/suite/inventory/projects/${p.id}/documents/${b.dataset.delDoc}`, { method: 'DELETE' })).message); draw(); } catch (e) { toast(e.message, 'err'); } }));
    };
    draw().catch((e) => { d.body.innerHTML = NXS.errorBox(e); });
  }
  NXS.openProject = openProject;

  /** Private files open through the authenticated endpoint (they are not public links). */
  NXS.openFile = async (url) => {
    try {
      const res = await fetch(url.replace(/^\/api/, (typeof getApiBase === 'function' ? getApiBase() : '/api')), { headers: { Authorization: `Bearer ${state.token}` } });
      if (!res.ok) throw new Error(res.status === 403 ? 'Your role cannot open this file.' : 'File not found.');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (e) { toast(e.message, 'err'); }
  };

  NXS.page('inv-units', {
    title: 'Units', label: 'Units & pricing', icon: 'grid', group: 'Inventory', order: 3, portals: INV, cap: 'inventory.view',
    async render(el, params) {
      const projects = (await api('/suite/inventory/projects?include_archived=1')).data;
      const f = { project_id: params.project_id || '', status: params.status || '', unit_type: '', q: '' };
      const o = await options();
      el.innerHTML = `<div class="sx-filters"><select data-f="project_id"><option value="">All projects</option>${projects.map((p) => `<option value="${p.id}" ${p.id === f.project_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><select data-f="status"><option value="">Any status</option>${['AVAILABLE', 'HOLD', 'BOOKED', 'SOLD', 'ARCHIVED'].map((s) => `<option value="${s}" ${s === f.status ? 'selected' : ''}>${s === 'HOLD' ? 'Reserved' : label(s)}</option>`).join('')}</select><select data-f="unit_type"><option value="">Any type</option>${o.unitTypes.map((u) => `<option>${u}</option>`).join('')}</select><input type="search" placeholder="Unit number" data-f="q"><div class="sx-spacer"></div>${can('inventory.manage') ? '<button class="sx-btn primary" data-new>Add unit</button>' : ''}</div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), {
        exportTitle: 'Units', pageSize: 100,
        columns: [
          { key: 'unit_number', label: 'Unit', render: (u) => `<strong>${esc(u.unit_number)}</strong><span class="sub">${esc(u.project_name)}${u.building_name ? ` · ${esc(u.building_name)}` : ''} · floor ${u.floor_number ?? '—'}</span>` },
          { key: 'unit_type', label: 'Type', render: (u) => `${esc(u.unit_type)}<span class="sub">${u.super_area_sqft || u.carpet_area_sqft || u.plot_area_sqft || '—'} sq ft · ${esc(label(u.facing || ''))}${u.is_corner ? ' · corner' : ''}</span>` },
          { key: 'base_price', label: 'Price', num: true, render: (u) => `${money(Number(u.base_price) + Number(u.plc_charges || 0))}${Number(u.plc_charges) ? `<span class="sub">incl. PLC ${money(u.plc_charges)}</span>` : ''}` },
          { key: 'status', label: 'Status', render: (u) => `${chip(u.status === 'HOLD' ? 'AMBER' : u.status, u.status === 'HOLD' ? 'Reserved' : label(u.status))}${u.deal_number ? `<span class="sub">${esc(u.deal_number)}</span>` : ''}${u.status === 'HOLD' && u.hold_expires_at ? `<span class="sub">until ${when(u.hold_expires_at)}</span>` : ''}` },
          { key: 'allocated_partner', label: 'Allocated to', render: (u) => esc([u.allocated_partner, u.allocated_user].filter(Boolean).join(' & ') || '—') },
          { key: 'age_days', label: 'Days listed', num: true },
          { key: 'act', label: '', nosort: true, noexport: true, render: (u) => (can('inventory.manage') || can('inventory.pricing') ? `<button class="sx-btn sm" data-unit="${u.id}">Manage</button>` : '') }
        ],
        empty: { title: 'No units match' },
        afterDraw: (root) => root.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => manageUnit(rows.find((x) => x.id === b.dataset.unit))))
      });
      let rows = [];
      const load = async () => { rows = (await api(`/suite/inventory/units${NXS.qs({ ...f, limit: 2000 })}`)).data.rows; t.update(rows); };
      function manageUnit(u) {
        const locked = ['BOOKED', 'SOLD'].includes(u.status) || u.hold_deal_id;
        const d = NXS.drawer(`Unit ${u.unit_number}`, { narrow: true });
        d.body.innerHTML = `${locked ? '<div class="sx-note amber">This unit belongs to a booking, so its price and status follow the booking.</div>' : ''}
          <div class="sx-card"><dl class="sx-kv"><dt>Project</dt><dd>${esc(u.project_name)}</dd><dt>Status</dt><dd>${chip(u.status)}</dd><dt>Price</dt><dd>${money(u.base_price, false)} + PLC ${money(u.plc_charges || 0, false)}</dd><dt>Allocated</dt><dd>${esc([u.allocated_partner, u.allocated_user].filter(Boolean).join(' & ') || 'Open sale')}${u.allocation_note ? ` — ${esc(u.allocation_note)}` : ''}</dd></dl></div>
          <div class="sx-stack">
            ${!locked && can('inventory.pricing') ? '<button class="sx-btn" data-x="price">Change price</button>' : ''}
            ${!locked && can('inventory.manage') ? '<button class="sx-btn" data-x="status">Change status (available / reserve / archive)</button>' : ''}
            ${can('inventory.allocate') ? '<button class="sx-btn" data-x="allocate">Allocate to partner / agent</button>' : ''}
            ${can('inventory.manage') ? '<button class="sx-btn" data-x="edit">Edit details</button>' : ''}
            <button class="sx-btn" data-x="history">Change history</button>
          </div>`;
        d.body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async () => {
          const x = b.dataset.x;
          const done = (r) => { d.close(); load(); return r.message; };
          if (x === 'price') formDialog({ title: `Price of ${u.unit_number}`, submit: 'Update price', fields: [[{ name: 'base_price', label: 'Base price (₹)', type: 'number', value: u.base_price, required: true }, { name: 'plc_charges', label: 'PLC (₹)', type: 'number', value: u.plc_charges }], { name: 'reason', label: 'Reason', type: 'textarea', required: true }], onSubmit: async (v) => done(await api(`/suite/inventory/units/${u.id}/price`, { body: v })) });
          if (x === 'status') formDialog({ title: `Status of ${u.unit_number}`, sub: 'Booked and sold come only from bookings.', submit: 'Update', fields: [{ name: 'status', label: 'Status', type: 'select', value: u.status, options: [['AVAILABLE', 'Available'], ['HOLD', 'Reserved (manual hold)'], ['ARCHIVED', 'Archived']] }, { name: 'hold_until', label: 'Hold until (for reserved)', type: 'datetime' }, { name: 'reason', label: 'Reason', type: 'textarea', required: true }], onSubmit: async (v) => done(await api(`/suite/inventory/units/${u.id}/status`, { body: v })) });
          if (x === 'allocate') {
            const firms = (await api('/suite/partner-firms').catch(() => ({ data: [] }))).data;
            const members = can('team.view') ? await NXS.memberOptions() : [];
            formDialog({ title: `Allocate ${u.unit_number}`, sub: 'Leave both empty for open sale.', submit: 'Allocate', fields: [{ name: 'partner_id', label: 'Partner firm', type: 'select', options: [['', '—'], ...firms.map((f2) => [f2.id, f2.firm_name])] }, { name: 'user_id', label: 'Sales agent', type: 'select', options: [['', '—'], ...members] }, { name: 'note', label: 'Note' }], onSubmit: async (v) => done(await api(`/suite/inventory/units/${u.id}/allocate`, { body: v })) });
          }
          if (x === 'edit') formDialog({ title: `Edit ${u.unit_number}`, submit: 'Save', fields: [[{ name: 'unit_number', label: 'Unit number', value: u.unit_number }, { name: 'floor_number', label: 'Floor', type: 'number', value: u.floor_number }], [{ name: 'carpet_area_sqft', label: 'Carpet sq ft', type: 'number', value: u.carpet_area_sqft }, { name: 'super_area_sqft', label: 'Super sq ft', type: 'number', value: u.super_area_sqft }], [{ name: 'facing', label: 'Facing', type: 'select', value: u.facing, options: [['', '—'], ...o.facings.map((x2) => [x2, label(x2)])] }, { name: 'is_corner', label: 'Corner unit', type: 'checkbox', value: Boolean(u.is_corner) }]], onSubmit: async (v) => done(await api(`/suite/inventory/units/${u.id}`, { method: 'PATCH', body: v })) });
          if (x === 'history') {
            const h = (await api(`/suite/timeline/UNIT/${u.id}`)).data;
            NXS.modal(`<h2>${esc(u.unit_number)} history</h2><ul class="sx-tl">${h.map((e) => `<li><span class="dot audit"></span><div><div class="meta">${when(e.created_at)} · ${esc(e.actor_name || 'System')}</div><div class="txt">${esc(e.summary || label(e.action))}</div></div></li>`).join('') || '<li class="sx-muted">No changes recorded.</li>'}</ul><div class="sx-actions"><button class="sx-btn" data-close>Close</button></div>`);
          }
        }));
      }
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.type === 'search' ? 'input' : 'change', () => { f[i.dataset.f] = i.value; clearTimeout(i._t); i._t = setTimeout(load, 250); }));
      const nb = el.querySelector('[data-new]');
      if (nb) nb.addEventListener('click', () => formDialog({
        title: 'Add a unit', submit: 'Add unit',
        fields: [{ name: 'project_id', label: 'Project', type: 'select', required: true, value: f.project_id, options: [['', 'Choose…'], ...projects.map((p) => [p.id, p.name])] }, [{ name: 'unit_number', label: 'Unit number', required: true }, { name: 'floor_number', label: 'Floor', type: 'number' }], [{ name: 'unit_type', label: 'Type', type: 'select', required: true, options: o.unitTypes.map((u) => [u, u]) }, { name: 'facing', label: 'Facing', type: 'select', options: [['', '—'], ...o.facings.map((x) => [x, label(x)])] }], [{ name: 'carpet_area_sqft', label: 'Carpet sq ft', type: 'number' }, { name: 'super_area_sqft', label: 'Super sq ft', type: 'number' }], [{ name: 'base_price', label: 'Price (₹)', type: 'number', required: true }, { name: 'plc_charges', label: 'PLC (₹)', type: 'number' }]],
        onSubmit: async (v) => { const r = await api('/suite/inventory/units', { body: v }); load(); return r.message; }
      }));
      await load();
    }
  });

  NXS.page('inv-ageing', {
    title: 'Inventory ageing', label: 'Ageing', icon: 'clock', group: 'Inventory', order: 4, portals: INV, cap: 'inventory.view',
    async render(el) {
      const r = (await api('/suite/inventory/ageing')).data;
      const keys = Object.keys(r.buckets);
      el.innerHTML = `<div class="sx-grid"><div class="sx-card"><div class="sx-card-head"><h3>Available units by days listed</h3></div><div data-c></div></div><div class="sx-card"><div class="sx-card-head"><h3>Unsold value by age</h3></div><div data-v></div></div></div><div class="sx-card" style="margin-top:16px" data-list></div>`;
      // ordinal: older stock is darker (one hue, monotone lightness)
      charts.hbars(el.querySelector('[data-c]'), keys.map((k, i) => ({ label: `${k} days`, value: r.buckets[k], color: `var(--seq-${i + 1})` })), { format: num });
      charts.hbars(el.querySelector('[data-v]'), keys.map((k, i) => ({ label: `${k} days`, value: r.value[k], color: `var(--seq-${i + 1})` })), { format: (v) => money(v) });
      table(el.querySelector('[data-list]'), { rows: r.rows, exportTitle: 'Unsold units by age', columns: [{ key: 'project_name', label: 'Project' }, { key: 'unit_number', label: 'Unit', render: (u) => `${esc(u.unit_number)}<span class="sub">${esc(u.building_name || '')}</span>` }, { key: 'unit_type', label: 'Type' }, { key: 'base_price', label: 'Price', num: true, render: (u) => money(Number(u.base_price) + Number(u.plc_charges || 0)) }, { key: 'age_days', label: 'Days listed', num: true }] });
    }
  });

  // ------------------------------------------------------------------ property directory (all sales roles in the suite)
  NXS.page('inv-directory', {
    title: 'Property directory', label: 'Property directory', icon: 'map', group: 'Inventory', order: 5, portals: ['inventory', 'sales-head', 'sales-manager', 'marketing', 'crm'], cap: 'inventory.directory',
    async render(el) {
      const o = await options();
      const f = { q: '', city: '', unit_type: '', min_price: '', max_price: '' };
      const first = (await api('/suite/inventory/directory')).data;
      el.innerHTML = `<div class="sx-filters"><input type="search" placeholder="Project, locality or unit" data-f="q"><select data-f="city"><option value="">Any city</option>${first.cities.map((c) => `<option>${esc(c)}</option>`).join('')}</select><select data-f="unit_type"><option value="">Any type</option>${o.unitTypes.map((u) => `<option>${u}</option>`).join('')}</select><input type="number" placeholder="Min ₹" data-f="min_price"><input type="number" placeholder="Max ₹" data-f="max_price"></div><div class="sx-card" data-list></div>`;
      const t = table(el.querySelector('[data-list]'), { rows: first.rows, exportTitle: 'Available units', columns: [{ key: 'project_name', label: 'Project', render: (u) => `<strong>${esc(u.project_name)}</strong><span class="sub">${esc(u.location)}, ${esc(u.city)} · ${esc(label(u.project_status))}</span>` }, { key: 'unit_number', label: 'Unit', render: (u) => `${esc(u.unit_number)}<span class="sub">${esc(u.building_name || '')} · floor ${u.floor_number ?? '—'}</span>` }, { key: 'unit_type', label: 'Type' }, { key: 'super_area_sqft', label: 'Area', num: true, render: (u) => num(u.super_area_sqft || u.carpet_area_sqft || u.plot_area_sqft || 0) }, { key: 'facing', label: 'Facing', render: (u) => esc(label(u.facing || '')) }, { key: 'base_price', label: 'Price', num: true, render: (u) => money(Number(u.base_price) + Number(u.plc_charges || 0)) }, { key: 'possession_date', label: 'Possession' }], empty: { title: 'No available units match' } });
      el.querySelectorAll('[data-f]').forEach((i) => i.addEventListener(i.type === 'search' || i.type === 'number' ? 'input' : 'change', () => { f[i.dataset.f] = i.value; clearTimeout(i._t); i._t = setTimeout(async () => t.update((await api(`/suite/inventory/directory${NXS.qs(f)}`)).data.rows), 300); }));
    }
  });
})();
