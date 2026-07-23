const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/public/Reports.html');
let content = fs.readFileSync(file, 'utf8');

// The pane block regex
const paneRegex = /\s*<!-- COMMERCIAL SUB-TAB -->[\s\S]*?<div class="perf-body" id="perf-com-result">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;
const match = content.match(paneRegex);

if (match) {
  const paneContent = match[0];
  // Remove it from current location
  content = content.replace(paneRegex, '');
  
  // Now, find the right place to put it.
  // It should be inside `<div id="tab-performance" class="tab-pane">`
  // We can insert it right before `      </div> <!-- /tab-performance -->` if it exists.
  // Or right before `      <div id="tab-analytics"` or similar.
  // Let's search for `<!-- INDIVIDUAL SUB-TAB -->` to see where it ends.
  
  // A safe place is right before `//  TAB 2  PERFORMANCE REVIEW (Enhanced)` in the script? No, it's HTML.
  // Let's just find `// --- REPORTS & HISTORY ---` ? No, we must insert in the DOM tree.
  // Let's search for `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>` or the first script tag.
}

fs.writeFileSync(file, content, 'utf8');
