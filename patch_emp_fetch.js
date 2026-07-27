const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const target = `  const employees = await Employee.find({ isActive: { $ne: false } }).select('_id name email employeeId').lean();`;
const replacement = `
  let employees = await User.find({ 
    isActive: { $ne: false }, 
    role: { $in: ['employee', 'service_coordinator'] } 
  }).select('_id name email employeeId').lean();
  
  const legacyEmployees = await Employee.find({ isActive: { $ne: false } }).select('_id name email employeeId').lean();
  const seenNames = new Set(employees.map(e => e.name.toLowerCase()));
  for (const le of legacyEmployees) {
    if (!seenNames.has(le.name.toLowerCase())) {
      employees.push(le);
      seenNames.add(le.name.toLowerCase());
    }
  }
`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Employees query patched successfully.');
} else {
  console.log('Target not found in code');
}
