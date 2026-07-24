const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

html = html.replace(
  /<table style="width:60%;border-collapse:collapse;margin-bottom:24px;">\s*<thead>\s*<tr>\s*<th colspan="2" style="\$\{TH\}background:#0f172a;color:#fff;text-align:left;font-size:14px;">COMPLIANCE TRACKER<\/th>/g,
  '<table class="compliance-table" style="width:60%;border-collapse:collapse;margin-bottom:24px;">\n        <thead>\n          <tr>\n            <th colspan="2" style="${TH}background:#0f172a;color:#fff;text-align:left;font-size:14px;">COMPLIANCE TRACKER</th>'
);

html = html.replace(
  /<div style="display:flex;gap:20px;margin-top:16px;">\s*<div style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:20px;text-align:center;background:#f8fafc;">/g,
  '<div class="summary-boxes" style="display:flex;gap:20px;margin-top:16px;">\n        <div style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:20px;text-align:center;background:#f8fafc;">'
);

html = html.replace(
  /if \(lowerSection\) lowerSection\.remove\(\);\s*const firstPageHtml = reportScratch\.innerHTML;/g,
  "if (lowerSection) lowerSection.remove();\n    if (hideBottom) {\n      const cTable = reportScratch.querySelector('.compliance-table');\n      if(cTable) cTable.remove();\n      const sBoxes = reportScratch.querySelector('.summary-boxes');\n      if(sBoxes) sBoxes.remove();\n    }\n    const firstPageHtml = reportScratch.innerHTML;"
);

fs.writeFileSync(file, html);
console.log('Update applied successfully.');
