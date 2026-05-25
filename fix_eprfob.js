const fs = require('fs');
const file = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/eprfob.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Replace stats-strip CSS with stats-row CSS
html = html.replace(/\.stats-strip\{[\s\S]*?\}/, `.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;box-shadow:var(--shadow);transition:all 0.2s;position:relative;overflow:hidden;display:grid;grid-template-columns:24px 1fr;column-gap:8px;align-items:start;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:11px 11px 0 0;}
.sc-blue::before{background:linear-gradient(90deg,#0068b5,#0ea5e9);}
.sc-amber::before{background:linear-gradient(90deg,#b45309,#d97706);}
.sc-red::before{background:linear-gradient(90deg,#b91c1c,#dc2626);}
.sc-green::before{background:linear-gradient(90deg,#047857,#059669);}
.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}
.stat-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;margin-bottom:0;grid-column:1;grid-row:1;}
.si-blue{background:rgba(0,104,181,0.1);}.si-amber{background:rgba(180,83,9,0.1);}.si-red{background:rgba(185,28,28,0.1);}.si-green{background:rgba(4,120,87,0.1);}
.stat-label{font-size:8.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;grid-column:2;grid-row:1;align-self:center;}
.stat-value{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--text);line-height:1;grid-column:1 / span 2;grid-row:2;margin-top:6px;}
.stat-sub{font-size:9px;color:var(--muted);margin-top:2px;grid-column:1 / span 2;grid-row:3;}`);

// Remove .stat-tile CSS
html = html.replace(/\.stat-tile\{[\s\S]*?\}\s*/g, '');
html = html.replace(/\.t-[a-z]+(?:\{[\s\S]*?\})?\s*/g, '');
html = html.replace(/\.stat-tile-label\{[\s\S]*?\}\s*/g, '');
html = html.replace(/\.stat-tile-value\{[\s\S]*?\}\s*/g, '');
html = html.replace(/\.stat-tile-sub\{[\s\S]*?\}\s*/g, '');

// 2. Replace HTML Stats strip with the new stats row
const statsHtmlRegex = /<!-- Stats strip -->[\s\S]*?<!-- Filter strip -->/;
const newStatsHtml = `<!-- Stats strip -->
      <div class="stats-row">
        <div class="stat-card sc-blue"><div class="stat-icon si-blue">&#128202;</div><div class="stat-label">Total PRF/OB</div><div class="stat-value" id="s-total">-</div><div class="stat-sub">Active records</div></div>
        <div class="stat-card sc-red"><div class="stat-icon si-red">&#128308;</div><div class="stat-label">Critical (&gt;30 days)</div><div class="stat-value" id="s-critical">-</div><div class="stat-sub">Needs immediate action</div></div>
        <div class="stat-card sc-amber"><div class="stat-icon si-amber">&#9203;</div><div class="stat-label">Warning (14-30 days)</div><div class="stat-value" id="s-warn">-</div><div class="stat-sub">Monitor closely</div></div>
        <div class="stat-card sc-green"><div class="stat-icon si-green">&#9989;</div><div class="stat-label">Closed</div><div class="stat-value" id="s-closed">-</div><div class="stat-sub">Completed PRF/OB</div></div>
      </div>

      <!-- Filter strip -->`;
html = html.replace(statsHtmlRegex, newStatsHtml);

// 3. Remove Filter strip HTML entirely
const filterStripRegex = /<!-- Filter strip -->[\s\S]*?<div class="filter-strip">[\s\S]*?<\/div>\s*<!-- PRF\/OB Details -->/;
html = html.replace(filterStripRegex, '<!-- PRF/OB Details -->');

// 4. Update JS loadData to remove generateDemoData
const loadDataOld = `/* ----------- LOAD DATA ----------- */
async function loadData(){
  try{
    const res=await fetch('/api/prfob',{headers:authH()});
    if(res.status===401||res.status===403){showToast('Session expired.','err');setTimeout(()=>window.location.href='login.html',1500);return;}
    if(!res.ok) throw new Error('HTTP '+res.status);
    prfobData=await res.json();
  }catch(e){
    /* Use demo data if API unavailable */
    prfobData=generateDemoData();
    showToast('Demo mode - connect API for live data','ok');
  }
  filteredData=[...prfobData];
  updateStats();
  updateBadges();
  applyDateFilter();
}`;
const loadDataNew = `/* ----------- LOAD DATA ----------- */
async function loadData(){
  try{
    const res=await fetch(API+'/api/prfob',{headers:authH()});
    if(res.status===401||res.status===403){showToast('Session expired.','err');setTimeout(()=>window.location.href='login.html',1500);return;}
    if(!res.ok) throw new Error('HTTP '+res.status);
    prfobData=await res.json();
  }catch(e){
    console.error(e);
    prfobData = [];
    showToast('Failed to load API data','err');
  }
  filteredData=[...prfobData];
  updateStats();
  updateBadges();
  applyDateFilter();
}`;
html = html.replace(loadDataOld, loadDataNew);

// Remove generateDemoData function
html = html.replace(/function generateDemoData\(\)\{[\s\S]*?return data;\n\}\s*/, '');

// 5. Update updateStats
const updateStatsOld = /function updateStats\(\)\{[\s\S]*?\}/;
const updateStatsNew = `function calcDays(d){
  if(!d) return 0;
  return Math.max(0,Math.floor((Date.now()-new Date(d).getTime())/86400000));
}

function updateStats(){
  const d=prfobData;
  document.getElementById('s-total').textContent=d.length;
  
  const pending = d.filter(x=>x.status!=='Closed'&&x.status!=='Completed');
  const critical = pending.filter(x=>calcDays(x.entryDate||x.createdAt)>30).length;
  const warn = pending.filter(x=>{ const days=calcDays(x.entryDate||x.createdAt); return days>14 && days<=30; }).length;
  const closed = d.filter(x=>x.status==='Closed'||x.status==='Completed').length;
  
  document.getElementById('s-critical').textContent=critical;
  document.getElementById('s-warn').textContent=warn;
  document.getElementById('s-closed').textContent=closed;
}`;
html = html.replace(updateStatsOld, updateStatsNew);

// 6. Update applyDateFilter and clearFilters
const applyDateFilterOld = /function applyDateFilter\(\)\{[\s\S]*?\}\nfunction clearFilters\(\)\{[\s\S]*?\}/;
const applyDateFilterNew = `function applyDateFilter(){
  const q=(document.getElementById('main-search')?.value||'').toLowerCase();
  filteredData=prfobData.filter(e=>{
    if(q&&![e.prfobRef,e.crmRef,e.engineer,e.model,e.division,e.branch,e.scEngg].join(' ').toLowerCase().includes(q))return false;
    return true;
  });
  sortData();
}
function clearFilters(){
  document.getElementById('main-search').value='';
  applyDateFilter();
}`;
html = html.replace(applyDateFilterOld, applyDateFilterNew);

fs.writeFileSync(file, html, 'utf8');
console.log('eprfob.html updated successfully.');
