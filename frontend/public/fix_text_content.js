const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const p = path.join(dir, file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    const orig = content;

    const lines = content.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      // Find lines that have textContent assignment and HTML entities
      if (lines[i].includes('textContent') && lines[i].includes('&#') && (lines[i].includes('=') || lines[i].includes('?'))) {
        lines[i] = lines[i].replace(/\.textContent\s*([=])/g, '.innerHTML $1');
        changed = true;
      }
    }
    
    if (changed) {
      fs.writeFileSync(p, lines.join('\n'), 'utf8');
      console.log('Fixed textContent rendering in', file);
    }
  }
}
