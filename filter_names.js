const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const regex = /for\s*\(\s*const\s*le\s*of\s*legacyEmployees\s*\)\s*\{\s*if\s*\(!seenNames\.has\(le\.name\.toLowerCase\(\)\)\)\s*\{\s*employees\.push\(le\);\s*seenNames\.add\(le\.name\.toLowerCase\(\)\);\s*\}\s*\}/;

const replacement = `for (const le of legacyEmployees) {
      if (!seenNames.has(le.name.toLowerCase())) {
        employees.push(le);
        seenNames.add(le.name.toLowerCase());
      }
    }

    const excludedNames = ['raam', 'vassougui v', 'siva hari thilipan', 'gajenthiran k', 'pradap k', 'service coordinator'];
    employees = employees.filter(e => e && e.name && !excludedNames.includes(e.name.trim().toLowerCase()));`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log('Added excluded names filter successfully.');
} else {
  console.log('Target block not found via regex.');
}
