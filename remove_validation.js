const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

// The block to remove:
// if (scope === 'employee' && !normalizeText(employee)) {
//   throw new Error('Employee is required for individual review.');
// }

const blockRegex = /if\s*\(scope\s*===\s*'employee'\s*&&\s*!normalizeText\(employee\)\)\s*\{\s*throw\s*new\s*Error\('Employee is required for individual review\.'\);\s*\}/;

if (blockRegex.test(code)) {
  code = code.replace(blockRegex, '// Employee validation removed');
  fs.writeFileSync(file, code);
  console.log('Validation removed safely');
} else {
  console.log('Block not found');
}
