const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// Fix 1: Add fallback reports Buy Back
const fallbackRegex = /const fallbackReports = \[\n([\s\S]*?\{ type: 'PIRequest', label: 'PI Request', schedule: '5th' \})\n\s*\];/g;
const fallbackReplacement = `const fallbackReports = [
$1
        ];
        if (monthStr.endsWith('-04') || monthStr.endsWith('-08') || monthStr.endsWith('-12')) {
          fallbackReports.push({ type: 'BuyBack', label: 'Buy Back', schedule: '15th' });
        }`;
html = html.replace(fallbackRegex, fallbackReplacement);

// Fix 2: Add SC Remarks to Individual Analysis UI
const indAllPdfBtnRegex = /<button class="btn btn-green" onclick="exportIndividualAllPDF\(\)"><i class="fas fa-file-pdf" style="margin-right:6px;"><\/i> Export PDF<\/button>/g;
const indAllPdfBtnReplacement = `<button class="btn btn-green" onclick="exportIndividualAllPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
        </div>
        <div style="margin:top:0;padding:15px 24px 0 24px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-indall" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>`;
html = html.replace(indAllPdfBtnRegex, indAllPdfBtnReplacement);

// Fix 3: Add SC Remarks to exportIndividualAllPDF
const exportIndAllRegex = /async function exportIndividualAllPDF\(\) \{\n\s*const el = document\.getElementById\('indall-pdf-content'\);\n\s*if \(!el\) return;\n\s*const month = document\.getElementById\('perf-indall-month'\)\.value \|\| 'Report';\n\s*await generatePremiumPDF\(el\.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', 'All Employees', month, 'Individual_Performance'\);\n\s*\}/g;
const exportIndAllReplacement = `async function exportIndividualAllPDF() {
    const el = document.getElementById('indall-pdf-content');
    if (!el) return;
    const month = document.getElementById('perf-indall-month').value || 'Report';
    const scRemarks = document.getElementById('sc-remarks-indall')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', 'All Employees', month, 'Individual_Performance', scRemarks);
  }`;
html = html.replace(exportIndAllRegex, exportIndAllReplacement);

fs.writeFileSync(file, html);
console.log('Fixed fallbackReports and added SC Remarks to Individual Analysis');
