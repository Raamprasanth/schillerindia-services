
// -- NAV HELPERS -----------------------------------------------
function toggleSF(){document.getElementById('sf-children').classList.toggle('open');document.getElementById('sf-toggle').classList.toggle('open');}
function toggleAR(){document.getElementById('ar-children').classList.toggle('open');document.getElementById('ar-toggle').classList.toggle('open');}
function toggleRTA(){document.getElementById('rta-children')?.classList.toggle('open');document.getElementById('rta-toggle')?.classList.toggle('open');}
function logout(){sessionStorage.clear(); localStorage.clear();window.location.href='login.html';}

// -- AUTH ------------------------------------------------------
const token=sessionStorage.getItem('schiller_token')||'';
function hdrs(){return{'Content-Type':'application/json','Authorization':'Bearer '+token};}

// -- TAB SWITCHING ---------------------------------------------
let currentTab='performance';
let kanbanLoaded=false;
function switchTab(tab){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  const idx={'generator':0,'performance':1,'analytics':2,'history':3,'kanban':4}[tab]||0;
  document.querySelectorAll('.tab-btn')[idx].classList.add('active');
  currentTab=tab;
  if(tab==='analytics' && !analyticsLoaded) loadAnalyticsCharts();
  if(tab==='history' && !histLoaded) loadHistory(1);
  if(tab==='performance' && !perfOptionsLoaded) loadPerfOptions();
  if(tab==='kanban' && !kanbanLoaded) { loadKanbanBoard(); kanbanLoaded = true; }
}

// -- TOAST -----------------------------------------------------
function toast(msg,type='info'){
  const wrap=document.getElementById('toast-wrap');
  const t=document.createElement('div');
  t.className='toast '+type;
  const icons={success:'&#10004;',error:'&#10006;',info:'&#8505;'};
  t.innerHTML=`<span>${icons[type]||'&#8505;'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(8px)';t.style.transition='all 0.25s';setTimeout(()=>t.remove(),260);},3500);
}

// -- USER INFO -------------------------------------------------
(function(){
  try{const u=JSON.parse(atob(token.split('.')[1]));const n=u.name||u.username||'Admin';document.getElementById('admin-name').textContent=n;document.getElementById('admin-avatar').textContent=n[0].toUpperCase();}catch(e){}
})();

// --------------------------------------------------------------
//  TAB 1  AI GENERATOR
// --------------------------------------------------------------

let dateMode='preset';
function setDateMode(mode,btn){
  dateMode=mode;
  document.querySelectorAll('.date-range-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('date-preset').style.display=mode==='preset'?'block':'none';
  document.getElementById('date-custom').style.display=mode==='custom'?'block':'none';
}

function updateCharCount(el){
  document.getElementById('char-count').textContent=el.value.length;
}

let currentReport=null;

async function generateReport(){
  const reportType=document.getElementById('report-type').value;
  const format=document.getElementById('report-format').value;
  const title=document.getElementById('report-title').value.trim();
  const customPrompt=document.getElementById('custom-prompt').value.trim();
  const division=document.getElementById('filter-division').value;
  const region=document.getElementById('filter-region').value;

  let dateRange={};
  if(dateMode==='preset'){
    dateRange={days:parseInt(document.getElementById('date-days').value)};
  } else {
    const from=document.getElementById('date-from').value;
    const to=document.getElementById('date-to').value;
    if(!from||!to){toast('Please select both from and to dates.','error');return;}
    dateRange={from,to};
  }

  const body={reportType,dateRange,filters:{division,region},format,customPrompt,title};

  // Show loading
  const btn=document.getElementById('gen-btn');
  btn.disabled=true;
  btn.innerHTML='? Generating';
  document.getElementById('output-body').innerHTML=`
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-title">Generating AI Report</div>
      <div class="loading-sub">Gemini is analysing your data. This may take 1030 seconds.</div>
    </div>`;
  document.getElementById('output-actions').style.display='none';
  document.getElementById('output-title').textContent='Generating';
  document.getElementById('output-meta').textContent='Please wait';

  try{
    const res=await fetch('/api/reports/generate',{method:'POST',headers:hdrs(),body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||'Generation failed');

    currentReport=data;
    renderReport(data);
    loadStats();
    toast('Report generated successfully!','success');
  }catch(e){
    document.getElementById('output-body').innerHTML=`
      <div class="empty-state">
        <div class="empty-icon">?</div>
        <div class="empty-title">Generation Failed</div>
        <div class="empty-sub">${e.message}</div>
      </div>`;
    document.getElementById('output-title').textContent='Failed';
    document.getElementById('output-meta').textContent=e.message;
    toast('Generation failed: '+e.message,'error');
  } finally {
    btn.disabled=false;
    btn.innerHTML='&#10024; Generate AI Report';
  }
}

function renderReport(data){
  const typeLabels={service_summary:'Service Summary',pending_frn:'Pending FRN',under_repair:'Under Repair',ob_pending:'OB Pending',estimation_pending:'Estimation Pending',engineer_performance:'Engineer Performance',division_analytics:'Division Analytics',escalation_report:'Escalation Report'};
  const formatLabels={detailed:'Detailed',summary:'Summary',technical:'Technical',action:'Action'};
  const fmtBadge={detailed:'badge-blue',summary:'badge-green',technical:'badge-purple',action:'badge-amber'};

  document.getElementById('output-title').textContent=data.title||'AI Report';
  const genMs=data.generationTimeMs||data.aiUsage?.generationTimeMs||0;
  document.getElementById('output-meta').textContent=`Generated ${new Date(data.createdAt||Date.now()).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}  ${genMs>0?(genMs/1000).toFixed(1)+'s':''}  ${data.aiUsage?.model||''}`;
  document.getElementById('output-actions').style.display='flex';

  const divVal=(data.filters?.division&&data.filters.division!=='all')?data.filters.division:'All Divisions';
  const regVal=(data.filters?.region&&data.filters.region!=='all')?data.filters.region:'All Regions';
  const periodVal=data.dateRange?.days?`Last ${data.dateRange.days} days`:`${data.dateRange?.from||''} ? ${data.dateRange?.to||''}`;

  const html=`
    <div class="report-meta-bar">
      <span class="meta-chip red">&#128221; ${typeLabels[data.reportType]||data.reportType}</span>
      <span class="meta-chip ${fmtBadge[data.format]||''}">&#128203; ${formatLabels[data.format]||data.format}</span>
      <span class="meta-chip">&#128197; ${periodVal}</span>
      <span class="meta-chip blue">&#127986; ${divVal}</span>
      <span class="meta-chip">&#128205; ${regVal}</span>
    </div>
    <div class="md-content" id="md-output"></div>`;
  document.getElementById('output-body').innerHTML=html;

  try{
    if(typeof marked!=='undefined'){
      document.getElementById('md-output').innerHTML=marked.parse(data.content||'No content.');
    } else {
      document.getElementById('md-output').textContent=data.content||'No content.';
    }
  } catch(e){
    document.getElementById('md-output').textContent=data.content||'No content.';
  }
}

function copyReport(){
  if(!currentReport) return;
  navigator.clipboard.writeText(currentReport.content||'').then(()=>toast('Report copied to clipboard','success')).catch(()=>toast('Copy failed','error'));
}

function printReport(){
  const content=document.getElementById('md-output');
  if(!content){toast('No report to print','error');return;}
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>Report</title><style>body{font-family:sans-serif;max-width:900px;margin:40px auto;line-height:1.7;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:8px 12px;} th{background:#f4f7fa;} h1,h2,h3{font-weight:700;} blockquote{border-left:3px solid #b91c1c;padding:8px 14px;background:#fff5f5;margin:10px 0;}</style></head><body>${content.innerHTML}<\/script>
</body></html>`);
  w.document.close();w.print();
}

// -- LOAD STATS ------------------------------------------------
async function loadStats(){
  try{
    const res=await fetch('/api/reports/stats',{headers:hdrs()});
    if(!res.ok)return;
    const d=await res.json();
    document.getElementById('stat-total').textContent=d.total??'';
    document.getElementById('stat-month').textContent=d.thisMonth??'';
    document.getElementById('stat-time').textContent=d.avgTime?d.avgTime+'s':'';
  }catch(e){}
}

// -- LOAD DIVISIONS --------------------------------------------
async function loadDivisions(){
  try{
    const res=await fetch('/api/reports/performance/options',{headers:hdrs()});
    if(!res.ok)return;
    const d=await res.json();
    const divs=d.divisions||[];
    const sel=document.getElementById('filter-division');
    const kanbanSel = document.getElementById('kanban-div-filter');
    sel.innerHTML='<option value="all">All Divisions</option>';
    if(kanbanSel) kanbanSel.innerHTML='<option value="all">All Divisions</option>';
    divs.forEach(div=>{
      const name = div.name || div;
      const o=document.createElement('option');
      o.value=name;o.textContent=name;
      sel.appendChild(o);
      if(kanbanSel) {
        const ko=document.createElement('option');
        ko.value=name;ko.textContent=name;
        kanbanSel.appendChild(ko);
      }
    });
  }catch(e){}
}

// --------------------------------------------------------------
//  TAB 2  PERFORMANCE REVIEW (Enhanced)
// --------------------------------------------------------------

let perfScope='employee'; // Default to individual now, division has its own tab
let perfOptionsLoaded=false;
let perfOptions={divisions:[],employees:[]};
let perfCurrentParams=null;
let trendChartInst=null;
let perfDivCurrentParams=null;
let trendDivChartInst=null;

