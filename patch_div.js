const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const targetStr = `              <div class="perf-footer">
                <button class="btn btn-primary" style="flex:1;justify-content:center;" id="perf-preview-btn-div" onclick="loadDivisionPerf()">&#128065; Preview Division</button>
                <button class="btn btn-ghost" style="flex:1;justify-content:center;" onclick="loadLeaderboard()">&#127942; Leaderboard</button>
              </div>`;

const newStr = `              <div class="perf-footer">
                <button class="btn btn-primary" style="flex:1;justify-content:center;" id="perf-preview-btn-div" onclick="loadDivisionPerf()">&#128065; Preview Division</button>
                <button class="btn btn-ghost" style="flex:1;justify-content:center;" onclick="loadLeaderboard()">&#127942; Leaderboard</button>
              </div>
              
              <div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                <label class="field-label">Period Type</label>
                <select id="perf-period-type-div" class="field-input" style="margin-bottom:10px;" onchange="togglePeriodInputs('div')">
                  <option value="quarter">Quarterly</option>
                  <option value="half">Half-Yearly</option>
                  <option value="annual">Annual</option>
                </select>
                
                <div id="perf-period-quarter-div" style="margin-bottom:10px;">
                  <label class="field-label">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-div" class="field-input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-div" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div id="perf-period-half-div" style="display:none;margin-bottom:10px;">
                  <label class="field-label">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-div" class="field-input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-div" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div id="perf-period-annual-div" style="display:none;margin-bottom:10px;">
                  <label class="field-label">Select Year</label>
                  <input type="number" id="perf-a-div" class="field-input" placeholder="YYYY" value="2026"/>
                </div>

                <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;" onclick="loadDivisionPerf(true)">Generate Period Preview</button>
              </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newStr);
  
  content = content.replace('async function loadDivisionPerf() {', 'async function loadDivisionPerf(usePeriod = false) {');
  content = content.replace(`const month=document.getElementById('perf-month-div').value;`, `const month=usePeriod ? getPeriodValue('div') : document.getElementById('perf-month-div').value;`);
  
  fs.writeFileSync(FILE_PATH, content);
  console.log('Patched Division Analysis');
} else {
  console.log('Could not find target string for Division Analysis');
}
