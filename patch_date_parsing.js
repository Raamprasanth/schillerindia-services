const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend', 'services', 'performanceReviewService.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Enhance parseAnyDate
const parseAnyDateOld = `  const dmy = text.match(/^(\\d{2})-(\\d{2})-(\\d{4})$/);
  if (dmy) {
    const date = new Date(\`\${dmy[3]}-\${dmy[2]}-\${dmy[1]}T00:00:00\`);
    if (!Number.isNaN(date.getTime())) return date;
  }`;

const parseAnyDateNew = `  const dmy = text.match(/^(\\d{2})[-/\\.](\\d{2})[-/\\.](\\d{4})$/);
  if (dmy) {
    const date = new Date(\`\${dmy[3]}-\${dmy[2]}-\${dmy[1]}T00:00:00\`);
    if (!Number.isNaN(date.getTime())) return date;
  }`;

if (content.includes(parseAnyDateOld)) {
  content = content.replace(parseAnyDateOld, parseAnyDateNew);
} else {
  console.log('Warning: Could not patch parseAnyDate');
}

// 2. Remove parseDateString and use parseAnyDate for getDiff
const parseDateStringStart = `    const parseDateString = (d) => {`;
const getDiffStart = `    const getDiff = (d1, d2) => {`;

const startIdx = content.indexOf(parseDateStringStart);
const endIdx = content.indexOf(getDiffStart);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + content.slice(endIdx);
  
  const getDiffOld = `    const getDiff = (d1, d2) => {
      const date1 = parseDateString(d1);
      const date2 = parseDateString(d2);`;
      
  const getDiffNew = `    const getDiff = (d1, d2) => {
      const date1 = parseAnyDate(d1);
      const date2 = parseAnyDate(d2);`;
      
  if (content.includes(getDiffOld)) {
    content = content.replace(getDiffOld, getDiffNew);
  } else {
    console.log('Warning: Could not patch getDiff contents.');
  }
} else {
  console.log('Warning: Could not remove parseDateString');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched date parsing.');
