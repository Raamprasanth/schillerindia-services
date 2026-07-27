const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const target1 = `const entityLabel = isDiv ? divisionLabel : employeeLabel;
  drawPerfPdfPage(doc, data, monthLabel, scopeLabel, entityLabel);`;

const repl1 = `const entityLabel = isDiv ? divisionLabel : employeeLabel;
  const scopeType = isDiv ? 'division' : 'employee';
  const scRemarks = document.getElementById(scopeType + '-sc-remarks')?.value || '';
  drawPerfPdfPage(doc, data, monthLabel, scopeLabel, entityLabel, scRemarks);`;

if (content.includes(target1)) {
    content = content.replace(target1, repl1);
    console.log('Patched exportPDF');
}

const target2 = `doc.text(remark.toUpperCase(), 140, boxY + 16, { align: "center" });
  }
}`;

const repl2 = `doc.text(remark.toUpperCase(), 140, boxY + 16, { align: "center" });
    
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
  }
}`;

if (content.includes(target2)) {
    content = content.replace(target2, repl2);
    console.log('Patched drawPerfPdfPage');
}

fs.writeFileSync(FILE_PATH, content);