function getCurrentMonthValue(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function optionLabel(item){
  return item && typeof item === 'object' ? (item.name || item.division || item.label || '') : String(item || '');
}

function setOptions(select, items, placeholder, includeAll = false, includeConsolidated = false){
  if(!select) return;
  const current = select.value;
  let html = '';
  if (includeAll) html += '<option value="all">All Divisions</option>';
  if (includeConsolidated) html += '<option value="consolidated">Consolidated</option>';
  if (!includeAll && !includeConsolidated) html += `<option value="">${placeholder}</option>`;
  html += (items || []).map(item => {
      const label = optionLabel(item);
      return label ? `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>` : '';
  }).join('');
  select.innerHTML = html;
  if([...select.options].some(o => o.value === current)) select.value = current;
}

async function loadPerfOptions(){
  const month = getCurrentMonthValue();
  // Set initial dates to current month
  const today = new Date();
  const currentMonthStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
  ['perf-start-month-div','perf-start-month-ind','perf-start-month-com','perf-start-month-rt'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el.value) el.value = currentMonthStr;
  });
  ['perf-end-month-div','perf-end-month-ind','perf-end-month-com','perf-end-month-rt'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el.value) el.value = currentMonthStr;
  });

  try{
    const res = await fetch('/api/reports/performance/options', { headers: hdrs() });
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.message || 'Could not load performance options');

    perfOptions = {
      divisions: Array.isArray(data.divisions) ? data.divisions : [],
      employees: Array.isArray(data.employees) ? data.employees : [],
    };

    setOptions(document.getElementById('perf-division'), perfOptions.divisions, ' Select Division ');
      setOptions(document.getElementById('perf-com-division'), perfOptions.divisions, '', true, true);
      setOptions(document.getElementById('perf-repairteam-division'), perfOptions.divisions, '', true);
    setOptions(document.getElementById('perf-emp-division'), perfOptions.divisions, " Division (for report) ");
    setOptions(document.getElementById('kanban-div-filter'), perfOptions.divisions, '', true);
    setOptions(document.getElementById('perf-employee'), perfOptions.employees, ' Select Employee ');

    const empSel = document.getElementById('perf-employee');
    if(empSel && !empSel.dataset.boundDivisionSync){
      empSel.dataset.boundDivisionSync = '1';
      empSel.addEventListener('change', () => {
        const emp = (perfOptions.employees || []).find(e => optionLabel(e) === empSel.value);
        const divSel = document.getElementById('perf-emp-division');
        if(divSel && emp && emp.division && [...divSel.options].some(o => o.value === emp.division)) {
          divSel.value = emp.division;
        }
      });
    }

    perfOptionsLoaded = true;
    refreshDivisionSubmissionBoxes();
    return perfOptions;
  }catch(e){
    perfOptionsLoaded = false;
    const divPane = document.getElementById('perf-pane-div-summary');
    if(divPane) {
      divPane.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-icon">&#9888;</div><div class="empty-title">Options Not Loaded</div><div class="empty-sub">${escapeHtml(e.message)}</div></div>`;
    }
    toast('Performance options failed: ' + e.message, 'error');
    throw e;
  }
}

function switchPerfSubTab(tab) {
  document.querySelectorAll('.perf-subtab').forEach(b=>b.classList.remove('active'));
  document.getElementById('pst-'+tab).classList.add('active');
  document.getElementById('perf-div-pane').style.display = tab === 'division' ? 'block' : 'none';
  document.getElementById('perf-ind-pane').style.display = tab === 'individual' ? 'block' : 'none';
  const comPane = document.getElementById('perf-com-pane');
  if (comPane) comPane.style.display = tab === 'commercial' ? 'block' : 'none';
  const rtPane = document.getElementById('perf-repairteam-pane');
  if (rtPane) rtPane.style.display = tab === 'repairteam' ? 'block' : 'none';
  if (tab === 'division') { perfScope = 'division'; } else { perfScope = 'employee'; }
  if (tab === 'division') refreshDivisionSubmissionBoxes();
}

function switchPerfDivTab(tab, btn) {
  document.querySelectorAll('#perf-div-inner-tabs .perf-inner-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['summary','trend','leaderboard'].forEach(t=>{
    const el=document.getElementById('perf-pane-'+t+(t==='summary'?'-div':'-div')); // adjust mapping
    let paneId = t === 'summary' ? 'perf-pane-div-summary' : 'perf-pane-'+t+'-div';
    const paneEl = document.getElementById(paneId);
    if(paneEl) paneEl.style.display=t===tab?'block':'none';
  });
  if(tab==='trend' && perfDivCurrentParams) loadDivTrend();
  if(tab==='leaderboard') loadLeaderboard();
}

function switchPerfTab(tab, btn) {
  document.querySelectorAll('#perf-inner-tabs .perf-inner-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['summary','trend','leaderboard'].forEach(t => {
    const pane = document.getElementById('perf-pane-' + t);
    if(pane) pane.style.display = t === tab ? 'block' : 'none';
  });
  if(tab === 'trend' && perfCurrentParams) loadTrend();
}

