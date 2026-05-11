/* ==========================================================
   server.js — Express static server
   Weekly Production Dashboard · Clamason
   ========================================================== */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all: any unknown route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Weekly Production Dashboard running on http://localhost:${PORT}`);
});
