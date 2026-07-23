const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'public', 'Reports.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. Add sub-tab button
if (!html.includes('id="pst-commercial"')) {
  html = html.replace(
    `<button class="perf-subtab" id="pst-individual" onclick="switchPerfSubTab('individual')">&#128100; Individual</button>`,
    `<button class="perf-subtab" id="pst-individual" onclick="switchPerfSubTab('individual')">&#128100; Individual</button>\n          <button class="perf-subtab" id="pst-commercial" onclick="switchPerfSubTab('commercial')">&#128188; Commercial</button>`
  );
}

// 2. Add sub-pane switching logic
if (!html.includes("tab === 'commercial' ? 'block' : 'none'")) {
  html = html.replace(
    `document.getElementById('perf-ind-pane').style.display = tab === 'individual' ? 'block' : 'none';`,
    `document.getElementById('perf-ind-pane').style.display = tab === 'individual' ? 'block' : 'none';\n    const comPane = document.getElementById('perf-com-pane');\n    if (comPane) comPane.style.display = tab === 'commercial' ? 'block' : 'none';`
  );
}

const commercialPaneHTML = `
      <!-- COMMERCIAL SUB-TAB -->
      <div id="perf-com-pane" class="perf-subpane" style="display:none;">
        <div class="perf-layout">
          <div class="perf-builder">
            <div class="perf-head">
              <div class="perf-head-title">&#128188; Commercial Performance Analysis</div>
              <div class="perf-head-sub">Division-wise calculations for FRN, TO, TO/SO, and SR</div>
            </div>
            <div class="perf-body">
              <div class="fg">
                <div class="fg-field">
                  <label>Select Month</label>
                  <input type="month" id="perf-com-month" onchange="fetchCommercialData()" />
                </div>
              </div>
            </div>
          </div>
          <div class="perf-view" style="flex:2;">
            <div class="perf-head">
              <div class="perf-head-title">Commercial Report</div>
            </div>
            <div class="perf-body" id="perf-com-result">
              <div class="empty-sub">Select a month to view the commercial performance report.</div>
            </div>
          </div>
        </div>
      </div>
`;

// Insert the HTML before `<script>`
if (!html.includes('id="perf-com-pane"')) {
  // Find the closing div of tab-performance, or right before `<script>`
  // A safe place is right before `</main>` or `<script>`
  let idx = html.lastIndexOf('</main>');
  if (idx !== -1) {
    html = html.slice(0, idx) + commercialPaneHTML + html.slice(idx);
  } else {
    idx = html.indexOf('<script>');
    html = html.slice(0, idx) + commercialPaneHTML + html.slice(idx);
  }
}

const commercialJS = `
async function fetchCommercialData() {
  const month = document.getElementById('perf-com-month').value;
  if (!month) return;
  const res = document.getElementById('perf-com-result');
  res.innerHTML = '<div class="empty-sub">Loading commercial data...</div>';
  try {
    const r = await fetch('/api/reports/performance/commercial?month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    if (Object.keys(d.data).length === 0) {
      res.innerHTML = '<div class="empty-sub">No data available for this month.</div>';
      return;
    }
    
    let html = \`<div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;">Commercial Report - \${month}</h3>
      <button class="btn btn-green" onclick="exportCommercialPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
    </div>
    <div id="commercial-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">\`;
    
    // Sort divisions alphabetically
    const divisions = Object.keys(d.data).sort((a,b) => a.localeCompare(b));
    
    for (const div of divisions) {
      const metrics = d.data[div];
      html += \`<div style="margin-bottom:30px; page-break-inside: avoid;">
        <h4 style="margin:0 0 10px 0; background:#0f172a; color:#fff; padding:8px 12px; border-radius:4px;">\${div}</h4>
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
          <thead>
            <tr>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Report Type</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&lt; 1 day</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">1 to 2 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&gt; 2 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center; color:#0f172a;">Total</th>
            </tr>
          </thead>
          <tbody>\`;
          
      for (const m of ['FRN', 'TO', 'TO/SO', 'SR']) {
        const val = metrics[m];
        const t = val.total || 0;
        const p1 = t > 0 ? Math.round((val['< 1 day']/t)*100) : 0;
        const p2 = t > 0 ? Math.round((val['1 to 2 days']/t)*100) : 0;
        const p3 = t > 0 ? Math.round((val['> 2 days']/t)*100) : 0;
        
        html += \`
            <tr>
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600; color:#334155;">\${m}</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${val['< 1 day']} <br><span style="color:#64748b;font-size:11px;">(\${p1}%)</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${val['1 to 2 days']} <br><span style="color:#64748b;font-size:11px;">(\${p2}%)</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${val['> 2 days']} <br><span style="color:#64748b;font-size:11px;">(\${p3}%)</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">\${t}</td>
            </tr>\`;
      }
      html += \`</tbody></table></div>\`;
    }
    
    html += \`</div>\`;
    res.innerHTML = html;
  } catch (e) {
    res.innerHTML = '<div style="color:red;padding:20px;">Error loading data: ' + e.message + '</div>';
  }
}

async function exportCommercialPDF() {
  const el = document.getElementById('commercial-pdf-content');
  if (!el) return;
  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'Commercial_Performance.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(el).save();
}
`;

if (!html.includes('fetchCommercialData')) {
  // Insert at the bottom of the script, before </body>
  const idx = html.lastIndexOf('</body>');
  if (idx !== -1) {
    html = html.slice(0, idx) + '\n<script>\n' + commercialJS + '\n</script>\n' + html.slice(idx);
  }
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('patched Reports.html');
