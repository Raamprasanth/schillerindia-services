const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const newJs = \`
  function getPeriodValue(prefix) {
    const from = document.getElementById('perf-range-from-' + prefix).value;
    const to = document.getElementById('perf-range-to-' + prefix).value;
    if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }
    return from + ':' + to;
  }
\`;

// Inject right before the last closing script tag or at a known function
const target = 'async function fetchDivisionData(usePeriod = false)';
if (content.indexOf(target) !== -1) {
  content = content.replace(target, newJs + '\\n\\n' + target);
  fs.writeFileSync(FILE_PATH, content);
  console.log('Injected getPeriodValue helper');
} else {
  // Try another function
  const target2 = 'async function loadDivisionPerf(usePeriod = false)';
  if (content.indexOf(target2) !== -1) {
    content = content.replace(target2, newJs + '\\n\\n' + target2);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Injected getPeriodValue helper (fallback)');
  } else {
    console.log('Could not find injection point');
  }
}
