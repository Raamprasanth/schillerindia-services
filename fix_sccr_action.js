const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/sccr.html');
let c = fs.readFileSync(p, 'utf8');

// 1. Rename Warranty Status
c = c.replace(
  /<th onclick="sortBy\('warrantyStatus'\)">Warranty Status <span class="si">&#8693;<\/span><\/th>/,
  '<th onclick="sortBy(\'warrantyStatus\')">Warr Status <span class="si">&#8693;</span></th>'
);

// 2. Remove Status column from thead and add Action
c = c.replace(
  /\s*<th onclick="sortBy\('status'\)">Status <span class="si">&#8693;<\/span><\/th>/,
  ''
);
c = c.replace(
  /<th onclick="sortBy\('executedDate'\)">Executed Date <span class="si">&#8693;<\/span><\/th>/,
  '<th onclick="sortBy(\'executedDate\')">Executed Date <span class="si">&#8693;</span></th>\n            <th style="text-align:center;">Action</th>'
);

// 3. Remove Status from tbody and add Action
c = c.replace(
  /\s*<td>\$\{statusPill\(d\.status\)\}<\/td>/,
  ''
);
c = c.replace(
  /<td style="font-size:11px;color:var\(--soft\);">\$\{fmtDate\(d\.executedDate\)\}<\/td>\s*<\/tr>`;\s*}\)\.join\(''\);/,
  `<td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>
        <td style="text-align:center;"><button class="btn-xs btn-outline" onclick="openUpdateModal('\${rid}')" title="View">&#128065;&#65039;</button></td>
      </tr>\`;
    }).join('');`
);

fs.writeFileSync(p, c, 'utf8');
console.log('Action column added, Status removed, Warranty renamed.');
