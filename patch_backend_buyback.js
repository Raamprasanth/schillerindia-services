const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const buildReportRegex = /function buildReportDefinitions\(year, month\) \{\n\s*return \[\n([\s\S]*?)\n\s*\];\n\s*\}/g;
const buildReportReplacement = `function buildReportDefinitions(year, month) {
    let defs = [
$1
    ];
    if (month === 4 || month === 8 || month === 12) {
      defs.push({ type: 'BuyBack', expectedPerEmployee: countDatesInMonth(year, month, [15]) });
    }
    return defs;
  }`;
code = code.replace(buildReportRegex, buildReportReplacement);

const actualsRegex = /const actuals = \{\n\s*CRM: 0, PendingActivity: 0, NonSaleable: 0,\n\s*SupplierWarranty: 0, CriticalPendingReport: 0, PIRequest: 0\n\s*\};/g;
const actualsReplacement = `const actuals = {
      CRM: 0, PendingActivity: 0, NonSaleable: 0,
      SupplierWarranty: 0, CriticalPendingReport: 0, PIRequest: 0, BuyBack: 0
    };`;
code = code.replace(actualsRegex, actualsReplacement);

const compRegex = /compliance\.purchaseIndent = realTrackers\.PIRequest;/g;
const compReplacement = `compliance.purchaseIndent = realTrackers.PIRequest;\n    compliance.buyBack = realTrackers.BuyBack;`;
code = code.replace(compRegex, compReplacement);

fs.writeFileSync(file, code);
console.log('Fixed backend tracker for BuyBack');
