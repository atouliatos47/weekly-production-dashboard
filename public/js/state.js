/* ==========================================================
   state.js — shared mutable state & constants
   Weekly Production Dashboard · Clamason
   ========================================================== */

// The active week's data payload.
// Populated either by the inlined data-payload <script> on page load,
// or replaced by loadFile() when the user uploads a new week's file.
let DATA = null;

// localStorage key for the week-on-week adherence trend snapshots.
// Shared between loader.js (writes) and pages/adherence.js (reads).
const ADH_TREND_KEY = 'clamason_adh_trend_v1';
