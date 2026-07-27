const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

// Start from the original, pristine HTML so we undo all the damage
let content = fs.readFileSync('Reports.original.html', 'utf8');

const marker = '<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">';

function replaceSection(prefix, functionCall) {
  const selectId = 'id="perf-period-type-' + prefix + '"';
  
  // 1. Find the select element
  let selIdx = content.indexOf(selectId);
  if (selIdx === -1) {
    console.log('Cannot find selectId for ' + prefix);
    return;
  }
  
  // 2. Find the marker BEFORE the select element
  let blockStart = content.lastIndexOf(marker, selIdx);
  if (blockStart === -1) {
    console.log('Cannot find marker for ' + prefix);
    return;
  }
  
  // 3. Find the button AFTER the select element
  let btnStart = content.indexOf('onclick="' + functionCall + '"', selIdx);
  if (btnStart === -1) {
    console.log('Cannot find button for ' + prefix);
    return;
  }
  
  // 4. Find the end of the div containing the button
  let blockEnd = content.indexOf('</div>', btnStart) + '</div>'.length;
  
  let isInd = (prefix === 'ind' || prefix === 'pt' || prefix === 'rt');
  let labelClass = isInd ? 'style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;"' : 'class="field-label"';
  let inputClass = isInd ? 'style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter,sans-serif;font-size:14px;color:#0f172a;"' : 'class="field-input"';
  let btnClass = isInd ? 'style="width:100%; padding:10px; font-weight:700; border-radius:6px; background: #3b82f6; color: #fff;"' : 'style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;"';
  
  let newBlock = marker + '\\n' +
  '                <div style="display:flex; gap:10px; margin-bottom:15px;">\\n' +
  '                  <div style="flex:1;">\\n' +
  '                    <label ' + labelClass + '>From Month</label>\\n' +
  '                    <input type="month" id="perf-range-from-' + prefix + '" ' + inputClass + ' />\\n' +
  '                  </div>\\n' +
  '                  <div style="flex:1;">\\n' +
  '                    <label ' + labelClass + '>To Month</label>\\n' +
  '                    <input type="month" id="perf-range-to-' + prefix + '" ' + inputClass + ' />\\n' +
  '                  </div>\\n' +
  '                </div>\\n' +
  '                <button class="btn btn-blue" ' + btnClass + ' onclick="' + functionCall + '">Generate Custom Report</button>\\n' +
  '              </div>';
  
  content = content.substring(0, blockStart) + newBlock + content.substring(blockEnd);
  console.log('Replaced ' + prefix);
}

replaceSection('div', 'loadDivisionPerf(true)');
replaceSection('ind', 'fetchIndividualAllData(true)');
replaceSection('com', 'fetchCommercialData(true)');
replaceSection('pt', 'fetchProductTeamData(true)');
replaceSection('rt', 'fetchRepairTeamData(true)');

// Now add the getPeriodValue helper exactly as we did before
const newJs = "\\n  function getPeriodValue(prefix) {\\n" +
  "    const from = document.getElementById('perf-range-from-' + prefix).value;\\n" +
  "    const to = document.getElementById('perf-range-to-' + prefix).value;\\n" +
  "    if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }\\n" +
  "    return from + ':' + to;\\n" +
  "  }\\n";

const target = 'async function loadDivisionPerf(usePeriod = false)';
if (content.indexOf(target) !== -1) {
  content = content.replace(target, newJs + '\\n' + target);
  console.log('Injected getPeriodValue helper');
} else {
  console.log('Could not find injection point');
}

fs.writeFileSync(FILE_PATH, content);
console.log('Done');
