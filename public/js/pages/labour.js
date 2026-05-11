/* ==========================================================
   pages/labour.js — Labour tab
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function labourTab() {

  // Enrich every row with labour fields
  const all = DATA.rows.map(r => ({
    ...r,
    _op:  r.op_hrs  || 0,
    _set: r.setters || 0,
    _min: r.minders || 0,
    _run: r.hrs     || 0,
  }));
  const labour = all.filter(r => r._op > 0 || r._set > 0 || r._min > 0);

  // Classify by operation style
  //   press    : rows with setter or minder allocations
  //   assembly : rows with operator hours only
  labour.forEach(r => {
    r._type = (r._set > 0 || r._min > 0) ? 'press'
            : r._op > 0                  ? 'assembly'
            : 'other';
  });

  // ---- KPI tiles ----
  const totOp  = labour.reduce((s, r) => s + r._op,  0);
  const totSet = labour.reduce((s, r) => s + r._set, 0);
  const totMin = labour.reduce((s, r) => s + r._min, 0);
  const opFte  = totOp / 40;  // weekly FTE basis

  document.getElementById('lab-op-hrs').textContent  = fmt(totOp, 0);
  document.getElementById('lab-op-fte').textContent  = opFte.toFixed(1);
  document.getElementById('lab-setters').textContent = totSet.toFixed(1);
  document.getElementById('lab-minders').textContent = totMin.toFixed(1);
  document.getElementById('lab-lines').textContent   = labour.length;
  document.getElementById('lab-lines-sub').textContent = `of ${DATA.rows.length} total lines`;

  // ---- Assembly / Pack area ranking ----
  const areaAgg = {};
  labour.filter(r => r._type === 'assembly').forEach(r => {
    const k = r.area || r.machine || '—';
    const a = areaAgg[k] || (areaAgg[k] = { area: k, op: 0, run: 0, lines: 0, parts: 0 });
    a.op    += r._op;
    a.run   += r._run;
    a.lines += 1;
    a.parts += r.planned;
  });
  const assemblyList = Object.values(areaAgg).sort((a, b) => b.op - a.op);
  const maxAsm = Math.max(...assemblyList.map(a => a.op), 1);

  const asmHost = document.getElementById('lab-assembly-list');
  asmHost.innerHTML = assemblyList.length
    ? assemblyList.map(a => {
        const w = (a.op / maxAsm) * 100;
        return `
          <div class="lab-area-row">
            <div>
              <div class="a-name">${a.area}</div>
              <div class="a-meta">${a.lines} line${a.lines === 1 ? '' : 's'} · ${fmt(a.run, 1)}h actual run · ${fmt(a.parts)} parts planned</div>
            </div>
            <div class="a-val">${fmt(a.op, 1)}<span>op hrs</span></div>
            <div class="a-bar-wrap"><div class="a-bar" style="width:${w}%"></div></div>
          </div>`;
      }).join('')
    : '<div class="empty-state" style="padding:20px 10px">No assembly lines with operator hours.</div>';

  // ---- Press shop machine ranking ----
  const pressAgg = {};
  labour.filter(r => r._type === 'press').forEach(r => {
    const k = r.machine || '—';
    const p = pressAgg[k] || (pressAgg[k] = { machine: k, setters: 0, minders: 0, lines: 0, run: 0 });
    p.setters += r._set;
    p.minders += r._min;
    p.lines   += 1;
    p.run     += r._run;
  });
  const pressList = Object.values(pressAgg).sort((a, b) => (b.minders + b.setters) - (a.minders + a.setters));

  const pressHost = document.getElementById('lab-press-list');
  pressHost.innerHTML = pressList.length
    ? pressList.map(p => `
        <div class="lab-press-row">
          <div>
            <div class="p-name">${p.machine}</div>
            <div class="p-meta">${p.lines} WO · ${fmt(p.run, 1)}h run</div>
          </div>
          <div class="p-fte">
            ${p.setters > 0 ? `<span class="p-pill setter">S · ${p.setters.toFixed(2)}</span>` : ''}
            ${p.minders > 0 ? `<span class="p-pill minder">M · ${p.minders.toFixed(2)}</span>` : ''}
          </div>
          <div class="p-total">${(p.setters + p.minders).toFixed(2)}<span>FTE total</span></div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:20px 10px">No press lines with setter/minder allocation.</div>';

  // ---- Owner breakdown ----
  const ownerAgg = {};
  labour.forEach(r => {
    const k = r.owner || '—';
    const o = ownerAgg[k] || (ownerAgg[k] = { owner: k, op: 0, set: 0, min: 0, lines: 0 });
    o.op    += r._op;
    o.set   += r._set;
    o.min   += r._min;
    o.lines += 1;
  });
  const ownerList = Object.values(ownerAgg)
    .filter(o => o.owner && o.owner !== '—')
    .sort((a, b) => (b.op + (b.set + b.min) * 40) - (a.op + (a.set + a.min) * 40));

  document.getElementById('lab-owner-grid').innerHTML = ownerList.map(o => `
    <div class="lab-owner-card">
      <div class="o-name">${o.owner}</div>
      <div class="o-lines">${o.lines} labour line${o.lines === 1 ? '' : 's'}</div>
      <div class="o-stats">
        <div class="o-stat wide">
          <div class="o-val">${fmt(o.op, 1)}</div>
          <div class="o-lbl">Operator hours</div>
        </div>
        <div class="o-stat">
          <div class="o-val">${o.set.toFixed(1)}</div>
          <div class="o-lbl">Setter FTE</div>
        </div>
        <div class="o-stat">
          <div class="o-val">${o.min.toFixed(1)}</div>
          <div class="o-lbl">Minder FTE</div>
        </div>
      </div>
    </div>`).join('');

  // ---- All labour lines table ----
  let labFilter = 'all';

  function renderLabTable() {
    const rows = labour
      .filter(r => labFilter === 'all' || r._type === labFilter)
      .sort((a, b) => {
        const score = r => r._op + (r._set + r._min) * 40;
        return score(b) - score(a);
      });

    document.getElementById('lab-total').textContent   = labour.length;
    document.getElementById('lab-showing').textContent = rows.length;

    const tbody = document.getElementById('lab-tbody');
    const empty = document.getElementById('lab-empty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const cell = (v, digits = 1) => v > 0
      ? `<td class="num">${fmt(v, digits)}</td>`
      : `<td class="num zero">—</td>`;

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="type-pill ${r._type}">${r._type === 'press' ? 'Press' : 'Assembly'}</span></td>
        <td class="machine-cell">${r.area || r.machine || '—'}</td>
        <td><span class="owner-cell">${r.owner || '—'}</span></td>
        <td class="part-cell">${r.part || '—'}</td>
        ${cell(r._op, 1)}
        ${cell(r._set, 2)}
        ${cell(r._min, 2)}
        ${cell(r._run, 1)}
        <td class="num">${fmt(r.planned)}</td>
      </tr>`).join('');
  }

  document.querySelectorAll('[data-lab-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-lab-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      labFilter = btn.dataset.labFilter;
      renderLabTable();
    });
  });

  renderLabTable();
}
