const fs = require('fs');
const files = ['sc-completed-frn.html', 'scrap-list.html'];
const links = '<a class="nav-item" href="todr.html"><span class="ico">&#128196;</span> TO/DR</a>\n      <a class="nav-item" href="ctodr.html"><span class="ico">&#128274;</span> Closed TO/DR</a>';

for (const f of files) {
  let content = fs.readFileSync('frontend/public/' + f, 'utf8');
  if (content.includes('todr.html')) continue;
  content = content.replace(/(<div class="nav-sec">Operations<\/div>)/, '$1\n      ' + links);
  fs.writeFileSync('frontend/public/' + f, content, 'utf8');
  console.log('Updated ' + f);
}
