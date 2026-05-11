/* ==========================================================
   pages/raw.js — Raw Data tab
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js
   ========================================================== */

function rawTab() {

  // Derive attainment once per row
  const all = DATA.rows.map(r => ({
    ...r,
    _att: r.planned > 0 ? (r.produced / r.planned) * 100 : null,
  }));

  // Counts
  document.getElementById('raw-total').textContent        = all.length;
  document.getElementById('raw-total-inline').textContent = all.length;

  // Populate filter dropdowns
  const owners   = [...new Set(all.map(r => r.owner).filter(Boolean))].sort();
  const machines = [...new Set(all.map(r => r.machine).filter(Boolean))].sort();
  const oSel = document.getElementById('raw-owner');
  const mSel = document.getElementById('raw-machine');
  owners.forEach(o   => oSel.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`));
  machines.forEach(m => mSel.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`));

  // Filter / sort state
  const state = {
    q:       '',
    owner:   'all',
    machine: 'all',
    reason:  'all',
    sortKey: null,
    sortDir: 'desc',
  };

  // Reason chip styling
  const HARD = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE']);
  const WARN = new Set(['QUALITY ISSUE', 'SUPPLIER']);
  const reasonClass = code => HARD.has(code) ? 'failure' : WARN.has(code) ? 'warn' : '';

  // ---- Filter + sort ----
  function apply() {
    const q = state.q.trim().toLowerCase();
    let rows = all.filter(r => {
      if (state.owner   !== 'all' && r.owner   !== state.owner)   return false;
      if (state.machine !== 'all' && r.machine !== state.machine) return false;
      if (state.reason === 'any'  && !r.reason)  return false;
      if (state.reason === 'none' &&  r.reason)  return false;
      if (!q) return true;
      const blob = [r.owner, r.machine, r.area, r.description, r.work_order, r.part, r.reason]
        .map(v => (v || '').toString().toLowerCase()).join(' | ');
      return blob.includes(q);
    });

    if (state.sortKey) {
      const k = state.sortKey, dir = state.sortDir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        let av = a[k], bv = b[k];
        if (av === null || av === undefined || av === '') av = dir === 1 ?  Infinity : -Infinity;
        if (bv === null || bv === undefined || bv === '') bv = dir === 1 ?  Infinity : -Infinity;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return rows;
  }

  // ---- Table renderer ----
  function render() {
    const rows = apply();
    document.getElementById('raw-showing').textContent = rows.length;

    const tbody = document.getElementById('raw-tbody');
    const empty = document.getElementById('raw-empty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const numCell = (v, digits = 0) => {
      if (v === null || v === undefined || v === 0 || v === '')
        return '<td class="num zero">—</td>';
      return `<td class="num">${fmt(v, digits)}</td>`;
    };

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="owner-cell">${r.owner || '—'}</span></td>
        <td class="machine-cell">${r.machine || '—'}</td>
        <td>${r.area || '—'}</td>
        <td class="part-cell">${r.part || '—'}</td>
        <td class="wo-cell">${r.work_order || '—'}</td>
        ${numCell(r.planned)}
        ${numCell(r.produced)}
        <td class="num ${r.balance < 0 ? 'bal-neg' : r.balance > 0 ? 'bal-pos' : 'zero'}">${r.balance ? fmt(r.balance) : '—'}</td>
        <td class="num">${r._att === null ? '<span class="zero">—</span>' : r._att.toFixed(0) + '%'}</td>
        <td>${r.reason ? `<span class="reason-chip ${reasonClass(r.reason)}">${r.reason}</span>` : '<span class="zero">—</span>'}</td>
        ${numCell(r.op_hrs, 1)}
        ${numCell(r.setters, 2)}
        ${numCell(r.minders, 2)}
        ${numCell(r.hrs, 1)}
      </tr>`).join('');

    // Update sort indicators in header
    document.querySelectorAll('#raw-head th').forEach(th => {
      th.classList.remove('sorted');
      th.removeAttribute('data-arrow');
    });
    if (state.sortKey) {
      const active = document.querySelector(`#raw-head th[data-sort="${state.sortKey}"]`);
      if (active) {
        active.classList.add('sorted');
        active.setAttribute('data-arrow', state.sortDir === 'asc' ? '↑' : '↓');
      }
    }
  }

  // ---- CSV export ----
  function toCSV(rows) {
    const cols = [
      ['Owner',        r => r.owner],
      ['Machine',      r => r.machine],
      ['Area',         r => r.area],
      ['Description',  r => r.description],
      ['Work Order',   r => r.work_order],
      ['Part',         r => r.part],
      ['Planned',      r => r.planned],
      ['Produced',     r => r.produced],
      ['Balance',      r => r.balance],
      ['Attainment %', r => r._att === null ? '' : r._att.toFixed(1)],
      ['Reason',       r => r.reason],
      ['Op Hrs',       r => r.op_hrs],
      ['Setters',      r => r.setters],
      ['Minders',      r => r.minders],
      ['Run Hrs',      r => r.hrs],
      ['Mon',          r => r.daily?.Mon ?? 0],
      ['Tue',          r => r.daily?.Tue ?? 0],
      ['Wed',          r => r.daily?.Wed ?? 0],
      ['Thu',          r => r.daily?.Thu ?? 0],
      ['Fri',          r => r.daily?.Fri ?? 0],
      ['Sat',          r => r.daily?.Sat ?? 0],
      ['Sun',          r => r.daily?.Sun ?? 0],
    ];
    const escape = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(c => c[0]).join(',')];
    rows.forEach(r => lines.push(cols.map(c => escape(c[1](r))).join(',')));
    return lines.join('\n');
  }

  function download(filename, content) {
    // BOM so Excel treats it as UTF-8
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Event wiring ----
  document.getElementById('raw-search').addEventListener('input', e => {
    state.q = e.target.value; render();
  });
  document.getElementById('raw-owner').addEventListener('change', e => {
    state.owner = e.target.value; render();
  });
  document.getElementById('raw-machine').addEventListener('change', e => {
    state.machine = e.target.value; render();
  });
  document.getElementById('raw-reason').addEventListener('change', e => {
    state.reason = e.target.value; render();
  });
  document.getElementById('raw-reset').addEventListener('click', () => {
    state.q = ''; state.owner = 'all'; state.machine = 'all';
    state.reason = 'all'; state.sortKey = null; state.sortDir = 'desc';
    document.getElementById('raw-search').value  = '';
    document.getElementById('raw-owner').value   = 'all';
    document.getElementById('raw-machine').value = 'all';
    document.getElementById('raw-reason').value  = 'all';
    render();
  });
  document.getElementById('raw-export').addEventListener('click', () => {
    const rows  = apply();
    const stamp = `WK${DATA.week}_${DATA.year}_clamason`;
    download(`${stamp}_export_${rows.length}rows.csv`, toCSV(rows));
  });

  // Column header sort
  document.querySelectorAll('#raw-head th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        // Numeric cols default to descending on first click, text to ascending
        state.sortDir = th.classList.contains('num') ? 'desc' : 'asc';
      }
      render();
    });
  });

  render();
}
