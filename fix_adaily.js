const fs = require('fs');
const p = 'c:/Users/raamp/OneDrive/Desktop/shcl/frontend/public/adaily.html';
let txt = fs.readFileSync(p, 'utf8');
txt = txt.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync(p, txt);
console.log('Fixed adaily.html');
