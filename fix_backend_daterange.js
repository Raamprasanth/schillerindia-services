const fs = require('fs');
const path = require('path');
const FILE_PATH = 'backend/services/performanceReviewService.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// We need to add matchDateRange parsing
const target = 'const matchRange = str.match(/^(\\d{4})-(\\d{2}):(\\d{4})-(\\d{2})$/);';
const replacement = target + '\n  const matchDateRange = str.match(/^(\\d{4})-(\\d{2})-(\\d{2}):(\\d{4})-(\\d{2})-(\\d{2})$/);';

if (content.includes(target) && !content.includes('matchDateRange = str.match')) {
  content = content.replace(target, replacement);
  console.log('Added matchDateRange to regex variables.');
}

const target2 = '} else if (matchRange) {';
const replacement2 = `} else if (matchDateRange) {
    year = Number(matchDateRange[1]);
    const startYear = Number(matchDateRange[1]);
    const startMonth = Number(matchDateRange[2]);
    const startDay = Number(matchDateRange[3]);
    const endYear = Number(matchDateRange[4]);
    const endMonth = Number(matchDateRange[5]);
    const endDay = Number(matchDateRange[6]);
    
    start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    // The end date should be inclusive, so we add 1 day to the bound
    end = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1, 0, 0, 0, 0));
    
    const startLabel = start.toLocaleDateString('en-IN', { timeZone: 'UTC' });
    const displayEnd = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));
    const endLabel = displayEnd.toLocaleDateString('en-IN', { timeZone: 'UTC' });
    
    label = startLabel === endLabel ? startLabel : \`\${startLabel} - \${endLabel}\`;
    periodKey = str;
    shortMonth = label;
    longMonth = label;
  } else if (matchRange) {`;

if (content.includes(target2) && !content.includes('} else if (matchDateRange) {')) {
  content = content.replace(target2, replacement2);
  console.log('Added matchDateRange parsing logic.');
}

// Update error message
content = content.replace(
  "throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, YYYY-A, or YYYY-MM:YYYY-MM format.');",
  "throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, YYYY-A, YYYY-MM:YYYY-MM, or YYYY-MM-DD:YYYY-MM-DD format.');"
);

fs.writeFileSync(FILE_PATH, content);
console.log('Done modifying performanceReviewService.js');
