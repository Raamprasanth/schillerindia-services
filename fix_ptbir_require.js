const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const ptcbirRequire = /const PtClosedBir = require\('\.\.\/models\/PtClosedBir'\);/g;
if (!code.includes("require('../models/PtBir')")) {
  code = code.replace(ptcbirRequire, `const PtBir = require('../models/PtBir');\n    const PtClosedBir = require('../models/PtClosedBir');`);
  fs.writeFileSync(file, code);
  console.log('Added PtBir require');
} else {
  console.log('PtBir already required');
}
