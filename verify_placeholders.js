const fs = require('fs');
const dir = 'frontend/public';
let found = false;
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.html')) return;
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  if (/placeholder="[^"]*e\.g\./i.test(c)) {
    console.log('Still has e.g.: ' + f);
    found = true;
  }
});
if (!found) console.log('All clean - no e.g. examples remain in placeholders.');
