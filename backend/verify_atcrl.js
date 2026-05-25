const fs = require('fs');
const c  = fs.readFileSync('../frontend/public/Atcrl.html', 'utf8');
const checks = {
  'API /api/atcrl calls': (c.match(/\/api\/atcrl/g)||[]).length,
  'Admin red #b91c1c':    c.includes('#b91c1c'),
  'Admin nav (usermgmt)': c.includes('usermanagement.html'),
  'Active Atcrl link':    c.includes('active') && c.includes('Atcrl.html'),
  'Dark mode vars':       c.includes('[data-theme'),
  'toggleGroup fn':       c.includes('toggleGroup'),
  'admin-sidebar.css':    c.includes('admin-sidebar.css'),
  'No old rtcrl refs':    !(c.includes('/api/rtcrl')),
  'Export filename atcrl':c.includes('atcrl-admin-'),
};
for(const [k,v] of Object.entries(checks)) console.log(v ? '[PASS]' : '[FAIL]', k);
