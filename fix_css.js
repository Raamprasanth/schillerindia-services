const fs = require('fs');
const files = [
  'Repair-dashboard.html',
  'Rtfrn.html', 'Rtob.html', 'Rtur.html', 'Rtcrl.html',
  'Rtoa.html', 'Rtcoa.html', 'Rtcomr.html', 'Rtccr.html'
];
let count = 0;
files.forEach(f => {
  const path = 'frontend/public/' + f;
  let c = fs.readFileSync(path, 'utf8');
  const brokenStr = '80%{transform:scaleX(0.8);opacity:1;}100%{transform:scaleX(1);opacity:0;}}';
  if (c.includes(brokenStr)) {
    c = c.replace(brokenStr, '');
    fs.writeFileSync(path, c, 'utf8');
    count++;
    console.log('Fixed CSS in ' + f);
  }
});
console.log('Fixed ' + count + ' files.');
