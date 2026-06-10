const fs = require('fs');
const file = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/Reports.html';
let content = fs.readFileSync(file, 'utf8');

// Replace \` with `
content = content.replace(/\\`/g, '`');

// Replace \${ with ${
content = content.replace(/\\\${/g, '${');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax errors in Reports.html');
