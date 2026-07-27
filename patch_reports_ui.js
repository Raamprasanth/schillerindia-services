const fs = require('fs');

const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Division Analysis
const divOld = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchDivisionData()">Generate Report</button>
                </div>`;
const divNew = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchDivisionData()">Generate Report</button>
                </div>
                
                <div style="flex-basis: 100%; height: 0;"></div>
                
                <div class="field-group">
                  <label class="field-label">Period Type</label>
                  <select id="perf-period-type-div" class="field-input" onchange="togglePeriodInputs('div')">
                    <option value="quarter">Quarterly</option>
                    <option value="half">Half-Yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                
                <div class="field-group" id="perf-period-quarter-div">
                  <label class="field-label">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-div" class="field-input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-div" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-half-div" style="display:none;">
                  <label class="field-label">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-div" class="field-input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-div" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-annual-div" style="display:none;">
                  <label class="field-label">Select Year</label>
                  <input type="number" id="perf-a-div" class="field-input" placeholder="YYYY" value="2026"/>
                </div>

                <div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchDivisionData(true)">Generate Period Report</button>
                </div>`;
content = content.replace(divOld, divNew);

// 2. Individual Analysis
const indOld = `<div style="flex:1; display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:6px;" onclick="fetchIndividualData()">Generate Report</button>
                </div>`;
const indNew = `<div style="flex:1; display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:6px;" onclick="fetchIndividualData()">Generate Report</button>
                </div>
                
                <div style="flex-basis: 100%; height: 0;"></div>
                
                <div style="flex:1;">
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">Period Type</label>
                  <select id="perf-period-type-ind" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;" onchange="togglePeriodInputs('ind')">
                    <option value="quarter">Quarterly</option>
                    <option value="half">Half-Yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                
                <div style="flex:1;" id="perf-period-quarter-ind">
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-ind" style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-ind" style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div style="flex:1; display:none;" id="perf-period-half-ind">
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-ind" style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-ind" style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div style="flex:1; display:none;" id="perf-period-annual-ind">
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;">Select Year</label>
                  <input type="number" id="perf-a-ind" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;" placeholder="YYYY" value="2026"/>
                </div>

                <div style="flex:1; display:flex; align-items:flex-end;">
                  <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:6px;" onclick="fetchIndividualData(true)">Generate Period Report</button>
                </div>`;
content = content.replace(indOld, indNew);


// 3. Commercial Analysis
const comOld = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchCommercialData()">Generate Report</button>
                </div>`;
const comNew = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchCommercialData()">Generate Report</button>
                </div>
                
                <div style="flex-basis: 100%; height: 0;"></div>
                
                <div class="field-group">
                  <label class="field-label">Period Type</label>
                  <select id="perf-period-type-com" class="field-input" onchange="togglePeriodInputs('com')">
                    <option value="quarter">Quarterly</option>
                    <option value="half">Half-Yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                
                <div class="field-group" id="perf-period-quarter-com">
                  <label class="field-label">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-com" class="field-input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-com" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-half-com" style="display:none;">
                  <label class="field-label">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-com" class="field-input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-com" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-annual-com" style="display:none;">
                  <label class="field-label">Select Year</label>
                  <input type="number" id="perf-a-com" class="field-input" placeholder="YYYY" value="2026"/>
                </div>

                <div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchCommercialData(true)">Generate Period Report</button>
                </div>`;
content = content.replace(comOld, comNew);


// 4. Product Team Analysis
const ptOld = `<div class="form-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchProductTeamData()">Generate Report</button>
                </div>`;
const ptNew = `<div class="form-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchProductTeamData()">Generate Report</button>
                </div>
                
                <div style="flex-basis: 100%; height: 0;"></div>
                
                <div class="form-group">
                  <label class="label">Period Type</label>
                  <select id="perf-period-type-pt" class="input" onchange="togglePeriodInputs('pt')">
                    <option value="quarter">Quarterly</option>
                    <option value="half">Half-Yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                
                <div class="form-group" id="perf-period-quarter-pt">
                  <label class="label">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-pt" class="input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-pt" class="input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="form-group" id="perf-period-half-pt" style="display:none;">
                  <label class="label">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-pt" class="input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-pt" class="input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="form-group" id="perf-period-annual-pt" style="display:none;">
                  <label class="label">Select Year</label>
                  <input type="number" id="perf-a-pt" class="input" placeholder="YYYY" value="2026"/>
                </div>

                <div class="form-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchProductTeamData(true)">Generate Period Report</button>
                </div>`;
content = content.replace(ptOld, ptNew);


