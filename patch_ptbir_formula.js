const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const regex = /const diff = getDiff\(fbir\.createdAt, ptcbir\.createdAt\);\s*if \(diff !== null && diff <= 7\) \{/g;
const replacement = `const diff = ptcbir.unitInwardDate ? getDiff(ptcbir.unitInwardDate, ptcbir.createdAt) : getDiff(fbir.createdAt, ptcbir.createdAt);
        if (diff !== null && diff <= 7) {`;

code = code.replace(regex, replacement);

fs.writeFileSync(file, code);
console.log('Patched formula for Product Team BIR tracking');
