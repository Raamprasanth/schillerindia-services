const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regexes = [
  // Division
  {
    regex: /<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">\s*<label class="field-label">Period Type<\/label>[\s\S]*?<button class="btn btn-blue"[^>]*onclick="loadDivisionPerf\(true\)">Generate Period Preview<\/button>\s*<\/div>/,
    replacement: `<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <div style="flex:1;">
                    <label class="field-label">From Month</label>
                    <input type="month" id="perf-range-from-div" class="field-input" />
                  </div>
                  <div style="flex:1;">
                    <label class="field-label">To Month</label>
                    <input type="month" id="perf-range-to-div" class="field-input" />
                  </div>
                </div>
                <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="loadDivisionPerf(true)">Generate Custom Preview</button>
              </div>`
  },
  // Individual
  {
    regex: /<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">\s*<label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">Period Type<\/label>[\s\S]*?<button class="btn btn-blue" onclick="fetchIndividualAllData\(true\)"[^>]*>Generate Period Report<\/button>\s*<\/div>/,
    replacement: `<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <div style="flex:1;">
                    <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">From Month</label>
                    <input type="month" id="perf-range-from-ind" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;" />
                  </div>
                  <div style="flex:1;">
                    <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">To Month</label>
                    <input type="month" id="perf-range-to-ind" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;" />
                  </div>
                </div>
                <button class="btn btn-blue" onclick="fetchIndividualAllData(true)" style="width:100%; background: #3b82f6; color: #fff; padding:10px; font-weight:700; border-radius:6px;">Generate Custom Report</button>
              </div>`
  },
  // Commercial
  {
    regex: /<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">\s*<label class="field-label">Period Type<\/label>[\s\S]*?<button class="btn btn-blue"[^>]*onclick="fetchCommercialData\(true\)">Generate Period Report<\/button>\s*<\/div>/,
    replacement: `<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <div style="flex:1;">
                    <label class="field-label">From Month</label>
                    <input type="month" id="perf-range-from-com" class="field-input" />
                  </div>
                  <div style="flex:1;">
                    <label class="field-label">To Month</label>
                    <input type="month" id="perf-range-to-com" class="field-input" />
                  </div>
                </div>
                <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="fetchCommercialData(true)">Generate Custom Report</button>
              </div>`
  },
  // Product Team
  {
    regex: /<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">\s*<label class="field-label">Period Type<\/label>[\s\S]*?<button class="btn btn-blue"[^>]*onclick="fetchProductTeamData\(true\)">Generate Period Report<\/button>\s*<\/div>/,
    replacement: `<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <div style="flex:1;">
                    <label class="field-label">From Month</label>
                    <input type="month" id="perf-range-from-pt" class="field-input" />
                  </div>
                  <div style="flex:1;">
                    <label class="field-label">To Month</label>
                    <input type="month" id="perf-range-to-pt" class="field-input" />
                  </div>
                </div>
                <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="fetchProductTeamData(true)">Generate Custom Report</button>
              </div>`
  },
  // Repair Team
  {
    regex: /<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">\s*<label class="field-label">Period Type<\/label>[\s\S]*?<button class="btn btn-blue"[^>]*onclick="fetchRepairTeamData\(true\)">Generate Period Report<\/button>\s*<\/div>/,
    replacement: `<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <div style="flex:1;">
                    <label class="field-label">From Month</label>
                    <input type="month" id="perf-range-from-rt" class="field-input" />
                  </div>
                  <div style="flex:1;">
                    <label class="field-label">To Month</label>
                    <input type="month" id="perf-range-to-rt" class="field-input" />
                  </div>
                </div>
                <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="fetchRepairTeamData(true)">Generate Custom Report</button>
              </div>`
  }
];

let changed = false;
regexes.forEach((r, i) => {
  if (content.match(r.regex)) {
    content = content.replace(r.regex, r.replacement);
    console.log('Replaced block ' + i);
    changed = true;
  } else {
    console.log('Could not find block ' + i);
  }
});

// Update getPeriodValue
const getPeriodRegex = /function getPeriodValue\(prefix\) \{[\s\S]*?return null;\n\}/;
const getPeriodReplacement = `function getPeriodValue(prefix) {
  const from = document.getElementById('perf-range-from-' + prefix).value;
  const to = document.getElementById('perf-range-to-' + prefix).value;
  if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }
  return from + ':' + to;
}`;

if (content.match(getPeriodRegex)) {
  content = content.replace(getPeriodRegex, getPeriodReplacement);
  console.log('Patched getPeriodValue');
} else {
  console.log('Could not find getPeriodValue');
}

if (changed) {
  fs.writeFileSync(FILE_PATH, content);
  console.log('Done.');
}
