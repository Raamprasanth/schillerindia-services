const fs = require('fs');
const path = require('path');

const files = [
  'Sc-dashboard.html',
  'scprfob.html',
  'todr.html',
  'ctodr.html',
  'dr.html',
  'cdr.html',
  'sccr.html',
  'lt.html',
  'cli.html'
];

files.forEach(f => {
  const p = path.join('frontend/public', f);
  if (!fs.existsSync(p)) {
    console.log(`${f}: NOT FOUND`);
    return;
  }
  const content = fs.readFileSync(p, 'utf8');
  const match = content.match(/<nav class="sidebar-nav">([\s\S]*?)<\/nav>/);
  if (match) {
    console.log(`\n==================== ${f} ====================`);
    console.log(match[1].trim());
  } else {
    console.log(`\n==================== ${f} ====================`);
    console.log('NO <nav class="sidebar-nav"> FOUND');
  }
});
