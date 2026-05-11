/* ==========================================================
   pages/charts.js — Charts tab (Pareto analysis)
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function chartsTab() {

  /* ---- Reusable Pareto chart renderer ----
     items : [{ label, value }]
     opts  : { cap, yAxisLabel }
     Returns summary info for caption generation, or null if no data. */
  function renderPareto(selector, items, opts = {}) {
    const el = document.querySelector(selector);
    if (!el) return null;
    if (!items || !items.length) {
      el.innerHTML = '<div class="empty-state" style="padding:40px 10px">No data to chart.</div>';
      return null;
    }

    // Sort descending, cap at N bars (roll remainder into "Other")
    items = [...items].sort((a, b) => b.value - a.value);
    const cap = opts.cap || 10;
    if (items.length > cap) {
      const rest  = items.slice(cap);
      const other = rest.reduce((s, i) => s + i.value, 0);
      items = items.slice(0, cap);
      if (other > 0) items.push({ label: `Other (${rest.length})`, value: other, isOther: true });
    }

    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    const maxV  = Math.max(...items.map(i => i.value));

    // Cumulative %
    let running = 0;
    const cum = items.map(i => { running += i.value; return (running / total) * 100; });

    // SVG dimensions (viewBox — scales responsively via CSS)
    const W  = 720, H = 360;
    const M  = { top: 28, right: 52, bottom: 92, left: 72 };
    const iw = W - M.left - M.right;
    const ih = H - M.top  - M.bottom;
    const slot = iw / items.length;
    const barW = Math.min(slot * 0.72, 56);

    const NAVY = '#243547', LIME = '#95C11F', RULE = '#e4e6e0', MUTE = '#5a6876';

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pareto chart">`;

    // Plot area background
    svg += `<rect x="${M.left}" y="${M.top}" width="${iw}" height="${ih}" fill="#fafbf7" />`;

    // Y-axis grid + left labels
    for (let g = 0; g <= 5; g++) {
      const y = M.top + ih * (1 - g / 5);
      const v = maxV * g / 5;
      svg += `<line x1="${M.left}" y1="${y}" x2="${M.left + iw}" y2="${y}" stroke="${RULE}" stroke-width="1" />`;
      svg += `<text x="${M.left - 8}" y="${y + 3}" text-anchor="end" font-size="10" font-family="IBM Plex Mono" fill="${MUTE}">${fmt(v)}</text>`;
    }

    // Right axis (cumulative %, 0–100)
    for (let g = 0; g <= 4; g++) {
      const y = M.top + ih * (1 - g / 4);
      svg += `<text x="${M.left + iw + 8}" y="${y + 3}" text-anchor="start" font-size="10" font-family="IBM Plex Mono" fill="${LIME}">${g * 25}%</text>`;
    }

    // 80% reference line
    const y80 = M.top + ih * (1 - 80 / 100);
    svg += `<line x1="${M.left}" y1="${y80}" x2="${M.left + iw}" y2="${y80}"
                  stroke="${LIME}" stroke-width="1" stroke-dasharray="5 3" opacity="0.45" />`;
    svg += `<text x="${M.left + iw - 4}" y="${y80 - 5}" text-anchor="end"
                  font-size="9" font-family="Archivo" fill="${LIME}" font-weight="700" letter-spacing="0.1em">80% TARGET</text>`;

    // Bars
    items.forEach((it, i) => {
      const h    = (it.value / maxV) * ih;
      const x    = M.left + i * slot + (slot - barW) / 2;
      const y    = M.top + ih - h;
      const fill = it.isOther ? MUTE : NAVY;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="1">
                <title>${it.label}: ${fmt(it.value)}</title>
              </rect>`;
      if (h > 18) {
        svg += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle"
                      font-size="10" font-family="IBM Plex Mono" fill="${NAVY}" font-weight="600">${fmt(it.value)}</text>`;
      }
    });

    // Cumulative line + dots
    const pts = items.map((_, i) => ({
      x:   M.left + i * slot + slot / 2,
      y:   M.top + ih * (1 - cum[i] / 100),
      pct: cum[i],
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    svg += `<path d="${path}" stroke="${LIME}" stroke-width="2.5" fill="none" stroke-linejoin="round" />`;
    pts.forEach(p => {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#fff" stroke="${LIME}" stroke-width="2" />`;
      svg += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle"
                    font-size="9" font-family="IBM Plex Mono" fill="#3d6f0d" font-weight="700">${p.pct.toFixed(0)}%</text>`;
    });

    // X-axis labels (rotated -35°)
    items.forEach((it, i) => {
      const cx  = M.left + i * slot + slot / 2;
      const y   = M.top + ih + 12;
      const lbl = it.label.length > 22 ? it.label.slice(0, 20) + '…' : it.label;
      svg += `<text x="${cx}" y="${y}" text-anchor="end"
                    font-size="11" font-family="Archivo" font-weight="600"
                    fill="${it.isOther ? MUTE : NAVY}"
                    transform="rotate(-35 ${cx} ${y})">${lbl}</text>`;
    });

    // Axis titles
    const yTitleX = 18, yTitleY = M.top + ih / 2;
    svg += `<text x="${yTitleX}" y="${yTitleY}" text-anchor="middle"
                  font-size="10" font-family="Archivo" font-weight="700" fill="${NAVY}" letter-spacing="0.14em"
                  transform="rotate(-90 ${yTitleX} ${yTitleY})">${(opts.yAxisLabel || 'VALUE').toUpperCase()}</text>`;
    svg += `<text x="${W - 14}" y="${yTitleY}" text-anchor="middle"
                  font-size="10" font-family="Archivo" font-weight="700" fill="${LIME}" letter-spacing="0.14em"
                  transform="rotate(90 ${W - 14} ${yTitleY})">CUMULATIVE %</text>`;

    // Baseline
    svg += `<line x1="${M.left}" y1="${M.top + ih}" x2="${M.left + iw}" y2="${M.top + ih}" stroke="${NAVY}" stroke-width="1.5" />`;

    svg += `</svg>`;
    el.innerHTML = svg;

    return {
      items,
      cum,
      total,
      top3Pct:       cum[Math.min(2, cum.length - 1)],
      reach80Index:  cum.findIndex(p => p >= 80),
    };
  }

  /* ---- 1) Pareto: parts lost by reason code ---- */
  const reasonAgg = {};
  DATA.rows.forEach(r => {
    if (!r.reason) return;
    const lost = r.planned > 0 ? Math.max(0, r.planned - r.produced) : 0;
    reasonAgg[r.reason] = (reasonAgg[r.reason] || 0) + lost;
  });
  const reasonItems = Object.entries(reasonAgg)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }));

  const reasonInfo = renderPareto('#pareto-reason', reasonItems, { yAxisLabel: 'Parts lost', cap: 10 });

  if (reasonInfo) {
    const top      = reasonInfo.items[0];
    const topShare = ((top.value / reasonInfo.total) * 100).toFixed(0);
    document.getElementById('pareto-reason-caption').innerHTML = `
      <strong>${top.label}</strong> alone accounts for
      <span class="hl-red">${topShare}%</span> of all parts lost to reason-coded events
      (<strong>${fmt(top.value)}</strong> of <strong>${fmt(reasonInfo.total)}</strong>).
      ${reasonInfo.reach80Index >= 0
        ? `First <span class="hl-lime">${reasonInfo.reach80Index + 1}</span> categor${reasonInfo.reach80Index === 0 ? 'y' : 'ies'} reach the 80% threshold.`
        : `No single category reaches 80%.`}
    `;
  }

  /* ---- 2) Pareto: parts short by machine ---- */
  const machineAgg = {};
  DATA.rows.forEach(r => {
    if (r.planned <= 0) return;
    const short = Math.max(0, r.planned - r.produced);
    if (short <= 0) return;
    const m = r.machine || '—';
    machineAgg[m] = (machineAgg[m] || 0) + short;
  });
  const machineItems = Object.entries(machineAgg).map(([label, value]) => ({ label, value }));

  const machineInfo = renderPareto('#pareto-machine', machineItems, { yAxisLabel: 'Parts short', cap: 10 });

  if (machineInfo) {
    const top3    = machineInfo.items.slice(0, 3);
    const top3Sum = top3.reduce((s, i) => s + i.value, 0);
    const top3Pct = ((top3Sum / machineInfo.total) * 100).toFixed(0);
    document.getElementById('pareto-machine-caption').innerHTML = `
      Top 3 machines (<strong>${top3.map(i => i.label).join(', ')}</strong>)
      account for <span class="hl-red">${top3Pct}%</span> of total parts shortfall
      (<strong>${fmt(top3Sum)}</strong> of <strong>${fmt(machineInfo.total)}</strong>).
      ${machineInfo.reach80Index >= 0
        ? `Focusing on the top <span class="hl-lime">${machineInfo.reach80Index + 1}</span> machines would recover 80% of lost output.`
        : ''}
    `;
  }
}
