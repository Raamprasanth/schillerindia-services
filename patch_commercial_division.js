const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/public/Reports.html');
let html = fs.readFileSync(file, 'utf8');

// 1. Update the HTML layout for perf-com-pane builder
const oldBuilder = `
            <div class="perf-body">
              <div class="fg">
                <div class="fg-field">
                  <label>Select Month</label>
                  <input type="month" id="perf-com-month" onchange="fetchCommercialData()" />
                </div>
              </div>
            </div>`;

const newBuilder = `
            <div class="perf-body">
              <div class="fg">
                <div class="fg-field">
                  <label class="field-label">Select Month</label>
                  <input type="month" id="perf-com-month" class="field-input" />
                </div>
                <div class="fg-field" style="margin-top:12px;">
                  <label class="field-label">Select Division</label>
                  <select id="perf-com-division" class="field-select">
                    <option value=""> All Divisions </option>
                  </select>
                </div>
                <div class="fg-field" style="margin-top:16px;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchCommercialData()">Generate Report</button>
                </div>
              </div>
            </div>`;

if (html.includes(oldBuilder)) {
  html = html.replace(oldBuilder, newBuilder);
} else {
  // Try a less exact match
  const fallbackRegex = /<div class="perf-body">\s*<div class="fg">\s*<div class="fg-field">\s*<label>Select Month<\/label>\s*<input type="month" id="perf-com-month"[^>]*>\s*<\/div>\s*<\/div>\s*<\/div>/;
  if (fallbackRegex.test(html)) {
    html = html.replace(fallbackRegex, newBuilder);
  }
}

// 2. Add perf-com-division population to loadPerformanceOptions
const setOptionsString = `setOptions(document.getElementById('perf-division'), perfOptions.divisions, ' Select Division ');`;
if (html.includes(setOptionsString) && !html.includes('perf-com-division')) {
  html = html.replace(
    setOptionsString,
    setOptionsString + `\n      setOptions(document.getElementById('perf-com-division'), perfOptions.divisions, ' All Divisions ');`
  );
}

// 3. Update fetchCommercialData to respect the selected division
const oldFetchDataStart = `async function fetchCommercialData() {
  const month = document.getElementById('perf-com-month').value;
  if (!month) return;`;

const newFetchDataStart = `async function fetchCommercialData() {
  const month = document.getElementById('perf-com-month').value;
  if (!month) {
    toast('Please select a month first', 'error');
    return;
  }
  const selectedDiv = document.getElementById('perf-com-division').value;`;

if (html.includes(oldFetchDataStart)) {
  html = html.replace(oldFetchDataStart, newFetchDataStart);
}

// Update the rendering loop in fetchCommercialData
const oldLoop = `const divisions = Object.keys(d.data).sort((a,b) => a.localeCompare(b));
    
    for (const div of divisions) {
      const metrics = d.data[div];`;

const newLoop = `const divisions = Object.keys(d.data).sort((a,b) => a.localeCompare(b));
    let hasData = false;
    for (const div of divisions) {
      if (selectedDiv && selectedDiv !== div && selectedDiv !== 'All Divisions') continue;
      hasData = true;
      const metrics = d.data[div];`;

if (html.includes(oldLoop)) {
  html = html.replace(oldLoop, newLoop);
  
  // also inject the empty state if no data for that division
  const oldHtmlEnd = `html += \`</div>\`;
    res.innerHTML = html;`;
  
  const newHtmlEnd = `html += \`</div>\`;
    if (!hasData) {
      res.innerHTML = '<div class="empty-sub">No commercial data found for the selected division in this month.</div>';
    } else {
      res.innerHTML = html;
    }`;
  
  if (html.includes(oldHtmlEnd)) {
    html = html.replace(oldHtmlEnd, newHtmlEnd);
  }
}

fs.writeFileSync(file, html, 'utf8');
console.log('Successfully patched commercial tab for division select');
