const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'elt.html');
let content = fs.readFileSync(p, 'utf8');

// 1. Remove Add New button
const addBtnRegex = /<button class="topbar-btn primary" onclick="openAddModal\(\)">&#43; Add New<\/button>\s*/g;
content = content.replace(addBtnRegex, '');

// 2. Change Opt to Status in column header
const optRegex = /<th>Opt<\/th>/g;
content = content.replace(optRegex, '<th>Status</th>');

// 3. Make remarks editable (remove readonly and update styles)
const rmkRegex = /readonly tabindex="-1" style="padding:5px; border:none; background:transparent; color:var\(--text\); width:100%; min-width:120px; outline:none; cursor:default;"/g;
content = content.replace(rmkRegex, 'style="padding:5px; border-radius:5px; border:1px solid #ccc; background:var(--surface); color:var(--text); width:100%; min-width:120px; outline:none;"');

fs.writeFileSync(p, content, 'utf8');
console.log('Modifications applied successfully!');
