/* ==========================================================================
   Business Suite charts — small HTML/CSS charts (crisp text at any width).
   Colours: validated categorical slots --viz-1..4 (fixed order, never cycled)
   and the ordinal blue ramp --seq-1..5; light and dark steps are in suite.css.
   Every chart has a hover tooltip; two or more series always get a legend; the
   pages show the numbers in a table beside each chart.
   ========================================================================== */
(function () {
  'use strict';
  const NXS = window.NXS;
  const esc = NXS.esc;

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function intStep(v) {
    if (v <= 1) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthLabel(key, withYear, long) {
    const [y, m] = key.split('-').map(Number);
    if (long) return `${MON[m - 1]} ${y}`;
    return withYear || m === 1 ? `${MON[m - 1]} ’${String(y).slice(2)}` : MON[m - 1];
  }

  function attachTips(root) {
    const tip = document.createElement('div');
    tip.className = 'sx-tip';
    tip.hidden = true;
    root.style.position = 'relative';
    root.appendChild(tip);
    root.querySelectorAll('[data-tip]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        tip.innerHTML = el.dataset.tip;
        tip.hidden = false;
        const r = el.getBoundingClientRect();
        const pr = root.getBoundingClientRect();
        tip.style.left = `${Math.min(Math.max(r.left - pr.left + r.width / 2, 60), pr.width - 60)}px`;
        tip.style.top = `${Math.max(r.top - pr.top + (el.dataset.tipTop ? Number(el.dataset.tipTop) : 0), 24)}px`;
      });
      el.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }

  /**
   * Vertical columns, one or more series sharing ONE axis (same unit only).
   * columns(el, { labels: [...], series: [{ name, values: [...] }], format: (v) => text, height })
   */
  function columns(el, { labels, series, format = (v) => v, height = 200, every = null, integer = false }) {
    const raw = Math.max(0, ...series.flatMap((s) => s.values.map(Number)));
    let max;
    let ticks;
    if (integer) {
      // counts get whole-number gridlines on a 1/2/5 step (0, 10, 20 … — never 1.25 or 11)
      const step = Math.max(1, intStep(raw / 5));
      max = Math.max(step * Math.ceil(raw / step), step === 1 ? 4 : step); // small counts still get a 0–4 axis
      ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
    } else {
      max = niceMax(raw);
      ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
    }
    // 'YYYY-MM' month keys read as Nov, Dec, Jan ’26 …
    const months = labels.every((l) => /^\d{4}-\d{2}$/.test(l));
    const shown = months ? labels.map((l, i) => monthLabel(l, i === 0)) : labels;
    const full = months ? labels.map((l) => monthLabel(l, true, true)) : labels;
    const step = every || Math.max(1, Math.ceil(labels.length / 12));
    el.innerHTML = `
      <div class="sx-cols" style="--h:${height}px">
        <div class="sx-cols-y">${ticks.slice().reverse().map((t) => `<span>${esc(format(t))}</span>`).join('')}</div>
        <div class="sx-cols-plot">
          ${ticks.map((t) => `<i class="grid" style="bottom:${(t / max) * 100}%"></i>`).join('')}
          ${full.map((lab, i) => `<div class="col" data-tip="<strong>${esc(lab)}</strong>${series.map((s, k) => `<br>${series.length > 1 ? `<i class='sw' style='background:var(--viz-${k + 1})'></i>${esc(s.name)}: ` : ''}${esc(format(s.values[i]))}`).join('')}">
            ${series.map((s, k) => `<b style="height:${max ? (Number(s.values[i]) / max) * 100 : 0}%;background:var(--viz-${k + 1})"></b>`).join('')}
          </div>`).join('')}
        </div>
        <div class="sx-cols-x">${shown.map((lab, i) => `<span>${i % step === 0 ? esc(lab) : ''}</span>`).join('')}</div>
      </div>
      ${series.length > 1 ? `<div class="sx-legend">${series.map((s, k) => `<span><i style="background:var(--viz-${k + 1})"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
    attachTips(el);
  }

  /**
   * Horizontal bars (single series): rows [{ label, value, sub, color }] with the value printed at the end.
   */
  function hbars(el, rows, { format = (v) => v, color = 'var(--viz-1)', onClick = null } = {}) {
    const max = Math.max(0, ...rows.map((r) => Number(r.value)));
    el.innerHTML = rows.length ? rows.map((r, i) => `
      <div class="sx-hbar" ${onClick ? `data-i="${i}" style="cursor:pointer"` : ''} data-tip="<strong>${esc(r.label)}</strong><br>${esc(format(r.value))}${r.sub ? `<br>${esc(r.sub)}` : ''}">
        <span class="name" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="track"><span class="fill" style="display:block;width:${max ? (Number(r.value) / max) * 100 : 0}%;background:${r.color || color}"></span></span>
        <span class="sx-num">${esc(format(r.value))}</span>
      </div>`).join('') : '<div class="sx-empty"><p>No data for this period.</p></div>';
    if (onClick) el.querySelectorAll('[data-i]').forEach((x) => x.addEventListener('click', () => onClick(rows[Number(x.dataset.i)])));
    attachTips(el);
  }

  /**
   * Stacked horizontal bars: rows [{ label, parts: { key: value } }], keys [{ key, label }] in fixed order.
   * Each segment prints its count (some light-mode slots sit below 3:1, so labels are always shown).
   */
  function stacked(el, rows, keys) {
    el.innerHTML = `${rows.map((r) => {
      const total = keys.reduce((s, k) => s + (Number(r.parts[k.key]) || 0), 0);
      return `<div style="margin-bottom:10px"><div class="sx-row" style="font-size:.84rem;margin-bottom:3px"><strong>${esc(r.label)}</strong><span class="sx-muted">${total} units</span></div>
        <div class="sx-stack-bar">${keys.map((k, i) => {
          const v = Number(r.parts[k.key]) || 0;
          return v ? `<span style="flex:${v};background:var(--viz-${i + 1})" class="${i >= 2 ? 'dark-ink' : ''}" data-tip="<strong>${esc(r.label)}</strong><br>${esc(k.label)}: ${v}">${v}</span>` : '';
        }).join('') || '<span style="flex:1;background:var(--sx-soft)"></span>'}</div></div>`;
    }).join('')}<div class="sx-legend">${keys.map((k, i) => `<span><i style="background:var(--viz-${i + 1})"></i>${esc(k.label)}</span>`).join('')}</div>`;
    attachTips(el);
  }

  NXS.charts = { columns, hbars, stacked, niceMax };
})();
