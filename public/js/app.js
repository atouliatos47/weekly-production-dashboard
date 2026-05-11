/* ==========================================================
   app.js — tab switching, renderAll, bootstrap
   Weekly Production Dashboard · Clamason
   Depends on: state.js, utils.js, all pages/*, loader.js
   ========================================================== */

// ---- Tab switching ----

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---- Master render dispatcher ----
// Called on initial load and every time a new file is uploaded.

function renderAll() {
  renderOverview();
  reliabilityTab();
  adherenceTab();
  labourTab();
  chartsTab();
  rawTab();
}

// ---- Bootstrap ----
// The data-payload <script> may have set DATA directly, or it may have
// written a named const (e.g. WEEK17). Handle both cases gracefully.

(function bootstrap() {
  if (!DATA && typeof WEEK17 !== 'undefined') DATA = WEEK17;

  if (DATA) {
    renderAll();
  } else {
    // No embedded data — show a prompt to upload a file
    showStatus('No data loaded · drop a weekly file or click ↑ Load Weekly File to begin', 'ok', 0);
  }
})();
