const fs = require('fs');
const dir = 'frontend/public';

// Repair team pages (those with repair role check + loading-bar)
const files = [
  'Repair-dashboard.html',
  'Rtfrn.html', 'Rtob.html', 'Rtur.html', 'Rtcrl.html',
  'Rtoa.html', 'Rtcoa.html', 'Rtcomr.html', 'Rtccr.html'
];

let changed = 0;

files.forEach(f => {
  const path = dir + '/' + f;
  if (!fs.existsSync(path)) { console.log('NOT FOUND: ' + f); return; }
  let c = fs.readFileSync(path, 'utf8');
  const original = c;

  // 1) Remove the HTML element  <div class="loading-bar" id="loading-bar"></div>
  c = c.replace(/<div class="loading-bar" id="loading-bar"><\/div>\s*/g, '');

  // 2) Remove the CSS rules for .loading-bar
  //    Handles: .loading-bar{...} and .loading-bar.active{...} and @keyframes lb{...}
  c = c.replace(/\.loading-bar\{[^}]*\}\s*/g, '');
  c = c.replace(/\.loading-bar\.active\{[^}]*\}\s*/g, '');
  c = c.replace(/@keyframes lb\{[^}]*\}\s*/g, '');

  // 3) Remove JS calls: setLoading(true/false) and the setLoading function itself
  //    Remove function definition
  c = c.replace(/function setLoading\(on\)\{[^}]*\}\s*/g, '');
  //    Remove calls  setLoading(true);  setLoading(false);  setLoading(on)
  c = c.replace(/\s*setLoading\([^)]*\);?/g, '');

  if (c !== original) {
    fs.writeFileSync(path, c, 'utf8');
    changed++;
    console.log('Updated: ' + f);
  } else {
    console.log('No change: ' + f);
  }
});

console.log('\nDone. ' + changed + ' files updated.');
