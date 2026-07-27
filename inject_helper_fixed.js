const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const newJs = "\\n  function getPeriodValue(prefix) {\\n" +
  "    const from = document.getElementById('perf-range-from-' + prefix).value;\\n" +
  "    const to = document.getElementById('perf-range-to-' + prefix).value;\\n" +
  "    if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }\\n" +
  "    return from + ':' + to;\\n" +
  "  }\\n";

const target = 'async function loadDivisionPerf(usePeriod = false)';
if (content.indexOf(target) !== -1) {
  content = content.replace(target, newJs + '\\n' + target);
  fs.writeFileSync(FILE_PATH, content);
  console.log('Injected getPeriodValue helper');
} else {
  console.log('Could not find injection point');
}
