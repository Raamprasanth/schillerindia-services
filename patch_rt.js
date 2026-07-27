const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const ptRegex = /(<button class="btn btn-green" onclick="fetchProductTeamData\(\)" style="width:100%;">Generate Report<\/button>)([\s\S]*?)<\/div>\s*<\/div>\s*<div class="perf-view"/;
const ptMatch = content.match(ptRegex);
console.log('PT Match: ' + !!ptMatch);

const rtRegex = /(<button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchRepairTeamData\(\)">Generate Report<\/button>\s*<\/div>)/;

const newStr = `$1

                  <div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                    <label class="field-label">Period Type</label>
                    <select id="perf-period-type-rt" class="field-input" style="margin-bottom:10px;" onchange="togglePeriodInputs('rt')">
                      <option value="quarter">Quarterly</option>
                      <option value="half">Half-Yearly</option>
                      <option value="annual">Annual</option>
                    </select>
                    
                    <div id="perf-period-quarter-rt" style="margin-bottom:10px;">
                      <label class="field-label">Select Quarter & Year</label>
                      <div style="display:flex; gap:5px;">
                        <select id="perf-q-rt" class="field-input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                        <input type="number" id="perf-qy-rt" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                      </div>
                    </div>
                    <div id="perf-period-half-rt" style="display:none;margin-bottom:10px;">
                      <label class="field-label">Select Half & Year</label>
                      <div style="display:flex; gap:5px;">
                        <select id="perf-h-rt" class="field-input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                        <input type="number" id="perf-hy-rt" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                      </div>
                    </div>
                    <div id="perf-period-annual-rt" style="display:none;margin-bottom:10px;">
                      <label class="field-label">Select Year</label>
                      <input type="number" id="perf-a-rt" class="field-input" placeholder="YYYY" value="2026"/>
                    </div>

                    <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="fetchRepairTeamData(true)">Generate Period Report</button>
                  </div>`;

if (content.match(rtRegex)) {
  content = content.replace(rtRegex, newStr);
  fs.writeFileSync(FILE_PATH, content);
  console.log('Patched Repair Team Analysis');
} else {
  console.log('Could not find target string for Repair Team Analysis');
}
