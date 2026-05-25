// build_atcrl.js — run with: node build_atcrl.js
const fs   = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../frontend/public/Rtcrl.html');
const dstPath = path.join(__dirname, '../frontend/public/Atcrl.html');

let out = fs.readFileSync(srcPath, 'utf8');

// ── 1. Title ──────────────────────────────────────────────────────────────
out = out.replace('SchillerIndia - RT CRL', 'SchillerIndia - Admin CRL');

// ── 2. Insert dark-mode data-theme script before auth check script ─────────
out = out.replace(
  '<script>(function(){\n  const token = localStorage.getItem(\'schiller_token\');',
  '<script>(function(){ document.documentElement.setAttribute(\'data-theme\', localStorage.getItem(\'si_theme\')||\'light\'); })();</script>\n<script>(function(){\n  const token = localStorage.getItem(\'schiller_token\');'
);

// ── 3. Override CRL accent colours → admin red ────────────────────────────
out = out.replace(
  '--crl:#059669;--crl2:#047857;--crl-bg:rgba(5,150,105,0.08);--crl-soft:rgba(5,150,105,0.12);',
  '--crl:#b91c1c;--crl2:#ef4444;--crl-bg:rgba(185,28,28,0.10);--crl-soft:rgba(185,28,28,0.15);'
);
out = out.replace(
  '--accent:#059669;--accent2:#047857;--accent3:#ecfdf5;',
  '--accent:#b91c1c;--accent2:#ef4444;--accent3:#fef2f2;'
);
out = out.replace(
  '--green:#059669;--green-bg:rgba(5,150,105,0.08);',
  '--green:#059669;--green-bg:rgba(5,150,105,0.08);--red2:#b91c1c;'
);

// ── 4. Dark mode CSS vars (insert before body{ …) ─────────────────────────
const darkVars = `
[data-theme="dark"]{
  --bg:#0f1621;--surface:#1a2333;--surface2:#1e293b;--surface3:#1a2a3e;
  --border:#2a3a52;--border2:#253348;--text:#e2eaf4;--muted:#4a6a8a;
  --soft:#7a9ab0;--card:#1a2333;
  --crl:#ef4444;--crl2:#b91c1c;--crl-bg:rgba(239,68,68,0.15);--crl-soft:rgba(239,68,68,0.2);
  --shadow:0 1px 8px rgba(0,0,0,0.3);--shadow-md:0 4px 20px rgba(0,0,0,0.35);
}
`;
out = out.replace('body{font-family:', darkVars + 'body{font-family:');

// ── 5. Sidebar header → admin red gradient ────────────────────────────────
out = out.replace(
  '.sidebar-header{padding:18px 18px 14px;border-bottom:1px solid var(--border);background:linear-gradient(145deg,#052e16,#059669);}',
  '.sidebar-header{padding:18px 18px 14px;border-bottom:1px solid var(--border);background:linear-gradient(145deg,#450a0a,#b91c1c);}'
);

// ── 6. Add admin-sidebar.css + dashboard-topbar-actions links ─────────────
out = out.replace(
  '  <link rel="stylesheet" href="global-typography.css">',
  '  <link rel="stylesheet" href="global-typography.css">\n  <link rel="stylesheet" href="admin-sidebar.css">\n  <link rel="stylesheet" href="dashboard-topbar-actions.css">\n  <script src="dashboard-topbar-actions.js" defer></script>'
);

// ── 7. Role badge text ─────────────────────────────────────────────────────
out = out.replace(
  '<span class="crl-badge">&#9989; Repair Team</span>',
  '<span class="crl-badge">&#128737;&#65039; Admin View</span>'
);

