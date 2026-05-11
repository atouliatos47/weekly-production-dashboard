/* ==========================================================
   pages/overview.js — Overview tab renderer
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function renderOverview() {

  /* ---------- Header chips ---------- */
  document.getElementById('wk-no').textContent     = DATA.week;
  document.getElementById('wk-period').textContent = DATA.period.toUpperCase();
  document.getElementById('raw-count').textContent = DATA.rows.length;

  /* ---------- KPI strip ---------- */
  const t = DATA.totals;
  document.getElementById('kpi-planned').textContent  = fmt(t.planned);
  document.getElementById('kpi-produced').textContent = fmt(t.produced);
  document.getElementById('kpi-attain').textContent   = pct(t.attainment_pct);
  document.getElementById('kpi-lines').textContent    = fmt(t.lines);
  document.getElementById('kpi-machines-sub').textContent = `across ${t.machines} machines`;
  document.getElementById('kpi-failure').textContent  = fmt(DATA.lines_in_failure);
  document.getElementById('kpi-produced-sub').textContent = `${DATA.captured_days}/7 days captured`;

  // Colour the attainment card based on value
  const attCard = document.getElementById('kpi-attain-card');
  attCard.classList.remove('accent', 'warn', 'bad');
  if (t.attainment_pct >= 95)      attCard.classList.add('accent');
  else if (t.attainment_pct >= 80) attCard.classList.add('warn');
  else                              attCard.classList.add('bad');
  document.getElementById('kpi-attain-sub').textContent =
    t.attainment_pct >= 100
      ? `+${(t.attainment_pct - 100).toFixed(1)}% over plan`
      : `${(100 - t.attainment_pct).toFixed(1)}% short of plan`;

  /* ---------- Daily production bars ---------- */
  (function renderDaily() {
    const days = DATA.daily;
    const max  = Math.max(...days.map(d => d.produced), 1);
    const host = document.getElementById('daily-bars');
    host.innerHTML = days.map(d => {
      const h     = d.produced > 0 ? Math.max(4, Math.round(d.produced / max * 180)) : 6;
      const empty = d.produced === 0 ? 'empty' : '';
      const lbl   = d.produced > 0 ? `${fmt(d.produced)}` : '';
      return `
        <div class="col">
          <div class="bar-wrap">
            <div class="bar ${empty}" style="height:${h}px">
              ${lbl ? `<div class="val">${lbl}</div>` : ''}
            </div>
          </div>
          <div class="day-lbl">${d.day}</div>
          <div class="date-lbl">${d.date}</div>
        </div>`;
    }).join('');
  })();

  /* ---------- Machine attainment ranked ---------- */
  (function renderMachines() {
    const list = [...DATA.machines].sort((a, b) => (a.attainment || 0) - (b.attainment || 0));
    const capPct     = 150;
    const targetLeft = (100 / capPct) * 100;
    const host = document.getElementById('machine-list');
    host.innerHTML = list.map(m => {
      const a    = m.attainment || 0;
      const band = a >= 95 ? 'green' : a >= 70 ? 'amber' : 'red';
      const width = Math.min(100, (a / capPct) * 100);
      return `
        <div class="machine-row">
          <div class="name">${m.Machinery}</div>
          <div class="track">
            <div class="fill ${band}" style="width:${width}%"></div>
            <div class="target" style="left:${targetLeft}%"></div>
          </div>
          <div class="pct ${band}">${pct(a)}</div>
        </div>`;
    }).join('');
  })();

  /* ---------- Reason codes ---------- */
  (function renderReasons() {
    const list = [...DATA.reasons].sort((a, b) => b.count - a.count);
    const hard = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE']);
    const warn = new Set(['QUALITY ISSUE', 'SUPPLIER']);
    const host = document.getElementById('reason-list');
    host.innerHTML = list.map(r => {
      const cls = hard.has(r.code) ? 'failure' : warn.has(r.code) ? 'warn' : '';
      const tag = hard.has(r.code) ? 'maintenance' : warn.has(r.code) ? 'quality/supply' : 'planning';
      return `
        <div class="reason-row ${cls}">
          <div><span class="code">${r.code}</span><span class="tag">· ${tag}</span></div>
          <div class="count">${r.count}</div>
        </div>`;
    }).join('');
  })();
}
