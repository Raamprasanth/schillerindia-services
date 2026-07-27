const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Remove the const d15
content = content.replace(/const d15 = data\.submissions\?\.includes\('15'\) \|\| false;\r?\n/g, '');

// 2. Add d15 initialization
const target = `d05 = '05-' + mStr + '-' + yearStr;\r\n    d16 = '16-' + mStr + '-' + yearStr;`;
const targetUnix = `d05 = '05-' + mStr + '-' + yearStr;\n    d16 = '16-' + mStr + '-' + yearStr;`;
const replacement = `d05 = '05-' + mStr + '-' + yearStr;\n    d15 = '15-' + mStr + '-' + yearStr;\n    d16 = '16-' + mStr + '-' + yearStr;`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
} else if (content.includes(targetUnix)) {
  content = content.replace(targetUnix, replacement);
} else {
  console.log("Could not find the target string to replace.");
}

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed syntax error!');
