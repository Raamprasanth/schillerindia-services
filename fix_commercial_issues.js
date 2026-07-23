const fs = require('fs');

// --- 1. Fix backend/services/performanceReviewService.js ---
let backendFile = 'backend/services/performanceReviewService.js';
let backendContent = fs.readFileSync(backendFile, 'utf8');

const metricMap = [
  { old: 'FRN ( inward - svc)', new: 'FRN ( Inward - Svc )' },
  { old: 'TO ( raised - received)', new: 'TO ( Raised - Received )' },
  { old: 'TO/SO (entry - received)', new: 'Field TO/SO ( Entry - Received )' },
  { old: 'SR ( raised - received )', new: 'SR ( Raised - Received )' },
  { old: 'DR ( requested - received )', new: 'DR ( Requested - Received )' },
  { old: 'TO/SO ( raised - entry)', new: 'Field TO/SO ( Raised - Entry )' }
];

for (const m of metricMap) {
  backendContent = backendContent.split(m.old).join(m.new);
}

// Ignore 'Unknown' divisions
backendContent = backendContent.replace(
  /const divName = (.*?);\s*const divData = ensureDivision\(divName\);/g,
  (match, divNameExpr) => {
    return `const divName = ${divNameExpr};\n    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') return;\n    const divData = ensureDivision(divName);`;
  }
);
// Also in other loops:
// For todrs
backendContent = backendContent.replace(
  /const divName = t\.division\?\.name \|\| t\.divisionName \|\| t\.division \|\| 'Unknown';\s*const divData = ensureDivision\(divName\);/g,
  `const divName = t.division?.name || t.divisionName || t.division || 'Unknown';\n    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') continue;\n    const divData = ensureDivision(divName);`
);
// For trrs
backendContent = backendContent.replace(
  /const divName = sr\.division\?\.name \|\| sr\.divisionName \|\| sr\.division \|\| 'Unknown';\s*const divData = ensureDivision\(divName\);/g,
  `const divName = sr.division?.name || sr.divisionName || sr.division || 'Unknown';\n    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') continue;\n    const divData = ensureDivision(divName);`
);
// For drs
backendContent = backendContent.replace(
  /const divName = d\.division\?\.name \|\| d\.divisionName \|\| d\.division \|\| 'Unknown';\s*const divData = ensureDivision\(divName\);/g,
  `const divName = d.division?.name || d.divisionName || d.division || 'Unknown';\n    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') continue;\n    const divData = ensureDivision(divName);`
);
// For srs loop 1
backendContent = backendContent.replace(
  /const divName = s\.division\?\.name \|\| s\.divisionName \|\| s\.division \|\| 'Unknown';\s*const divData = ensureDivision\(divName\);/g,
  `const divName = s.division?.name || s.divisionName || s.division || 'Unknown';\n    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') continue;\n    const divData = ensureDivision(divName);`
);

fs.writeFileSync(backendFile, backendContent);

// --- 2. Fix frontend/public/Reports.html ---
let frontendFile = 'frontend/public/Reports.html';
let frontendContent = fs.readFileSync(frontendFile, 'utf8');

for (const m of metricMap) {
  frontendContent = frontendContent.split(m.old).join(m.new);
}

// Fix the PDF Export function references
// The commercial tab uses `perf-com-month` and `perf-com-division`
// but the export function uses `perf-commercial-month` and `perf-commercial-division`
frontendContent = frontendContent.replace(/document\.getElementById\('perf-commercial-month'\)/g, "document.getElementById('perf-com-month')");
frontendContent = frontendContent.replace(/document\.getElementById\('perf-commercial-division'\)/g, "document.getElementById('perf-com-division')");

// Also check repair team export function just in case
// repair team uses `perf-repairteam-month` and `perf-repairteam-division`
// The export function uses `perf-repairteam-month`. No division dropdown exists for repair team tab? Let me check.
// Wait, the repair team tab does NOT have a division dropdown in Reports.html. That's fine.

fs.writeFileSync(frontendFile, frontendContent);
console.log('Fixes applied successfully!');
