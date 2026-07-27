const fs = require('fs');
const path = require('path');

const dir = 'frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Employee module: Warr/Rep -> Re-Export/Rep
  content = content.replace(/<span>Warr\/Rep<\/span>/g, '<span>Re-Export/Rep</span>');

  // 2. Admin pages: Supplier Warranty -> Re-Export
  // Admin sidebar
  content = content.replace(/> Supplier Warranty<\/button>/g, '> Re-Export</button>');
  
  // Admin dashboard chart labels
  if (file === 'admin-dashboard.html' || file === 'Reports.html') {
    content = content.replace(/Supplier Warranty/g, 'Re-Export');
  }

  // Also replace in supplier-warranty-list.html title/headings
  if (file === 'supplier-warranty-list.html') {
    content = content.replace(/>Supplier Warranty /g, '>Re-Export ');
    content = content.replace(/Supplier Warranty List/g, 'Re-Export List');
    content = content.replace(/'Supplier Warranty'/g, "'Re-Export'");
  }
  
  // Also check admin-re-repair-atrr, closed-frn, etc. just replacing any "Supplier Warranty" text 
  // that might be visible.
  if (['admin-re-repair-atrr.html', 'admin-closed-re-repair-atcrr.html', 'under-repair.html', 'closed-frn.html'].includes(file)) {
      content = content.replace(/>Supplier Warranty</g, '>Re-Export<');
      content = content.replace(/Supplier Warranty/g, 'Re-Export');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    updatedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Successfully updated ${updatedCount} HTML files.`);
