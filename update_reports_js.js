const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// Fix button onclick
html = html.replace('onclick="loadProductTeamReport()"', 'onclick="fetchProductTeamData()"');

// Append JS functions
const jsFunctions = `
async function fetchProductTeamData() {
  const month = document.getElementById('perf-productteam-month').value;
  if (!month) {
    toast('Please select a month first', 'error');
    return;
  }
  const res = document.getElementById('perf-productteam-result');
  res.innerHTML = '<div class="empty-sub">Loading product team data...</div>';
  try {
    const r = await fetch('/api/reports/performance/productteam?month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    const { employees, birData } = d.data;
    
    let reportHtml = \`<div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;">Product Team Report - \${month}</h3>
      <button class="btn btn-green" onclick="exportProductTeamPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
    </div>
    <div id="productteam-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">
      <h3 style="text-align:center; font-family:'Syne',sans-serif; margin-bottom:20px;">Product Team Performance Analysis - \${d.data.month}</h3>
      
      <!-- Employee Table -->
      <h4 style="font-family:'Inter',sans-serif; margin-bottom:10px;">Employee Performance (Total Working Days: \${d.data.workingDays})</h4>
      <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px; margin-bottom:30px;">
        <thead>
          <tr>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Employee</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">PT Call (Entered)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">PT Daily Work (Entered)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Overall %</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Remark</th>
          </tr>
        </thead>
        <tbody>
\`;

    for (const emp of employees) {
      reportHtml += \`
          <tr>
            <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600;">\${emp.employee}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${emp.callScore}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${emp.workScore}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">\${emp.completionRate}%</td>
            <td style="border:1px solid #cbd5e1; padding:10px;">\${emp.remark}</td>
          </tr>
      \`;
    }
    
    reportHtml += \`
        </tbody>
      </table>
      
      <!-- BIR List Table -->
      <h4 style="font-family:'Inter',sans-serif; margin-bottom:10px;">BIR List Tracker (< 7 Days)</h4>
      <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
        <thead>
          <tr>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Division</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Total BIR Created</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Moved to PTCBIR (< 7 Days)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Completion %</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Remark</th>
          </tr>
        </thead>
        <tbody>
\`;

    for (const bir of birData) {
      reportHtml += \`
          <tr>
            <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600;">\${bir.division}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${bir.total}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${bir.completed}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">\${bir.rate}%</td>
            <td style="border:1px solid #cbd5e1; padding:10px;">\${bir.remark}</td>
          </tr>
      \`;
    }

    reportHtml += \`
        </tbody>
      </table>
    </div>\`;

    res.innerHTML = reportHtml;

  } catch (error) {
    console.error(error);
    res.innerHTML = \`<div class="empty-sub" style="color:#ef4444;">Failed to load data: \${error.message}</div>\`;
  }
}

async function exportProductTeamPDF() {
  const el = document.getElementById('productteam-pdf-content');
  if (!el) return;
  const month = document.getElementById('perf-productteam-month').value || 'Report';
  await generatePremiumPDF(el.innerHTML, 'PRODUCT TEAM PERFORMANCE REPORT', 'All Divisions', month, 'ProductTeam_Performance');
}
`;

if (!html.includes('function exportProductTeamPDF')) {
  // Append right before closing </script>
  html = html.replace('</script>\\n</body>', jsFunctions + '\\n</script>\\n</body>');
  // if not found with \n, try with normal matching
  html = html.replace(/<\/script>\s*<\/body>/, jsFunctions + '\n</script>\n</body>');
  fs.writeFileSync(file, html);
  console.log('Appended Product Team JS functions');
} else {
  console.log('Product team functions already exist.');
}
