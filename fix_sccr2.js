const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/sccr.html');
let c = fs.readFileSync(p, 'utf8');

// 1. thead changes
c = c.replace(
  `<th onclick="sortBy('executedDate')">Spares rcd date <span class="si">&#8693;</span></th>`,
  `<th onclick="sortBy('sparesReceivedAtSvc')">Spares rcd date <span class="si">&#8693;</span></th>\n            <th onclick="sortBy('executedDate')">Executed Date <span class="si">&#8693;</span></th>`
);

// 2. tbody changes
c = c.replace(
  `<td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>\n      </tr>\`;`,
  `<td style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</td>\n        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>\n      </tr>\`;`
);

// 3. colspans 11 -> 12
c = c.replace(/colspan="11"/g, 'colspan="12"');

// 4. stats card removal
const completedCardRegex = /<div class="stat-card sc-green">[\s\S]*?<div class="stat-icon si-green">&#128221;<\/div>[\s\S]*?<div class="stat-label">Completed<\/div>[\s\S]*?<div class="stat-value" id="s-completed"> <\/div>[\s\S]*?<div class="stat-sub">Successfully executed<\/div>\s*<\/div>/;
c = c.replace(completedCardRegex, '');

// 5. stats grid css
c = c.replace(/grid-template-columns:repeat\(4,1fr\);/, 'grid-template-columns:repeat(3,1fr);');
c = c.replace(/grid-template-columns: repeat\(4, 1fr\);/, 'grid-template-columns: repeat(3, 1fr);'); // just in case it's formatted

// 6. remove s-completed from setLoading
c = c.replace(/,'s-completed'/, '');

// 7. remove from updateStats
c = c.replace(/  \(document\.getElementById\('s-completed'\)\|\|\{\}\)\.textContent = DATA\.filter\(d=>d\.status==='Completed'\)\.length;\r?\n/, '');

fs.writeFileSync(p, c, 'utf8');
console.log('Update complete.');
