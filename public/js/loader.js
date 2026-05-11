/* ==========================================================
   loader.js — file upload, drag-and-drop, adherence snapshot
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js, pages/adherence.js, app.js
   ========================================================== */

// ---- Adherence trend: persist a weekly snapshot to localStorage ----

function saveAdherenceTrend(payload) {
  try {
    const planned = payload.rows.filter(r => (r.planned || 0) > 0);
    if (!planned.length) return;

    const totalPlanned  = planned.reduce((s, r) => s + r.planned, 0);
    const totalProduced = planned.reduce((s, r) => s + r.produced, 0);
    const overallPct    = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;

    // Status counts
    const counts = { critical: 0, risk: 0, track: 0, complete: 0 };
    planned.forEach(r => {
      const att = (r.produced / r.planned) * 100;
      const s   = att >= 100 ? 'complete' : att >= 90 ? 'track' : att >= 70 ? 'risk' : 'critical';
      counts[s]++;
    });

    // Upsert this week into the stored trend array
    let trend = [];
    try { trend = JSON.parse(localStorage.getItem(ADH_TREND_KEY) || '[]'); } catch (_) {}
    const idx   = trend.findIndex(e => e.week === payload.week && e.year === payload.year);
    const entry = {
      week:  payload.week,
      year:  payload.year,
      label: `WK${payload.week}`,
      pct:   +overallPct.toFixed(1),
      counts,
    };
    if (idx >= 0) trend[idx] = entry; else trend.push(entry);

    // Keep sorted chronologically; cap at 26 weeks
    trend.sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week);
    if (trend.length > 26) trend = trend.slice(-26);
    localStorage.setItem(ADH_TREND_KEY, JSON.stringify(trend));
  } catch (e) {
    console.warn('Could not save adherence trend:', e);
  }
}

// ---- File reader ----

async function loadFile(file) {
  if (!file) return;
  const name = file.name || '';
  showStatus(`Reading <strong>${name}</strong>…`, 'ok', 0);

  try {
    const buf = await file.arrayBuffer();

    // SheetJS reads both .csv and .xlsx
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });

    // Pick the most relevant sheet: prefer one matching WK## from the filename
    let sheetName = wb.SheetNames[0];
    const wkMatch = (name.match(/wk[_\s-]*(\d{1,2})/i) || [])[1];
    if (wkMatch) {
      const wanted = `WK${wkMatch}`;
      const found  = wb.SheetNames.find(s => s.toUpperCase().includes(wanted));
      if (found) sheetName = found;
    } else {
      const found = wb.SheetNames.find(s => /^WK\d/i.test(s));
      if (found) sheetName = found;
    }

    const sheet = wb.Sheets[sheetName];
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    const payload = parseRowsToPayload(rows, name);

    DATA = payload;
    saveAdherenceTrend(payload);
    renderAll();

    showStatus(
      `Loaded <strong>WK${payload.week}/${payload.year}</strong> · ${payload.rows.length} active lines · ${payload.captured_days}/7 days captured`,
      'ok'
    );
  } catch (err) {
    console.error(err);
    showStatus(`<strong>Couldn't read file:</strong> ${err.message}`, 'error', 7000);
  }
}

// ---- Upload button + file input ----

document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('upload-input').click();
});

document.getElementById('upload-input').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) loadFile(f);
  e.target.value = ''; // allow re-uploading the same file
});

// ---- Drag-and-drop anywhere on the page ----

['dragenter', 'dragover'].forEach(evt => {
  document.addEventListener(evt, e => {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      document.getElementById('upload-btn').classList.add('dragging');
    }
  });
});

['dragleave', 'drop'].forEach(evt => {
  document.addEventListener(evt, () => {
    document.getElementById('upload-btn').classList.remove('dragging');
  });
});

document.addEventListener('drop', e => {
  if (e.dataTransfer && e.dataTransfer.files.length) {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
  }
});
