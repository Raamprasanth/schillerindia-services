const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Add SC Incharge Remarks textarea to PDF exports
const pdfFuncRegex = /async function generatePremiumPDF\(reportHtml, title, divisionLabel, monthLabel, filenamePrefix\) \{/;
const pdfFuncReplacement = `async function generatePremiumPDF(reportHtml, title, divisionLabel, monthLabel, filenamePrefix, scRemarks = '') {`;

html = html.replace(pdfFuncRegex, pdfFuncReplacement);

// 2. Add the remarks text in the PDF before html2canvas
const cloneRegex = /const clone = el\.cloneNode\(true\);/;
const cloneReplacement = `const clone = el.cloneNode(true);
    if (scRemarks && scRemarks.trim() !== '') {
      const rmDiv = document.createElement('div');
      rmDiv.style.marginTop = '30px';
      rmDiv.style.padding = '15px';
      rmDiv.style.border = '1px solid #cbd5e1';
      rmDiv.style.borderRadius = '8px';
      rmDiv.style.backgroundColor = '#f8fafc';
      rmDiv.style.pageBreakInside = 'avoid';
      rmDiv.innerHTML = \`<h4 style="margin:0 0 8px 0;font-family:'Syne',sans-serif;color:#0f172a;">SC Incharge Remarks</h4><p style="margin:0;white-space:pre-wrap;font-family:'Inter',sans-serif;font-size:13px;color:#334155;">\${escapeHtml(scRemarks)}</p>\`;
      clone.appendChild(rmDiv);
    }`;

html = html.replace(cloneRegex, cloneReplacement);

// 3. Fix PDF limits by scaling the canvas properly
const canvasRegex = /const canvas = await html2canvas\(clone, \{[\s\S]*?\}\);/;
const canvasReplacement = `const canvas = await html2canvas(clone, {
      scale: 1.5, // Reduced scale to ensure it fits width
      useCORS: true,
      logging: false,
      windowWidth: 1200 // Force a specific width for layout constraints
    });`;

if(html.match(canvasRegex)) {
    html = html.replace(canvasRegex, canvasReplacement);
}

// Ensure proper aspect ratio rendering in jsPDF
const jsPdfAddImageRegex = /doc\.addImage\(imgData, 'PNG', 10, position, imgWidth, imgHeight\);/g;
const jsPdfAddImageReplacement = `
        // Ensure image fits within page width
        if (imgWidth > pageWidth - 20) {
            const ratio = (pageWidth - 20) / imgWidth;
            imgWidth = pageWidth - 20;
            imgHeight = imgHeight * ratio;
        }
        doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);`;

if(html.match(jsPdfAddImageRegex)) {
    html = html.replace(jsPdfAddImageRegex, jsPdfAddImageReplacement);
}

// 4. Hide 'Division: All Divisions' in the header
const headerRegex = /doc\.text\(\`Division: \$\{divisionLabel\}   \|   Month: \$\{monthLabel\}\`, 280, 24, \{ align: "right" \}\);/;
const headerReplacement = `
      const divText = divisionLabel && divisionLabel.toLowerCase() !== 'all divisions' ? \`Division: \${divisionLabel}   |   \` : '';
      doc.text(\`\${divText}Month: \${monthLabel}\`, 280, 24, { align: "right" });`;
      
html = html.replace(headerRegex, headerReplacement);

fs.writeFileSync(file, html);
console.log('PDF core patched successfully');
