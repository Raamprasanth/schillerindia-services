const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Remove the old d15 constant declaration
const regexRemove = /const d15 = data\.submissions\?\.includes\('15'\) \|\| false;\n/g;
content = content.replace(regexRemove, '');

// 2. Add d15 to the var declarations
const regexVar = /var d02 = '-', d03 = '-', d05 = '-', d16 = '-';/g;
content = content.replace(regexVar, `var d02 = '-', d03 = '-', d05 = '-', d15 = '-', d16 = '-';`);

// 3. Add d15 to the initialization block
const regexInit = /d05 = '05-' \+ mStr \+ '-' \+ yearStr;\n\s*d16 = '16-' \+ mStr \+ '-' \+ yearStr;/g;
content = content.replace(regexInit, `d05 = '05-' + mStr + '-' + yearStr;\n    d15 = '15-' + mStr + '-' + yearStr;\n    d16 = '16-' + mStr + '-' + yearStr;`);

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully updated d15 logic.');
