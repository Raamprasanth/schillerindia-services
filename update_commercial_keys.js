const fs = require('fs');

function replaceAll(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split('FRN ( Inward - Svc )').join('FRN ( Inward - SVC )');
  c = c.split('Field TO/SO ( Entry - Received )').join('TO/SO ( Entry - Received )');
  c = c.split('Field TO/SO ( Raised - Entry )').join('Field TO/SO ( ER Raised - Entry )');
  fs.writeFileSync(file, c);
}

replaceAll('backend/services/performanceReviewService.js');
replaceAll('frontend/public/Reports.html');

// Also filter out 'UNKNOWN' in Reports.html commercial loop
let html = fs.readFileSync('frontend/public/Reports.html', 'utf8');
html = html.replace(
  `    for (const div of divisions) {
      if (selectedDiv === 'consolidated' && div !== 'ALL DIVISIONS') continue;`,
  `    for (const div of divisions) {
      if (div.toUpperCase() === 'UNKNOWN') continue;
      if (selectedDiv === 'consolidated' && div !== 'ALL DIVISIONS') continue;`
);

fs.writeFileSync('frontend/public/Reports.html', html);
console.log('Update successful.');
