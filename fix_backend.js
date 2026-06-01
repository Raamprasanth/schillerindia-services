const fs = require('fs');
const path = require('path');
const p = path.join('backend', 'routes', 'closedLoanRoutes.js');
let content = fs.readFileSync(p, 'utf8');

// Update POST extraction
content = content.replace(
  /const { date, division, partNo, description, girNo } = req.body \|\| {};/g,
  "const { date, division, partNo, description, girNo, revalue, opt, remarks, toRaisedDate } = req.body || {};"
);

// Update POST create object
const createRegex = /const doc = await ClosedLoan\.create\({\s*date,\s*division,\s*partNo,\s*description,\s*girNo,\s*createdBy: req\.user\?\.name \|\| req\.user\?\.email \|\| '',\s*}\);/;
const createReplacement = `const doc = await ClosedLoan.create({
      date,
      division,
      partNo,
      description,
      girNo,
      revalue,
      opt,
      remarks,
      toRaisedDate,
      createdBy: req.user?.name || req.user?.email || '',
    });`;
content = content.replace(createRegex, createReplacement);

// Update PUT iteration array
content = content.replace(
  /\['date', 'division', 'partNo', 'description', 'girNo'\]/g,
  "['date', 'division', 'partNo', 'description', 'girNo', 'revalue', 'opt', 'remarks', 'toRaisedDate']"
);

fs.writeFileSync(p, content, 'utf8');
console.log('Backend routes updated!');
