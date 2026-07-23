const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/public/Reports.html');
let html = fs.readFileSync(file, 'utf8');

const targetStr = "setOptions(document.getElementById('perf-division'), perfOptions.divisions, ' Select Division ');";
const injectionStr = "      setOptions(document.getElementById('perf-com-division'), perfOptions.divisions, '', true);";

if (html.includes(targetStr) && !html.includes("setOptions(document.getElementById('perf-com-division')")) {
  html = html.replace(targetStr, targetStr + '\n' + injectionStr);
  fs.writeFileSync(file, html, 'utf8');
  console.log('Successfully injected division setup.');
} else {
  // Try another approach
  const backupStr = "setOptions(document.getElementById('perf-emp-division'), perfOptions.divisions, \" Division (for report) \");";
  if (html.includes(backupStr) && !html.includes("setOptions(document.getElementById('perf-com-division')")) {
    html = html.replace(backupStr, backupStr + '\n' + injectionStr);
    fs.writeFileSync(file, html, 'utf8');
    console.log('Successfully injected division setup using backup string.');
  } else {
    console.log('Could not find target strings to inject division setup.');
  }
}