async function loadPerfSummary() {
  const month = document.getElementById('perf-month').value;
  const employee = document.getElementById('perf-employee').value;
  const division = document.getElementById('perf-emp-division')?.value || '';
  if(!month){ toast('Please select a month', 'error'); return; }
  if(!employee){ toast('Please select an employee', 'error'); return; }

  const params = { scope:'employee', month, employee, division };
  perfCurrentParams = params;
  const btn = document.getElementById('perf-preview-btn');
  btn.disabled = true;
  btn.innerHTML = '&#9203; Loading';
  document.getElementById('perf-pane-summary').innerHTML = `
    <div class="loading-state"><div class="spinner"></div><div class="loading-title">Loading Employee Data</div></div>`;

  try{
    const qs = new URLSearchParams(params).toString();
    const res = await fetch('/api/reports/performance/summary?' + qs, { headers: hdrs() });
    const d = await res.json();
    if(!res.ok) throw new Error(d.message || 'Failed');

    renderPerfSummary(d.data, params);
    document.getElementById('perf-out-title').textContent = `Employee: ${employee}`;
    document.getElementById('perf-out-meta').textContent = `Month: ${month}${division ? ' | Division: ' + division : ''}`;
    document.getElementById('perf-inner-tabs').style.display = 'flex';
    document.getElementById('perf-comment-section').style.display = 'block';
    const key = 'perf_comment_' + employee + '_' + month;
    document.getElementById('perf-comment').value = localStorage.getItem(key) || '';
    document.getElementById('perf-comment').dataset.key = key;
    switchPerfTab('summary', document.querySelector('#perf-inner-tabs .perf-inner-tab'));
    toast('Employee summary loaded', 'success');
  }catch(e){
    document.getElementById('perf-pane-summary').innerHTML = `
      <div class="empty-state" style="padding:40px;">
        <div class="empty-icon">&#128683;</div>
        <div class="empty-title">Failed to Load</div>
        <div class="empty-sub">${escapeHtml(e.message)}</div>
      </div>`;
    toast('Failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128065; Preview Summary';
  }
}

async function loadDivTrend(){
  if(!perfDivCurrentParams) return;
  const pane = document.getElementById('perf-pane-trend-div');
  pane.innerHTML = `<div class="loading-state"><div class="spinner"></div><div class="loading-title">Loading 6-Month Trend</div></div>`;
  try{
    const p = perfDivCurrentParams;
    const qs = new URLSearchParams({scope:'division', division:p.division || '', months:6}).toString();
    const res = await fetch('/api/reports/performance/trend?' + qs, {headers: hdrs()});
    const d = await res.json();
    if(!res.ok) throw new Error(d.message || 'Failed');
    renderTrendChart(d.trend || [], true);
  }catch(e){
    pane.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-icon">&#9888;</div><div class="empty-title">Trend Failed</div><div class="empty-sub">${escapeHtml(e.message)}</div></div>`;
  }
}

async function loadDivisionPerf() {
  const month=document.getElementById('perf-month-div').value;
  if(!month){toast('Please select a month','error');return;}
  const div=document.getElementById('perf-division').value;
  if(!div){toast('Please select a division','error');return;}

  const params={scope:'division',month,division:div};
  perfDivCurrentParams=params;
  const btn=document.getElementById('perf-preview-btn-div');
  btn.disabled=true;btn.innerHTML='&#9203; Loading';
  document.getElementById('perf-pane-div-summary').innerHTML=`
    <div class="loading-state"><div class="spinner"></div><div class="loading-title">Loading Division Data</div></div>`;
  
  try{
    const qs=new URLSearchParams(params).toString();
    const res=await fetch('/api/reports/performance/summary?'+qs,{headers:hdrs()});
    const d=await res.json();
    if(!res.ok) throw new Error(d.message||'Failed');
    
    renderDivisionPerfSummary(d.data,params);
    document.getElementById('perf-div-out-title').textContent=`&#127986; Division: ${params.division}`;
    document.getElementById('perf-div-out-meta').textContent=`Month: ${params.month}`;
    
    document.getElementById('perf-div-inner-tabs').style.display='flex';
    document.getElementById('perf-div-comment-section').style.display='block';
    
    const key='perf_comment_div_'+params.division+'_'+params.month;
    document.getElementById('perf-div-comment').value=localStorage.getItem(key)||'';
    document.getElementById('perf-div-comment').dataset.key=key;
    switchPerfDivTab('summary',document.querySelector('#perf-div-inner-tabs .perf-inner-tab'));
    toast('Division summary loaded','success');
  }catch(e){
    document.getElementById('perf-pane-div-summary').innerHTML=`
      <div class="empty-state" style="padding:40px;">
        <div class="empty-icon">&#128683;</div>
        <div class="empty-title">Failed to Load</div>
        <div class="empty-sub">${e.message}</div>
      </div>`;
    toast('Failed: '+e.message,'error');
  } finally {
    btn.disabled=false;btn.innerHTML='&#128065; Preview Division';
  }
}

function saveDivComment(){
  const ta=document.getElementById('perf-div-comment');
  if(!ta) return;
  localStorage.setItem(ta.dataset.key, ta.value);
  const saved=document.getElementById('div-comment-saved');
  saved.style.display='block';
  clearTimeout(ta._saveTimer);
  ta._saveTimer=setTimeout(()=>{saved.style.display='none';},1800);
}

function saveComment(){
  const ta=document.getElementById('perf-comment');
  if(!ta) return;
  localStorage.setItem(ta.dataset.key || 'perf_comment_draft', ta.value);
  const saved=document.getElementById('comment-saved');
  if(!saved) return;
  saved.style.display='block';
  clearTimeout(ta._saveTimer);
  ta._saveTimer=setTimeout(()=>{saved.style.display='none';},1800);
}


function generatePerfAnalysisHtml(data, params, scopeType) {
  const rate = data.summary?.completionRate || data.completionRate || 0;
  let remark = 'Needs Improvement';
  if (rate >= 90) remark = 'Excellent';
  else if (rate >= 75) remark = 'Good';
  else if (rate >= 60) remark = 'Average';

  const rows = data.activityRows || data.activities || [];
  const getRow = (label) => rows.find(r => (r.label||'').toLowerCase() === label.toLowerCase()) || {};
  const getVal = (r, key, fallback='-') => r[key] !== undefined && r[key] !== null ? r[key] : fallback;
  const pct = (r, key) => {
    let v = r[key];
    if(v===undefined || v===null) return '-';
    // prevRate & nextRate are stored as fractions (0-1), completionPercent/withinPercent are already 0-100
    const isRateFraction = key === 'prevRate' || key === 'nextRate' || key === 'currentRate';
    return Math.round(isRateFraction ? v * 100 : v) + '%';
  };

  const rFrn = getRow('Pending frn');
  const rFrnCon = getRow('pending FRN con');
  const rSo = getRow('SO Pending');
  const rRepair = getRow('Under Repair');
  const rTo = getRow('TO/SO');
  const rNonSaleable = getRow('Non-Saleable');
  const rBir = getRow('BIR list');
  const rEst = getRow('Estimation');

  const cWeekly = data.compliance?.weeklyCrm ?? 0;
  const cPending = data.compliance?.pendingActivity ?? 0;
  const cNonSaleableTracker = data.compliance?.nonSaleable ?? 0;
  const cSupWarr = data.compliance?.supplierWarranty ?? 0;
  const cCritical = data.compliance?.criticalPending ?? 0;
  const cPI = data.compliance?.purchaseIndent ?? 0;
  const c5S = data.compliance?.fiveSRate ?? 0;
  const cRR = data.compliance?.repairReport ?? 0;

  const monthLabel = params.month || '';
  const employeeLabel = data.employee || params.employee || '';
  const divisionLabel = data.division || params.division || '';

  if (scopeType === 'employee' && data.calculationMode === 'call_daily_work_non_sunday') {
    const workingDays = Number(data.workingDays || 0);
    const sundayExcluded = Number(data.sundayExcluded || 0);
    const completedCount = Number(data.completedCount || data.summary?.completedCount || 0);
    const totalTracked = Number(data.totalTracked || data.summary?.totalTracked || 0);
    const simpleRows = rows.map((row, index) => {
      const done = Number(row.withinTarget || 0);
      const total = Number(row.total || workingDays || 0);
      const missed = Math.max(0, total - done);
      const completion = row.completionPercent ?? row.withinPercent ?? (total ? Math.round((done / total) * 100) : 0);
      return `
        <tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'};">
          <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:left; font-weight:700; color:#334155;">${escapeHtml(row.label || '-')}</td>
          <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; color:#475569;">${total}</td>
          <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; color:#059669; font-weight:800;">${done}</td>
          <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; color:${missed ? '#b91c1c' : '#64748b'}; font-weight:800;">${missed}</td>
          <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; color:#3730a3; font-weight:900; background:#eef2ff;">${completion}%</td>
        </tr>
      `;
    }).join('');

    return `
      <div data-perf-mode="simple-employee" style="font-family:'Inter',system-ui,sans-serif; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:28px; color:#1e293b; width:100%; box-sizing:border-box;">
        <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:22px; border-bottom:2px solid #e2e8f0; padding-bottom:16px;">
          <div>
            <h2 style="margin:0 0 4px 0; font-size:22px; font-weight:800; color:#0f172a;">Individual Performance Analysis</h2>
            <div style="font-size:13px; color:#64748b; font-weight:500;">Call entry and daily work updates only</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Employee: <span style="color:#0f172a; font-size:14px;">${escapeHtml(employeeLabel)}</span></div>
            <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase;">Month: <span style="color:#0f172a; font-size:14px;">${escapeHtml(monthLabel)}</span></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px;">
          <div style="border:1px solid #e2e8f0; background:#f8fafc; border-radius:8px; padding:14px;">
            <div style="font-size:11px; color:#64748b; font-weight:800; text-transform:uppercase;">Working Days</div>
            <div style="font-size:24px; font-weight:900; color:#0f172a; margin-top:4px;">${workingDays}</div>
          </div>
          <div style="border:1px solid #e2e8f0; background:#f8fafc; border-radius:8px; padding:14px;">
            <div style="font-size:11px; color:#64748b; font-weight:800; text-transform:uppercase;">Sundays Excluded</div>
            <div style="font-size:24px; font-weight:900; color:#0f172a; margin-top:4px;">${sundayExcluded}</div>
          </div>
          <div style="border:1px solid #dcfce7; background:#f0fdf4; border-radius:8px; padding:14px;">
            <div style="font-size:11px; color:#166534; font-weight:800; text-transform:uppercase;">Updates Done</div>
            <div style="font-size:24px; font-weight:900; color:#059669; margin-top:4px;">${completedCount}</div>
          </div>
          <div style="border:1px solid #e0e7ff; background:#eef2ff; border-radius:8px; padding:14px;">
            <div style="font-size:11px; color:#3730a3; font-weight:800; text-transform:uppercase;">Overall</div>
            <div style="font-size:24px; font-weight:900; color:#3730a3; margin-top:4px;">${rate}%</div>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; border-radius:8px; overflow:hidden;">
            <thead>
              <tr>
                <th style="background:#0f172a; color:#ffffff; border:1px solid #334155; padding:14px 16px; text-align:left; font-size:12px; text-transform:uppercase;">Calculation</th>
                <th style="background:#0f172a; color:#ffffff; border:1px solid #334155; padding:14px 16px; text-align:center; font-size:12px; text-transform:uppercase;">Expected Days</th>
                <th style="background:#0f172a; color:#ffffff; border:1px solid #334155; padding:14px 16px; text-align:center; font-size:12px; text-transform:uppercase;">Updated Days</th>
                <th style="background:#0f172a; color:#ffffff; border:1px solid #334155; padding:14px 16px; text-align:center; font-size:12px; text-transform:uppercase;">Missing Days</th>
                <th style="background:#0f172a; color:#ffffff; border:1px solid #334155; padding:14px 16px; text-align:center; font-size:12px; text-transform:uppercase;">Score</th>
              </tr>
            </thead>
            <tbody>${simpleRows}</tbody>
            <tfoot>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:14px 16px; font-weight:900; background:#f8fafc;">Total</td>
                <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:900; background:#f8fafc;">${totalTracked}</td>
                <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:900; color:#059669; background:#f8fafc;">${completedCount}</td>
                <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:900; color:${totalTracked - completedCount ? '#b91c1c' : '#64748b'}; background:#f8fafc;">${Math.max(0, totalTracked - completedCount)}</td>
                <td style="border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:900; color:#3730a3; background:#e0e7ff;">${rate}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top:16px; font-size:12px; color:#64748b; line-height:1.5;">
          Sundays are excluded from the selected month. Each remaining day expects one call entry update and one daily work update.
        </div>
        <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
          <button class="btn btn-green" style="padding:10px 18px; font-weight:600; border-radius:8px; font-size:13px;" onclick="exportPDF('emp')">
            <i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF
          </button>
        </div>
      </div>
    `;
  }

  var [yearStr, mStr] = (params.month || '').split('-');
  var yearNum = parseInt(yearStr, 10);
  var monthNum = parseInt(mStr, 10) - 1;

  var tuesdays = [], mondays = [];
  var d02 = '-', d03 = '-', d05 = '-', d16 = '-';
  if (!isNaN(yearNum) && !isNaN(monthNum)) {
    let d = new Date(yearNum, monthNum, 1);
    while (d.getMonth() === monthNum) {
      const fDate = String(d.getDate()).padStart(2,'0') + '-' + mStr + '-' + yearStr;
      if (d.getDay() === 2) tuesdays.push(fDate);
      if (d.getDay() === 1) mondays.push(fDate);
      d.setDate(d.getDate() + 1);
    }
    d02 = '02-' + mStr + '-' + yearStr;
    d03 = '03-' + mStr + '-' + yearStr;
    d05 = '05-' + mStr + '-' + yearStr;
    d16 = '16-' + mStr + '-' + yearStr;
  }
  
  var checkSub = (type, ds) => {
    if (!ds || ds === '-') return `<div style="text-align:center;color:#94a3b8;font-size:12px;">-</div>`;
    const parts = ds.split('-');
    if (parts.length !== 3) return ds;
    const backendDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const subs = (data.compliance && data.compliance.trackerSubmissions && data.compliance.trackerSubmissions[type]) || [];
    
    let countOrHasSub = false;
    let label = '';
    
    if (scopeType === 'division') {
      const uniqueEmps = new Set(subs.filter(s => s.date === backendDate).map(s => s.emp));
      countOrHasSub = uniqueEmps.size > 0;
      label = countOrHasSub ? uniqueEmps.size + ' Submitted' : 'Not Submitted';
    } else {
      countOrHasSub = subs.some(s => s.date === backendDate);
      label = countOrHasSub ? 'Submitted' : 'Not Submitted';
    }

    return `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; width:100%; box-sizing:border-box;">
      <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:6px; letter-spacing:0.5px;">${ds}</div>
      <div style="font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; width:100%; text-align:center; box-sizing:border-box; ${countOrHasSub ? 'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;' : 'background:#fee2e2; color:#991b1b; border:1px solid #fecaca;'}">
        ${label}
      </div>
    </div>`;
  };

  const makeRow = (title, r, isAlt) => {
    const targetDays = r.targetDays != null ? r.targetDays : null;
    const limitCell = targetDays != null
      ? `<td style="border:1px solid #cbd5e1; padding:10px 12px; text-align:center; color:#0369a1; font-weight:700; font-size:13px; background-color:${isAlt ? '#f0f9ff' : '#e0f2fe'};">≤${targetDays} days</td>`
      : `<td style="border:1px solid #cbd5e1; padding:10px 12px; text-align:center; color:#94a3b8; font-size:12px;">-</td>`;
    return `
    <tr style="background-color:${isAlt ? '#f8fafc' : '#ffffff'};">
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:left; font-weight:600; color:#334155; font-size:13px;">${title}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#475569; font-size:13px;">${getVal(r, 'total')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#059669; font-weight:700; font-size:13px;">${getVal(r, 'withinTarget')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#0f172a; font-weight:700; font-size:13px;">${pct(r, 'completionPercent')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#64748b; font-size:13px;">${pct(r, 'prevRate')}</td>
      ${limitCell}
    </tr>
  `;
  };

  const hideFrnCon = scopeType === 'division' && /^(monitors?|ventilators?)$/i.test(divisionLabel.trim());

  const topTable = `
    <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; margin-bottom:28px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden;">
      <thead>
        <tr>
          <th colspan="3" rowspan="2" style="background-color:#0f172a; color:#ffffff; font-size:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase; border:1px solid #334155; padding:16px 20px; text-align:left; width:50%;">PERFORMANCE REVIEW</th>
          <th style="background-color:#f1f5f9; color:#475569; text-align:right; border:1px solid #cbd5e1; padding:12px 16px; font-weight:600; font-size:13px;">For the month of</th>
          <th colspan="2" style="background-color:#ffffff; color:#0f172a; border:1px solid #cbd5e1; padding:12px 16px; font-weight:700; font-size:14px; min-width:120px; text-align:center;">${monthLabel}</th>
        </tr>
        <tr>
          <th style="background-color:#f1f5f9; color:#475569; text-align:right; border:1px solid #cbd5e1; padding:12px 16px; font-weight:600; font-size:13px;">${scopeType === 'division' ? 'Division' : 'Employee'}</th>
          <th colspan="2" style="background-color:#ffffff; color:#0f172a; border:1px solid #cbd5e1; padding:12px 16px; font-weight:700; font-size:14px; text-align:center;">${scopeType === 'division' ? divisionLabel : employeeLabel}</th>
        </tr>
        <tr>
          <th style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:left; font-weight:700; font-size:13px;">Activity</th>
          <th style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">Total Inward<br><span style="color:#ef4444; font-size:11px; font-weight:600;">(If NA mark zero)</span></th>
          <th style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">Executions within<br>target date</th>
          <th style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">% of Executions<br>out of target date</th>
          <th style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px;">Prev Month %</th>
          <th style="background-color:#dbeafe; color:#1e40af; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px;">Limit</th>
        </tr>
      </thead>
      <tbody>
        ${makeRow('Pending frn', rFrn, false)}
        ${hideFrnCon ? '' : makeRow('pending FRN con', rFrnCon, true)}
        ${makeRow('SO Pending', rSo, false)}
        ${makeRow('Under Repair', rRepair, true)}
        ${makeRow('TO/SO', rTo, false)}
        ${makeRow('Non-Saleable', rNonSaleable, true)}
        ${makeRow('BIR list', rBir, false)}
        ${makeRow('Estimation', rEst, true)}
      </tbody>
    </table>
  `;

  const bottomTable = `
    <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden;">
      <tbody>
        <tr>
          <td rowspan="5" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; width:20%;">Weekly CRM Reports</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">${checkSub('CRM', tuesdays[0])}</td>
          <td rowspan="5" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; width:20%;">Pending activity on<br>Monday</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">${checkSub('PendingActivity', mondays[0])}</td>
          <td rowspan="4" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; width:15%;">Non-Saleable<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">${checkSub('NonSaleable', d02)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('CRM', tuesdays[1])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('PendingActivity', mondays[1])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('NonSaleable', d16)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('CRM', tuesdays[2])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('PendingActivity', mondays[2])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; background-color:#f8fafc;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('CRM', tuesdays[3])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('PendingActivity', mondays[3])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; background-color:#f8fafc;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('CRM', tuesdays[4])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">${checkSub('PendingActivity', mondays[4])}</td>
          <td style="border:1px solid #cbd5e1; padding:12px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">${cNonSaleableTracker}%</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">${cWeekly}%</td>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">${cPending}%</td>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; background-color:#f1f5f9;"></td>
        </tr>

      </tbody>
    </table>

    <table class="perf-pdf-page-break" style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden; margin-top:28px;">
      <tbody>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4;">Supplier Warranty transaction<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
          <td colspan="3" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4;">Critical Pending report<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:12px; vertical-align:middle;">
            <div style="display:flex; justify-content:space-evenly; align-items:center; gap:16px;">
              <div style="flex:1;">${checkSub('SupplierWarranty', d03)}</div>
              <div style="flex:1;">${checkSub('SupplierWarranty', d16)}</div>
            </div>
          </td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:12px; vertical-align:middle;">
            <div style="display:flex; justify-content:center; align-items:center; width:50%; margin:0 auto;">
              ${checkSub('CriticalPendingReport', d02)}
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">${cSupWarr}%</td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">${cCritical}%</td>
        </tr>

        <tr>
          <td colspan="3" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; vertical-align:middle;">
            Purchase indent request to commercial<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span>
            <div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">
              ${checkSub('PIRequest', d05)}
            </div>
          </td>
        </tr>
        <tr></tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; background-color:#e0e7ff; color:#3730a3; font-size:18px; text-align:center;">${cPI}%</td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; font-size:18px; text-align:center; color:${rate>=75?'#059669':'#ef4444'}; background-color:${rate>=75?'#ecfdf5':'#fef2f2'}; text-transform:uppercase; letter-spacing:1px;">
            ${remark}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  return `
    <div style="font-family:'Inter',system-ui,sans-serif; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:32px; color:#1e293b; width:100%; box-sizing:border-box;">
      ${scopeType === 'employee' ? '<div class="submission-panel" id="perf-submission-panel"></div>' : ''}
      <div class="perf-review-table-container">
        ${topTable}
        ${bottomTable}
      </div>
      <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
        <button class="btn btn-green" style="padding:10px 18px; font-weight:600; border-radius:8px; font-size:13px;" onclick="exportPDF('${scopeType === 'division' ? 'div' : 'emp'}')">
          <i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF
        </button>
      </div>
    </div>
  `;
}

function renderDivisionPerfSummary(data,params) {
  if(!data){
    document.getElementById('perf-pane-div-summary').innerHTML='<div class="empty-state"><div class="empty-icon">&#128196;</div><div class="empty-title">No Data</div></div>';
    return;
  }
  window._lastPerfDivData = data;
  const html = generatePerfAnalysisHtml(data, params, 'division');
  document.getElementById('perf-pane-div-summary').innerHTML = html;
  if(typeof loadDivisionReportSubmissions === 'function') loadDivisionReportSubmissions(params);
}

function renderPerfSummary(data,params) {
  if(!data){
    document.getElementById('perf-pane-summary').innerHTML='<div class="empty-state"><div class="empty-icon">&#128196;</div><div class="empty-title">No Data</div></div>';
    return;
  }
  window._lastPerfEmpData = data;
  const html = generatePerfAnalysisHtml(data, params, 'employee');
  document.getElementById('perf-pane-summary').innerHTML = html;
}



async function loadTrend(){
  if(!perfCurrentParams) return;
  const pane=document.getElementById('perf-pane-trend');
  pane.innerHTML=`<div class="loading-state"><div class="spinner"></div><div class="loading-title">Loading 6-Month Trend</div></div>`;
  try{
    const p=perfCurrentParams;
    const qs=new URLSearchParams({scope:p.scope,division:p.division||'',employee:p.employee||'',months:6}).toString();
    const res=await fetch('/api/reports/performance/trend?'+qs,{headers:hdrs()});
    const d=await res.json();
    if(!res.ok) throw new Error(d.message||'Failed');
    renderTrendChart(d.trend||[]);
  }catch(e){
    pane.innerHTML=`<div class="empty-state" style="padding:40px;"><div class="empty-icon">!</div><div class="empty-title">Trend Failed</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

function renderTrendChart(points, isDiv = false){
  const pane=document.getElementById(isDiv ? 'perf-pane-trend-div' : 'perf-pane-trend');
  const canvasId = isDiv ? 'perfTrendChartDiv' : 'perfTrendChart';
  pane.innerHTML=`<div class="trend-wrap">
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">6-month completion rate trend for <strong style="color:var(--text);">${(isDiv ? perfDivCurrentParams?.division : perfCurrentParams?.employee)||''}</strong></div>
    <div class="trend-chart-container"><canvas id="${canvasId}"></canvas></div>
  </div>`;
  const ctx=document.getElementById(canvasId).getContext('2d');
  if(isDiv) {
    if(trendDivChartInst) trendDivChartInst.destroy();
  } else {
    if(trendChartInst) trendChartInst.destroy();
  }
  const rates=points.map(p=>p.completionRate);
  const avg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length):0;
  const chartInst=new Chart(ctx,{
    type:'line',
    data:{
      labels:points.map(p=>p.month),
      datasets:[
        {label:'Completion Rate %',data:rates,borderColor:'#b91c1c',backgroundColor:'rgba(185,28,28,0.08)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:5,pointBackgroundColor:'#b91c1c'},
        {label:'Target (75%)',data:points.map(()=>75),borderColor:'rgba(5,150,105,0.5)',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false},
        {label:`Average (${avg}%)`,data:points.map(()=>avg),borderColor:'rgba(217,119,6,0.5)',borderDash:[3,3],borderWidth:1.5,pointRadius:0,fill:false}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${ctx.raw}%`}}},scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:v=>v+'%'}},x:{grid:{color:'rgba(0,0,0,0.04)'}}}}
  });
  if(isDiv) trendDivChartInst = chartInst;
  else trendChartInst = chartInst;
}

async function loadLeaderboard(){
  const isDivisionPane = perfScope === 'division' || document.getElementById('perf-div-pane')?.style.display !== 'none';
  const month=(isDivisionPane ? document.getElementById('perf-month-div') : document.getElementById('perf-month')).value;
  if(!month){
    toast('Please select a month first','error');
    if(isDivisionPane) switchPerfDivTab('summary',document.querySelector('#perf-div-inner-tabs .perf-inner-tab'));
    else switchPerfTab('summary',document.querySelector('.perf-inner-tab'));
    return;
  }
  const pane=document.getElementById(isDivisionPane ? 'perf-pane-leaderboard-div' : 'perf-pane-leaderboard');
  if(!pane){ toast('Leaderboard is available in the Division tab.', 'info'); return; }
  pane.innerHTML=`<div class="loading-state"><div class="spinner"></div><div class="loading-title">Building Division Leaderboard</div><div class="loading-sub">Computing all divisions for ${month}...</div></div>`;
  document.getElementById(isDivisionPane ? 'perf-div-inner-tabs' : 'perf-inner-tabs').style.display='flex';
  if(isDivisionPane) {
    document.querySelectorAll('#perf-div-inner-tabs .perf-inner-tab').forEach((b,i)=>{b.classList.toggle('active',i===2);});
    ['perf-pane-div-summary','perf-pane-trend-div'].forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='none';});
  } else {
    document.querySelectorAll('.perf-inner-tab').forEach((b,i)=>{b.classList.toggle('active',i===2);});
    ['summary','trend'].forEach(t=>document.getElementById('perf-pane-'+t).style.display='none');
  }
  pane.style.display='block';
  try{
    const res=await fetch('/api/reports/performance/leaderboard?month='+month,{headers:hdrs()});
    const d=await res.json();
    if(!res.ok) throw new Error(d.message||'Failed');
    renderLeaderboard(d.leaderboard||[],month,isDivisionPane);
  }catch(e){
    pane.innerHTML=`<div class="empty-state" style="padding:40px;"><div class="empty-icon">!</div><div class="empty-title">Leaderboard Failed</div><div class="empty-sub">${e.message}</div></div>`;
    toast('Leaderboard failed: '+e.message,'error');
  }
}

function renderLeaderboard(rows,month,isDivisionPane=false){
  const pane=document.getElementById(isDivisionPane ? 'perf-pane-leaderboard-div' : 'perf-pane-leaderboard');
  if(!pane) return;
  if(!rows.length){
    pane.innerHTML='<div class="empty-state" style="padding:40px;"><div class="empty-icon">#</div><div class="empty-title">No Divisions Found</div></div>';
    return;
  }
  let tbl=`<div style="padding:20px;">
    <div style="font-family:Syne,sans-serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;">Division Leaderboard — ${month}</div>
    <table class="lb-table">
      <thead><tr><th style="width:40px;">Rank</th><th>Division</th><th style="text-align:center;">Tracked</th><th style="text-align:center;">Completed</th><th style="text-align:center;">Pending</th><th style="text-align:center;">Critical</th><th>Status</th></tr></thead>
      <tbody>`;
  rows.forEach((r,i)=>{
    const p=Math.min(100,Math.max(0,r.completionRate||0));
    tbl+=`<tr>
      <td><span class="lb-rank">${i+1}</span></td>
      <td style="font-weight:600;">${r.division}</td>
      <td style="text-align:center;">${r.totalTracked}</td>
      <td style="text-align:center;color:#059669;font-weight:700;">${r.completedCount}</td>
      <td style="text-align:center;color:${r.pendingCount>0?'#d97706':'var(--muted)'}">${r.pendingCount}</td>
      <td style="text-align:center;color:${r.criticalPendingCount>0?'#b91c1c':'var(--muted)'}">${r.criticalPendingCount}</td>
      <td>${flagBadge(p)}</td>
    </tr>`;
  });
  tbl+='</tbody></table></div>';
  pane.innerHTML=tbl;
}

async function exportPDF(type) {
  {
    const isDiv = type === 'div';
    const params = isDiv ? perfDivCurrentParams : perfCurrentParams;
    if(!params) return;

    const data = isDiv ? window._lastPerfDivData : window._lastPerfEmpData;
    if(!data) { toast('No data loaded to export','error'); return; }

    const month = params.month || 'Report';
    const scope = params.division || params.employee || 'Performance';
    const scopeLabel = isDiv ? 'Division' : 'Employee';
    const divisionLabel = data.division || params.division || '';
    const employeeLabel = data.employee || params.employee || '';
    const monthLabel = data.monthLabel || month;
    const reportHtml = generatePerfAnalysisHtml(data, params, isDiv ? 'division' : 'employee');
    const reportScratch = document.createElement('div');
    reportScratch.innerHTML = reportHtml;
    const lowerSection = reportScratch.querySelector('table.perf-pdf-page-break');
    const secondPageHtml = lowerSection ? lowerSection.outerHTML : '';
    if (lowerSection) lowerSection.remove();
    const firstPageHtml = reportScratch.innerHTML;

    const html = `
      <div class="perf-pdf-doc">
        <style>
          .perf-pdf-doc,.perf-pdf-doc *{box-sizing:border-box;}
          .perf-pdf-doc{width:1120px;font-family:Arial,sans-serif;background:#fff;color:#1e293b;}
          .perf-pdf-sheet{width:1120px;background:#fff;padding:22px 36px 22px 150px;}
          .perf-pdf-page-2{padding-top:44px;}
          .perf-pdf-head{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:18px;}
          .perf-pdf-title{font-size:20px;font-weight:800;letter-spacing:.5px;color:#0f172a;text-align:right;}
          .perf-pdf-meta{font-size:14px;margin-top:6px;color:#475569;text-align:right;}
          .perf-pdf-content>div{border:0!important;border-radius:0!important;padding:0!important;width:100%!important;box-shadow:none!important;}
          .perf-pdf-content .submission-panel,.perf-pdf-content button,.perf-pdf-content .btn{display:none!important;}
          .perf-pdf-content table{width:100%!important;max-width:100%!important;table-layout:fixed;border-collapse:collapse!important;margin-left:0!important;margin-right:0!important;}
          .perf-pdf-content tr,.perf-pdf-content td,.perf-pdf-content th{break-inside:avoid!important;page-break-inside:avoid!important;}
          .perf-pdf-content .perf-pdf-page-break{break-before:auto!important;page-break-before:auto!important;}
          .perf-pdf-content table.perf-pdf-page-break{margin-top:0!important;}
          .perf-pdf-content th,.perf-pdf-content td{font-size:9.5px!important;line-height:1.18!important;padding:5px 6px!important;word-break:normal!important;overflow-wrap:anywhere!important;}
          .perf-pdf-content th[colspan]{font-size:12px!important;}
          .perf-pdf-content [style*="font-size:18px"]{font-size:15px!important;}
          .perf-pdf-content [style*="font-size:32px"]{font-size:28px!important;}
          .perf-pdf-content [style*="margin-top:24px"]{margin-top:14px!important;}
          .perf-pdf-content [style*="gap:20px"]{gap:14px!important;}
        </style>
        <section class="perf-pdf-sheet">
          <div class="perf-pdf-head">
            <img src="logo.png" alt="SCHILLER" style="height:48px;object-fit:contain;">
            <div>
              <div class="perf-pdf-title">PERFORMANCE ANALYSIS REPORT</div>
              <div class="perf-pdf-meta">${scopeLabel}: <strong style="color:#0f172a;">${escapeHtml(isDiv ? divisionLabel : employeeLabel)}</strong> &nbsp;|&nbsp; Month: <strong style="color:#0f172a;">${escapeHtml(monthLabel)}</strong></div>
            </div>
          </div>
          <div class="perf-pdf-content">${firstPageHtml}</div>
        </section>
        ${secondPageHtml ? `<section class="perf-pdf-sheet perf-pdf-page-2"><div class="perf-pdf-content">${secondPageHtml}</div></section>` : ''}
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '80px';
    wrapper.style.top = '0px';
    wrapper.style.width = '1120px';
    wrapper.style.background = '#ffffff';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '-1';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (typeof window.html2canvas !== 'function' || !jsPDF) throw new Error('PDF libraries are not loaded. Please refresh the page and try again.');
      const pdf = new jsPDF({ unit: 'in', format: 'a4', orientation: 'landscape' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 0.18;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const sheets = Array.from(wrapper.querySelectorAll('.perf-pdf-sheet'));
      for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i], {
          scale: 4,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 1120,
          windowWidth: 1280,
          scrollX: 0,
          scrollY: 0
        });
        const imgData = canvas.toDataURL('image/jpeg', 1);
        const ratio = Math.min(usableW / canvas.width, usableH / canvas.height);
        const imgW = canvas.width * ratio;
        const imgH = canvas.height * ratio;
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', margin + (usableW - imgW) / 2, margin, imgW, imgH, undefined, 'FAST');
      }
      pdf.save(`Performance_Analysis_${scope}_${month}.pdf`);
      toast('PDF export completed!', 'success');
    } catch(e) {
      toast('PDF export failed: ' + e.message, 'error');
    } finally {
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
    }
    return;
  }
  const isDiv = type === 'div';
  const params = isDiv ? perfDivCurrentParams : perfCurrentParams;
  if(!params) return;
  const month = params.month||'Report';
  const scope = params.division||params.employee||'Performance';

  const data = isDiv ? window._lastPerfDivData : window._lastPerfEmpData;
  if(!data) { toast('No data loaded to export','error'); return; }
  
  const scopeLabel = isDiv ? 'Division' : 'Employee';
  const divisionLabel = data.division || params.division || '';
  const employeeLabel = data.employee || params.employee || '';
  const monthLabel = data.monthLabel || month;

  const rows = data.activityRows || [];
  const hideFrnCon = isDiv && /^(monitors?|ventilators?)$/i.test(divisionLabel.trim());

  const pctVal = (v) => {
    if (v === undefined || v === null) return '-';
    const isRateFraction = typeof v === 'number' && v >= 0 && v <= 1;
    return Math.round(isRateFraction ? v * 100 : v) + '%';
  };

  const TD = 'border:1px solid #cbd5e1;padding:8px 10px;font-size:12px;';
  const TH = 'border:1px solid #334155;padding:10px;font-size:13px;font-weight:700;';

  const rowHtml = rows.filter(r => {
    if (hideFrnCon && (r.label || '').toLowerCase() === 'pending frn con') return false;
    return true;
  }).map((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const limitText = r.targetDays != null ? `\u2264${r.targetDays}d` : '-';
    return `<tr style="background:${bg};">
      <td style="${TD}text-align:left;font-weight:600;color:#334155;">${escapeHtml(r.label||'')}</td>
      <td style="${TD}text-align:center;color:#475569;">${r.total ?? '-'}</td>
      <td style="${TD}text-align:center;color:#059669;font-weight:700;">${r.withinTarget ?? '-'}</td>
      <td style="${TD}text-align:center;color:#0f172a;font-weight:700;">${pctVal(r.withinPercent ?? r.completionPercent)}</td>
      <td style="${TD}text-align:center;color:#64748b;">${pctVal(r.prevRate)}</td>
      <td style="${TD}text-align:center;color:#1e40af;font-weight:700;background:#dbeafe;">${limitText}</td>
    </tr>`;
  }).join('');

  const comp = data.compliance || {};
  const compRows = [
    ['Weekly CRM Reports', comp.weeklyCrm != null ? comp.weeklyCrm + '%' : '-'],
    ['Pending Activity (Monday)', comp.pendingActivity != null ? comp.pendingActivity + '%' : '-'],
    ['Non-Saleable Tracker', comp.nonSaleable != null ? comp.nonSaleable + '%' : '-'],
    ['Supplier Warranty', comp.supplierWarranty != null ? comp.supplierWarranty + '%' : '-'],
    ['Critical Pending Report', comp.criticalPending != null ? comp.criticalPending + '%' : '-'],
    ['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-'],
  ].map((row, i) => `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
    <td style="${TD}font-weight:600;color:#334155;">${row[0]}</td>
    <td style="${TD}text-align:center;font-weight:700;color:#3730a3;background:#eef2ff;">${row[1]}</td>
  </tr>`).join('');

  const summary = data.summary || {};
  const rate = summary.completionRate || 0;
  const remark = rate >= 90 ? 'Excellent' : rate >= 75 ? 'Good' : rate >= 60 ? 'Average' : 'Needs Improvement';
  const remarkColor = rate >= 75 ? '#059669' : '#ef4444';
  const remarkBg = rate >= 75 ? '#ecfdf5' : '#fef2f2';

  const html = `
  <div style="width:1050px;font-family:Arial,sans-serif;background:#fff;color:#1e293b;padding:30px;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:24px;">
      <img src="logo.png" alt="SCHILLER" style="height:50px;object-fit:contain;">
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:800;letter-spacing:.5px;color:#0f172a;">PERFORMANCE ANALYSIS REPORT</div>
        <div style="font-size:14px;margin-top:6px;color:#475569;">${scopeLabel}: <strong style="color:#0f172a;">${escapeHtml(isDiv ? divisionLabel : employeeLabel)}</strong> &nbsp;|&nbsp; Month: <strong style="color:#0f172a;">${escapeHtml(monthLabel)}</strong></div>
      </div>
    </div>
    
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr>
          <th colspan="6" style="${TH}background:#0f172a;color:#fff;text-align:left;letter-spacing:.5px;font-size:15px;">PERFORMANCE REVIEW — ${escapeHtml(monthLabel)}</th>
        </tr>
        <tr>
          <th style="${TH}background:#f1f5f9;color:#334155;text-align:left;width:28%;">Activity</th>
          <th style="${TH}background:#f1f5f9;color:#334155;text-align:center;width:13%;">Total Inward</th>
          <th style="${TH}background:#f1f5f9;color:#334155;text-align:center;width:15%;">Within Target</th>
          <th style="${TH}background:#f1f5f9;color:#334155;text-align:center;width:15%;">% Execution</th>
          <th style="${TH}background:#f1f5f9;color:#334155;text-align:center;width:15%;">Prev Month %</th>
          <th style="${TH}background:#dbeafe;color:#1e40af;text-align:center;width:14%;">Limit</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>

    <table style="width:60%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr>
          <th colspan="2" style="${TH}background:#0f172a;color:#fff;text-align:left;font-size:14px;">COMPLIANCE TRACKER</th>
        </tr>
      </thead>
      <tbody>${compRows}</tbody>
    </table>

    <div style="display:flex;gap:20px;margin-top:16px;">
      <div style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:20px;text-align:center;background:#f8fafc;">
        <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;">Overall Completion Rate</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;margin-top:8px;">${rate}%</div>
      </div>
      <div style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:20px;text-align:center;background:${remarkBg};">
        <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;">Overall Remark</div>
        <div style="font-size:32px;font-weight:900;color:${remarkColor};margin-top:8px;letter-spacing:1px;">${remark}</div>
      </div>
    </div>
  </div>`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0px';
  wrapper.style.top = '0px';
  wrapper.style.opacity = '0';
  wrapper.style.pointerEvents = 'none';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try {
    await html2pdf().set({
      margin: 0.3,
      filename: `Performance_Analysis_${scope}_${month}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1100, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    }).from(wrapper.firstElementChild).save();
  } catch(e) {
    toast('PDF export failed: ' + e.message, 'error');
  } finally {
    if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
  }
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function buildPerfPdfPage(data,label,month){
  const rows=(data.activities||[]).map((act,i)=>{
    const bg=i%2===0?'#ffffff':'#f9fbfd';
    const oot=act.outOfTarget||0;
    return `<tr style="background:${bg};">
      <td style="border:1px solid #d0e0ec;padding:8px 10px;font-weight:600;font-size:11px;">${escapeHtml(act.label)}</td>
      <td style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:11px;">${act.total||0}</td>
      <td style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:11px;">${act.targetDays?act.targetDays+' days':'-'}</td>
      <td style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:11px;color:#059669;font-weight:700;">${act.withinTarget||0}</td>
      <td style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:11px;color:${oot>0?'#b91c1c':'#666'};font-weight:${oot>0?'700':'500'};">${oot}</td>
    </tr>`;
  }).join('');
  const rate=data.completionRate||0;
  const isCrit=rate<60;
  const isWarn=rate>=60&&rate<75;
  const sColor=isCrit?'#b91c1c':isWarn?'#d97706':'#059669';
  const sTxt=isCrit?'CRITICAL':isWarn?'AT RISK':'ON TRACK';
  return `<section style="page-break-after:always;padding:28px;font-family:Arial,sans-serif;color:#1a2a3a;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #b91c1c;">
      <div>
        <div style="font-size:20px;font-weight:700;color:#b91c1c;font-family:Georgia,serif;">SchillerIndia</div>
        <div style="font-size:12px;color:#666;">Performance Review Report</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;">${escapeHtml(label)}</div>
        <div style="font-size:11px;color:#666;">Month: ${escapeHtml(month)} | Generated: ${new Date().toLocaleDateString('en-IN')}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="border:1px solid #d0e0ec;padding:10px 14px;width:25%;">
          <div style="font-size:18px;font-weight:700;">${data.totalTracked||0}</div>
          <div style="font-size:10px;color:#666;margin-top:3px;">Total Tracked</div>
        </td>
        <td style="border:1px solid #d0e0ec;padding:10px 14px;width:25%;">
          <div style="font-size:18px;font-weight:700;color:#059669;">${data.completedCount||0}</div>
          <div style="font-size:10px;color:#666;margin-top:3px;">Within Target</div>
        </td>
        <td style="border:1px solid #d0e0ec;padding:10px 14px;width:25%;">
          <div style="font-size:18px;font-weight:700;color:#b91c1c;">${data.pendingCount||0}</div>
          <div style="font-size:10px;color:#666;margin-top:3px;">Out of Target</div>
        </td>
        <td style="border:1px solid #d0e0ec;padding:10px 14px;width:25%;background:${isCrit?'#fff5f5':isWarn?'#fffbeb':'#f0fdf4'};">
          <div style="font-size:18px;font-weight:700;color:${sColor};">${rate}%</div>
          <div style="font-size:10px;color:${sColor};margin-top:3px;font-weight:600;">${sTxt}</div>
        </td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f4f7fa;">
          <th style="border:1px solid #d0e0ec;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7a9ab0;">Activity</th>
          <th style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7a9ab0;">Total</th>
          <th style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7a9ab0;">Target Days</th>
          <th style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7a9ab0;">Within Target</th>
          <th style="border:1px solid #d0e0ec;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7a9ab0;">Out of Target</th>
        </tr>
      </thead>
      <tbody>${rows||'<tr><td colspan="5" style="border:1px solid #d0e0ec;padding:14px;text-align:center;color:#999;">No activity data found.</td></tr>'}</tbody>
    </table>
  </section>`;
}

async function exportPriorityDivisionPDF(){
  try{
    const month=document.getElementById('perf-month').value;
    if(!month){toast('Please select a month','error');return;}
    if(!perfOptionsLoaded) await loadPerfOptions();
    const wanted=[
      {label:'Ventilator',patterns:['VENTILATOR']},
      {label:'Vent Con',patterns:['VENT CON','VENTCON']},
      {label:'Patient Monitors',patterns:['PATIENT MONITOR','MONITOR'],exclude:[' CON',' PM','PM CM']},
      {label:'PM CM',patterns:['PM CM','PMCM','MONITOR CON','MONITORS CON']}
    ];
    const divisions=(perfOptions.divisions||[]).map(d=>d.name||d);
    const pages=[];
    for(const item of wanted){
      const division=divisions.find(name=>{
        const upper=String(name||'').toUpperCase();
        return item.patterns.some(p=>upper.includes(p)) && !(item.exclude||[]).some(p=>upper.includes(p));
      })||item.label;
      const qs=new URLSearchParams({scope:'division',month,division}).toString();
      const res=await fetch('/api/reports/performance/summary?'+qs,{headers:hdrs()});
      const payload=await res.json();
      if(!res.ok) throw new Error(payload.message||`Failed to load ${division}`);
      pages.push(buildPerfPdfPage(payload.data,division,month));
    }
    const wrapper=document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0px';
    wrapper.innerHTML=pages.join('');
    document.body.appendChild(wrapper);
    await html2pdf().set({
      margin:0.2,
      filename:`Performance_Division_Pack_${month}.pdf`,
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true},
      jsPDF:{unit:'in',format:'a4',orientation:'landscape'}
    }).from(wrapper).save();
    wrapper.remove();
    toast('Division pack PDF export completed!','success');
  }catch(e){
    toast('Division pack PDF failed: '+e.message,'error');
  }
}

// --------------------------------------------------------------
//  TAB 3  ANALYTICS
// --------------------------------------------------------------

let analyticsLoaded=false;
let trendInst=null,divInst=null,engInst=null;

async function loadAnalyticsCharts(){
  analyticsLoaded=true;
  const days=document.getElementById('analytics-range').value;
  try{
    const res=await fetch('/api/reports/analytics?days='+days,{headers:hdrs()});
    if(!res.ok)throw new Error('Failed to load analytics');
    const d=await res.json();
    renderAnalyticsTrendChart(d.trends||[]);
    renderDivisionChart(d.divisions||[]);
    renderEngineerChart(d.engineers||[]);
  }catch(e){toast('Analytics error: '+e.message,'error');}
}

function renderAnalyticsTrendChart(trends){
  const ctx=document.getElementById('trendChart').getContext('2d');
  if(trendInst)trendInst.destroy();
  trendInst=new Chart(ctx,{
    type:'line',
    data:{
      labels:trends.map(t=>t.date),
      datasets:[
        {label:'Calls',data:trends.map(t=>t.calls),borderColor:'#b91c1c',backgroundColor:'rgba(185,28,28,0.08)',fill:true,tension:0.4,borderWidth:2},
        {label:'FRNs',data:trends.map(t=>t.frns),borderColor:'#059669',backgroundColor:'rgba(5,150,105,0.08)',fill:true,tension:0.4,borderWidth:2},
        {label:'BIRs',data:trends.map(t=>t.birs),borderColor:'#d97706',backgroundColor:'rgba(217,119,6,0.08)',fill:true,tension:0.4,borderWidth:2}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{color:'rgba(0,0,0,0.04)'}}}}
  });
}

function renderDivisionChart(divisions){
  const ctx=document.getElementById('divisionChart').getContext('2d');
  if(divInst)divInst.destroy();
  divInst=new Chart(ctx,{
    type:'doughnut',
    data:{
      labels:divisions.map(d=>d.division||'Unknown'),
      datasets:[{data:divisions.map(d=>d.count),backgroundColor:['#b91c1c','#059669','#d97706','#0077cc','#7c3aed','#0f766e','#eab308','#ec4899']}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,font:{size:11}}}}}
  });
}

function renderEngineerChart(engineers){
  const ctx=document.getElementById('engineerChart').getContext('2d');
  if(engInst)engInst.destroy();
  engInst=new Chart(ctx,{
    type:'bar',
    data:{
      labels:engineers.map(e=>e.name),
      datasets:[{label:'Completed Tasks',data:engineers.map(e=>e.count),backgroundColor:'rgba(185,28,28,0.75)',borderRadius:5,borderSkipped:false}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false}}}}
  });
}

// --------------------------------------------------------------
//  TAB 4  HISTORY
// --------------------------------------------------------------

let histLoaded=false;
let histCurrentPage=1;
let histTotalPages=1;

async function loadHistory(page=1){
  histLoaded=true;
  histCurrentPage=page;
  const typeFilter=document.getElementById('hist-type-filter').value;
  let url=`/api/reports/history?page=${page}&limit=15`;
  if(typeFilter) url+=`&reportType=${typeFilter}`;

  document.getElementById('hist-body').innerHTML=`<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Loading</td></tr>`;

  try{
    const res=await fetch(url,{headers:hdrs()});
    if(!res.ok)throw new Error('Failed');
    const d=await res.json();
    renderHistory(d.reports||[],d.pagination);
  }catch(e){
    document.getElementById('hist-body').innerHTML=`<tr><td colspan="7" style="text-align:center;padding:32px;color:#b91c1c;">Error: ${e.message}</td></tr>`;
  }
}

const TYPE_LABELS={service_summary:'Service Summary',pending_frn:'Pending FRN',under_repair:'Under Repair',ob_pending:'OB Pending',estimation_pending:'Estimation Pending',engineer_performance:'Engineer Performance',division_analytics:'Division Analytics',escalation_report:'Escalation Report'};
const TYPE_BADGES={service_summary:'badge-blue',pending_frn:'badge-amber',under_repair:'badge-red',ob_pending:'badge-purple',estimation_pending:'badge-green',engineer_performance:'badge-blue',division_analytics:'badge-purple',escalation_report:'badge-red'};
const FORMAT_BADGES={detailed:'badge-blue',summary:'badge-green',technical:'badge-purple',action:'badge-amber'};

function renderHistory(reports,pagination){
  histTotalPages=pagination?.pages||1;
  document.getElementById('hist-count').textContent=pagination?.total||0;
  document.getElementById('hist-page-info').textContent=`Page ${pagination?.page||1} of ${pagination?.pages||1}  ${pagination?.total||0} reports`;
  document.getElementById('hist-prev').disabled=(pagination?.page||1)<=1;
  document.getElementById('hist-next').disabled=(pagination?.page||1)>=(pagination?.pages||1);

  if(!reports.length){
    document.getElementById('hist-body').innerHTML=`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No reports found.</td></tr>`;
    return;
  }

  const rows=reports.map(r=>{
    const div=(r.filters?.division&&r.filters.division!=='all')?r.filters.division:'';
    const period=r.dateRange?.days?`Last ${r.dateRange.days}d`:`${r.dateRange?.from||''}?${r.dateRange?.to||''}`;
    const created=r.createdAt?new Date(r.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'';
    const statusBadge=r.status==='completed'?'badge-green':'badge-red';
    return `<tr>
      <td>
        <div class="hist-title">${r.title||'Untitled Report'}</div>
        <div class="hist-meta"><span class="badge ${TYPE_BADGES[r.reportType]||'badge-gray'}">${TYPE_LABELS[r.reportType]||r.reportType}</span></div>
      </td>
      <td><span class="badge ${FORMAT_BADGES[r.format]||'badge-gray'}">${r.format||''}</span></td>
      <td style="font-size:12px;color:var(--soft);">${div}</td>
      <td style="font-size:12px;color:var(--soft);">${period}</td>
      <td style="font-size:12px;color:var(--muted);">${created}</td>
      <td><span class="badge ${statusBadge}">${r.status}</span></td>
      <td>
        <div class="action-btns" style="justify-content:center;">
          <button class="btn btn-ghost btn-xs" onclick="viewReport('${r._id}')">&#128065; View</button>
          <button class="btn btn-danger btn-xs" onclick="deleteReport('${r._id}',this)">&#128465;</button>
        </div>
      </td>
    </tr>`;
  });
  document.getElementById('hist-body').innerHTML=rows.join('');
}

function histPage(dir){
  const next=histCurrentPage+dir;
  if(next<1||next>histTotalPages)return;
  loadHistory(next);
}

async function viewReport(id){
  switchTab('performance');
  document.getElementById('output-body').innerHTML=`<div class="loading-state"><div class="spinner"></div><div class="loading-title">Loading Report</div></div>`;
  try{
    const res=await fetch(`/api/reports/${id}`,{headers:hdrs()});
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||'Not found');
    currentReport=data;
    renderReport(data);
  }catch(e){toast('Failed to load: '+e.message,'error');}
}

async function deleteReport(id,btn){
  if(!confirm('Delete this report? This cannot be undone.'))return;
  btn.disabled=true;
  try{
    const res=await fetch(`/api/reports/${id}`,{method:'DELETE',headers:hdrs()});
    if(!res.ok) throw new Error('Delete failed');
    toast('Report deleted','success');
    loadHistory(histCurrentPage);
    loadStats();
  }catch(e){toast('Delete failed: '+e.message,'error');btn.disabled=false;}
}

// --------------------------------------------------------------
//  TAB 5  KANBAN BOARD
// --------------------------------------------------------------
let kanbanData = [];
let kanbanCompletedData = [];

async function loadKanbanBoard() {
  const container = document.getElementById('kanban-container');
  container.innerHTML = `<div class="loading-state" style="width:100%;"><div class="spinner"></div><div class="loading-title">Loading Kanban Board</div></div>`;
  
  try {
    if (!perfOptionsLoaded) await loadPerfOptions();

    // Fetch both pending FRNs and completed FRNs to calculate the metric formula
    const [resPending, resCompleted] = await Promise.all([
      fetch('/api/emp/frn', { headers: hdrs() }),
      fetch('/api/completed-frn/admin/all', { headers: hdrs() })
    ]);

    if (!resPending.ok) throw new Error('HTTP ' + resPending.status);
    
    const dataPending = await resPending.json();
    kanbanData = dataPending.filter(d => d.status === 'pending');

    if (resCompleted.ok) {
      kanbanCompletedData = await resCompleted.json();
    } else {
      kanbanCompletedData = [];
    }

    renderKanbanBoard();
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><div class="empty-title">Failed to load Workload</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

function renderKanbanBoard() {
  const container = document.getElementById('kanban-container');
  const divFilter = document.getElementById('kanban-div-filter').value;
  
  let filtered = kanbanData;
  let filteredCompleted = kanbanCompletedData;
  
  if (divFilter !== 'all') {
    filtered = filtered.filter(d => (d.divisionName === divFilter || d.division === divFilter));
    filteredCompleted = filteredCompleted.filter(d => (d.divisionName === divFilter || d.division === divFilter || d.region === divFilter));
  }
  
  // Base group with ALL engineers from user management + Unassigned
  const grouped = { 'Unassigned': [] };
  const validEngineers = ['Unassigned'];
  
  (perfOptions.employees || []).forEach(emp => {
    const name = emp.name || emp;
    if (name) {
      grouped[name] = [];
      validEngineers.push(name);
    }
  });

  filtered.forEach(d => {
    const eng = d.eng || 'Unassigned';
    if (validEngineers.includes(eng)) {
      grouped[eng].push(d);
    } else {
      // If the ticket has an engineer not in the user management system, put them in Unassigned
      grouped['Unassigned'].push(d);
    }
  });
  
  const completedCounts = {};
  filteredCompleted.forEach(d => {
    const eng = d.eng || 'Unassigned';
    if (validEngineers.includes(eng)) {
      completedCounts[eng] = (completedCounts[eng] || 0) + 1;
    } else {
      completedCounts['Unassigned'] = (completedCounts['Unassigned'] || 0) + 1;
    }
  });

  // Sort: Unassigned first, then alphabetical
  const columnsToShow = Object.keys(grouped).sort((a,b) => a==='Unassigned' ? -1 : a.localeCompare(b));
  
  let html = '';
  columnsToShow.forEach(eng => {
    const cards = grouped[eng];
    const compCount = completedCounts[eng] || 0;
    const pendingCount = cards.length;
    
    html += `
      <div class="kanban-col">
        <div class="kanban-col-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="kanban-avatar">${eng.charAt(0).toUpperCase()}</div>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${eng}</span>
          </div>
          <span class="count-pill" title="Pending / Completed" style="background:var(--surface2);padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;display:flex;gap:4px;align-items:center;">
            <span style="color:var(--amber)" title="Active Pending Tickets">${pendingCount}</span>
            <span style="color:var(--border);">/</span>
            <span style="color:var(--green)" title="Completed Tickets">${compCount}</span>
          </span>
        </div>
        <div class="kanban-list" data-engineer="${eng}">
    `;
    
    cards.forEach(c => {
      // Calculate pending days if not provided directly
      const pdays = c.pdays ?? Math.floor((Date.now() - new Date(c.entryDate).getTime()) / 86400000);
      const pClass = pdays > 150 ? 'priority-high' : pdays > 80 ? 'priority-med' : 'priority-low';
      
      html += `
        <div class="kanban-card ${pClass}" data-id="${c._id || c.id}">
          <div class="kanban-card-title">
            <span>${c.scRno || '-'}</span>
            <span style="color:var(--muted);font-size:11px;">#${String(c.frnNo||'')}</span>
          </div>
          <div class="kanban-card-sub">
            <b style="color:var(--text);">${c.model || '-'}</b><br/>
            ${c.customer || '-'}
          </div>
          <div class="kanban-card-footer">
            <span style="color:var(--muted)">${new Date(c.entryDate).toLocaleDateString('en-GB',{month:'short',day:'2-digit'})}</span>
            <span class="${pClass === 'priority-high' ? 'badge-red' : pClass === 'priority-med' ? 'badge-amber' : 'badge-green'} badge" style="padding:2px 6px;">${pdays || 0} Days</span>
          </div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  });
  
  container.innerHTML = html;
  
  // Initialize SortableJS
  if (typeof Sortable !== 'undefined') {
    document.querySelectorAll('.kanban-list').forEach(list => {
      new Sortable(list, {
        group: 'shared',
        animation: 150,
        ghostClass: 'kanban-ghost',
        onEnd: function (evt) {
          const itemEl = evt.item;
          const newEngineer = evt.to.getAttribute('data-engineer');
          const recordId = itemEl.getAttribute('data-id');
          if (evt.from !== evt.to) {
            updateEngineer(recordId, newEngineer);
          }
        }
      });
    });
  }
}

async function updateEngineer(id, newEngineer) {
  toast(`Reassigning to ${newEngineer}...`, 'info');
  try {
    const res = await fetch('/api/emp/frn/' + id + '/assign', { 
      method: 'PUT', 
      headers: hdrs(), 
      body: JSON.stringify({ eng: newEngineer === 'Unassigned' ? '' : newEngineer }) 
    });
    if(!res.ok) throw new Error('Update failed');
    toast(`Successfully reassigned to ${newEngineer}`, 'success');
    
    // Update local data
    const record = kanbanData.find(d => (d._id||d.id) === id);
    if(record) record.eng = newEngineer === 'Unassigned' ? '' : newEngineer;
    renderKanbanBoard();
  } catch(e) {
    toast(`Failed to reassign: ${e.message}`, 'error');
    loadKanbanBoard(); // Reload from server to reset UI
  }
}

// -- ALL-DIVISIONS REPORT TRACKER (Division tab) ---------------
let _rptTrackerLoaded = false;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function refreshDivisionSubmissionBoxes(){
  const panel = document.getElementById('perf-submission-panel');
  if(!panel) return;
  const month = document.getElementById('perf-month-div')?.value || getCurrentMonthValue();
  const division = document.getElementById('perf-division')?.value || '';
  const meta = division ? `${escapeHtml(division)} | ${escapeHtml(month)}` : `Select division | ${escapeHtml(month)}`;
  panel.innerHTML = `
    <div class="submission-panel-head">
      <div>
        <div class="submission-title">Division Wise Report Submission</div>
        <div class="submission-meta">${meta}</div>
      </div>
    </div>
    <div style="font-size:12.5px;color:var(--muted);">${division ? 'Click Preview Division to load submission status.' : 'Select division and month.'}</div>`;
}

async function loadDivisionReportSubmissions(params){
  const panel = document.getElementById('perf-submission-panel');
  if(!panel || !params) return;
  panel.innerHTML = `
    <div class="submission-panel-head">
      <div>
        <div class="submission-title">Division Wise Report Submission</div>
        <div class="submission-meta">${escapeHtml(params.division || '')} | ${escapeHtml(params.month || '')}</div>
      </div>
    </div>
    <div style="font-size:12.5px;color:var(--muted);"><span class="spinner" style="width:18px;height:18px;margin:0 8px 0 0;display:inline-block;vertical-align:middle;"></span>Loading submission status...</div>`;

  try{
    const res = await fetch('/api/tracker/stats?month=' + encodeURIComponent(params.month || ''), { headers: hdrs() });
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.message || 'Failed to load report submissions');
    const rows = Array.isArray(data.stats) ? data.stats : [];
    const divisionRow = rows.find(row => String(row.name || '').toLowerCase() === String(params.division || '').toLowerCase());
    const reports = divisionRow && Array.isArray(divisionRow.reports) ? divisionRow.reports : [];
    if(!divisionRow || !reports.length){
      panel.innerHTML = `
        <div class="submission-panel-head">
          <div>
            <div class="submission-title">Division Wise Report Submission</div>
            <div class="submission-meta">${escapeHtml(params.division || '')} | ${escapeHtml(params.month || '')}</div>
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--muted);">No submission data found for this division and month.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="submission-panel-head">
        <div>
          <div class="submission-title">Division Wise Report Submission</div>
          <div class="submission-meta">${escapeHtml(params.division || '')} | ${escapeHtml(params.month || '')}</div>
        </div>
      </div>
      <div class="submission-grid">
        ${reports.map(report => {
          const percent = Math.min(100, Math.max(0, Number(report.percent || 0)));
          const done = report.complete || (Number(report.expected || 0) > 0 && Number(report.actual || 0) >= Number(report.expected || 0));
          return `<div class="submission-card ${done ? 'done' : ''}">
            <div class="submission-card-title">
              <span>${escapeHtml(report.label || report.type || 'Report')}</span>
              <span class="submission-check">${done ? '&#10003;' : '-'}</span>
            </div>
            <div class="submission-card-sub">Due: ${escapeHtml(report.schedule || '-')}</div>
            <div class="submission-count">${Number(report.actual || 0)} / ${Number(report.expected || 0)} submitted (${percent}%)</div>
          </div>`;
        }).join('')}
      </div>`;
  }catch(e){
    panel.innerHTML = `
      <div class="submission-panel-head">
        <div>
          <div class="submission-title">Division Wise Report Submission</div>
          <div class="submission-meta">${escapeHtml(params.division || '')} | ${escapeHtml(params.month || '')}</div>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--red);font-weight:700;">Could not load submission status: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadAllDivisionTrackers() {
  const grid = document.getElementById('rpt-tracker-grid');
  const monthInput = document.getElementById('rpt-tracker-month');
  if (!grid) return;

  const today = new Date();
  const currentMonth = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0');
  if (monthInput && !monthInput.value) monthInput.value = currentMonth;
  const monthStr = monthInput?.value || currentMonth;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:28px;font-size:13px;"><div class="spinner" style="margin:0 auto 10px;"></div>Loading report submission data...</div>';

  try {
    const res = await fetch('/api/tracker/stats?month=' + monthStr, { headers: hdrs() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();

    if (data.success && data.stats && data.stats.length > 0) {
      const fallbackReports = [
        { type: 'CRM', label: 'CRM Reports', schedule: 'Every Tuesday' },
        { type: 'PendingActivity', label: 'Pending Activity', schedule: 'Every Monday' },
        { type: 'NonSaleable', label: 'Non Saleable', schedule: '2nd & 16th' },
        { type: 'SupplierWarranty', label: 'Supplier Warranty', schedule: '3rd & 16th' },
        { type: 'CriticalPendingReport', label: 'Critical Pending Report', schedule: '2nd' },
        { type: 'PIRequest', label: 'PI Request', schedule: '5th' }
      ];
      const reportDefs = data.stats.find(div => Array.isArray(div.reports) && div.reports.length)?.reports || fallbackReports;

      grid.innerHTML = reportDefs.map(reportDef => {
        const rows = data.stats.map(div => {
          const report = (div.reports || []).find(item => item.type === reportDef.type) || {
            label: reportDef.label,
            schedule: reportDef.schedule,
            actual: reportDef.type === 'CRM' ? div.actualCRM : reportDef.type === 'PendingActivity' ? div.actualPending : 0,
            expected: reportDef.type === 'CRM' ? div.expectedCRM : reportDef.type === 'PendingActivity' ? div.expectedPending : 0,
            percent: reportDef.type === 'CRM' ? div.crmPercent : reportDef.type === 'PendingActivity' ? div.pendingPercent : 0,
            complete: false
          };
          const percent = Math.min(100, Math.max(0, report.percent || 0));
          const done = report.complete || (report.expected > 0 && report.actual >= report.expected);
          const fillClass = done ? 'done' : percent >= 60 ? 'warn' : '';
            let missingTooltip = '';
            if (report.missingNames && report.missingNames.length > 0) {
              missingTooltip = ` <span title="Missing: ${escapeHtml(report.missingNames.join(', '))}" style="cursor:help;color:var(--amber);font-size:11px;">&#9888;</span>`;
            }
            return `
            <tr>
              <td style="font-weight:700;">${escapeHtml(div.name)}</td>
              <td style="text-align:center;">${div.empCount || 0}</td>
              <td style="text-align:center;">${report.actual || 0} / ${report.expected || 0}</td>
              <td>
                <div class="rpt-tracker-progress">
                  <div class="rpt-tracker-bar"><div class="rpt-tracker-fill ${fillClass}" style="width:${percent}%;"></div></div>
                  <span class="rpt-tracker-pct">${percent}%</span>
                  <span class="rpt-tracker-check ${done ? 'done' : ''}">${done ? '&#10003;' : '-'}</span>${missingTooltip}
                </div>
              </td>
            </tr>`;
        }).join('');

        return `
          <div class="rpt-tracker-card">
            <div class="rpt-tracker-card-head">
              <div>
                <div class="rpt-tracker-card-title">${escapeHtml(reportDef.label)}</div>
                <div class="rpt-tracker-card-schedule">Due: ${escapeHtml(reportDef.schedule || '')}</div>
              </div>
            </div>
            <div class="rpt-tracker-card-body">
              <table class="rpt-tracker-table">
                <thead>
                  <tr>
                    <th>Division</th>
                    <th style="text-align:center;">Employees</th>
                    <th style="text-align:center;">Submitted</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>`;
      }).join('');
    } else {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:28px;font-size:13px;">No report submission data found for this month.</div>';
    }
  } catch (err) {
    console.error('Report tracker load error:', err);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);padding:28px;font-size:13px;font-weight:600;">Failed to load report submission stats.</div>';
  }
}

// Hook: load tracker when Division tab opens
const _origSwitchPerfSubTab = switchPerfSubTab;
switchPerfSubTab = function(tab) {
  _origSwitchPerfSubTab(tab);
  if (tab === 'division' && !_rptTrackerLoaded) {
    _rptTrackerLoaded = true;
    loadAllDivisionTrackers();
  }
};

// -- INIT ------------------------------------------------------
loadStats();
loadDivisions();
loadPerfOptions().catch(() => {});
if (currentTab === 'kanban') loadKanbanBoard(); // Handle direct loads if modified
