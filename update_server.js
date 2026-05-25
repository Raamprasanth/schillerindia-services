const fs = require('fs');
const path = require('path');
let s = fs.readFileSync('backend/server.js', 'utf8');
if (!s.includes("app.get('/todr.html'")) {
  s = s.replace(
    "app.get('/scprfob.html',               (req, res) => res.sendFile(path.join(frontendPath, 'scprfob.html')));",
    "app.get('/scprfob.html',               (req, res) => res.sendFile(path.join(frontendPath, 'scprfob.html')));\napp.get('/todr.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'todr.html')));\napp.get('/ctodr.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'ctodr.html')));\napp.get('/Sc-dashboard.html',         (req, res) => res.sendFile(path.join(frontendPath, 'Sc-dashboard.html')));\napp.get('/sc-dashboard.html',         (req, res) => res.sendFile(path.join(frontendPath, 'Sc-dashboard.html')));"
  );
  fs.writeFileSync('backend/server.js', s, 'utf8');
  console.log('Added app.get routes');
}
