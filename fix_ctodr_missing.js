const fs = require('fs');
const path = require('path');
const dir = 'frontend/public';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const ctodrLink = '<a class="nav-item" href="ctodr.html"><span class="ico">&#128274;</span> Closed TO/DR</a>';

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add ctodr.html after todr.html if it's missing
  if (content.includes('todr.html') && !content.includes('ctodr.html')) {
    // We match todr.html line exactly. It could have active class or not.
    content = content.replace(/(<a class="nav-item(?: active)?" href="todr\.html">[\s\S]*?<\/a>)/, '$1\n      ' + ctodrLink);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed ' + file);
  }
}
