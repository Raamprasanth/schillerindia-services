const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The string "\\n" is two characters: a backslash and an 'n'.
const literalNewline = String.fromCharCode(92) + 'n';
const actualNewline = '\\n';

let prevLength = 0;
while (content.length !== prevLength) {
    prevLength = content.length;
    content = content.replace(literalNewline, actualNewline);
}

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed literal newlines for good.');
