const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /const isBuyBackMonth = true;/g;
const replacement = `const isBuyBackMonth = params.month && (
      params.month.includes('-04-') || 
      params.month.includes('-08-') || 
      params.month.includes('-12-') ||
      params.month.endsWith('-04') || 
      params.month.endsWith('-08') || 
      params.month.endsWith('-12')
    );`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Successfully reverted isBuyBackMonth back to dynamic!');
} else {
    console.log('Regex did not match.');
}
