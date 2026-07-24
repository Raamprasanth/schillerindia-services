const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Remove pending FRN con row for ALL division report tables
// We replace the hideFrnCon declaration inside generatePerfAnalysisHtml
html = html.replace(
  /const hideFrnCon = (?:scopeType === 'division'|isDiv) && \/\^\(monitors\?\|ventilators\?\)\$\/i\.test\(divisionLabel\.trim\(\)\);/g,
  "const hideFrnCon = scopeType === 'division';"
);

// 2. Hide bottom table/boxes for monitors con / vent con on PDF export
html = html.replace(
  /const secondPageHtml = lowerSection \? lowerSection\.outerHTML : '';/g,
  "const hideBottom = isDiv && /monitors|ventilators/i.test(divisionLabel);\n      const secondPageHtml = (lowerSection && !hideBottom) ? lowerSection.outerHTML : '';"
);

fs.writeFileSync(file, html);
console.log('Update applied successfully.');
