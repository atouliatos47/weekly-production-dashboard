/* ==========================================================
   utils.js — shared helpers & data parsing
   Weekly Production Dashboard · Clamason
   ========================================================== */

// Day labels used throughout the app for daily columns
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---- Formatters ----

// Format a number with thousands separators; returns '—' for null/NaN
const fmt = (n, d = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { maximumFractionDigits: d });
};

// Format a number as a percentage string; returns '—' for null/NaN
const pct = n => (n === null || n === undefined || isNaN(n)) ? '—' : n.toFixed(1) + '%';

// Safely coerce a cell value to a finite number (0 on failure)
function num(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/,/g, '').replace(/"/g, '').replace(/\s+/g, '');
  if (s === '' || s === '-' || s.startsWith('#')) return 0;
  // Strict: must be entirely numeric (incl. optional sign / decimal / exponent).
  // parseFloat is too lenient – it would accept "24-Apr" as 24.
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Format a cell that may be a Date, ISO string, or "20-Apr" style string
function fmtDayDate(v) {
  if (v instanceof Date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${v.getDate()}-${months[v.getMonth()]}`;
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return fmtDayDate(new Date(v));
  }
  return String(v || '').trim();
}

// ---- Week detection ----

// Try to extract week number from a filename (e.g. "WK_18D_2026.xlsx")
function detectWeekFromFilename(filename) {
  if (!filename) return null;
  const m = filename.match(/wk[_\s-]*(\d{1,2})/i);
  const y = filename.match(/(20\d{2})/);
  if (m) return { week: parseInt(m[1], 10), year: y ? parseInt(y[1], 10) : new Date().getFullYear() };
  return null;
}

// Scan the first few rows of the sheet for a "WK## PLAN" banner cell
function detectWeekFromCells(rows) {
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    for (const cell of rows[r] || []) {
      if (typeof cell === 'string') {
        const m = cell.match(/WK\s*(\d{1,2})\s*PLAN/i);
        if (m) return { week: parseInt(m[1], 10), year: new Date().getFullYear() };
      }
    }
  }
  return null;
}

// Build a human-readable period string from the day header cells
function periodFromDays(dayCells) {
  const dates = dayCells.filter(d => d instanceof Date);
  if (dates.length >= 2) {
    const first = dates[0], last = dates[dates.length - 1];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
      ? `${first.getDate()}–${last.getDate()} ${months[last.getMonth()]} ${last.getFullYear()}`
      : `${first.getDate()} ${months[first.getMonth()]} – ${last.getDate()} ${months[last.getMonth()]} ${last.getFullYear()}`;
  }
  const labels = dayCells.map(fmtDayDate).filter(Boolean);
  return labels.length ? `${labels[0]} – ${labels[labels.length - 1]}` : '';
}

// ---- CSV / XLSX parsing ----

// Convert a 2D array of raw cells (from SheetJS) into the DATA payload object
function parseRowsToPayload(rows, filename) {
  if (!rows || rows.length < 6) throw new Error('File too short – expected at least 6 rows');

  const header = rows[4].map(c => (c === null || c === undefined) ? '' : String(c).trim());
  // Owner column in WK17 = 0, WK18 = 1. Detect by which contains 'Notes'
  const notesIdx = header.indexOf('Notes');
  const ownerIdx = notesIdx > 0 ? notesIdx - 1 : 0;

  // Build a column lookup
  const col = {};
  header.forEach((name, i) => {
    if (name && col[name] === undefined) col[name] = i;
  });

  // Confirm essentials
  ['Machinery', 'Part number', 'Planned', 'Balance', 'Reason Code', 'Hrs', 'Area'].forEach(k => {
    if (col[k] === undefined) throw new Error(`Missing required column: ${k}`);
  });

  // Day columns: 7 cells starting at column "Planned" + 1
  const planIdx = col['Planned'];
  const dayHeaderCells = rows[4].slice(planIdx + 1, planIdx + 8);
  const dayDateLabels  = dayHeaderCells.map(fmtDayDate);

  // Week label
  const wkFromFile = detectWeekFromFilename(filename);
  const wkFromCell = detectWeekFromCells(rows);
  const wk = wkFromFile || wkFromCell || { week: null, year: new Date().getFullYear() };
  const period = periodFromDays(dayHeaderCells);

  // Build records
  const records = [];
  for (let r = 5; r < rows.length; r++) {
    const row = rows[r] || [];
    const machinery = String(row[col['Machinery']] || '').trim();
    if (!machinery) continue;
    // Skip repeated header rows that appear as section dividers in the sheet
    if (machinery.toLowerCase() === 'machinery') continue;

    const planned   = num(row[planIdx]);
    const dailyVals = dayHeaderCells.map((_, i) => num(row[planIdx + 1 + i]));
    const produced  = dailyVals.reduce((s, v) => s + v, 0);
    if (planned <= 0 && produced <= 0) continue; // skip blank lines

    records.push({
      owner:       String(row[ownerIdx] || '').trim(),
      machine:     machinery,
      area:        String(row[col['Area']] || '').trim(),
      description: String(row[col['Description']] || '').trim(),
      work_order:  String(row[col['Work Order']] || '').trim(),
      part:        String(row[col['Part number']] || '').trim(),
      planned, produced,
      balance:     num(row[col['Balance']]),
      hrs:         num(row[col['Hrs']]),
      efacs_rate:  num(row[col['EFACS Rate']]),
      oee:         num(row[col['OEE']]),
      reason:      String(row[col['Reason Code']] || '').trim(),
      daily:       Object.fromEntries(DAY_LABELS.map((d, i) => [d, dailyVals[i]])),
      op_hrs:      num(row[col["Operator Hrs Req'd"]]),
      setters:     num(row[col['Setters']]),
      minders:     num(row[col['Minders']]),
    });
  }

  // Aggregates
  const totalPlanned  = records.reduce((s, r) => s + r.planned, 0);
  const totalProduced = records.reduce((s, r) => s + r.produced, 0);
  const machinesSet   = new Set(records.map(r => r.machine));
  const totals = {
    planned:        totalPlanned,
    produced:       totalProduced,
    lines:          records.length,
    machines:       machinesSet.size,
    attainment_pct: totalPlanned > 0 ? +((totalProduced / totalPlanned) * 100).toFixed(1) : 0,
  };

  // Captured days = number of days with any production
  const dailyTotals = DAY_LABELS.map((d, i) => ({
    day:      d,
    date:     dayDateLabels[i] || '',
    produced: records.reduce((s, r) => s + (r.daily[d] || 0), 0),
  }));
  const capturedDays = dailyTotals.filter(d => d.produced > 0).length;

  // Machine roll-up
  const mAgg = {};
  records.forEach(r => {
    const m = mAgg[r.machine] || (mAgg[r.machine] = { Machinery: r.machine, planned: 0, produced: 0, lines: 0 });
    m.planned  += r.planned;
    m.produced += r.produced;
    m.lines    += 1;
  });
  const machines = Object.values(mAgg).map(m => ({
    ...m,
    attainment: m.planned > 0 ? +((m.produced / m.planned) * 100).toFixed(1) : 0,
  })).sort((a, b) => b.planned - a.planned);

  // Reason code counts
  const FAILURE = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE', 'QUALITY ISSUE', 'SUPPLIER', 'PLAN CHANGE']);
  const HARD    = new Set(['TOOL FAILURE', 'WORK CENTRE FAILURE']);
  const rcCount = {};
  records.forEach(r => { if (r.reason) rcCount[r.reason] = (rcCount[r.reason] || 0) + 1; });
  const reasons = Object.entries(rcCount)
    .map(([code, count]) => ({ code, count, is_failure: FAILURE.has(code) }))
    .sort((a, b) => b.count - a.count);

  const lines_in_failure = records.filter(r => HARD.has(r.reason)).length;

  return {
    week: wk.week,
    year: wk.year,
    period,
    captured_days: capturedDays,
    totals,
    daily: dailyTotals,
    machines,
    reasons,
    lines_in_failure,
    rows: records,
  };
}

// ---- UI helper ----

// Show a temporary status banner at the bottom-right of the screen
function showStatus(message, kind = 'ok', timeout = 4000) {
  const el = document.getElementById('status-banner');
  el.className = 'status-banner show' + (kind === 'error' ? ' error' : '');
  el.innerHTML = message;
  if (timeout) {
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => el.classList.remove('show'), timeout);
  }
}
