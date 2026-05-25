const fs = require('fs');
const files = [
  'Sc-dashboard.html',
  'sccr.html',
  'scprfob.html',
  'sc-completed-frn.html',
  'scrap-list.html'
];
const link = '<a class="nav-item" href="todr.html"><span class="ico">&#128196;</span> TO/DR</a>';

for (const file of files) {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');
  if (content.includes('todr.html')) {
    console.log(file + ' already updated');
    continue;
  }
  
  content = content.replace(
    /(<div class="nav-sec">Work Orders<\/div>)/,
    '$1\n    ' + link
  );
  
  fs.writeFileSync('frontend/public/' + file, content, 'utf8');
  console.log('Updated ' + file);
}
