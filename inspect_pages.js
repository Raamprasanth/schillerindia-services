const fs = require('fs');

['emppendingfrn.html', 'employee-ob-pending.html'].forEach(f => {
  const path = 'frontend/public/' + f;
  if (!fs.existsSync(path)) { console.log('NOT FOUND: ' + f); return; }
  const c = fs.readFileSync(path, 'utf8');
  const lines = c.split('\n');
  console.log('\n=== ' + f + ' ===');
  lines.forEach((l, i) => {
    if (/(updateStats|stat-card|stat-val|noOfDays|calcDays|pdays|pdFrn|pendingDays|Normal|Warning|Critical|sc-green|sc-amber|sc-red|cards\[|stat-normal|stat-warn|stat-crit|filterByCard)/i.test(l))
      console.log((i+1) + ': ' + l.substring(0, 150));
  });
});
