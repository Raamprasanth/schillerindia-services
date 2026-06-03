const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'frontend', 'public', 'empestpend.html');
const content = fs.readFileSync(file, 'utf8');

// Handle both CRLF and LF line endings
const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
const linesArray = content.split(lineEnding);

console.log('Total lines:', linesArray.length);
console.log('Line 770 (1-indexed, index 769):', linesArray[769]); 
console.log('Line 963 (1-indexed, index 962):', linesArray[962]); 

if (linesArray[769].includes('<script>') && linesArray[962].trim() === '</div>') {
  // Remove lines from index 769 to 963 (inclusive - from <script> to the empty line before the next <script>)
  linesArray.splice(769, 963 - 769 + 1);
  fs.writeFileSync(file, linesArray.join(lineEnding), 'utf8');
  console.log('SUCCESS: Successfully cleaned up duplicate block!');
} else {
  console.log('ERROR: Line contents did not match expected values. Aborting.');
}
