const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// Patch exportPDF
const exportPdfRegex = /const entityLabel = isDiv \? divisionLabel : employeeLabel;\n\s*drawPerfPdfPage\(doc, data, monthLabel, scopeLabel, entityLabel\);/g;
const exportPdfReplacement = `const entityLabel = isDiv ? divisionLabel : employeeLabel;
  const scopeType = isDiv ? 'division' : 'employee';
  const scRemarks = document.getElementById(scopeType + '-sc-remarks')?.value || '';
  drawPerfPdfPage(doc, data, monthLabel, scopeLabel, entityLabel, scRemarks);`;
if (content.match(exportPdfRegex)) {
    content = content.replace(exportPdfRegex, exportPdfReplacement);
    console.log('Patched exportPDF');
} else {
    console.log('Failed to patch exportPDF');
}

// Patch exportPriorityDivisionPDF
const priorityRegex = /drawPerfPdfPage\(doc, payload\.data, month, 'Division', division\);/g;
const priorityReplacement = `const scRemarks = document.getElementById('division-sc-remarks')?.value || '';
      drawPerfPdfPage(doc, payload.data, month, 'Division', division, scRemarks);`;
if (content.match(priorityRegex)) {
    content = content.replace(priorityRegex, priorityReplacement);
    console.log('Patched exportPriorityDivisionPDF');
} else {
    console.log('Failed to patch exportPriorityDivisionPDF');
}

// Patch drawPerfPdfPage
const drawPdfRegex = /doc\.text\(remark\.toUpperCase\(\), 140, boxY \+ 16, \{ align: "center" \}\);\n\s*\}/g;
const drawPdfReplacement = `doc.text(remark.toUpperCase(), 140, boxY + 16, { align: "center" });
    
    if (scRemarks) {
      boxY += 28;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("SC INCHARGE REMARKS:", 14, boxY);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      const splitRemarks = doc.splitTextToSize(scRemarks, 269);
      doc.text(splitRemarks, 14, boxY + 6);
    }
  }`;
if (content.match(drawPdfRegex)) {
    content = content.replace(drawPdfRegex, drawPdfReplacement);
    console.log('Patched drawPerfPdfPage');
} else {
    console.log('Failed to patch drawPerfPdfPage');
}

fs.writeFileSync(FILE_PATH, content);
