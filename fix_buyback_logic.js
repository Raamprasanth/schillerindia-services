const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const target = `const isBuyBackMonth = params.month && (params.month.endsWith('-04') || params.month.endsWith('-08') || params.month.endsWith('-12'));`;
const replacement = `const isBuyBackMonth = params.month && (
      params.month.includes('-04-') || 
      params.month.includes('-08-') || 
      params.month.includes('-12-') ||
      params.month.endsWith('-04') || 
      params.month.endsWith('-08') || 
      params.month.endsWith('-12')
    );`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Fixed isBuyBackMonth logic!');
} else {
    console.log('Target not found!');
}
