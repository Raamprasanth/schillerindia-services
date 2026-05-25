const fs = require('fs');
const path = require('path');
const dir = 'frontend/public';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const links = '<a class="nav-item" href="todr.html"><span class="ico">&#128196;</span> TO/DR</a>\n      <a class="nav-item" href="ctodr.html"><span class="ico">&#128274;</span> Closed TO/DR</a>';

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix sc-dashboard.html casing
  if (content.includes('"sc-dashboard.html"')) {
    content = content.replace(/"sc-dashboard\.html"/g, '"Sc-dashboard.html"');
    changed = true;
  }

  // Inject links in lt.html and cli.html
  if (['lt.html', 'cli.html'].includes(file)) {
    if (!content.includes('todr.html')) {
      content = content.replace(/(<div class="nav-sec">Work Orders<\/div>)/, '$1\n      ' + links);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed ' + file);
  }
}
