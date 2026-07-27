const fs = require('fs');
const FILE_PATH = 'backend/services/performanceReviewService.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /const str = String\(month \|\| ''\)\.trim\(\);\s*const matchMonth = str\.match\(\/\^\(\\d\{4\}\)-\(\\d\{2\}\)\$\/\);\s*const matchQuarter = str\.match\(\/\^\(\\d\{4\}\)-Q\(\[1-4\]\)\$\/\);\s*const matchHalf = str\.match\(\/\^\(\\d\{4\}\)-H\(\[1-2\]\)\$\/\);\s*const matchAnnual = str\.match\(\/\^\(\\d\{4\}\)-A\$\/\);/;

const replacement = `const str = String(month || '').trim();
  const matchMonth = str.match(/^(\\d{4})-(\\d{2})$/);
  const matchQuarter = str.match(/^(\\d{4})-Q([1-4])$/);
  const matchHalf = str.match(/^(\\d{4})-H([1-2])$/);
  const matchAnnual = str.match(/^(\\d{4})-A$/);
  const matchRange = str.match(/^(\\d{4})-(\\d{2}):(\\d{4})-(\\d{2})$/);`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  
  // Now add the if-branch for matchRange
  const branchRegex = /\} else if \(matchAnnual\) \{[\s\S]*?\} else \{/;
  
  const branchReplacement = `} else if (matchAnnual) {
    year = Number(matchAnnual[1]);
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    label = \`Year \${year}\`;
    periodKey = \`\${year}-A\`;
    shortMonth = \`\${year}\`;
    longMonth = \`\${year}\`;
  } else if (matchRange) {
    year = Number(matchRange[1]);
    const startYear = Number(matchRange[1]);
    const startMonth = Number(matchRange[2]);
    const endYear = Number(matchRange[3]);
    const endMonth = Number(matchRange[4]);
    
    start = new Date(Date.UTC(startYear, startMonth - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(endYear, endMonth, 1, 0, 0, 0, 0));
    
    const startLabel = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) + ' ' + startYear;
    // We display end label as endMonth - 1, because the bound is the START of the NEXT month
    const displayEnd = new Date(Date.UTC(endYear, endMonth - 1, 1, 0, 0, 0, 0));
    const endLabel = displayEnd.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) + ' ' + endYear;
    
    label = startLabel === endLabel ? startLabel : \`\${startLabel} - \${endLabel}\`;
    periodKey = str;
    shortMonth = label;
    longMonth = label;
  } else {`;
  
  content = content.replace(branchRegex, branchReplacement);
  
  // Also fix the error string
  content = content.replace(`throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, or YYYY-A format.');`, `throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, YYYY-A, or YYYY-MM:YYYY-MM format.');`);
  
  fs.writeFileSync(FILE_PATH, content);
  console.log('Patched performanceReviewService.js');
} else {
  console.log('Could not find regex match in backend');
}
