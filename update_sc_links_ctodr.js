const fs = require('fs');
const files = [
  'Sc-dashboard.html',
  'sccr.html',
  'scprfob.html',
  'sc-completed-frn.html',
  'scrap-list.html'
];
const ctodrLink = '<a class="nav-item" href="ctodr.html"><span class="ico">&#128274;</span> Closed TO/DR</a>';

for (const file of files) {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');
  if (content.includes('ctodr.html')) {
    console.log(file + ' already updated');
    continue;
  }
  
  content = content.replace(
    /(<a class="nav-item" href="todr.html"><span class="ico">&#128196;<\/span> TO\/DR<\/a>)/,
    '$1\n    ' + ctodrLink
  );
  
  fs.writeFileSync('frontend/public/' + file, content, 'utf8');
  console.log('Updated ' + file);
}
