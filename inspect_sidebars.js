const fs = require('fs');
const path = require('path');

const dir = 'frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const missingApa = [];
const missingAcpa = [];

for (const file of files) {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('class="sidebar"') || content.includes("<aside")) {
    if (!content.includes('apa.html')) {
      missingApa.push(file);
    }
    if (!content.includes('acpa.html')) {
      missingAcpa.push(file);
    }
  }
}

console.log('Files missing apa.html:', missingApa);
console.log('Files missing acpa.html:', missingAcpa);
