const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'public');

let totalFiles = 0;
let changedFiles = 0;

fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith('.html')) return;
  totalFiles++;

  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Strategy: inside placeholder="...", remove "e.g. <anything up to next quote or end>"
  // Also handles "e.g. X, Y, Z" and trailing punctuation/spaces
  content = content.replace(
    /placeholder="([^"]*)"/g,
    (match, val) => {
      // Remove "e.g. ..." portions (case-insensitive)
      let cleaned = val
        .replace(/,?\s*e\.g\.\s*[^,"]*(?:,\s*[^,"]*)?/gi, '') // remove "e.g. X" or "e.g. X, Y"
        .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
        .replace(/^[\s,\-–]+/, '') // strip leading dash/comma/space
        .replace(/[\s,\-–]+$/, '') // strip trailing dash/comma/space
        .trim();

      return `placeholder="${cleaned}"`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedFiles++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`\nDone. Checked ${totalFiles} HTML files, updated ${changedFiles}.`);
