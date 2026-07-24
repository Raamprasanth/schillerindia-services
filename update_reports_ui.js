const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Add Tab Button
if (!html.includes('id="pst-productteam"')) {
  html = html.replace(
    '<button class="perf-subtab" id="pst-repairteam" onclick="switchPerfSubTab(\'repairteam\')">&#128736; Repair Team</button>',
    '<button class="perf-subtab" id="pst-repairteam" onclick="switchPerfSubTab(\'repairteam\')">&#128736; Repair Team</button>\n          <button class="perf-subtab" id="pst-productteam" onclick="switchPerfSubTab(\'productteam\')">&#128188; Product Team</button>'
  );
}

// 2. Add Pane HTML right before </section> (which is the end of #perf-analysis section)
// Wait, the safest is to find `<!-- REPAIR TEAM SUB-TAB -->` and inject after the repairteam-pane ends.
// A safe way is to find the function loadRepairTeamReport and put loadProductTeamReport next to it.
const paneHtml = `
      <!-- PRODUCT TEAM SUB-TAB -->
      <div id="perf-productteam-pane" class="perf-subpane" style="display:none;">
        <div class="perf-layout">
          <div class="perf-builder">
            <div class="perf-head">
              <div class="perf-head-title">&#128188; Product Team Performance Analysis</div>
              <div class="perf-head-sub">Analysis for PT Call, PT Daily Work and BIR List Tracker</div>
            </div>
            <div class="perf-body">
              <div class="form-group">
                <label>Month</label>
                <input type="month" id="perf-productteam-month" class="input">
              </div>
              <button class="btn btn-green" onclick="loadProductTeamReport()" style="width:100%;">Generate Report</button>
            </div>
          </div>
          <div class="perf-view" style="flex:2;">
            <div class="perf-head">
              <div class="perf-head-title">Product Team Report</div>
            </div>
            <div class="perf-body" id="perf-productteam-result">
              <div class="empty-sub">Select a month to view the product team performance report.</div>
            </div>
          </div>
        </div>
      </div>
`;

if (!html.includes('id="perf-productteam-pane"')) {
  html = html.replace(
    '<!-- REPAIR TEAM SUB-TAB -->',
    paneHtml + '\n\n      <!-- REPAIR TEAM SUB-TAB -->'
  );
}

// 3. Update switchPerfSubTab logic
html = html.replace(
  "['division', 'individual', 'commercial', 'repairteam']",
  "['division', 'individual', 'commercial', 'repairteam', 'productteam']"
);

fs.writeFileSync(file, html);
console.log('UI updated for Product Team.');
