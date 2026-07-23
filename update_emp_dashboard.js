const fs = require('fs');
let htmlFile = 'frontend/public/employee-dashboard.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// 1. Add to SUBMIT_REPORT_BOXES
const boxSearch = `    { panelId:'pirequest-tracker-body', icon:'&#128196;', title:'PI Request', schedule:'5th' }`;
const boxReplace = `    { panelId:'pirequest-tracker-body', icon:'&#128196;', title:'PI Request', schedule:'5th' },
    { panelId:'opencallreview-tracker-body', icon:'&#128269;', title:'Open Call Review', schedule:'Daily (exc. 3rd Sat)' }`;
html = html.replace(boxSearch, boxReplace);

// 2. Add getNonSundayNonThirdSaturdayDates logic in employee-dashboard.html
// Let's inject the function near getDaysInMonth
const fnSearch = `  function getDaysInMonth(year, monthIndex, dayOfWeek) {`;
const fnReplace = `  function getNonSundayNonThirdSaturdayDates(year, monthIndex) {
    let d = new Date(year, monthIndex, 1), days = [];
    let saturdayCount = 0;
    while (d.getMonth() === monthIndex) {
      if (d.getDay() === 6) saturdayCount++;
      const isThirdSaturday = (d.getDay() === 6 && saturdayCount === 3);
      if (d.getDay() !== 0 && !isThirdSaturday) {
        days.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  function getDaysInMonth(year, monthIndex, dayOfWeek) {`;
html = html.replace(fnSearch, fnReplace);

// 3. Add to loadWeeklyTrackers
const callSearch = `    renderTrackerPanel('pirequest-tracker-body', getMonthDates(year, monthIndex, [5]), submissions, 'PIRequest', monthStr);`;
const callReplace = `    renderTrackerPanel('pirequest-tracker-body', getMonthDates(year, monthIndex, [5]), submissions, 'PIRequest', monthStr);
    renderTrackerPanel('opencallreview-tracker-body', getNonSundayNonThirdSaturdayDates(year, monthIndex), submissions, 'OpenCallReview', monthStr);`;
html = html.replace(callSearch, callReplace);

// 4. Also add the HTML div for the new panel in the fallback template? Wait, ensureSubmitReportBoxes generates it automatically based on SUBMIT_REPORT_BOXES! But wait, there are hardcoded divs in the HTML for the others (lines 610-636).
// Let's replace the grid div to include the new one.
const gridSearch = `      <div class="panel">
        <div class="panel-header"><div class="panel-title">&#128196; PI Request <span style="font-size:10px;color:var(--muted);font-weight:400;">(5th)</span></div></div>
        <div class="panel-body" id="pirequest-tracker-body"><div style="color:var(--muted);font-size:13px;">Loading...</div></div>
      </div>
    </div>`;
const gridReplace = `      <div class="panel">
        <div class="panel-header"><div class="panel-title">&#128196; PI Request <span style="font-size:10px;color:var(--muted);font-weight:400;">(5th)</span></div></div>
        <div class="panel-body" id="pirequest-tracker-body"><div style="color:var(--muted);font-size:13px;">Loading...</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">&#128269; Open Call Review <span style="font-size:10px;color:var(--muted);font-weight:400;">(Daily exc. 3rd Sat)</span></div></div>
        <div class="panel-body" id="opencallreview-tracker-body"><div style="color:var(--muted);font-size:13px;">Loading...</div></div>
      </div>
    </div>`;
html = html.replace(gridSearch, gridReplace);

fs.writeFileSync(htmlFile, html);
console.log('Employee dashboard updated');
