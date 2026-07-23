const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend', 'services', 'performanceReviewService.js');
let content = fs.readFileSync(file, 'utf8');

const targetStr = "const d = (div || 'Unknown').trim();";
const replacementStr = "const d = String(div || 'Unknown').trim();";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully fixed .trim() error.');
} else {
  // Try regex in case of slight variation
  const regex = /const d = \(div \|\| 'Unknown'\)\.trim\(\);/;
  if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully fixed .trim() error via regex.');
  } else {
    console.log('Error: Could not find target string to patch.');
  }
}
