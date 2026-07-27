const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const regex = /const Bir = require\('\.\.\/models\/Bir'\);\n\s*const PtClosedBir = require\('\.\.\/models\/PtClosedBir'\);/g;
const replacement = `const PtBir = require('../models/PtBir');
    const PtClosedBir = require('../models/PtClosedBir');`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
}

const trackerRegex = /const fbirs = await Bir\.find\(\{ createdAt: \{ \$gte: start, \$lt: end \} \}\)\.lean\(\);\s*const ptcbirs = await PtClosedBir\.find\(\{[\s\S]*?\}\)\.lean\(\);\s*let withinTargetCount = 0;\s*for \(const fbir of fbirs\) \{[\s\S]*?\}\s*const total = fbirs\.length;/g;

const trackerReplacement = `
    const monthStartKey = monthInfo.monthKey + '-01';
    const monthEndDate = new Date(monthInfo.year, monthInfo.month, 0);
    const monthEndKey = \`\${monthInfo.year}-\${String(monthInfo.month).padStart(2, '0')}-\${String(monthEndDate.getDate()).padStart(2, '0')}\`;

    const ptbirs = await PtBir.find({
      $or: [
        { unitInwardDate: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: start, $lt: end } }
      ]
    }).lean();

    const ptcbirs = await PtClosedBir.find({
      $or: [
        { unitInwardDate: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: start, $lt: end } },
        { approvedDate: { $gte: monthStartKey, $lte: monthEndKey } }
      ]
    }).lean();
    
    let withinTargetCount = 0;
    
    for (const ptcbir of ptcbirs) {
      const diff = ptcbir.unitInwardDate ? getDiff(ptcbir.unitInwardDate, ptcbir.createdAt) : getDiff(ptcbir.createdAt, ptcbir.createdAt);
      if (diff !== null && diff <= 7) {
        withinTargetCount++;
      }
    }
    
    const total = ptbirs.length + ptcbirs.length;`;

if (code.match(trackerRegex)) {
  code = code.replace(trackerRegex, trackerReplacement);
  fs.writeFileSync(file, code);
  console.log('PtBir tracker formula patched successfully');
} else {
  console.log('PtBir tracker formula regex not found');
}
