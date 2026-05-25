const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'frontend', 'public');
let failed = false;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.html') ? [full] : [];
  });
}

for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  let index = 0;
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    index += 1;
    const code = match[1];
    if (!code.trim()) continue;
    try {
      new vm.Script(code, { filename: `${path.relative(process.cwd(), file)}:script${index}` });
    } catch (error) {
      failed = true;
      console.error(`${path.relative(process.cwd(), file)} script ${index}: ${error.message}`);
    }
  }
}

if (failed) process.exit(1);
console.log('HTML inline scripts parse successfully.');
