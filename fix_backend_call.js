const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const regex = /if\s*\(\s*scope\s*===\s*'employee'\s*\)\s*\{\s*return\s*getSimpleEmployeePerformanceData\(\{\s*monthInfo,\s*employee:\s*selectedEmployee\?\.name\s*\|\|\s*employee,\s*selectedDivision,\s*\}\);\s*\}/;

if (regex.test(code)) {
  code = code.replace(regex, `if (scope === 'employee') {\n    return await getAllEmployeesPerformanceData({ monthInfo });\n  }`);
  fs.writeFileSync(file, code);
  console.log('Replaced correctly via regex');
} else {
  console.log('Target not found via regex');
}
