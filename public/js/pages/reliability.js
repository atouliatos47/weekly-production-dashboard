/* ==========================================================
   pages/reliability.js — Reliability tab
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function reliabilityTab() {

  const MAINTENANCE = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE']);
  const QUALITY     = new Set(['QUALITY ISSUE', 'SUPPLIER']);

  // Enrich every reason-coded row once
  const events = DATA.rows
    .filter(r => r.reason)
    .map(r => ({
      ...r,
      _lost:  r.planned > 0 ? Math.max(0, r.planned - r.produced) : 0,
      _att:   r.planned > 0 ? (r.produced / r.planned) * 100 : null,
      _group: MAINTENANCE.has(r.reason) ? 'maintenance'
            : QUALITY.has(r.reason)     ? 'quality'
            : 'planning',
    }));

  // ---- KPI tiles ----
  const maint        = events.filter(e => e._group === 'maintenance');
  const maintLost    = maint.reduce((s, e) => s + e._lost, 0);
  const maintMachines = new Set(maint.map(e => e.machine));

  // Worst single maintenance event by parts lost
  const worst = maint.slice().sort((a, b) => b._lost - a._lost)[0];

  // Repeat offenders: machines with more than one maintenance event
  const mCounts = {};
  maint.forEach(e => { mCounts[e.machine] = (mCounts[e.machine] || 0) + 1; });
  const repeaters = Object.values(mCounts).filter(n => n > 1).length;

  document.getElementById('rel-events').textContent   = maint.length;
  document.getElementById('rel-lost').textContent     = fmt(maintLost);
  document.getElementById('rel-machines').textContent = maintMachines.size;
  document.getElementById('rel-machines-sub').textContent = `out of ${DATA.totals.machines} machines this week`;
  document.getElementById('rel-worst').textContent    = worst ? fmt(worst._lost) : '0';
  document.getElementById('rel-worst-sub').textContent = worst
    ? `${worst.machine} · ${worst.part || '—'}`
    : 'no failure losses';
  document.getElementById('rel-repeat').textContent   = repeaters;

  // ---- Reason code roll-up (left card) ----
  const codeAgg = {};
  events.forEach(e => {
    const a = codeAgg[e.reason] || (codeAgg[e.reason] = {
      code: e.reason, group: e._group, events: 0, lost: 0, machines: new Set()
    });
    a.events++;
    a.lost += e._lost;
    a.machines.add(e.machine);
  });
  const codeList    = Object.values(codeAgg).sort((a, b) => b.lost - a.lost || b.events - a.events);
  const maxCodeLost = Math.max(...codeList.map(c => c.lost), 1);

  const tagFor = g =>
    g === 'maintenance' ? 'maintenance · our remit' :
    g === 'quality'     ? 'quality / supply' :
    'planning';

  document.getElementById('rel-reason-list').innerHTML = codeList.map(c => {
    const w = (c.lost / maxCodeLost) * 100;
    return `
      <div class="rel-reason-row ${c.group}">
        <div>
          <span class="r-code">${c.code}</span>
          <span class="r-tag">· ${tagFor(c.group)}</span>
        </div>
        <div class="r-events">${c.events}<span>events</span></div>
        <div class="r-bar-wrap"><div class="r-bar" style="width:${w}%"></div></div>
        <div class="r-lost">
          <strong>${fmt(c.lost)}</strong> parts lost
          · across ${c.machines.size} machine${c.machines.size === 1 ? '' : 's'}
        </div>
      </div>`;
  }).join('');

  // ---- Machine reliability signature (right card) ----
  const machAgg = {};
  maint.forEach(e => {
    const m = machAgg[e.machine] || (machAgg[e.machine] = {
      machine: e.machine, events: 0, lost: 0, codes: []
    });
    m.events++;
    m.lost += e._lost;
    m.codes.push(e.reason);
  });
  const machList = Object.values(machAgg).sort((a, b) => b.lost - a.lost);

  const badgeFor = code => code === 'WORK CENTRE FAILURE' ? 'WCF' : 'TF';
  const badgeCls = code => code === 'WORK CENTRE FAILURE' ? 'wcf' : '';

  document.getElementById('rel-machine-list').innerHTML = machList.length
    ? machList.map(m => `
        <div class="rel-machine-row">
          <div class="m-name">${m.machine}</div>
          <div class="m-badges">
            ${m.codes.map(c => `<span class="m-badge ${badgeCls(c)}" title="${c}">${badgeFor(c)}</span>`).join('')}
          </div>
          <div class="m-stats">
            <div class="m-lost">-${fmt(m.lost)}</div>
            <div class="m-events">${m.events} event${m.events === 1 ? '' : 's'}</div>
          </div>
        </div>`).join('')
    : `<div class="empty-state" style="padding:20px 10px">No maintenance failures recorded.</div>`;

  // ---- Events detail table ----
  let relFilter = 'all';

  function renderRelTable() {
    const groupRank = g => ({ maintenance: 0, quality: 1, planning: 2 }[g]);
    const rows = events
      .filter(e => relFilter === 'all' || e._group === relFilter)
      .sort((a, b) => groupRank(a._group) - groupRank(b._group) || b._lost - a._lost);

    document.getElementById('rel-total').textContent   = events.length;
    document.getElementById('rel-showing').textContent = rows.length;

    const tbody = document.getElementById('rel-tbody');
    const empty = document.getElementById('rel-empty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = rows.map(e => {
      const lostCls = e._lost > 0 ? 'parts-lost-neg' : 'parts-lost-zero';
      const attStr  = e._att === null ? '—' : `${e._att.toFixed(0)}%`;
      const chipCls = e._group === 'maintenance' ? 'failure' : e._group === 'quality' ? 'warn' : '';
      return `
        <tr class="r-${e._group}">
          <td><span class="reason-chip ${chipCls}">${e.reason}</span></td>
          <td class="machine-cell">${e.machine}</td>
          <td class="part-cell">${e.part || '—'}</td>
          <td class="wo-cell">${e.work_order || '—'}</td>
          <td><span class="owner-cell">${e.owner || '—'}</span></td>
          <td class="num">${fmt(e.planned)}</td>
          <td class="num">${fmt(e.produced)}</td>
          <td class="num ${lostCls}">${e._lost > 0 ? '-' + fmt(e._lost) : '0'}</td>
          <td class="num">${attStr}</td>
        </tr>`;
    }).join('');
  }

  // Filter chip wiring
  document.querySelectorAll('[data-rel-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-rel-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      relFilter = btn.dataset.relFilter;
      renderRelTable();
    });
  });

  renderRelTable();
}
