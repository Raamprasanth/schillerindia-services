const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Replace the UI block for perf-ind-pane
const startMarker = '<!-- INDIVIDUAL SUB-TAB -->';
const endMarker = '<!-- COMMERCIAL SUB-TAB -->';
const newPaneHtml = `<!-- INDIVIDUAL SUB-TAB -->
      <div id="perf-ind-pane" class="perf-subpane" style="display:none;">
        <div class="perf-layout">
          <div class="perf-builder" style="flex:0 0 320px;">
            <div class="perf-head">
              <div class="perf-head-title">&#128100; Individual Performance</div>
              <div class="perf-head-sub">All Service Team Employees</div>
            </div>
            <div class="perf-body" style="padding:24px;">
              <div style="margin-bottom:15px;">
                <label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Month</label>
                <input type="month" id="perf-indall-month" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;color:#0f172a;">
              </div>
              <button class="btn btn-green" onclick="fetchIndividualAllData()" style="width:100%;">Generate Report</button>
            </div>
          </div>
          <div class="perf-output" style="flex:1;">
            <div id="perf-indall-result" style="height:100%;">
              <div class="empty-state" style="padding:40px;text-align:center;">
                <div class="empty-icon" style="font-size:48px;color:#cbd5e1;margin-bottom:16px;">&#128100;</div>
                <div class="empty-title" style="font-size:18px;font-weight:700;color:#334155;">No Report Generated</div>
                <div class="empty-sub" style="color:#64748b;margin-top:8px;">Select a month and click Generate Report.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      `;

const paneRegex = /<!-- INDIVIDUAL SUB-TAB -->[\s\S]*?<!-- COMMERCIAL SUB-TAB -->/;
html = html.replace(paneRegex, newPaneHtml + '<!-- COMMERCIAL SUB-TAB -->');

// 2. Append JS functions
const newJs = `

async function fetchIndividualAllData() {
  const month = document.getElementById('perf-indall-month').value;
  if (!month) {
    toast('Please select a month', 'error');
    return;
  }
  const resEl = document.getElementById('perf-indall-result');
  resEl.innerHTML = '<div class="empty-state" style="padding:40px;"><div class="empty-sub">Loading employee data...</div></div>';
  
  try {
    const r = await fetch('/api/reports/performance/summary?scope=employee&month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    const data = d.data;
    if (!data.employees || data.employees.length === 0) {
      resEl.innerHTML = '<div class="empty-state" style="padding:40px;"><div class="empty-sub">No employee data available for this month.</div></div>';
      return;
    }
    
    let html = \`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:24px 24px 0 24px;">
        <div>
          <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;font-size:20px;">Individual Performance Analysis</h3>
          <div style="color:#64748b;font-size:14px;margin-top:4px;">Month: \${data.month} &bull; Working Days: \${data.workingDays}</div>
        </div>
        <button class="btn btn-green" onclick="exportIndividualAllPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
      </div>
      
      <div id="indall-pdf-content" style="padding:0 24px 24px 24px;">
        <h4 style="font-family:'Inter',sans-serif;margin-bottom:10px;font-size:15px;color:#334155;">Employee Track Records</h4>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px; text-align:center;">
            <thead>
              <tr>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Employee</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px;">Call Entries Updated</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px;">Daily Work Updated</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px;">Open Call Review</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px;">Total Tracked Days</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; color:#0f172a;">Completion %</th>
                <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Remark</th>
              </tr>
            </thead>
            <tbody>
    \`;
    
    for (const emp of data.employees) {
      const totCompleted = emp.callScore + emp.workScore + emp.reviewScore;
      const totTracked = data.workingDays * 3;
      html += \`
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:600; color:#334155;">\${emp.employee}</td>
          <td style="border:1px solid #cbd5e1; padding:10px;">\${emp.callScore} / \${data.workingDays}</td>
          <td style="border:1px solid #cbd5e1; padding:10px;">\${emp.workScore} / \${data.workingDays}</td>
          <td style="border:1px solid #cbd5e1; padding:10px;">\${emp.reviewScore} / \${data.workingDays}</td>
          <td style="border:1px solid #cbd5e1; padding:10px;">\${totCompleted} / \${totTracked}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; font-weight:700; color:\${emp.completionRate >= 90 ? '#059669' : (emp.completionRate >= 75 ? '#ca8a04' : '#dc2626')};">\${emp.completionRate}%</td>
          <td style="border:1px solid #cbd5e1; padding:10px; text-align:left;">\${emp.remark}</td>
        </tr>
      \`;
    }
    
    html += \`
            </tbody>
          </table>
        </div>
      </div>
    \`;
    
    resEl.innerHTML = html;
  } catch(e) {
    resEl.innerHTML = '<div style="color:red;padding:40px;">Error: ' + e.message + '</div>';
  }
}

async function exportIndividualAllPDF() {
  const el = document.getElementById('indall-pdf-content');
  if (!el) return;
  const month = document.getElementById('perf-indall-month').value || 'Report';
  await generatePremiumPDF(el.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', 'All Employees', month, 'Individual_Performance');
}
`;

html = html.replace('// -- INIT', newJs + '\n  // -- INIT');

fs.writeFileSync(file, html);
console.log('Frontend logic updated for Individual Analysis');
