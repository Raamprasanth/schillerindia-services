const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/sccr.html');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /<td style="font-size:11px;color:var\(--soft\);">\$\{fmtDate\(d\.executedDate\)\}<\/td>\s*<\/tr>`;\s*}\)\.join\(''\);/,
  `<td style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>
      </tr>\`;
    }).join('');`
);

fs.writeFileSync(p, c, 'utf8');
console.log('Fixed missing td in sccr.html with regex');
