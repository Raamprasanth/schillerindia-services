const fs = require('fs');
const path = require('path');

const dirs = [
  'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public',
];

const regexps = [
  { from: /localStorage\.getItem\(['"]schiller_token['"]\)/g, to: 'sessionStorage.getItem(\'schiller_token\')' },
  { from: /localStorage\.setItem\(['"]schiller_token['"]/g, to: 'sessionStorage.setItem(\'schiller_token\'' },
  { from: /localStorage\.removeItem\(['"]schiller_token['"]\)/g, to: 'sessionStorage.removeItem(\'schiller_token\')' },
  { from: /localStorage\.getItem\(['"]schiller_user['"]\)/g, to: 'sessionStorage.getItem(\'schiller_user\')' },
  { from: /localStorage\.setItem\(['"]schiller_user['"]/g, to: 'sessionStorage.setItem(\'schiller_user\'' },
  { from: /localStorage\.removeItem\(['"]schiller_user['"]\)/g, to: 'sessionStorage.removeItem(\'schiller_user\')' },
  { from: /localStorage\.getItem\(['"]schiller_role['"]\)/g, to: 'sessionStorage.getItem(\'schiller_role\')' },
  { from: /localStorage\.setItem\(['"]schiller_role['"]/g, to: 'sessionStorage.setItem(\'schiller_role\'' },
  { from: /localStorage\.removeItem\(['"]schiller_role['"]\)/g, to: 'sessionStorage.removeItem(\'schiller_role\')' },
  { from: /localStorage\.clear\(\)/g, to: 'sessionStorage.clear(); localStorage.clear()' },
  { from: /sessionStorage\.clear\(\); sessionStorage\.clear\(\); localStorage\.clear\(\)/g, to: 'sessionStorage.clear(); localStorage.clear()' },
];

let changedFiles = 0;

function processDir(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      let content = original;
      for (const rule of regexps) {
        content = content.replace(rule.from, rule.to);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        changedFiles++;
        console.log('Updated:', file);
      }
    }
  }
}

for (const dir of dirs) {
  processDir(dir);
}
console.log('Total files updated:', changedFiles);
