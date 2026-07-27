const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

const htmlRegex = /let remark = 'Needs Improvement';\s*if \(rate >= 90\) remark = 'Excellent';\s*else if \(rate >= 75\) remark = 'Good';\s*else if \(rate >= 60\) remark = 'Average';/g;
const newHtmlRemark = `let remark = 'Very Poor';
    if (rate >= 91) remark = 'Outstanding';
    else if (rate >= 81) remark = 'Excellent';
    else if (rate >= 61) remark = 'Very Good';
    else if (rate >= 41) remark = 'Satisfactory';
    else if (rate >= 21) remark = 'Needs Improvement';`;
html = html.replace(htmlRegex, newHtmlRemark);

const pdfRegex = /const remark = rate >= 90 \? 'Excellent' : rate >= 75 \? 'Good' : rate >= 60 \? 'Average' : 'Needs Improvement';/g;
const newPdfRemark = `let remark = 'Very Poor';
      if (rate >= 91) remark = 'Outstanding';
      else if (rate >= 81) remark = 'Excellent';
      else if (rate >= 61) remark = 'Very Good';
      else if (rate >= 41) remark = 'Satisfactory';
      else if (rate >= 21) remark = 'Needs Improvement';`;
html = html.replace(pdfRegex, newPdfRemark);

// Also need to add SC Remarks to `exportPDF` logic.
// In exportPDF, we can grab `perf-comment` or a specific ID.
// Wait, for exportPDF('div') and exportPDF('emp'), the textareas we added in the previous steps were... wait, we only added it to generatePremiumPDF!
// The user says "the sc incharge remarks is not shown in any of the analysis"
// This means they probably didn't see the textarea in the UI for the Division / Product team reports?
// Actually I added it for Product Team, Individual, Commercial, Repair in `patch_pdf_ui.js` by matching the string literal template.
// Let's also add it to `generatePerfAnalysisHtml` right below the table.

const generateRegex = /<div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">/g;
const generateReplacement = `<div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="\${scopeType}-sc-remarks" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>
        <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">`;
html = html.replace(generateRegex, generateReplacement);

// And we need to pass this textarea value to `drawPerfPdfPage` in `exportPDF`
const exportPDFRegex = /const entityLabel = isDiv \? divisionLabel : employeeLabel;\n\s*drawPerfPdfPage\(doc, data, monthLabel, scopeLabel, entityLabel\);/g;
const exportPDFReplacement = `const entityLabel = isDiv ? divisionLabel : employeeLabel;
    const scRemarksText = document.getElementById(isDiv ? 'division-sc-remarks' : 'employee-sc-remarks')?.value || '';
    drawPerfPdfPage(doc, data, monthLabel, scopeLabel, entityLabel, scRemarksText);`;
html = html.replace(exportPDFRegex, exportPDFReplacement);

// Finally, inside `drawPerfPdfPage`, add the text at the bottom.
const drawPdfRegex = /doc\.save\(\`Performance_Analysis_\$\{isDiv \? divisionLabel : employeeLabel\}_\$\{month\}\.pdf\`\);/g;
// Wait, `doc.save` is in `exportPDF`, not `drawPerfPdfPage`.
// We need to change `drawPerfPdfPage` signature and body.
const drawPdfSig = /function drawPerfPdfPage\(doc, data, monthLabel, scopeLabel, entityLabel\) \{/g;
const drawPdfSigNew = `function drawPerfPdfPage(doc, data, monthLabel, scopeLabel, entityLabel, scRemarks = '') {`;
html = html.replace(drawPdfSig, drawPdfSigNew);

const drawPdfEnd = /doc\.text\(remark\.toUpperCase\(\), 140, boxY \+ 16, \{ align: "center" \}\);\n\s*\}\n\s*\}/g;
const drawPdfEndNew = `doc.text(remark.toUpperCase(), 140, boxY + 16, { align: "center" });
      
      if (scRemarks && scRemarks.trim() !== '') {
        let remarksY = boxY + 30;
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, remarksY, 269, 20, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("SC Incharge Remarks:", 18, remarksY + 7);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        
        const splitText = doc.splitTextToSize(scRemarks, 260);
        doc.text(splitText, 18, remarksY + 14);
      }
    }
  }`;
html = html.replace(drawPdfEnd, drawPdfEndNew);

fs.writeFileSync(file, html);
console.log('Fixed remarks logic and PDF export');
