const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const replaceCustomBlock = (prefix, functionCall) => {
  const regexStr = '<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">[\\\\s\\\\S]*?id="perf-period-type-' + prefix + '"[\\\\s\\\\S]*?onclick="' + functionCall.replace('(', '\\\\(').replace(')', '\\\\)') + '"[\\\\s\\\\S]*?</div>';
  const regex = new RegExp(regexStr, "g");
  
  const isInd = prefix === 'ind';
  const labelClass = isInd ? 'style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#64748b;"' : 'class="field-label"';
  const inputClass = isInd ? 'style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:\\'Inter\\',sans-serif;font-size:14px;color:#0f172a;"' : 'class="field-input"';
  const btnClass = isInd ? 'style="width:100%; padding:10px; font-weight:700; border-radius:6px; background: #3b82f6; color: #fff;"' : 'style="width:100%; padding:10px; font-weight:700; border-radius:8px; background: #3b82f6; color: #fff;"';

  const newBlock = \`<div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
  <div style="display:flex; gap:10px; margin-bottom:15px;">
    <div style="flex:1;">
      <label \${labelClass}>From Month</label>
      <input type="month" id="perf-range-from-\${prefix}" \${inputClass} />
    </div>
    <div style="flex:1;">
      <label \${labelClass}>To Month</label>
      <input type="month" id="perf-range-to-\${prefix}" \${inputClass} />
    </div>
  </div>
  <button class="btn btn-blue" \${btnClass} onclick="\${functionCall}">Generate Custom Report</button>
</div>\`;

  if (content.match(regex)) {
    content = content.replace(regex, newBlock);
    console.log('Replaced block for ' + prefix);
  } else {
    console.log('Could not find block for ' + prefix);
  }
};

replaceCustomBlock('div', 'loadDivisionPerf(true)');
replaceCustomBlock('ind', 'fetchIndividualAllData(true)');
replaceCustomBlock('com', 'fetchCommercialData(true)');
replaceCustomBlock('pt', 'fetchProductTeamData(true)');
replaceCustomBlock('rt', 'fetchRepairTeamData(true)');

const jsRegex = /function getPeriodValue\\(prefix\\) \\{[\\s\\S]*?return null;\\n\\}/;
const newJs = \`function getPeriodValue(prefix) {
  const from = document.getElementById('perf-range-from-' + prefix).value;
  const to = document.getElementById('perf-range-to-' + prefix).value;
  if (!from || !to) { toast('Please select both From and To months', 'error'); return null; }
  return from + ':' + to;
}\`;

if (content.match(jsRegex)) {
  content = content.replace(jsRegex, newJs);
  console.log('Patched JS helper');
} else {
  console.log('Could not find JS helper');
}

fs.writeFileSync(FILE_PATH, content);
console.log('Done');
