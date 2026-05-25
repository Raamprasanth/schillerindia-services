const fs = require('fs');

['emppendingfrn.html', 'employee-ob-pending.html', 'empestpend.html', 'empunderep.html'].forEach(f => {
  const path = 'frontend/public/' + f;
  const c = fs.readFileSync(path, 'utf8');
  const lines = c.split('\n');
  console.log('\n=== ' + f + ' ===');
  const checks = {
    'filterByCard function':  /function filterByCard/.test(c),
    '_activeCardFilter var':  /_activeCardFilter/.test(c),
    'card onclick wired':     /setAttribute.*onclick.*filterByCard/.test(c),
    'card-active CSS':        /card-active/.test(c),
    'filter injection':       /activeCardFilter.*===.*normal/.test(c),
  };
  Object.entries(checks).forEach(([k,v]) => console.log(`  [${v?'OK':'FAIL'}] ${k}`));
});
