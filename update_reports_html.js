const fs = require('fs');
let html = fs.readFileSync('frontend/public/Reports.html', 'utf8');

// 1. Update loadDivisionPerf
html = html.replace(
  /const month=document\.getElementById\('perf-month-div'\)\.value;\s+if\(!month\)\{toast\('Please select a month','error'\);return;\}/g,
  `const startM = document.getElementById('perf-start-month-div').value;
  const endM = document.getElementById('perf-end-month-div').value;
  const boundaries = calculateMonthBoundaryDates(startM, endM);
  if(!boundaries){ toast('Please select valid Start and End months','error'); return; }
  const { from, to, title } = boundaries;`
);

// Update loadDivisionPerf parameters mapping
html = html.replace(
  /const params=\{scope:'division',month,division:div\};/g,
  `const params={scope:'division',from,to,division:div};`
);

// Update loadDivisionPerf period title mapping
html = html.replace(
  /document\.getElementById\('perf-div-out-meta'\)\.textContent=`Period: \$\{params\.month\}`;/g,
  `document.getElementById('perf-div-out-meta').textContent=\`Period: \$\{title\}\`;`
);
html = html.replace(
  /const key='perf_comment_div_'\+params\.division\+'_'\+params\.month;/g,
  `const key='perf_comment_div_'+params.division+'_'+params.from+'_'+params.to;`
);

// 2. Update loadPerfSummary
html = html.replace(
  /const month = document\.getElementById\('perf-month'\)\.value;\s+const employee = document\.getElementById\('perf-employee'\)\.value;\s+const division = document\.getElementById\('perf-emp-division'\)\?\.value \|\| '';\s+if\(!month\)\{ toast\('Please select a month', 'error'\); return; \}/g,
  `const startM = document.getElementById('perf-start-month-ind').value;
  const endM = document.getElementById('perf-end-month-ind').value;
  const boundaries = calculateMonthBoundaryDates(startM, endM);
  if(!boundaries){ toast('Please select valid Start and End months', 'error'); return; }
  const { from, to, title } = boundaries;
  const employee = document.getElementById('perf-employee').value;
  const division = document.getElementById('perf-emp-division')?.value || '';`
);

// Update loadPerfSummary parameters mapping
html = html.replace(
  /const params = \{ scope:'employee', month, employee, division \};/g,
  `const params = { scope:'employee', from, to, employee, division };`
);

// Update loadPerfSummary period title mapping
html = html.replace(
  /document\.getElementById\('perf-out-meta'\)\.textContent = `Period: \$\{month\}\$\{division \? ' \| Division: ' \+ division : ''\}`;/g,
  `document.getElementById('perf-out-meta').textContent = \`Period: \$\{title\}\$\{division ? ' | Division: ' + division : ''\}\`;`
);
html = html.replace(
  /const key = 'perf_comment_' \+ employee \+ '_' \+ month;/g,
  `const key = 'perf_comment_' + employee + '_' + from + '_' + to;`
);

// 3. Update loadLeaderboard
html = html.replace(
  /const month=\(isDivisionPane \? document\.getElementById\('perf-month-div'\) : document\.getElementById\('perf-month'\)\)\.value;\s+if\(!month\)\{\s+toast\('Please select a month first','error'\);/g,
  `const startMDiv = document.getElementById('perf-start-month-div')?.value;
    const endMDiv = document.getElementById('perf-end-month-div')?.value;
    const startMInd = document.getElementById('perf-start-month-ind')?.value;
    const endMInd = document.getElementById('perf-end-month-ind')?.value;
    const bDiv = startMDiv && endMDiv ? calculateMonthBoundaryDates(startMDiv, endMDiv) : null;
    const bInd = startMInd && endMInd ? calculateMonthBoundaryDates(startMInd, endMInd) : null;
    const boundaries = isDivisionPane ? bDiv : bInd;
    if(!boundaries){
      toast('Please select valid Start and End months first','error');`
);
html = html.replace(
  /Computing all divisions for \$\{month\}\.\.\./g,
  `Computing all divisions for \$\{boundaries.title\}...`
);
html = html.replace(
  /const qs=new URLSearchParams\(\{scope:isDivisionPane\?'division':'employee', month\}\)\.toString\(\);/g,
  `const qs=new URLSearchParams({scope:isDivisionPane?'division':'employee', from: boundaries.from, to: boundaries.to}).toString();`
);

// 4. Update loadCommercialPerf
html = html.replace(
  /const month=document\.getElementById\('perf-month'\)\.value;\s+if\(!month\)\{toast\('Please select a month','error'\);return;\}/g,
  `const startM = document.getElementById('perf-start-month-com').value;
  const endM = document.getElementById('perf-end-month-com').value;
  const boundaries = calculateMonthBoundaryDates(startM, endM);
  if(!boundaries){ toast('Please select valid Start and End months','error'); return; }
  const { from, to, title } = boundaries;`
);
html = html.replace(
  /const qs=new URLSearchParams\(\{division:div, month\}\)\.toString\(\);/g,
  `const qs=new URLSearchParams({division:div, from, to}).toString();`
);
html = html.replace(
  /document\.getElementById\('perf-com-out-meta'\)\.textContent=`Period: \$\{month\}`;/g,
  `document.getElementById('perf-com-out-meta').textContent=\`Period: \$\{title\}\`;`
);

// 5. Update loadRepairTeamPerf
html = html.replace(
  /const month = document\.getElementById\('perf-month-div'\)\?\.value \|\| getCurrentMonthValue\(\);/g,
  `const startM = document.getElementById('perf-start-month-rt').value;
  const endM = document.getElementById('perf-end-month-rt').value;
  const boundaries = calculateMonthBoundaryDates(startM, endM);
  if(!boundaries){ toast('Please select valid Start and End months','error'); return; }
  const { from, to, title } = boundaries;`
);
html = html.replace(
  /const qs = new URLSearchParams\(\{ division: div, month \}\)\.toString\(\);/g,
  `const qs = new URLSearchParams({ division: div, from, to }).toString();`
);
html = html.replace(
  /document\.getElementById\('perf-rt-out-meta'\)\.textContent = `Period: \$\{month\}`;/g,
  `document.getElementById('perf-rt-out-meta').textContent = \`Period: \$\{title\}\`;`
);

fs.writeFileSync('frontend/public/Reports.html', html);
console.log('Done');
