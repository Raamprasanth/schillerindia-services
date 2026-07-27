const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The marker has literal "\n" in it. We need to replace all literal '\n' that we accidentally injected.
// Since we only injected these in the HTML blocks we just added, we can replace '\\n                <div' with '\n                <div'
content = content.replace(/\\\\n/g, '\\n');

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed literal newlines in Reports.html');
