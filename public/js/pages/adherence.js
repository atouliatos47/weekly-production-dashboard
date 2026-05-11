/* ==========================================================
   pages/adherence.js — Schedule Adherence tab
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function adherenceTab() {

  // Only rows with a plan qualify for an adherence view
  const planned = DATA.rows.filter(r => (r.planned || 0) > 0);

  const statusOf = att => {
    if (att >= 100) return 'complete';
    if (att >=  90) return 'track';
    if (att >=  70) return 'risk';
    return 'critical';
  };

  // Enrich rows once
  planned.forEach(r => {
    r._att    = (r.produced / r.planned) * 100;
    r._status = statusOf(r._att);
    r._short  = Math.max(0, r.planned - r.produced);  // shortfall in parts
  });

  // Summary tile counts
  const counts = { critical: 0, risk: 0, track: 0, complete: 0 };
  planned.forEach(r => counts[r._status]++);
  document.getElementById('adh-n-critical').textContent = counts.critical;
  document.getElementById('adh-n-risk').textContent     = counts.risk;
  document.getElementById('adh-n-track').textContent    = counts.track;
  document.getElementById('adh-n-complete').textContent = counts.complete;
  document.getElementById('wo-total').textContent       = planned.length;

  // Populate owner and machine filter dropdowns
  const owners   = [...new Set(planned.map(r => r.owner).filter(Boolean))].sort();
  const machines = [...new Set(planned.map(r => r.machine).filter(Boolean))].sort();
  const ownerSel = document.getElementById('filter-owner');
  const machSel  = document.getElementById('filter-machine');
  owners.forEach(o   => ownerSel.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`));
  machines.forEach(m => machSel.insertAdjacentHTML('beforeend',  `<option value="${m}">${m}</option>`));

  // Filter / sort state
  const state = { status: 'all', owner: 'all', machine: 'all', sort: 'shortfall' };

  // Reason code chip styling
  const HARD = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE']);
  const WARN = new Set(['QUALITY ISSUE', 'SUPPLIER']);
  const reasonClass = code => HARD.has(code) ? 'failure' : WARN.has(code) ? 'warn' : '';

  const labelFor = s => ({ critical: 'Critical', risk: 'At Risk', track: 'On Track', complete: 'Complete' }[s]);

  // ---- Table renderer ----
  function render() {
    let rows = planned.filter(r =>
      (state.status  === 'all' || r._status  === state.status)  &&
      (state.owner   === 'all' || r.owner    === state.owner)   &&
      (state.machine === 'all' || r.machine  === state.machine)
    );

    const sorters = {
      shortfall:       (a, b) => b._short - a._short,
      attainment_asc:  (a, b) => a._att - b._att,
      attainment_desc: (a, b) => b._att - a._att,
      planned_desc:    (a, b) => b.planned - a.planned,
      machine:         (a, b) => a.machine.localeCompare(b.machine),
    };
    rows.sort(sorters[state.sort]);

    const tbody = document.getElementById('wo-tbody');
    const empty = document.getElementById('wo-empty');
    document.getElementById('wo-showing').textContent = rows.length;

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const cap = 150;
    const targetL = (100 / cap) * 100;

    tbody.innerHTML = rows.map(r => {
      const att    = r._att;
      const barW   = Math.min(100, (att / cap) * 100);
      const balNum = r.planned - r.produced;
      const balCls = balNum > 0 ? 'bal-neg' : balNum < 0 ? 'bal-pos' : '';
      const balStr = balNum > 0 ? '-' + fmt(balNum) : balNum < 0 ? '+' + fmt(-balNum) : '0';
      const reason = r.reason
        ? `<span class="reason-chip ${reasonClass(r.reason)}">${r.reason}</span>`
        : '';
      return `
        <tr>
          <td><span class="status-pill ${r._status}">${labelFor(r._status)}</span></td>
          <td class="machine-cell">${r.machine}</td>
          <td class="part-cell">${r.part || '—'}</td>
          <td class="wo-cell">${r.work_order || '—'}</td>
          <td><span class="owner-cell">${r.owner || '—'}</span></td>
          <td class="num">${fmt(r.planned)}</td>
          <td class="num">${fmt(r.produced)}</td>
          <td class="num ${balCls}">${balStr}</td>
          <td class="num">
            <span class="mini-bar">
              <span class="f ${r._status}" style="width:${barW}%"></span>
              <span class="t" style="left:${targetL}%"></span>
            </span>
            ${att.toFixed(0)}%
          </td>
          <td>${reason}</td>
        </tr>`;
    }).join('');
  }

  // ---- Event wiring ----
  document.querySelectorAll('[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.status = btn.dataset.filterStatus;
      render();
    });
  });

  document.querySelectorAll('#adh-summary .adh-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const s = tile.dataset.status;
      state.status = (state.status === s) ? 'all' : s;
      document.querySelectorAll('[data-filter-status]').forEach(b => {
        b.classList.toggle('active', b.dataset.filterStatus === state.status);
      });
      render();
    });
  });

  document.getElementById('filter-owner').addEventListener('change',  e => { state.owner   = e.target.value; render(); });
  document.getElementById('filter-machine').addEventListener('change', e => { state.machine = e.target.value; render(); });
  document.getElementById('sort-mode').addEventListener('change',      e => { state.sort    = e.target.value; render(); });

  render();

  // ---- Trend chart ----
  renderAdhTrend();
  document.getElementById('adh-trend-clear').addEventListener('click', () => {
    if (!confirm('Clear all saved adherence trend history?')) return;
    localStorage.removeItem(ADH_TREND_KEY);
    renderAdhTrend();
  });
}

// ---- Adherence trend SVG chart ----
function renderAdhTrend() {
  const trend = (() => {
    try { return JSON.parse(localStorage.getItem(ADH_TREND_KEY) || '[]'); } catch (_) { return []; }
  })();

  const card = document.getElementById('adh-trend-card');
  const wrap = document.getElementById('adh-trend-svg-wrap');
  const sub  = document.getElementById('adh-trend-sub');

  if (trend.length < 2) {
    card.style.display = trend.length === 1 ? 'block' : 'none';
    if (trend.length === 1) {
      sub.textContent = `WK${trend[0].week} loaded — upload a second week to see the trend`;
      wrap.innerHTML  = '';
    }
    return;
  }

  card.style.display = 'block';
  sub.textContent = `${trend.length} weeks · overall attainment %`;

  // SVG dimensions
  const W = 700, H = 180;
  const M = { top: 24, right: 24, bottom: 36, left: 48 };
  const iw = W - M.left - M.right;
  const ih = H - M.top  - M.bottom;

  const NAVY = '#243547', LIME = '#95C11F', RULE = '#d4d9cc', MUTE = '#8a9080';
  const RED  = '#c0392b';

  // Scales
  const pcts   = trend.map(e => e.pct);
  const minPct = Math.max(0,   Math.floor(Math.min(...pcts) / 10) * 10 - 10);
  const maxPct = Math.min(150, Math.ceil(Math.max(...pcts)  / 10) * 10 + 10);
  const xStep  = iw / (trend.length - 1);
  const yScale = v => M.top + ih - ((v - minPct) / (maxPct - minPct)) * ih;

  const pts = trend.map((e, i) => ({ x: M.left + i * xStep, y: yScale(e.pct), ...e }));

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, monospace">`;

  // Grid lines + y-axis labels
  const yTicks = [];
  for (let v = minPct; v <= maxPct; v += 10) yTicks.push(v);
  yTicks.forEach(v => {
    const y = yScale(v);
    svg += `<line x1="${M.left}" y1="${y}" x2="${M.left + iw}" y2="${y}" stroke="${RULE}" stroke-width="1"/>`;
    svg += `<text x="${M.left - 6}" y="${y + 4}" text-anchor="end" font-size="9" fill="${MUTE}">${v}%</text>`;
  });

  // Reference lines at 90% and 100%
  [
    { v: 100, color: LIME,      label: '100%', dash: '4,3' },
    { v: 90,  color: '#e67e22', label: '90%',  dash: '3,3' },
  ].forEach(({ v, color, label, dash }) => {
    if (v < minPct || v > maxPct) return;
    const y = yScale(v);
    svg += `<line x1="${M.left}" y1="${y}" x2="${M.left + iw}" y2="${y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}" opacity="0.75"/>`;
    svg += `<text x="${M.left + iw + 4}" y="${y + 4}" font-size="9" fill="${color}">${label}</text>`;
  });

  // Area fill
  const areaPath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
    + ` L${pts[pts.length - 1].x},${M.top + ih} L${pts[0].x},${M.top + ih} Z`;
  svg += `<path d="${areaPath}" fill="${LIME}" opacity="0.10"/>`;

  // Line
  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  svg += `<path d="${linePath}" stroke="${NAVY}" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Dots + value labels
  pts.forEach(p => {
    const dotCol = p.pct < 70 ? RED : p.pct < 90 ? '#e67e22' : LIME;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="${dotCol}" stroke-width="2.5"/>`;
    svg += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="9" fill="${NAVY}" font-weight="600">${p.pct.toFixed(0)}%</text>`;
  });

  // X axis week labels
  pts.forEach(p => {
    svg += `<text x="${p.x}" y="${M.top + ih + 18}" text-anchor="middle" font-size="9" fill="${MUTE}">${p.label}</text>`;
  });

  // Axes
  svg += `<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top + ih}" stroke="${NAVY}" stroke-width="1.5"/>`;
  svg += `<line x1="${M.left}" y1="${M.top + ih}" x2="${M.left + iw}" y2="${M.top + ih}" stroke="${NAVY}" stroke-width="1.5"/>`;

  svg += `</svg>`;
  wrap.innerHTML = svg;
}
