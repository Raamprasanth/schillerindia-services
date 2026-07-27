const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /const isBuyBackMonth = params\.month && \([\s\S]*?\);/g;
const replacement = `const isBuyBackMonth = true;`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Successfully hardcoded isBuyBackMonth to true!');
} else {
    console.log('Regex did not match.');
}
