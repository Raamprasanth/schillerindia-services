const fs = require('fs');
const path = require('path');
const dir = 'frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let count = 0;
files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  // Look for the block containing todr, dr, ctodr, cdr
  const regex = /(<a class="nav-item[^"]*" href="todr\.html">.*?<\/a>)\s*(<a class="nav-item[^"]*" href="dr\.html">.*?<\/a>)\s*(<a class="nav-item[^"]*" href="ctodr\.html">.*?<\/a>)\s*(<a class="nav-item[^"]*" href="cdr\.html">.*?<\/a>)/;
  if (regex.test(content)) {
    content = content.replace(regex, '$1\n    $3\n    $2\n    $4');
    fs.writeFileSync(p, content, 'utf8');
    count++;
  }
});
console.log('Fixed ' + count + ' files.');
