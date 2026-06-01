const fs = require('fs');
let txt = fs.readFileSync('frontend/public/sccr.html', 'utf8');

// find openUpdateModal and replace everything until helpers with correct JS
const startIdx = txt.indexOf('function openUpdateModal(id)');
const endIdx = txt.indexOf('// -- HELPERS');

const newJs = `function openUpdateModal(id){
  const d = DATA.find(x=>(x._id||x.id)===id);
  if(!d) return;

  const set=(elId,val)=>{const el=document.getElementById(elId);if(el)el.value=val||'';};
  
  // View Tab
  set('ep-division', d.division);
  set('ep-type', d.type);
  set('ep-entryDate', fmtDate(d.entryDate));
  set('ep-branch', d.branch);
  set('ep-eng', d.eng);
  set('ep-model', d.model);
  set('ep-warrantyStatus', d.warrantyStatus);
  set('ep-refNo', d.refNo);
  set('ep-status', d.status);
  set('ep-sparesReceivedAtSvc', fmtDate(d.sparesReceivedAtSvc));
  set('ep-receivedDate', fmtDate(d.receivedDate));
  set('ep-executedDate', fmtDate(d.executedDate));
  set('ep-scEng', d.scEng);
  set('ep-crmRefNo', d.crmRefNo);
  set('ep-remarks', d.remarks);

  document.getElementById('update-overlay').classList.add('open');
  document.querySelector('.modal-scroll').scrollTop = 0;
}

function closeModal(){
  document.getElementById('update-overlay').classList.remove('open');
}

// -- EXPORT CSV ------------------------------------------------------------
function exportCSV(){
  const headers=['#','Division','Entry Date','SC Engg','Type','Received Date','Branch','Engineer','Model','Warranty Status','TO/SO Ref No','CRM Ref No','Status','Executed Date','Remarks'];
  const rows=filtered.map((d,i)=>[i+1,d.division,d.entryDate,d.scEng,d.type,d.receivedDate,d.branch,d.eng,d.model,d.warrantyStatus,d.refNo,d.crmRefNo,d.status,d.executedDate,d.remarks]);
  const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='closed-prfob-'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
  showToast('Exported '+filtered.length+' records.','ok');
}

// -- PAGINATION ------------------------------------------------------------
function renderPagination(pages){
  const el=document.getElementById('tbl-pagination');
  if(pages<=1){el.innerHTML='';return;}
  let h=\`<button class="pager" \${currentPage===1?'disabled':''} onclick="gp(\${currentPage-1})">&#8249; Prev</button>\`;
  getRange(currentPage,pages).forEach(p=>{
    if(p===' ') h+=\`<button class="pager" disabled> </button>\`;
    else h+=\`<button class="pager \${p===currentPage?'active':''}" onclick="gp(\${p})">\${p}</button>\`;
  });
  h+=\`<button class="pager" \${currentPage===pages?'disabled':''} onclick="gp(\${currentPage+1})">Next &#8250;</button>\`;
  el.innerHTML=h;
}
function getRange(c,t){if(t<=7)return Array.from({length:t},(_,i)=>i+1);if(c<=4)return[1,2,3,4,5,' ',t];if(c>=t-3)return[1,' ',t-4,t-3,t-2,t-1,t];return[1,' ',c-1,c,c+1,' ',t];}
function gp(p){currentPage=p;renderTable();}

`;

txt = txt.substring(0, startIdx) + newJs + txt.substring(endIdx);
fs.writeFileSync('frontend/public/sccr.html', txt);
