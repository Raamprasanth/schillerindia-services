const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'elt.html');
let content = fs.readFileSync(p, 'utf8');

// 1. Remove the "Parts" and "Divisions" summary cards
const cardsRegex = /\s*<div class="stat-card sc-purple">[\s\S]*?<div class="stat-card sc-amber">[\s\S]*?Active in table<\/div><\/div>/;
content = content.replace(cardsRegex, '');

// 2. Swap the headers (Revalue <-> GIR No)
const headerRegex = /<th onclick="sortBy\('revalue'\)">Revalue <span class="si">&#8693;<\/span><\/th>\s*<th onclick="sortBy\('girNo'\)">GIR No <span class="si">&#8693;<\/span><\/th>/;
const headerReplacement = `<th onclick="sortBy('girNo')">GIR No <span class="si">&#8693;</span></th>
            <th onclick="sortBy('revalue')">Revalue <span class="si">&#8693;</span></th>`;
content = content.replace(headerRegex, headerReplacement);

// 3. Swap the cells in renderTable()
const cellsRegex = /<td><input type="number" id="rev-\$\{id\}" value="\$\{d\.revalue \?\? ''\}" placeholder="Amount" style="padding:5px; border-radius:5px; border:1px solid #ccc; width:80px;"><\/td>\s*<td class="mono">\$\{esc\(d\.girNo \|\| '-'\)\}<\/td>/;
const cellsReplacement = `<td class="mono">\${esc(d.girNo || '-')}</td>
        <td><input type="number" id="rev-\${id}" value="\${d.revalue ?? ''}" placeholder="Amount" style="padding:5px; border-radius:5px; border:1px solid #ccc; width:80px;"></td>`;
content = content.replace(cellsRegex, cellsReplacement);

fs.writeFileSync(p, content, 'utf8');
console.log('Modifications applied successfully!');
