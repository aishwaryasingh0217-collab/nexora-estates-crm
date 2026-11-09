/* Business Suite — Inside Sales (Telecaller), Outside Sales (Field Agent), and Channel Partner Portals. */
(function () {
  'use strict';
  const NXS = window.NXS;
  const { esc, api, chip, when, ago, money, num, label, toast, table, formDialog, modal, drawer, kpi, can, icon } = NXS;

  const INSIDE = ['inside-sales', 'sales-head', 'sales-manager', 'owner'];
  const OUTSIDE = ['outside-sales', 'sales-head', 'sales-manager', 'owner'];
  const PARTNER = ['channel-partner', 'sales-head', 'sales-manager', 'owner'];

  // ==========================================================================
  // 1. INSIDE SALES PORTAL (TELECALLER)
  // ==========================================================================

  // 1A. Calling Queue & Smart Dialer
  NXS.page('telecaller-queue', {
    title: 'Calling Pipeline & Dialer Queue', label: 'Calling Queue', icon: 'phone', group: 'Calling Desk', order: 1, portals: INSIDE,
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-toolbar></div><div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      const toolbar = el.querySelector('[data-toolbar]');

      let currentTab = 'fresh';
      let queueData = null;

      const load = async () => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api('/suite/inside/queue')).data;
          queueData = res;
          paint();
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      const paint = () => {
        const sc = queueData.scoreboard || {};
        const fresh = queueData.fresh || [];
        const today = queueData.today || [];
        const overdue = queueData.overdue || [];
        const revival = queueData.revival || [];

        toolbar.innerHTML = `
          <button class="sx-btn ${currentTab === 'fresh' ? 'primary' : ''}" data-tab="fresh">⚡ Fresh Leads (${fresh.length})</button>
          <button class="sx-btn ${currentTab === 'today' ? 'primary' : ''}" data-tab="today">📅 Due Today (${today.length})</button>
          <button class="sx-btn ${currentTab === 'overdue' ? 'danger' : ''}" data-tab="overdue">⚠️ Overdue (${overdue.length})</button>
          <button class="sx-btn ${currentTab === 'revival' ? 'primary' : ''}" data-tab="revival">🔄 Cold Revival (${revival.length})</button>
          <div class="sx-spacer"></div>
          <button class="sx-btn" data-act="refresh">${icon('swap')} Refresh Queue</button>
        `;

        toolbar.querySelectorAll('[data-tab]').forEach((b) => {
          b.addEventListener('click', () => { currentTab = b.dataset.tab; paint(); });
        });
        toolbar.querySelector('[data-act="refresh"]').addEventListener('click', load);

        let activeList = fresh;
        let emptyMsg = 'No fresh leads in queue. Great job staying on top of incoming inquiries!';
        if (currentTab === 'today') { activeList = today; emptyMsg = 'No more follow-ups scheduled for today.'; }
        else if (currentTab === 'overdue') { activeList = overdue; emptyMsg = 'Zero overdue follow-ups! 100% adherence.'; }
        else if (currentTab === 'revival') { activeList = revival; emptyMsg = 'No revival leads currently pending.'; }

        body.innerHTML = `
          <!-- Telecaller Daily Scoreboard KPI Row -->
          <div class="sx-kpis" style="margin-bottom:16px">
            ${kpi('Calls Made Today', `${sc.callsToday} / ${sc.targetCalls}`, { hint: `${Math.round((sc.callsToday / (sc.targetCalls || 1)) * 100)}% daily target achieved`, tone: sc.callsToday >= sc.targetCalls ? 'good' : '' })}
            ${kpi('Connect Rate', `${sc.connectRate}%`, { hint: `${sc.connectsToday} successful connects`, tone: sc.connectRate >= 60 ? 'good' : '' })}
            ${kpi('Visits Booked', num(sc.visitsBooked), { hint: 'scheduled today', tone: sc.visitsBooked ? 'good' : '' })}
            ${kpi('Response SLA', `${sc.slaCompliance}%`, { hint: 'leads contacted within 30m', tone: sc.slaCompliance >= 85 ? 'good' : 'warn' })}
          </div>

          <div class="sx-card">
            <div class="sx-card-head">
              <h3>${currentTab === 'fresh' ? 'Fresh Uncontacted Inquiries' : currentTab === 'today' ? 'Follow-ups Scheduled for Today' : currentTab === 'overdue' ? 'Critical Overdue Follow-ups' : 'Cold Leads for Re-engagement'}</h3>
              <span class="sx-sub">Showing ${activeList.length} leads in current queue</span>
            </div>
            <div data-table></div>
          </div>
        `;

        const tblEl = body.querySelector('[data-table]');
        table(tblEl, {
          columns: [
            {
              key: 'client_name',
              label: 'Lead Contact',
              render: (r) => `<strong>${esc(NXS.fullName(r.first_name, r.last_name))}</strong><span class="sub">${esc(r.phone)}${r.email ? ` · ${esc(r.email)}` : ''}</span>`
            },
            {
              key: 'project_name',
              label: 'Interest / Project',
              render: (r) => `${esc(r.project_name || 'General Inquiry')}<span class="sub">${esc([r.configuration, r.budget_max ? money(r.budget_max) : ''].filter(Boolean).join(' · ') || 'Budget open')}</span>`
            },
            {
              key: 'stage',
              label: 'Stage / SLA',
              render: (r) => {
                if (currentTab === 'fresh') {
                  const mins = r.age_minutes || 0;
                  const isSlaBreached = mins > 30;
                  return `${chip(r.bucket, label(r.stage))} <span class="sx-sla-badge ${isSlaBreached ? '' : 'ok'}">${mins}m ago</span>`;
                }
                if (currentTab === 'overdue') {
                  return `${chip('LOST', 'Overdue')} <span class="sx-sla-badge">${r.overdue_hours || 1}h late</span>`;
                }
                return `${chip(r.bucket, label(r.stage))}${r.temperature ? ` ${chip(r.temperature)}` : ''}`;
              }
            },
            {
              key: 'source',
              label: 'Source',
              render: (r) => `${esc(label(r.source || 'Direct'))}${r.partner_firm ? `<span class="sub">via ${esc(r.partner_firm)}</span>` : ''}`
            },
            {
              key: 'followup',
              label: 'Follow-up Due',
              render: (r) => r.next_follow_up_at ? when(r.next_follow_up_at) : 'Not set'
            },
            {
              key: 'actions',
              label: 'Action',
              render: (r) => `
                <div style="display:flex;gap:6px">
                  <button class="sx-btn primary sm" data-call="${esc(r.id)}">${icon('phone')} Call Now</button>
                  <button class="sx-btn sm" data-lead="${esc(r.id)}">Details</button>
                </div>
              `
            }
          ],
          rows: activeList,
          empty: { title: emptyMsg },
          onRow: (r, e) => {
            if (e.target.closest('[data-call]')) {
              openDispositionModal(r, load);
            } else if (e.target.closest('[data-lead]')) {
              NXS.openLead(r.id);
            }
          }
        });
      };

      await load();
    }
  });

  // 1B. My Assigned Leads Table
  NXS.page('telecaller-leads', {
    title: 'My Assigned Leads', label: 'My Leads', icon: 'lead', group: 'Calling Desk', order: 2, portals: INSIDE,
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-f></div><div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      const fEl = el.querySelector('[data-f]');

      let leads = [];
      const load = async () => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api('/suite/sales/leads?limit=300')).data;
          leads = res.rows || [];
          paint();
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      const paint = () => {
        fEl.innerHTML = `
          <input type="search" placeholder="Search name or phone..." data-q style="min-width:220px">
          <select data-stage>
            <option value="">All Stages</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted / Follow-up</option>
            <option value="VISIT_SCHEDULED">Visit Scheduled</option>
            <option value="VISIT_COMPLETED">Visited</option>
            <option value="BOOKED">Booked</option>
            <option value="LOST">Lost</option>
          </select>
          <div class="sx-spacer"></div>
          <button class="sx-btn primary" data-act="new-lead">+ Add Lead</button>
        `;

        fEl.querySelector('[data-act="new-lead"]').addEventListener('click', () => {
          NXS.openCreateLeadModal ? NXS.openCreateLeadModal(load) : openNewLeadDialog(load);
        });

        const filterAndRender = () => {
          const q = fEl.querySelector('[data-q]').value.toLowerCase();
          const st = fEl.querySelector('[data-stage]').value;
          const filtered = leads.filter((l) => {
            const matchesQ = !q || (l.first_name + ' ' + (l.last_name || '') + ' ' + l.phone).toLowerCase().includes(q);
            const matchesSt = !st || l.stage === st || l.bucket === st;
            return matchesQ && matchesSt;
          });

          table(body, {
            columns: [
              { key: 'name', label: 'Lead Name', render: (r) => `<strong>${esc(NXS.fullName(r.first_name, r.last_name))}</strong><span class="sub">${esc(r.phone)}</span>` },
              { key: 'project', label: 'Project', render: (r) => esc(r.project_name || '—') },
              { key: 'stage', label: 'Stage', render: (r) => chip(r.bucket, label(r.stage)) },
              { key: 'budget', label: 'Budget', render: (r) => r.budget_max ? money(r.budget_max) : '—' },
              { key: 'next_follow_up_at', label: 'Next Due', render: (r) => r.next_follow_up_at ? when(r.next_follow_up_at) : '—' },
              {
                key: 'action',
                label: 'Action',
                render: (r) => `<button class="sx-btn sm primary" data-call="${esc(r.id)}">${icon('phone')} Call</button>`
              }
            ],
            rows: filtered,
            onRow: (r, e) => {
              if (e.target.closest('[data-call]')) {
                openDispositionModal(r, load);
              } else {
                NXS.openLead(r.id);
              }
            }
          });
        };

        fEl.querySelector('[data-q]').addEventListener('input', filterAndRender);
        fEl.querySelector('[data-stage]').addEventListener('change', filterAndRender);
        filterAndRender();
      };

      await load();
    }
  });

  // 1C. Scheduled Site Visits
  NXS.page('telecaller-visits', {
    title: 'Site Visits Scheduled', label: 'Site Visits', icon: 'calendar', group: 'Calling Desk', order: 3, portals: INSIDE,
    async render(el) {
      el.innerHTML = '<div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      try {
        const res = (await api('/suite/sales/visits')).data;
        const visits = res.rows || [];
        table(body, {
          columns: [
            { key: 'client_name', label: 'Client', render: (r) => `<strong>${esc(r.client_name)}</strong><span class="sub">${esc(r.phone || '')}</span>` },
            { key: 'project_name', label: 'Project', render: (r) => esc(r.project_name) },
            { key: 'scheduled_time', label: 'Date & Slot', render: (r) => when(r.scheduled_time) },
            { key: 'agent_name', label: 'Field Agent', render: (r) => esc(r.agent_name || 'Unallocated') },
            { key: 'status', label: 'Visit Status', render: (r) => chip(r.status) },
            { key: 'feedback', label: 'Notes / Pickup', render: (r) => esc(r.client_feedback || '—') }
          ],
          rows: visits,
          empty: { title: 'No scheduled site visits found.' }
        });
      } catch (err) {
        body.innerHTML = NXS.errorBox(err);
      }
    }
  });

  // 1D. Live Available Units Matcher & Brochure Hub
  NXS.page('telecaller-inventory', {
    title: 'Live Inventory & Brochure Hub', label: 'Live Inventory', icon: 'grid', group: 'Resources', order: 4, portals: INSIDE,
    async render(el) {
      el.innerHTML = `
        <div class="sx-filters" data-f>
          <select data-config>
            <option value="">Any Typology</option>
            <option value="2BHK">2 BHK</option>
            <option value="3BHK">3 BHK</option>
            <option value="4BHK">4 BHK</option>
            <option value="PENTHOUSE">Penthouse</option>
            <option value="VILLA">Villa</option>
          </select>
          <input type="number" data-budget placeholder="Max Budget (e.g. 15000000)" style="min-width:180px">
          <button class="sx-btn primary" data-act="search">Filter Units</button>
        </div>
        <div data-body>${NXS.loading()}</div>
      `;

      const body = el.querySelector('[data-body]');
      const f = el.querySelector('[data-f]');

      const search = async () => {
        body.innerHTML = NXS.loading();
        const cfg = f.querySelector('[data-config]').value;
        const bgt = f.querySelector('[data-budget]').value;
        try {
          const res = (await api(`/suite/inside/inventory-match${NXS.qs({ configuration: cfg, max_budget: bgt })}`)).data;
          const units = res.units || [];
          if (!units.length) {
            body.innerHTML = '<div class="sx-card"><p class="sx-muted">No units currently match these filter criteria.</p></div>';
            return;
          }
          body.innerHTML = `
            <div class="sx-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
              ${units.map((u) => `
                <div class="sx-card">
                  <div class="sx-row">
                    <strong>${esc(u.project_name)} · Unit ${esc(u.unit_number)}</strong>
                    <span class="sx-unit-pill avail">Available</span>
                  </div>
                  <dl class="sx-kv" style="margin:10px 0">
                    <dt>Typology / Facing</dt><dd>${esc(u.unit_type)} · ${esc(u.facing || 'East')}</dd>
                    <dt>Floor / Carpet</dt><dd>Floor ${u.floor_number} · ${num(u.carpet_area_sqft)} sq.ft</dd>
                    <dt>Base Price</dt><dd><strong>${money(u.base_price)}</strong></dd>
                    <dt>Possession</dt><dd>${esc(u.possession_date || 'Ready')}</dd>
                  </dl>
                  <div class="sx-row" style="margin-top:10px;gap:6px">
                    ${u.brochure_url ? `<a href="${esc(u.brochure_url)}" target="_blank" class="sx-btn sm">${icon('download')} Brochure</a>` : ''}
                    <button class="sx-btn primary sm" data-share="${esc(u.unit_number)}" data-proj="${esc(u.project_name)}" data-price="${esc(money(u.base_price))}">${icon('share')} WhatsApp</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;

          body.querySelectorAll('[data-share]').forEach((b) => {
            b.addEventListener('click', () => {
              const text = encodeURIComponent(`Hi! Sharing details for ${b.dataset.proj} - Unit ${b.dataset.share}. Base Price: ${b.dataset.price}. Let me know if you would like to book a site visit!`);
              window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
            });
          });
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      f.querySelector('[data-act="search"]').addEventListener('click', search);
      await search();
    }
  });

  // Call Disposition & Instant Site Visit Modal
  function openDispositionModal(lead, onDone) {
    let selectedOutcome = 'CONNECTED_INTERESTED';
    let durationSec = 120;
    let timerInterval = null;

    const m = modal(`
      <div style="max-width:560px">
        <div class="sx-row" style="margin-bottom:12px">
          <div>
            <h2 style="margin:0">${esc(NXS.fullName(lead.first_name, lead.last_name))}</h2>
            <span class="sx-sub">${esc(lead.phone)} · ${esc(lead.project_name || 'General Inquiry')}</span>
          </div>
          <div class="sx-spacer"></div>
          <div id="sx-call-timer" style="font-family:monospace;font-size:1.15rem;font-weight:700;color:var(--sx-green);background:var(--sx-green-bg);padding:4px 10px;border-radius:6px">
            02:00
          </div>
        </div>

        <div style="font-size:.78rem;font-weight:700;color:var(--sx-muted);text-transform:uppercase;margin-bottom:6px">
          Select Call Outcome (Disposition)
        </div>
        <div class="sx-dispo-grid" id="sx-dispo-options">
          <button type="button" class="sx-dispo-btn active" data-val="CONNECTED_INTERESTED">✨ Interested</button>
          <button type="button" class="sx-dispo-btn" data-val="SITE_VISIT_SCHEDULED">📅 Book Visit</button>
          <button type="button" class="sx-dispo-btn" data-val="CALLBACK_REQUESTED">⏰ Callback</button>
          <button type="button" class="sx-dispo-btn" data-val="BUSY">📵 Busy / No Answer</button>
          <button type="button" class="sx-dispo-btn" data-val="NOT_INTERESTED">❌ Not Interested</button>
          <button type="button" class="sx-dispo-btn" data-val="INVALID_NUMBER">🚫 Invalid No.</button>
        </div>

        <form id="sx-dispo-form" class="sx-form" style="margin-top:14px">
          <label class="sx-field">
            <span>Call Summary / Notes *</span>
            <textarea name="notes" rows="2" placeholder="Key discussion points, objections, client preferences..." required></textarea>
          </label>

          <!-- Follow-up or Visit fields -->
          <div id="sx-next-step-box" style="margin-top:10px">
            <div class="sx-form-row">
              <label class="sx-field">
                <span>Next Follow-up Date & Time</span>
                <input type="datetime-local" name="next_follow_up_at">
              </label>
              <label class="sx-field">
                <span>Client Temperature</span>
                <select name="temperature">
                  <option value="HOT" ${lead.temperature === 'HOT' ? 'selected' : ''}>🔥 Hot (Closing in 7-15d)</option>
                  <option value="WARM" ${lead.temperature === 'WARM' || !lead.temperature ? 'selected' : ''}>☀️ Warm (Interested)</option>
                  <option value="COLD" ${lead.temperature === 'COLD' ? 'selected' : ''}>❄️ Cold (Browsing)</option>
                </select>
              </label>
            </div>
          </div>

          <!-- Quick Qualification Accordion -->
          <details style="margin:12px 0;background:var(--sx-soft);padding:10px;border-radius:8px">
            <summary style="font-weight:700;font-size:.85rem;cursor:pointer">📋 Update Client Qualification Checklist</summary>
            <div class="sx-form-row" style="margin-top:10px">
              <label class="sx-field"><span>Min Budget (₹)</span><input type="number" name="budget_min" value="${lead.budget_min || ''}"></label>
              <label class="sx-field"><span>Max Budget (₹)</span><input type="number" name="budget_max" value="${lead.budget_max || ''}"></label>
            </div>
            <div class="sx-form-row">
              <label class="sx-field">
                <span>Typology</span>
                <select name="configuration">
                  <option value="">Select...</option>
                  <option value="2BHK" ${lead.configuration === '2BHK' ? 'selected' : ''}>2 BHK</option>
                  <option value="3BHK" ${lead.configuration === '3BHK' ? 'selected' : ''}>3 BHK</option>
                  <option value="4BHK" ${lead.configuration === '4BHK' ? 'selected' : ''}>4 BHK</option>
                  <option value="Villa" ${lead.configuration === 'Villa' ? 'selected' : ''}>Villa</option>
                  <option value="Plot" ${lead.configuration === 'Plot' ? 'selected' : ''}>Plot</option>
                </select>
              </label>
              <label class="sx-field">
                <span>Purchase Timeline</span>
                <select name="purchase_timeline">
                  <option value="IMMEDIATE">Immediate (Ready to buy)</option>
                  <option value="3_MONTHS">Within 3 Months</option>
                  <option value="6_MONTHS">Within 6 Months</option>
                  <option value="EXPLORING">Exploring options</option>
                </select>
              </label>
            </div>
          </details>

          <div class="sx-actions" style="margin-top:16px">
            <button type="button" class="sx-btn" data-close>Cancel</button>
            <button type="button" class="sx-btn" id="sx-open-scheduler">${icon('calendar')} Instant Visit Scheduler</button>
            <button type="submit" class="sx-btn primary">Save Disposition</button>
          </div>
        </form>
      </div>
    `, {
      onClose: () => { clearInterval(timerInterval); }
    });

    // Start live timer
    let elapsed = 0;
    timerInterval = setInterval(() => {
      elapsed++;
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      const timerEl = document.getElementById('sx-call-timer');
      if (timerEl) timerEl.textContent = `${min}:${sec}`;
    }, 1000);

    const dispoOptions = m.el.querySelectorAll('.sx-dispo-btn');
    dispoOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        dispoOptions.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedOutcome = btn.dataset.val;
      });
    });

    m.el.querySelector('#sx-open-scheduler').addEventListener('click', () => {
      m.close();
      openInstantVisitScheduler(lead, onDone);
    });

    const form = m.el.querySelector('#sx-dispo-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const notes = fd.get('notes');
      const nextFollowUp = fd.get('next_follow_up_at');
      const temp = fd.get('temperature');

      const qual = {
        budget_min: fd.get('budget_min'),
        budget_max: fd.get('budget_max'),
        configuration: fd.get('configuration'),
        purchase_timeline: fd.get('purchase_timeline')
      };

      try {
        await api('/suite/inside/disposition', {
          body: {
            lead_id: lead.id,
            outcome: selectedOutcome,
            notes,
            call_duration_sec: elapsed,
            next_follow_up_at: nextFollowUp,
            temperature: temp,
            qualification: qual
          }
        });
        toast('Call disposition and notes saved successfully!');
        m.close();
        if (onDone) onDone();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  }

  // Instant Site Visit Scheduler Dialog
  async function openInstantVisitScheduler(lead, onDone) {
    let projects = [];
    let fieldAgents = [];
    try {
      const pRes = (await api('/suite/outside/project-matrix')).data;
      projects = pRes.projects || [];
      const mRes = (await api('/suite/sales/members')).data;
      fieldAgents = mRes.filter((m) => m.role === 'OUTSIDE_SALES' || m.role === 'ADMIN');
    } catch (e) { /* continue */ }

    formDialog({
      title: `Schedule Site Visit — ${NXS.fullName(lead.first_name, lead.last_name)}`,
      sub: 'Assign field sales executive and arrange client arrival',
      fields: [
        {
          name: 'project_id',
          label: 'Project *',
          type: 'select',
          required: true,
          options: projects.map((p) => [p.id, `${p.name} (${p.location})`]),
          value: lead.preferred_project_id || (projects[0] ? projects[0].id : '')
        },
        {
          name: 'scheduled_time',
          label: 'Visit Date & Slot *',
          type: 'datetime',
          required: true,
          hint: 'Select the scheduled client arrival time'
        },
        {
          name: 'assigned_agent_id',
          label: 'Field Sales Agent',
          type: 'select',
          options: [['', 'Unallocated (Sales Desk Assignment)'], ...fieldAgents.map((a) => [a.id, `${a.name} (Field Agent)`])]
        },
        {
          name: 'cab_pickup_required',
          label: 'Arrange Complimentary Cab Pickup for Client',
          type: 'checkbox'
        },
        {
          name: 'cab_pickup_address',
          label: 'Client Pickup Location / Landmark',
          type: 'text',
          placeholder: 'Enter pickup address or landmark'
        },
        {
          name: 'notes',
          label: 'Handover Instructions for Field Agent',
          type: 'textarea',
          placeholder: 'e.g. Client interested in 3BHK East-facing higher floors, loan pre-approved'
        }
      ],
      submit: 'Confirm Site Visit',
      onSubmit: async (v) => {
        await api('/suite/inside/schedule-visit', {
          body: {
            lead_id: lead.id,
            project_id: v.project_id,
            scheduled_time: v.scheduled_time,
            assigned_agent_id: v.assigned_agent_id || null,
            notes: v.notes,
            cab_pickup_required: v.cab_pickup_required,
            cab_pickup_address: v.cab_pickup_address
          }
        });
        toast('Site visit confirmed and dispatched to field sales!');
        if (onDone) onDone();
      }
    });
  }

  // ==========================================================================
  // 2. OUTSIDE SALES PORTAL (FIELD / SITE AGENT)
  // ==========================================================================

  // 2A. Site Visit Command Center
  NXS.page('siteagent-visits', {
    title: 'Site Visit Command Center', label: 'Today\'s Visits', icon: 'calendar', group: 'Site Operations', order: 1, portals: OUTSIDE,
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-toolbar></div><div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      const toolbar = el.querySelector('[data-toolbar]');

      let currentTab = 'today';
      let visitData = null;

      const load = async () => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api('/suite/outside/visits')).data;
          visitData = res;
          paint();
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      const paint = () => {
        const m = visitData.metrics || {};
        const today = visitData.today || [];
        const upcoming = visitData.upcoming || [];
        const completed = visitData.completed || [];

        toolbar.innerHTML = `
          <button class="sx-btn ${currentTab === 'today' ? 'primary' : ''}" data-tab="today">📍 Today's Visits (${today.length})</button>
          <button class="sx-btn ${currentTab === 'upcoming' ? 'primary' : ''}" data-tab="upcoming">🗓️ Upcoming (${upcoming.length})</button>
          <button class="sx-btn ${currentTab === 'completed' ? 'primary' : ''}" data-tab="completed">✓ Completed & Past (${completed.length})</button>
          <div class="sx-spacer"></div>
          <button class="sx-btn" data-act="refresh">${icon('swap')} Refresh</button>
        `;

        toolbar.querySelectorAll('[data-tab]').forEach((b) => {
          b.addEventListener('click', () => { currentTab = b.dataset.tab; paint(); });
        });
        toolbar.querySelector('[data-act="refresh"]').addEventListener('click', load);

        body.innerHTML = `
          <!-- Outside Sales KPI Scoreboard -->
          <div class="sx-kpis" style="margin-bottom:16px">
            ${kpi('Visits Today', num(m.todayCount), { hint: 'scheduled at site', tone: m.todayCount ? 'good' : '' })}
            ${kpi('Completed This Month', num(m.monthCompleted), { hint: 'physical visits conducted' })}
            ${kpi('Closed Bookings', num(m.bookingsCount), { hint: `${m.conversionPct}% visit conversion rate`, tone: m.bookingsCount ? 'good' : '' })}
            ${kpi('Closed Gross Sales', money(m.closedRevenue), { hint: 'total agreement value' })}
            ${kpi('Earned Incentive', money(m.incentiveEst), { hint: 'estimated payout at 0.25%', tone: 'good' })}
          </div>

          <div class="sx-card">
            <div class="sx-card-head">
              <h3>${currentTab === 'today' ? "Today's Client Site Visits" : currentTab === 'upcoming' ? 'Upcoming Scheduled Arrivals' : 'Completed & Past Site Visits'}</h3>
              <span class="sx-sub">Field Agent Gallery Command</span>
            </div>
            <div data-list></div>
          </div>
        `;

        const listEl = body.querySelector('[data-list]');
        const activeList = currentTab === 'today' ? today : currentTab === 'upcoming' ? upcoming : completed;

        if (!activeList.length) {
          listEl.innerHTML = '<p class="sx-muted" style="padding:16px 0">No visits in this view.</p>';
          return;
        }

        listEl.innerHTML = `
          <div style="display:grid;gap:12px">
            ${activeList.map((v) => `
              <div class="sx-card" style="border-left: 4px solid ${v.status === 'COMPLETED' ? 'var(--sx-green)' : v.status === 'IN_PROGRESS' ? 'var(--sx-blue)' : 'var(--sx-amber)'}">
                <div class="sx-row">
                  <div>
                    <h3 style="margin:0">${esc(v.client_name)}</h3>
                    <span class="sx-sub">${esc(v.phone)} · <strong>${esc(v.project_name)}</strong></span>
                  </div>
                  <div class="sx-spacer"></div>
                  <div style="text-align:right">
                    <span style="font-weight:700;font-size:.95rem">${when(v.scheduled_time)}</span>
                    <div>${chip(v.status)} ${v.temperature ? chip(v.temperature) : ''}</div>
                  </div>
                </div>

                <div style="background:var(--sx-soft);padding:10px 12px;border-radius:8px;margin:10px 0;font-size:.85rem">
                  <div><strong>Requirements:</strong> ${esc(v.configuration || 'Open')} · Budget: ${v.budget_max ? money(v.budget_max) : 'Flexible'}</div>
                  ${v.lead_notes ? `<div style="margin-top:4px"><strong>Telecaller Notes:</strong> ${esc(v.lead_notes)}</div>` : ''}
                  ${v.client_feedback ? `<div style="margin-top:4px;color:var(--sx-blue)"><strong>Visit Feedback:</strong> “${esc(v.client_feedback)}”</div>` : ''}
                  ${v.check_in_distance_m != null ? `<div style="margin-top:4px;color:var(--sx-green)"><strong>GPS Verified:</strong> ${v.check_in_distance_m}m from site gallery at ${when(v.check_in_at)}</div>` : ''}
                </div>

                <div class="sx-row" style="gap:8px;flex-wrap:wrap">
                  <a href="tel:${esc(v.phone)}" class="sx-btn sm">${icon('phone')} Call Client</a>
                  <a href="https://api.whatsapp.com/send?phone=${esc((v.phone || '').replace(/\D/g, ''))}" target="_blank" class="sx-btn sm">${icon('spark')} WhatsApp</a>
                  <button class="sx-btn sm" data-checkin="${esc(v.id)}">📍 Geo Check-in / Status</button>
                  <button class="sx-btn primary sm" data-spotbook="${esc(v.lead_id)}" data-proj="${esc(v.project_id)}">✍️ Spot Booking Token</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        listEl.querySelectorAll('[data-checkin]').forEach((b) => {
          b.addEventListener('click', () => {
            const v = activeList.find((x) => x.id === b.dataset.checkin);
            if (v) openGeoCheckInDialog(v, load);
          });
        });

        listEl.querySelectorAll('[data-spotbook]').forEach((b) => {
          b.addEventListener('click', () => {
            openSpotBookingModal(b.dataset.spotbook, b.dataset.proj, load);
          });
        });
      };

      await load();
    }
  });

  // 2B. Digital Project Showcase & Interactive Unit Matrix
  NXS.page('siteagent-matrix', {
    title: 'Digital Project Showcase & Unit Matrix', label: 'Unit Matrix', icon: 'building', group: 'Site Operations', order: 2, portals: OUTSIDE,
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-picker></div><div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      const picker = el.querySelector('[data-picker]');

      let currentProjectId = '';

      const load = async (projId = '') => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api(`/suite/outside/project-matrix${projId ? `?project_id=${projId}` : ''}`)).data;
          const projects = res.projects || [];
          const sel = res.selectedProject || projects.find((p) => num(p.unit_count) > 0) || projects[0] || {};
          currentProjectId = sel.id;
          const units = res.units || [];

          picker.innerHTML = `
            <select data-proj style="min-width:240px">
              ${projects.map((p) => `<option value="${p.id}" ${p.id === currentProjectId ? 'selected' : ''}>${esc(p.name)} (${p.city || p.location})</option>`).join('')}
            </select>
            <div class="sx-spacer"></div>
            <div style="display:flex;gap:12px;align-items:center;font-size:.82rem;font-weight:600">
              <span style="display:flex;align-items:center;gap:4px"><span class="sx-unit-pill avail" style="min-width:18px;padding:2px 6px">●</span> Available</span>
              <span style="display:flex;align-items:center;gap:4px"><span class="sx-unit-pill hold" style="min-width:18px;padding:2px 6px">●</span> Hold / Token</span>
              <span style="display:flex;align-items:center;gap:4px"><span class="sx-unit-pill booked" style="min-width:18px;padding:2px 6px">●</span> Booked / Sold</span>
            </div>
          `;

          picker.querySelector('[data-proj]').addEventListener('change', (e) => {
            load(e.target.value);
          });

          // Group units by floor
          const floors = {};
          units.forEach((u) => {
            const fl = u.floor_number ?? 0;
            if (!floors[fl]) floors[fl] = [];
            floors[fl].push(u);
          });

          const sortedFloors = Object.keys(floors).sort((a, b) => Number(b) - Number(a));

          body.innerHTML = `
            <div class="sx-card" style="margin-bottom:14px">
              <div class="sx-row">
                <div>
                  <h2 style="margin:0">${esc(sel.name)}</h2>
                  <span class="sx-sub">${esc(sel.location || '')} · RERA: ${esc(sel.rera_number || 'Approved')}</span>
                </div>
                <div class="sx-spacer"></div>
                ${sel.brochure_url ? `<a href="${esc(sel.brochure_url)}" target="_blank" class="sx-btn">${icon('download')} Official Brochure PDF</a>` : ''}
              </div>
            </div>

            <div class="sx-card">
              <div class="sx-card-head">
                <h3>Visual Floor & Unit Availability Grid</h3>
                <span class="sx-sub">Click any unit to view all-inclusive cost sheet breakdown</span>
              </div>

              <div class="sx-unit-matrix">
                ${sortedFloors.length ? sortedFloors.map((fl) => `
                  <div class="sx-floor-row">
                    <div class="sx-floor-label">Floor ${fl}</div>
                    <div class="sx-floor-units">
                      ${floors[fl].map((u) => `
                        <button class="sx-unit-pill ${u.status === 'AVAILABLE' ? 'avail' : u.status === 'HOLD' ? 'hold' : 'booked'}" data-unit="${esc(u.id)}">
                          <div>${esc(u.unit_number)}</div>
                          <div class="sub">${esc(u.unit_type)} · ${esc(u.facing || '')}</div>
                        </button>
                      `).join('')}
                    </div>
                  </div>
                `).join('') : '<p class="sx-muted" style="padding:16px 0">No units currently configured for this project. Select Greenfield Heights or Palm Springs Estates from the dropdown above.</p>'}
              </div>
            </div>
          `;

          body.querySelectorAll('[data-unit]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const u = units.find((x) => x.id === btn.dataset.unit);
              if (u) openUnitCostSheetModal(u, sel);
            });
          });
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      await load();
    }
  });

  // Unit Cost Sheet Modal
  function openUnitCostSheetModal(u, proj) {
    const base = num(u.base_price);
    const plc = num(u.plc_charges);
    const parking = num(u.parking_charges) || 300000;
    const gst = Math.round(base * 0.05);
    const total = base + plc + parking + gst;

    const m = modal(`
      <div style="max-width:500px">
        <div class="sx-row" style="margin-bottom:12px">
          <div>
            <h2 style="margin:0">${esc(proj.name)} · Unit ${esc(u.unit_number)}</h2>
            <span class="sx-sub">Floor ${u.floor_number} · ${esc(u.unit_type)} · ${esc(u.facing || 'East Facing')}</span>
          </div>
          <div class="sx-spacer"></div>
          <span class="sx-unit-pill ${u.status === 'AVAILABLE' ? 'avail' : u.status === 'HOLD' ? 'hold' : 'booked'}">${u.status}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;background:var(--sx-soft);padding:10px;border-radius:8px;font-size:.85rem">
          <div>Carpet Area: <strong>${num(u.carpet_area_sqft)} sq.ft</strong></div>
          <div>Super Built-up: <strong>${Math.round(num(u.calc_sba))} sq.ft</strong></div>
          <div>Rate / sq.ft: <strong>₹${Math.round(base / (num(u.calc_sba) || 1)).toLocaleString('en-IN')}</strong></div>
          <div>Possession: <strong>${esc(proj.possession_date || 'Ready')}</strong></div>
        </div>

        <h4 style="margin:10px 0 4px">All-Inclusive Cost Sheet Breakdown</h4>
        <dl class="sx-cost-sheet">
          <dt>Base Price</dt><dd>${money(base)}</dd>
          <dt>Preferred Location Charges (PLC)</dt><dd>${plc ? money(plc) : 'Inclusive / Nil'}</dd>
          <dt>Covered Car Parking (1 Slot)</dt><dd>${money(parking)}</dd>
          <dt>Estimated GST & Statutory (5%)</dt><dd>${money(gst)}</dd>
          <div class="total-row" style="display:contents">
            <dt>Total All-Inclusive Value</dt><dd>${money(total)}</dd>
          </div>
        </dl>

        <div class="sx-actions" style="margin-top:16px">
          <button type="button" class="sx-btn" data-close>Close</button>
          <button type="button" class="sx-btn" id="sx-share-cost">${icon('share')} WhatsApp Cost Sheet</button>
          ${u.status === 'AVAILABLE' ? `<button type="button" class="sx-btn primary" id="sx-spot-book">✍️ Spot Book Unit</button>` : ''}
        </div>
      </div>
    `);

    m.el.querySelector('#sx-share-cost').addEventListener('click', () => {
      const msg = encodeURIComponent(`Cost Sheet Estimate for ${proj.name} Unit ${u.unit_number} (${u.unit_type}): Base: ${money(base)}, Parking: ${money(parking)}, GST: ${money(gst)}. All-inclusive total: ${money(total)}.`);
      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    });

    const bookBtn = m.el.querySelector('#sx-spot-book');
    if (bookBtn) {
      bookBtn.addEventListener('click', () => {
        m.close();
        openSpotBookingModal(null, proj.id, null, u.id);
      });
    }
  }

  // Geo Check-in / Visit Completion Modal
  function openGeoCheckInDialog(v, onDone) {
    let userLat = null;
    let userLng = null;

    const m = modal(`
      <div style="max-width:500px">
        <h2 style="margin:0 0 4px">Site Visit Status & Geo Check-in</h2>
        <p class="sx-sub">Client: ${esc(v.client_name)} · ${esc(v.project_name)}</p>

        <div id="sx-gps-status" style="margin:12px 0;padding:10px 12px;background:var(--sx-soft);border-radius:8px;font-size:.85rem;display:flex;align-items:center;gap:8px">
          ${icon('map')} <span>Detecting GPS site location...</span>
        </div>

        <form id="sx-checkin-form" class="sx-form">
          <label class="sx-field">
            <span>Visit Status *</span>
            <select name="status">
              <option value="IN_PROGRESS" ${v.status === 'IN_PROGRESS' ? 'selected' : ''}>⏳ Client Arrived / Tour In-Progress</option>
              <option value="COMPLETED" ${v.status === 'COMPLETED' ? 'selected' : ''}>✓ Completed (Sample flat showed)</option>
              <option value="NO_SHOW">❌ Client No Show</option>
              <option value="RESCHEDULED">🗓️ Client Requested Reschedule</option>
            </select>
          </label>

          <label class="sx-field">
            <span>Client Lead Temperature</span>
            <select name="temperature">
              <option value="HOT" ${v.temperature === 'HOT' ? 'selected' : ''}>🔥 Hot (Ready to book within 7 days)</option>
              <option value="WARM" ${v.temperature === 'WARM' || !v.temperature ? 'selected' : ''}>☀️ Warm (Evaluating project)</option>
              <option value="COLD" ${v.temperature === 'COLD' ? 'selected' : ''}>❄️ Cold (Budget / Location mismatch)</option>
            </select>
          </label>

          <label class="sx-field">
            <span>Client Impressions & Objections *</span>
            <textarea name="client_feedback" rows="3" placeholder="What did the client like? Which unit typology was shortlisted? Price expectations..." required>${esc(v.client_feedback || '')}</textarea>
          </label>

          <div class="sx-actions" style="margin-top:16px">
            <button type="button" class="sx-btn" data-close>Cancel</button>
            <button type="submit" class="sx-btn primary">Save & Update Visit</button>
          </div>
        </form>
      </div>
    `);

    // Detect GPS Coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          const statusBox = m.el.querySelector('#sx-gps-status');
          if (statusBox) {
            statusBox.innerHTML = `${icon('check')} <span style="color:var(--sx-green);font-weight:600">GPS Locked: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}</span>`;
          }
        },
        () => {
          const statusBox = m.el.querySelector('#sx-gps-status');
          if (statusBox) statusBox.innerHTML = `<span class="sx-muted">GPS permission unavailable. Location logging bypassed.</span>`;
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    const form = m.el.querySelector('#sx-checkin-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api(`/suite/outside/visits/${v.id}/checkin`, {
          body: {
            status: fd.get('status'),
            temperature: fd.get('temperature'),
            client_feedback: fd.get('client_feedback'),
            latitude: userLat,
            longitude: userLng
          }
        });
        toast('Site visit updated successfully!');
        m.close();
        if (onDone) onDone();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  }

  // Spot Booking Modal
  async function openSpotBookingModal(leadId, projectId, onDone, preUnitId = null) {
    let leads = [];
    let units = [];
    try {
      const lRes = (await api('/suite/sales/leads?limit=200')).data;
      leads = lRes.rows || [];
      const uRes = (await api(`/suite/outside/project-matrix${projectId ? `?project_id=${projectId}` : ''}`)).data;
      units = (uRes.units || []).filter((u) => u.status === 'AVAILABLE' || u.id === preUnitId);
    } catch (e) { /* ignore */ }

    formDialog({
      title: 'Collect Spot Booking Token',
      sub: 'Reserve unit on-the-spot and initiate token payment verification',
      fields: [
        {
          name: 'lead_id',
          label: 'Client / Buyer *',
          type: 'select',
          required: true,
          options: leads.map((l) => [l.id, `${NXS.fullName(l.first_name, l.last_name)} (${l.phone})`]),
          value: leadId || (leads[0] ? leads[0].id : '')
        },
        {
          name: 'unit_id',
          label: 'Unit to Reserve *',
          type: 'select',
          required: true,
          options: units.map((u) => [u.id, `Unit ${u.unit_number} (${u.unit_type} · Floor ${u.floor_number} · ${money(u.base_price)})`]),
          value: preUnitId || (units[0] ? units[0].id : '')
        },
        {
          name: 'token_amount',
          label: 'Token Amount Collected (₹) *',
          type: 'number',
          value: 200000,
          required: true
        },
        {
          name: 'payment_mode',
          label: 'Payment Mode',
          type: 'select',
          options: [
            ['UPI', 'UPI / QR Code Scan'],
            ['CHEQUE', 'Cheque / Demand Draft'],
            ['NEFT', 'Bank Transfer (NEFT/RTGS)'],
            ['POS_CARD', 'POS Credit/Debit Card Machine']
          ]
        },
        {
          name: 'reference_number',
          label: 'Transaction Ref / UTR / Cheque Number',
          type: 'text',
          placeholder: 'Enter 12-digit UTR or Cheque No.'
        },
        {
          name: 'discount_requested',
          label: 'Special Spot Discount (₹) [Needs Approval]',
          type: 'number',
          value: 0,
          hint: 'Amounts > 0 trigger automatic approval request to Sales Head / Manager'
        },
        {
          name: 'notes',
          label: 'Booking Notes',
          type: 'textarea',
          placeholder: 'Special client conditions, parking slot choice, payment schedule agreement...'
        }
      ],
      submit: 'Record Spot Booking',
      onSubmit: async (v) => {
        const res = await api('/suite/outside/spot-book', { body: v });
        toast(res.message || 'Spot booking recorded successfully!');
        if (onDone) onDone();
      }
    });
  }

  // ==========================================================================
  // 3. CHANNEL PARTNER PORTAL (BROKER DESK)
  // ==========================================================================

  // 3A. Broker Executive Dashboard
  NXS.page('partner-desk', {
    title: 'Channel Partner Command Center', label: 'Overview', icon: 'home', group: 'Partner Desk', order: 1, portals: PARTNER,
    async render(el) {
      el.innerHTML = '<div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');

      const load = async () => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api('/suite/partner/dashboard')).data;
          const p = res.partner || {};
          const rm = res.rm || {};
          const k = res.kpis || {};
          const clients = res.recentClients || [];

          body.innerHTML = `
            <!-- Broker Firm Header Banner -->
            <div class="sx-card" style="margin-bottom:16px;background:linear-gradient(135deg, var(--sx-card), var(--sx-soft))">
              <div class="sx-row">
                <div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <h2 style="margin:0">${esc(p.firmName || 'Channel Partner Desk')}</h2>
                    <span class="sx-tier-pill ${(p.tier || 'gold').toLowerCase()}">${esc(p.tier || 'Gold')} Tier</span>
                  </div>
                  <span class="sx-sub">RERA No: ${esc(p.reraNumber || 'Applied')} · Commission Slab: <strong>${p.commissionRate}%</strong></span>
                </div>
                <div class="sx-spacer"></div>
                <button class="sx-btn primary" id="sx-btn-reg-lead">+ Register New Client (45-Day Lock)</button>
              </div>

              ${rm.name ? `
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--sx-line);display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                  <span style="font-size:.82rem;color:var(--sx-muted)">Your Assigned Relationship Manager:</span>
                  <strong style="font-size:.88rem">${esc(rm.name)}</strong>
                  <a href="tel:${esc(rm.phone)}" class="sx-btn sm">${icon('phone')} ${esc(rm.phone)}</a>
                  <a href="https://api.whatsapp.com/send?phone=${esc((rm.phone || '').replace(/\D/g, ''))}" target="_blank" class="sx-btn sm">${icon('spark')} WhatsApp RM</a>
                </div>
              ` : ''}
            </div>

            <!-- Partner KPIs -->
            <div class="sx-kpis" style="margin-bottom:16px">
              ${kpi('Registered Clients', num(k.totalRegistered), { hint: 'total leads submitted' })}
              ${kpi('Active Protected', num(k.activeProtected), { hint: 'under 45-day protection lock', tone: 'good' })}
              ${kpi('Confirmed Deals', num(k.confirmedBookings), { hint: 'verified closed bookings', tone: k.confirmedBookings ? 'good' : '' })}
              ${kpi('Total Sales Value', money(k.totalBookingValue), { hint: 'gross client bookings' })}
              ${kpi('Earned Commission', money(k.earnedCommission), { hint: `${p.commissionRate}% brokerage`, tone: 'good' })}
              ${kpi('Disbursed Brokerage', money(k.paidCommission), { hint: 'paid into bank account' })}
              ${kpi('Pending Approval', money(k.pendingCommission), { hint: 'milestones in process', tone: k.pendingCommission ? 'warn' : '' })}
            </div>

            <!-- Recent Clients with 45-Day Lead Protection Status -->
            <div class="sx-card">
              <div class="sx-card-head">
                <h3>Registered Clients & 45-Day Protection Status</h3>
                <span class="sx-sub">Exclusive lead protection prevents commission conflict</span>
              </div>
              <div data-clients-table></div>
            </div>
          `;

          body.querySelector('#sx-btn-reg-lead').addEventListener('click', () => {
            openPartnerRegisterClientModal(load);
          });

          const tableEl = body.querySelector('[data-clients-table]');
          table(tableEl, {
            columns: [
              { key: 'client_name', label: 'Buyer Name', render: (r) => `<strong>${esc(r.client_name)}</strong><span class="sub">${esc(r.phone)}</span>` },
              { key: 'project_name', label: 'Project Interest', render: (r) => esc(r.project_name || 'General Inquiry') },
              { key: 'stage', label: 'CRM Stage', render: (r) => chip(r.bucket, label(r.stage)) },
              {
                key: 'protection',
                label: 'Lead Lock Guarantee',
                render: (r) => {
                  if (r.isProtected) {
                    return `<span class="sx-lead-lock">🔒 Protected (${r.protection_days_left}d left)</span>`;
                  }
                  return `<span class="sx-lead-lock expired">Lock Expired</span>`;
                }
              },
              { key: 'created_at', label: 'Registered On', render: (r) => when(r.created_at, { dateOnly: true }) }
            ],
            rows: clients,
            empty: { title: 'No clients registered yet. Register your first buyer to activate 45-day protection!' }
          });
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      await load();
    }
  });

  // 3B. Registered Clients & 45-Day Lead Lock
  NXS.page('partner-clients', {
    title: 'Registered Clients & Lead Protection', label: 'My Clients', icon: 'users', group: 'Partner Desk', order: 2, portals: PARTNER,
    async render(el) {
      el.innerHTML = '<div class="sx-filters" data-f></div><div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');
      const fEl = el.querySelector('[data-f]');

      const load = async () => {
        body.innerHTML = NXS.loading();
        try {
          const res = (await api('/suite/partner/dashboard')).data;
          const clients = res.recentClients || [];

          fEl.innerHTML = `
            <input type="search" placeholder="Search clients..." data-q style="min-width:220px">
            <div class="sx-spacer"></div>
            <button class="sx-btn primary" id="sx-btn-add-client">+ Register Client (45-Day Lock)</button>
          `;

          fEl.querySelector('#sx-btn-add-client').addEventListener('click', () => {
            openPartnerRegisterClientModal(load);
          });

          table(body, {
            columns: [
              { key: 'client_name', label: 'Client Name', render: (r) => `<strong>${esc(r.client_name)}</strong><span class="sub">${esc(r.phone)}${r.email ? ` · ${esc(r.email)}` : ''}</span>` },
              { key: 'project_name', label: 'Project Interest', render: (r) => esc(r.project_name || '—') },
              { key: 'stage', label: 'Live CRM Stage', render: (r) => chip(r.bucket, label(r.stage)) },
              {
                key: 'lock',
                label: '45-Day Lead Protection',
                render: (r) => r.isProtected ? `<span class="sx-lead-lock">🔒 Protected until ${new Date(r.cp_protected_until).toLocaleDateString('en-IN')} (${r.protection_days_left}d left)</span>` : '<span class="sx-lead-lock expired">Expired</span>'
              },
              { key: 'registered', label: 'Registered On', render: (r) => when(r.created_at) }
            ],
            rows: clients,
            empty: { title: 'No registered clients found.' }
          });
        } catch (err) {
          body.innerHTML = NXS.errorBox(err);
        }
      };

      await load();
    }
  });

  // 3C. Commission & Payout Tracker
  NXS.page('partner-commissions', {
    title: 'Commission & Payout Tracker', label: 'Earnings & Payouts', icon: 'money', group: 'Finance', order: 3, portals: PARTNER,
    async render(el) {
      el.innerHTML = '<div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');

      try {
        const res = (await api('/suite/partner/commissions')).data;
        const deals = res.deals || [];
        const rate = res.commissionRate || 2.5;

        body.innerHTML = `
          <div class="sx-card" style="margin-bottom:14px">
            <div class="sx-card-head">
              <h3>Brokerage Milestone Payment Slabs (${rate}% Commission)</h3>
              <span class="sx-sub">Payouts automatically unlock at verified milestones</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;font-size:.85rem">
              <div style="padding:10px;background:var(--sx-soft);border-radius:8px">
                <strong>Milestone 1 (25%)</strong><div class="sx-sub">On Token Clearance & Verification</div>
              </div>
              <div style="padding:10px;background:var(--sx-soft);border-radius:8px">
                <strong>Milestone 2 (50%)</strong><div class="sx-sub">On Agreement for Sale Signing</div>
              </div>
              <div style="padding:10px;background:var(--sx-soft);border-radius:8px">
                <strong>Milestone 3 (25%)</strong><div class="sx-sub">On Loan Disbursement / Registry</div>
              </div>
            </div>
          </div>

          <div class="sx-card">
            <div class="sx-card-head">
              <h3>Confirmed Deals & Commission Ledger</h3>
            </div>
            <div data-deals-table></div>
          </div>
        `;

        const tEl = body.querySelector('[data-deals-table]');
        table(tEl, {
          columns: [
            { key: 'deal_number', label: 'Deal / Booking', render: (r) => `<strong>${esc(r.deal_number)}</strong><span class="sub">${esc(r.project_name)} · Unit ${esc(r.unit_number)}</span>` },
            { key: 'client_name', label: 'Buyer', render: (r) => esc(r.client_name) },
            { key: 'agreed_total_amount', label: 'Agreement Value', num: true, render: (r) => money(r.agreed_total_amount) },
            { key: 'total_commission', label: `Commission (${rate}%)`, num: true, render: (r) => `<strong>${money(r.total_commission)}</strong>` },
            {
              key: 'slabs',
              label: 'Milestone Disbursal Breakdown',
              render: (r) => `
                <div style="display:flex;flex-direction:column;gap:4px;font-size:.78rem">
                  ${r.slabs.map((s) => `<span><strong>${s.milestone}:</strong> ${money(s.amount)} · ${chip(s.status)}${s.utr ? ` <span class="sx-muted">(${s.utr})</span>` : ''}</span>`).join('')}
                </div>
              `
            },
            { key: 'status', label: 'Status', render: (r) => chip(r.status) }
          ],
          rows: deals,
          empty: { title: 'No closed bookings recorded yet for your firm.' }
        });
      } catch (err) {
        body.innerHTML = NXS.errorBox(err);
      }
    }
  });

  // 3D. Marketing Collaterals & Project Hub
  NXS.page('partner-projects', {
    title: 'Marketing Collateral & Project Hub', label: 'Marketing Kit', icon: 'building', group: 'Marketing', order: 4, portals: PARTNER,
    async render(el) {
      el.innerHTML = '<div data-body>' + NXS.loading() + '</div>';
      const body = el.querySelector('[data-body]');

      try {
        const res = (await api('/suite/partner/collaterals')).data;
        const projects = res.projects || [];
        const partner = res.partner || {};

        body.innerHTML = `
          <div class="sx-card" style="margin-bottom:16px">
            <div class="sx-card-head">
              <h3>Partner Collaterals & Co-branded Marketing Material</h3>
              <span class="sx-sub">Download verified promotional assets stamped with your brokerage firm name</span>
            </div>
            <p style="font-size:.88rem;color:var(--sx-muted);margin:0">Official RERA-approved digital brochures, floor plans, and master plan walkthroughs ready to present to your investors.</p>
          </div>

          <div class="sx-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
            ${projects.map((p) => `
              <div class="sx-card">
                <div style="height:140px;background:var(--sx-soft) url('${esc(p.hero_image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80')}') center/cover no-repeat;border-radius:8px;margin-bottom:12px"></div>
                <div class="sx-row">
                  <div>
                    <h3 style="margin:0">${esc(p.name)}</h3>
                    <span class="sx-sub">${esc(p.location || '')} · ${esc(p.city || '')}</span>
                  </div>
                  <div class="sx-spacer"></div>
                  <span class="sx-unit-pill avail">${p.available_units || 'Available'} Units</span>
                </div>
                <dl class="sx-kv" style="margin:10px 0">
                  <dt>RERA Number</dt><dd>${esc(p.rera_number || 'RERA Approved')}</dd>
                  <dt>Possession</dt><dd>${esc(p.possession_date || 'Ready to Move')}</dd>
                </dl>
                <div class="sx-row" style="margin-top:12px;gap:8px">
                  ${p.brochure_url ? `<a href="${esc(p.brochure_url)}" target="_blank" class="sx-btn sm">${icon('download')} Official Brochure PDF</a>` : ''}
                  <button class="sx-btn primary sm" data-flyer="${esc(p.name)}" data-loc="${esc(p.location)}">${icon('share')} Co-branded Flyer</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        body.querySelectorAll('[data-flyer]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const firm = partner.firm_name || 'Channel Partner Desk';
            const phone = partner.phone || '';
            const msg = encodeURIComponent(`Exclusive Opportunity: ${btn.dataset.flyer} at ${btn.dataset.loc}. Verified RERA approved luxury development. For VIP site visits & investor pricing, contact ${firm} at ${phone}.`);
            window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
          });
        });
      } catch (err) {
        body.innerHTML = NXS.errorBox(err);
      }
    }
  });

  // Modal: Register Client with 45-Day Lock
  async function openPartnerRegisterClientModal(onDone) {
    let projects = [];
    try {
      const pRes = (await api('/suite/partner/collaterals')).data;
      projects = pRes.projects || [];
    } catch (e) { /* ignore */ }

    formDialog({
      title: 'Register Client (Guaranteed 45-Day Protection Lock)',
      sub: 'Submit buyer details to secure your commission protection rights under RERA guidelines',
      fields: [
        [
          { name: 'first_name', label: 'Client First Name *', type: 'text', required: true, placeholder: 'e.g. Ramesh' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'e.g. Sharma' }
        ],
        [
          { name: 'phone', label: 'Mobile Number *', type: 'text', required: true, placeholder: '10-digit mobile number' },
          { name: 'email', label: 'Email Address', type: 'text', placeholder: 'client@example.com' }
        ],
        {
          name: 'preferred_project_id',
          label: 'Project of Interest',
          type: 'select',
          options: [['', 'General / Multiple Projects'], ...projects.map((p) => [p.id, p.name])]
        },
        [
          { name: 'budget_min', label: 'Budget Min (₹)', type: 'number', placeholder: '5000000' },
          { name: 'budget_max', label: 'Budget Max (₹)', type: 'number', placeholder: '15000000' }
        ],
        {
          name: 'configuration',
          label: 'Configuration',
          type: 'select',
          options: [
            ['', 'Select...'],
            ['2BHK', '2 BHK'],
            ['3BHK', '3 BHK'],
            ['4BHK', '4 BHK'],
            ['Villa', 'Luxury Villa'],
            ['Plot', 'Plotted Development']
          ]
        },
        {
          name: 'notes',
          label: 'Buyer Requirement Details',
          type: 'textarea',
          placeholder: 'Mention purchase timeline, funding mode (loan/self), preferred floor, or family requirements...'
        }
      ],
      submit: '🔒 Register & Lock Protection (45 Days)',
      onSubmit: async (v) => {
        const res = await api('/suite/partner/register-client', { body: v });
        toast(res.message || 'Client registered and 45-day protection activated!');
        if (onDone) onDone();
      }
    });
  }

  // Fallback simple lead dialog
  function openNewLeadDialog(onDone) {
    formDialog({
      title: 'Create New Lead',
      fields: [
        [
          { name: 'first_name', label: 'First Name *', required: true },
          { name: 'last_name', label: 'Last Name' }
        ],
        [
          { name: 'phone', label: 'Phone *', required: true },
          { name: 'email', label: 'Email' }
        ],
        { name: 'notes', label: 'Notes', type: 'textarea' }
      ],
      submit: 'Create Lead',
      onSubmit: async (v) => {
        await api('/suite/sales/leads', { body: v });
        toast('Lead created!');
        if (onDone) onDone();
      }
    });
  }

})();
