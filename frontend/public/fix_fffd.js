const fs = require('fs');
const path = require('path');

const files = ['fns.html', 'fs.html', 'fbir.html', 'fcbir.html', 'fqc-dashboard.html'];

for (const file of files) {
  const p = path.join(__dirname, file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');

    // Replace the replacement character U+FFFD with a hyphen
    content = content.replace(/\uFFFD/g, '-');

    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed U+FFFD in', file);
  }
}
