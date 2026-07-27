const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// Repair Team PDF UI
const repHtmlRegex = /<div id="repairteam-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">`;/g;
const repHtmlReplacement = `<div id="repairteam-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">\`;\n    const scRemarksBlock = \`<div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-repairteam" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>\`;`;
if(html.match(repHtmlRegex)) {
    html = html.replace(repHtmlRegex, repHtmlReplacement);
}

const repEndHtmlRegex = /res\.innerHTML = reportHtml \+ '<\/div>';/g;
// Wait, for repair team it might use res.innerHTML = reportHtml + '</div>'; let's replace all of them just to be safe if they haven't been replaced.
// But commercial already got replaced.
const repEndHtmlReplacement2 = `res.innerHTML = reportHtml + '</div>' + (typeof scRemarksBlock !== 'undefined' ? scRemarksBlock : '');`;
html = html.replace(/res\.innerHTML = reportHtml \+ '<\/div>';/g, repEndHtmlReplacement2);

const exportRepRegex = /await generatePremiumPDF\(el\.innerHTML, 'REPAIR TEAM PERFORMANCE REPORT', divisionLabel, month, 'RepairTeam_Performance'\);/;
const exportRepReplacement = `const scRemarks = document.getElementById('sc-remarks-repairteam')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'REPAIR TEAM PERFORMANCE REPORT', '', month, 'RepairTeam_Performance', scRemarks);`;
html = html.replace(exportRepRegex, exportRepReplacement);

fs.writeFileSync(file, html);
console.log('Repair team PDF UI patched');
