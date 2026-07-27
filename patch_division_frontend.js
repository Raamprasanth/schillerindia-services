const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Add Division Dropdown to UI
const uiRegex = /<input type="month" id="perf-indall-month"[^>]*>/;
const uiReplacement = `
                <input type="month" id="perf-indall-month" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;">
              </div>
              <div style="margin-bottom:15px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Division</label>
                <select id="perf-indall-division" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;"></select>
`;
if (html.match(uiRegex)) {
  html = html.replace(uiRegex, uiReplacement);
}

// 2. Populate Division Dropdown in renderPerfOptions
const optRegex = /setOptions\(document\.getElementById\('perf-emp-division'\), perfOptions\.divisions, " Division \(for report\) "\);/;
const optReplacement = `setOptions(document.getElementById('perf-emp-division'), perfOptions.divisions, " Division (for report) ");
      setOptions(document.getElementById('perf-indall-division'), perfOptions.divisions, ' All Divisions ');`;
if (html.match(optRegex)) {
  html = html.replace(optRegex, optReplacement);
}

// 3. Update fetchIndividualAllData JS function to pass division
const fetchRegex = /const month = document\.getElementById\('perf-indall-month'\)\.value;\s*if \(!month\)/;
const fetchReplacement = `
  const month = document.getElementById('perf-indall-month').value;
  const division = document.getElementById('perf-indall-division').value;
  if (!month)`;
if (html.match(fetchRegex)) {
  html = html.replace(fetchRegex, fetchReplacement);
}

const urlRegex = /'\/api\/reports\/performance\/summary\?scope=employee&month=' \+ month/;
const urlReplacement = `'/api/reports/performance/summary?scope=employee&month=' + month + (division ? '&division=' + encodeURIComponent(division) : '')`;
if (html.match(urlRegex)) {
  html = html.replace(urlRegex, urlReplacement);
}

fs.writeFileSync(file, html);
console.log('Frontend patched for division filter');
