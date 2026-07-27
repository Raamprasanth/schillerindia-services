const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const marker = '<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">';

function replaceSection(prefix, functionCall) {
  const selectId = \`id="perf-period-type-\${prefix}"\`;
  
  let startIndex = 0;
  while (true) {
    let blockStart = content.indexOf(marker, startIndex);
    if (blockStart === -1) {
      console.log('Cannot find block for ' + prefix);
      return;
    }
    
    let btnStart = content.indexOf(\`onclick="\${functionCall}"\`, blockStart);
    if (btnStart !== -1) {
      let selIdx = content.indexOf(selectId, blockStart);
      if (selIdx !== -1 && selIdx < btnStart) {
        let blockEnd = content.indexOf('</div>', btnStart) + '</div>'.length;
        
        let isInd = (prefix === 'ind' || prefix === 'pt' || prefix === 'rt');
        let labelClass = isInd ? 'style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;"' : 'class="field-label"';
        let inputClass = isInd ? 'style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:\\'Inter\\',sans-serif;font-size:14px;color:#0f172a;"' : 'class="field-input"';
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
        return;
      }
    }
    startIndex = blockStart + marker.length;
  }
}

replaceSection('div', 'loadDivisionPerf(true)');
replaceSection('ind', 'fetchIndividualAllData(true)');
replaceSection('com', 'fetchCommercialData(true)');
replaceSection('pt', 'fetchProductTeamData(true)');
replaceSection('rt', 'fetchRepairTeamData(true)');

const getPeriodRegex = /function getPeriodValue\\(prefix\\) \\{[\\s\\S]*?return null;\\n\\}/;
const getPeriodReplacement = \`function getPeriodValue(prefix) {
  const from = document.getElementById('perf-range-from-' + prefix).value;
  const to = document.getElementById('perf-range-to-' + prefix).value;
  if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }
  return from + ':' + to;
}\`;

if (content.match(getPeriodRegex)) {
  content = content.replace(getPeriodRegex, getPeriodReplacement);
  console.log('Patched getPeriodValue');
} else {
  console.log('Could not find getPeriodValue');
}

fs.writeFileSync(FILE_PATH, content);
console.log('Done');
