const fs = require('fs');
const path = require('path');

const dir = 'frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Sidebar changes
  content = content.replace(/> Supplier Warranty<\/a>/g, '> Re-Export Pending</a>');
  content = content.replace(/> Closed Supp Warr<\/a>/g, '> Re-Export Completed</a>');

  // empunderep specific dropdown change
  if (file === 'empunderep.html') {
    content = content.replace(/<option value="Supplier Warranty">Supplier Warranty<\/option>/g, '<option value="Supplier Warranty">Re-Export</option>');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    updatedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Successfully updated ${updatedCount} HTML files.`);
