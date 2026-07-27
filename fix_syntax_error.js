const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// The messed up string that was inserted
const badString = "\\n  function getPeriodValue(prefix) {\\n" +
  "    const from = document.getElementById('perf-range-from-' + prefix).value;\\n" +
  "    const to = document.getElementById('perf-range-to-' + prefix).value;\\n" +
  "    if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }\\n" +
  "    return from + ':' + to;\\n" +
  "  }\\n\\n";

const goodString = `
  function getPeriodValue(prefix) {
    const from = document.getElementById('perf-range-from-' + prefix).value;
    const to = document.getElementById('perf-range-to-' + prefix).value;
    if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }
    return from + ':' + to;
  }
`;

if (content.includes(badString)) {
  content = content.replace(badString, goodString);
  fs.writeFileSync(FILE_PATH, content);
  console.log('Fixed syntax error!');
} else {
  // Maybe the bad string wasn't exactly that. Let's do a more robust regex replacement
  // Replace the literal "\n  function getPeriodValue" with actual newlines
  let replaced = content.split('\\\\n').join('\\n'); // if there are double backslashes?
  
  // Actually, wait, let's just find "async function loadDivisionPerf" and what's right before it
  let idx = content.indexOf('async function loadDivisionPerf');
  if (idx > -1) {
    // See what's before it
    let before = content.substring(idx - 400, idx);
    console.log('Before:', before);
  }
  
  console.log('Could not find exact bad string to replace. Try regex.');
  
  // Let's replace the explicit bad injection.
  const regex = /\\\\n  function getPeriodValue\\(prefix\\) \\{\\\\n    const from = document.getElementById\\('perf-range-from-' \\+ prefix\\).value;\\\\n    const to = document.getElementById\\('perf-range-to-' \\+ prefix\\).value;\\\\n    if \\(!from \\|\\| !to\\) \\{ toast\\('Please select both From and To months', 'error'\\); return null; \\}\\\\n    return from \\+ ':' \\+ to;\\\\n  \\}\\\\n\\\\n/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, goodString);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Fixed via regex!');
  }
}
