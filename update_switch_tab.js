const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

const regex = /const rtPane = document\.getElementById\('perf-repairteam-pane'\);\s+if \(rtPane\) rtPane\.style\.display = tab === 'repairteam' \? 'block' : 'none';/;

const replacement = `const rtPane = document.getElementById('perf-repairteam-pane');
  if (rtPane) rtPane.style.display = tab === 'repairteam' ? 'block' : 'none';
  const ptPane = document.getElementById('perf-productteam-pane');
  if (ptPane) ptPane.style.display = tab === 'productteam' ? 'block' : 'none';`;

if (regex.test(html) && !html.includes('perf-productteam-pane\');')) {
  html = html.replace(regex, replacement);
  fs.writeFileSync(file, html);
  console.log('Fixed switchPerfSubTab');
} else {
  console.log('Target not found or already fixed');
}
