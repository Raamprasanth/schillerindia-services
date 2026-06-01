const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'cli.html');
let content = fs.readFileSync(p, 'utf8');

// Remove Add New button
const addBtnRegex = /<button class="btn btn-primary btn-sm" onclick="openAddModal\(\)">&#43; Add New<\/button>\s*/;
content = content.replace(addBtnRegex, '');

// Remove Today and Parts summary cards
const cardsRegex = /\s*<div class="stat-card sc-green">[\s\S]*?<div class="stat-card sc-purple">[\s\S]*?Unique part numbers<\/div><\/div>/;
content = content.replace(cardsRegex, '');

// Change CSS grid template columns for stats-row (since it was 4, now 2)
const statsRowRegex = /\.stats-row\{display:grid;grid-template-columns:repeat\(4,1fr\);gap:10px;margin-bottom:14px;\}/;
content = content.replace(statsRowRegex, '.stats-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}');

fs.writeFileSync(p, content, 'utf8');
console.log('cli.html cleanup applied successfully!');