// 5. Repair Team Analysis
const rtOld = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchRepairTeamData()">Generate Report</button>
                </div>`;
const rtNew = `<div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-red" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchRepairTeamData()">Generate Report</button>
                </div>
                
                <div style="flex-basis: 100%; height: 0;"></div>
                
                <div class="field-group">
                  <label class="field-label">Period Type</label>
                  <select id="perf-period-type-rt" class="field-input" onchange="togglePeriodInputs('rt')">
                    <option value="quarter">Quarterly</option>
                    <option value="half">Half-Yearly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                
                <div class="field-group" id="perf-period-quarter-rt">
                  <label class="field-label">Select Quarter & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-q-rt" class="field-input" style="flex:1;"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                    <input type="number" id="perf-qy-rt" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-half-rt" style="display:none;">
                  <label class="field-label">Select Half & Year</label>
                  <div style="display:flex; gap:5px;">
                    <select id="perf-h-rt" class="field-input" style="flex:1;"><option value="1">H1</option><option value="2">H2</option></select>
                    <input type="number" id="perf-hy-rt" class="field-input" style="flex:1;" placeholder="YYYY" value="2026"/>
                  </div>
                </div>
                <div class="field-group" id="perf-period-annual-rt" style="display:none;">
                  <label class="field-label">Select Year</label>
                  <input type="number" id="perf-a-rt" class="field-input" placeholder="YYYY" value="2026"/>
                </div>

                <div class="field-group" style="display:flex; align-items:flex-end;">
                  <button class="btn btn-blue" style="width:100%; padding:10px; font-weight:700; border-radius:8px;" onclick="fetchRepairTeamData(true)">Generate Period Report</button>
                </div>`;
content = content.replace(rtOld, rtNew);


// Helper functions
const helpers = `
// Period UI toggling
function togglePeriodInputs(prefix) {
  const type = document.getElementById('perf-period-type-' + prefix).value;
  document.getElementById('perf-period-quarter-' + prefix).style.display = 'none';
  document.getElementById('perf-period-half-' + prefix).style.display = 'none';
  document.getElementById('perf-period-annual-' + prefix).style.display = 'none';
  
  if (type === 'quarter') {
    document.getElementById('perf-period-quarter-' + prefix).style.display = 'block';
  } else if (type === 'half') {
    document.getElementById('perf-period-half-' + prefix).style.display = 'block';
  } else if (type === 'annual') {
    document.getElementById('perf-period-annual-' + prefix).style.display = 'block';
  }
}

function getPeriodValue(prefix) {
  const type = document.getElementById('perf-period-type-' + prefix).value;
  if (type === 'quarter') {
    const q = document.getElementById('perf-q-' + prefix).value;
    const y = document.getElementById('perf-qy-' + prefix).value;
    if (!y) return null;
    return y + '-Q' + q;
  } else if (type === 'half') {
    const h = document.getElementById('perf-h-' + prefix).value;
    const y = document.getElementById('perf-hy-' + prefix).value;
    if (!y) return null;
    return y + '-H' + h;
  } else if (type === 'annual') {
    const y = document.getElementById('perf-a-' + prefix).value;
    if (!y) return null;
    return y + '-A';
  }
  return null;
}
`;

content = content.replace('// Function to setup sidebar toggle logic', helpers + '\n// Function to setup sidebar toggle logic');

// Modifying the fetch functions to accept usePeriod
content = content.replace('async function fetchDivisionData() {', 'async function fetchDivisionData(usePeriod = false) {');
content = content.replace(`const month = document.getElementById('perf-month-div').value;`, `const month = usePeriod ? getPeriodValue('div') : document.getElementById('perf-month-div').value;`);

content = content.replace('async function fetchIndividualData() {', 'async function fetchIndividualData(usePeriod = false) {');
content = content.replace(`const month = document.getElementById('perf-indall-month').value;`, `const month = usePeriod ? getPeriodValue('ind') : document.getElementById('perf-indall-month').value;`);

content = content.replace('async function fetchCommercialData() {', 'async function fetchCommercialData(usePeriod = false) {');
content = content.replace(`const month = document.getElementById('perf-com-month').value;`, `const month = usePeriod ? getPeriodValue('com') : document.getElementById('perf-com-month').value;`);

content = content.replace('async function fetchProductTeamData() {', 'async function fetchProductTeamData(usePeriod = false) {');
content = content.replace(`const month = document.getElementById('perf-productteam-month').value;`, `const month = usePeriod ? getPeriodValue('pt') : document.getElementById('perf-productteam-month').value;`);

content = content.replace('async function fetchRepairTeamData() {', 'async function fetchRepairTeamData(usePeriod = false) {');
content = content.replace(`const month = document.getElementById('perf-repairteam-month').value;`, `const month = usePeriod ? getPeriodValue('rt') : document.getElementById('perf-repairteam-month').value;`);

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched Reports.html UI');
