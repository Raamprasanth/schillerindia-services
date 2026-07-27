const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const literalNewline = String.fromCharCode(92) + 'n';
const actualNewline = '\\n'; // This is an actual newline character in JS

let prevLength = 0;
while (content.length !== prevLength) {
    prevLength = content.length;
    content = content.replace(literalNewline, actualNewline);
}

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed literal newlines for REAL this time.');
