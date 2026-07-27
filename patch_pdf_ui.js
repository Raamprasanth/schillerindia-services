const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Division PDF UI
const divHtmlRegex = /<div id="div-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">[\s\S]*?<\/div>\s*<\/div>\s*`;/g;
let match = html.match(divHtmlRegex);
if(match) {
    html = html.replace(divHtmlRegex, match[0].replace('</div>\n    `;', '</div>\n      <div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-division" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>\n    `;'));
}

const exportDivRegex = /await generatePremiumPDF\(el\.innerHTML, 'DIVISION WISE PERFORMANCE REPORT', params\.division, params\.month, 'Division_Performance'\);/;
const exportDivReplacement = `const scRemarks = document.getElementById('sc-remarks-division')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'DIVISION WISE PERFORMANCE REPORT', params.division, params.month, 'Division_Performance', scRemarks);`;
html = html.replace(exportDivRegex, exportDivReplacement);

// 2. Product Team PDF UI
const ptHtmlRegex = /<h3 style="text-align:center; font-family:'Syne',sans-serif; margin-bottom:20px;">Product Team Performance Analysis - \$\{d\.data\.month\}<\/h3>[\s\S]*?<\/div>\s*`;/g;
match = html.match(ptHtmlRegex);
if (match) {
    let replaced = match[0].replace('</div>\n    `;', '</div>\n      <div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-productteam" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>\n    `;');
    html = html.replace(ptHtmlRegex, replaced);
}

const exportPtRegex = /await generatePremiumPDF\(el\.innerHTML, 'PRODUCT TEAM PERFORMANCE REPORT', 'All Divisions', month, 'ProductTeam_Performance'\);/;
const exportPtReplacement = `const scRemarks = document.getElementById('sc-remarks-productteam')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'PRODUCT TEAM PERFORMANCE REPORT', '', month, 'ProductTeam_Performance', scRemarks);`;
html = html.replace(exportPtRegex, exportPtReplacement);

// 3. Individual PDF UI
const indHtmlRegex = /<h3 style="text-align:center; font-family:'Syne',sans-serif; margin-bottom:20px;">Individual Performance Analysis - \$\{d\.data\.month\}<\/h3>[\s\S]*?<\/div>\s*`;/g;
match = html.match(indHtmlRegex);
if(match) {
    let replaced = match[0].replace('</div>\n    `;', '</div>\n      <div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-individual" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>\n    `;');
    html = html.replace(indHtmlRegex, replaced);
}

const exportIndRegex = /await generatePremiumPDF\(el\.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', divisionLabel, month, 'Individual_Performance'\);/;
const exportIndReplacement = `const scRemarks = document.getElementById('sc-remarks-individual')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', divisionLabel, month, 'Individual_Performance', scRemarks);`;
html = html.replace(exportIndRegex, exportIndReplacement);

// 4. Commercial PDF UI
const comHtmlRegex = /<div id="commercial-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">`;/g;
const comHtmlReplacement = `<div id="commercial-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">\`;\n    const scRemarksBlock = \`<div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-commercial" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>\`;`;
html = html.replace(comHtmlRegex, comHtmlReplacement);

const comEndHtmlRegex = /res\.innerHTML = reportHtml \+ '<\/div>';/g;
const comEndHtmlReplacement = `res.innerHTML = reportHtml + '</div>' + scRemarksBlock;`;
html = html.replace(comEndHtmlRegex, comEndHtmlReplacement);

const exportComRegex = /await generatePremiumPDF\(el\.innerHTML, 'COMMERCIAL PERFORMANCE REPORT', divisionLabel, month, 'Commercial_Performance'\);/;
const exportComReplacement = `const scRemarks = document.getElementById('sc-remarks-commercial')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'COMMERCIAL PERFORMANCE REPORT', divisionLabel, month, 'Commercial_Performance', scRemarks);`;
html = html.replace(exportComRegex, exportComReplacement);


fs.writeFileSync(file, html);
console.log('PDF UI patched successfully');
