const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

const thRegex = /<th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px;">Total Tracked Days<\/th>\n/g;
html = html.replace(thRegex, '');

const tdRegex = /<td style="border:1px solid #cbd5e1; padding:10px;">\$\{totCompleted\} \/ \$\{totTracked\}<\/td>\n/g;
html = html.replace(tdRegex, '');

fs.writeFileSync(file, html);
console.log('Removed Total Tracked Days column');