// ── 8. Replace sidebar nav with admin nav ─────────────────────────────────
const adminNav = `  <nav class="sidebar-nav">
    <div class="nav-section">Main</div>
    <button class="nav-item" onclick="window.location.href='admin-dashboard.html'"><span class="icon">&#128202;</span> Dashboard</button>
    <div class="nav-section">Operations</div>
    <button class="nav-group-toggle" id="sf-toggle" onclick="toggleGroup('sf-toggle','sf-children')"><span class="icon">&#128295;</span> Services &amp; Filter <span class="caret">&#9656;</span></button>
    <div class="nav-children" id="sf-children">
      <div class="nav-sub">
        <button class="nav-item" onclick="window.location.href='service-list.html'"><span class="icon">&#128225;</span> Services</button>
        <button class="nav-item" onclick="window.location.href='pending-frn.html'"><span class="icon">&#128221;</span> Pending FRN</button>
        <button class="nav-item" onclick="window.location.href='ob-pending.html'"><span class="icon">&#128194;</span> OB Pending</button>
        <button class="nav-item" onclick="window.location.href='under-repair.html'"><span class="icon">&#128736;&#65039;</span> Under Repair</button>
        <button class="nav-item" onclick="window.location.href='closed-frn.html'"><span class="icon">&#9989;</span> Closed FRN</button>
      </div>
    </div>
    <button class="nav-group-toggle open" id="rta-toggle" onclick="toggleGroup('rta-toggle','rta-children')"><span class="icon">&#128295;</span> Repair Team Activities <span class="caret">&#9656;</span></button>
    <div class="nav-children open" id="rta-children">
      <div class="nav-sub">
        <a class="nav-item" href="atfrn.html"><span class="icon">&#128221;</span> Admin RT FRN</a>
        <a class="nav-item" href="atob.html"><span class="icon">&#128230;</span> Admin RT OB</a>
        <a class="nav-item" href="atur.html"><span class="icon">&#128736;&#65039;</span> Admin RT UR</a>
        <a class="nav-item active" href="Atcrl.html"><span class="icon">&#9989;</span> Admin CRL</a>
      </div>
    </div>
    <div class="nav-section">Admin</div>
    <button class="nav-item" onclick="window.location.href='usermanagement.html'"><span class="icon">&#128101;</span> User Management</button>
    <button class="nav-item" onclick="window.location.href='Reports.html'"><span class="icon">&#128200;</span> Reports</button>
    <button class="nav-item" onclick="window.location.href='settings.html'"><span class="icon">&#9881;&#65039;</span> Settings</button>
    <button class="nav-item" onclick="window.location.href='notifications.html'"><span class="icon">&#128276;</span> Notifications</button>
  </nav>`;

// Replace the entire nav block
out = out.replace(
  /  <nav class="sidebar-nav">[\s\S]*?  <\/nav>/,
  adminNav
);

// ── 9. Sidebar footer → admin defaults ────────────────────────────────────
out = out.replace(
  '<div class="user-av" id="emp-avatar">R</div>',
  '<div class="user-av" id="emp-avatar">A</div>'
);
out = out.replace(
  '<div class="user-nm" id="emp-name">Repair User</div><div class="user-rl" id="emp-role">Repair Team</div>',
  '<div class="user-nm" id="emp-name">Admin</div><div class="user-rl" id="emp-role">Administrator</div>'
);

// ── 10. Topbar breadcrumb + title ─────────────────────────────────────────
out = out.replace(
  'href="Repair-dashboard.html">Dashboard</a>',
  'href="admin-dashboard.html">Dashboard</a>'
);
out = out.replace(
  '<span>Repair Work</span><span class="sep">&#8250;</span><span>Closed Repair List</span>',
  '<span>Repair Team</span><span class="sep">&#8250;</span><span>Admin Closed Repair List</span>'
);
out = out.replace(
  '<div class="topbar-title">Closed Repair List</div>',
  '<div class="topbar-title">Admin Closed Repair List</div>'
);

// ── 11. Hero banner ───────────────────────────────────────────────────────
out = out.replace(
  'background:linear-gradient(135deg,#052e16 0%,#047857 50%,#059669 100%)',
  'background:linear-gradient(135deg,#450a0a 0%,#991b1b 50%,#b91c1c 100%)'
);
out = out.replace(
  '<div class="hero-title">Closed Repair List</div>',
  '<div class="hero-title">Admin Closed Repair List</div>'
);
out = out.replace(
  '<div class="hero-sub">',
  '<div class="hero-sub">Admin read-only view — '
);

// ── 12. API endpoint rtcrl → atcrl ────────────────────────────────────────
out = out.replace(/\/api\/rtcrl/g, '/api/atcrl');

// ── 13. Auth warn message ─────────────────────────────────────────────────
out = out.replace(
  'may not have access to <code>/api/atcrl</code>.',
  'may not have access to <code>/api/atcrl</code>. Make sure you are logged in as Admin.'
);

// ── 14. CSV filename ──────────────────────────────────────────────────────
out = out.replace("'rtcrl-'", "'atcrl-admin-'");

// ── 15. JS init defaults ──────────────────────────────────────────────────
out = out.replace(
  "textContent = EMP_NAME || 'Repair User'",
  "textContent = EMP_NAME || 'Admin'"
);
out = out.replace(
  "textContent = RAW_ROLE || 'Repair Team'",
  "textContent = RAW_ROLE || 'Administrator'"
);

// ── 16. Inject toggleGroup helper before logout() ─────────────────────────
out = out.replace(
  'function logout(){',
  `function toggleGroup(toggleId, childId) {
  var btn = document.getElementById(toggleId);
  var panel = document.getElementById(childId);
  if (btn && panel) { btn.classList.toggle('open'); panel.classList.toggle('open'); }
}
function logout(){`
);

// ── 17. Write output ──────────────────────────────────────────────────────
fs.writeFileSync(dstPath, out, 'utf8');
console.log('✅  Atcrl.html written:', out.length, 'bytes');
