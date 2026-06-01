const fs = require('fs');
let file = fs.readFileSync('frontend/public/scprfob.html', 'utf8');

// =============================================
// 1. REMOVE "Read-Only Fields" section from Form 1 (x- form, Add New tab)
// =============================================
file = file.replace(
  /\s*<div class="form-section-title" style="margin-top:20px;">Read-Only Fields<\/div>\s*<div class="fg-4">\s*<div class="ff">\s*<label>Part No<\/label>\s*<input type="text" id="x-partType" class="is-locked" readonly\/>\s*<\/div>\s*<div class="ff">\s*<label>Description<\/label>\s*<input type="text" id="x-partsDescription" class="is-locked" readonly\/>\s*<\/div>\s*<div class="ff">\s*<label>SC Engineer<\/label>\s*<input type="text" id="x-scEng" class="is-locked" readonly\/>\s*<\/div>\s*<div class="ff">\s*<label>GIR No<\/label>\s*<input type="text" id="x-crmRefNo" class="is-locked" readonly\/>\s*<\/div>\s*<div class="ff">\s*<label>Remarks<\/label>\s*<input type="text" id="x-remarks" class="is-locked" readonly\/>\s*<\/div>\s*<\/div>/g,
  ''
);

// =============================================
// 2. REMOVE "Received Date" column from TABLE HEADER
// =============================================
file = file.replace(
  /\s*<th onclick="sortBy\('receivedDate'\)">Received Date <span class="si">&#8597;<\/span><\/th>/g,
  ''
);

// =============================================
// 3. REMOVE "Received Date" cell from TABLE ROWS (td for receivedDate)
// =============================================
file = file.replace(
  /\s*<td style="font-size:11px;color:var\(--soft\);">\$\{fmtDate\(d\.receivedDate\)\}<\/td>/g,
  ''
);

// =============================================
// 4. In UPDATE tab (x- form):
//    - Remove Status box (it's hidden in Add mode, remove it fully via JS)
//    - Freeze Spares Rcv Date in update mode
// We do this in openEditModal by hiding status and disabling sparesReceivedAtSvc
// =============================================

// In openEditModal: hide status, freeze spares date
file = file.replace(
  "document.getElementById('x-sparesReceivedAtSvc').parentElement.style.display = 'flex';\n  document.getElementById('x-status').parentElement.style.display = 'flex';",
  "document.getElementById('x-sparesReceivedAtSvc').parentElement.style.display = 'none';\n  document.getElementById('x-status').parentElement.style.display = 'none';"
);

fs.writeFileSync('frontend/public/scprfob.html', file);
console.log('Done.');
