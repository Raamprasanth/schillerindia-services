const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'backend', 'models');
let count = 0;

const files = fs.readdirSync(modelsDir);
for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const p = path.join(modelsDir, file);
  let content = fs.readFileSync(p, 'utf8');
  
  // Find enum array that contains 'PATIENT MONITORS'
  const regex = /\s*enum:\s*\[\s*['"]PATIENT MONITORS['"][\s\S]*?\],?/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync(p, content, 'utf8');
    console.log('Updated', file);
    count++;
  }
}

console.log('Updated ' + count + ' files.');
