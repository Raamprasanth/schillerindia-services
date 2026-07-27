const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

// Update getPerformanceReviewData
code = code.replace(
  `return await getAllEmployeesPerformanceData({ monthInfo });`,
  `return await getAllEmployeesPerformanceData({ monthInfo, selectedDivision });`
);

// Update getAllEmployeesPerformanceData signature
code = code.replace(
  `async function getAllEmployeesPerformanceData({ monthInfo }) {`,
  `async function getAllEmployeesPerformanceData({ monthInfo, selectedDivision }) {`
);

// Update user query
const userQueryRegex = /let employees = await User\.find\(\{\s*isActive: \{ \$ne: false \},\s*role: \{ \$in: \['employee', 'service_coordinator'\] \}\s*\}\)\.select\('_id name email employeeId'\)\.lean\(\);/;

const userQueryReplacement = `
    let filter = { 
      isActive: { $ne: false }, 
      role: { $in: ['employee', 'service_coordinator'] } 
    };
    if (selectedDivision) {
      filter.$or = [
        { division: selectedDivision },
        { divisions: selectedDivision },
        { division: new RegExp(selectedDivision, 'i') },
        { divisions: new RegExp(selectedDivision, 'i') }
      ];
    }
    let employees = await User.find(filter).select('_id name email employeeId division divisions').lean();
`;

code = code.replace(userQueryRegex, userQueryReplacement);

// Update employee query
const empQueryRegex = /const legacyEmployees = await Employee\.find\(\{ isActive: \{ \$ne: false \} \}\)\.select\('_id name email employeeId'\)\.lean\(\);/;
const empQueryReplacement = `
    let legacyFilter = { isActive: { $ne: false } };
    if (selectedDivision) {
      legacyFilter.$or = [
        { division: selectedDivision },
        { divisions: selectedDivision },
        { division: new RegExp(selectedDivision, 'i') },
        { divisions: new RegExp(selectedDivision, 'i') }
      ];
    }
    const legacyEmployees = await Employee.find(legacyFilter).select('_id name email employeeId division divisions').lean();
`;

code = code.replace(empQueryRegex, empQueryReplacement);

fs.writeFileSync(file, code);
console.log('Backend patched for division filter');
