const fs = require('fs');
const file = 'frontend/public/emppendingfrn.html';
let c = fs.readFileSync(file, 'utf8');

// Find the closing brace of filterByCard function (the one with window.scrollTo)
// and the point where renderTable tbody processing starts
// We need to insert the 5 missing functions between them

const marker = `  applyFilters();
  window.scrollTo({top: document.querySelector('.table-card') ? document.querySelector('.table-card').offsetTop - 10 : 0, behavior:'smooth'});
}`;

const missing = `
function applyFilters(){const q=document.getElementById('tbl-search').value.toLowerCase();filtered=FRN_DATA.filter(d=>{if(_activeCardFilter==='normal'&&!(d.pdays<3))return false;if(_activeCardFilter==='warning'&&!(d.pdays>=3&&d.pdays<=7))return false;if(_activeCardFilter==='critical'&&!(d.pdays>7))return false;return(!q||((d.scRno||'')+' '+(d.customer||'')+' '+(d.eng||'')+' '+(d.scEng||'')+' '+(d.frnNo||'')+' '+(d.model||'')+' '+(d.defGir||'')).toLowerCase().includes(q));});sortArr();currentPage=1;renderTable();}
function sortBy(k){if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=-1;}sortArr();renderTable();}
function sortArr(){filtered.sort((a,b)=>{const av=a[sortKey]??'',bv=b[sortKey]??'';if(typeof av==='number'&&typeof bv==='number')return(av-bv)*sortDir;return String(av).toLowerCase()<String(bv).toLowerCase()?-sortDir:String(av).toLowerCase()>String(bv).toLowerCase()?sortDir:0;});}
function renderRepairStateButton(id,isSent,isCompleted,titlePrefix='RT FRN'){const stateClass=isCompleted?'repair-complete':isSent?'repair-sent':'repair-pending';const stateLabel=isCompleted?'RC':isSent?'RS':'RP';const stateTitle=isCompleted?'Repair completed':isSent?'Sent to '+titlePrefix:'Send to '+titlePrefix;return '<button class="btn-xs repair-state '+stateClass+'" onclick="openRepairModal(\\'' + id + '\\')" title="'+stateTitle+'">'+stateLabel+'</button>';}
function renderTable(){
  const perPage=parseInt(document.getElementById('per-page').value)||10;
  const total=filtered.length;const pages=Math.max(1,Math.ceil(total/perPage));
  if(currentPage>pages)currentPage=pages;
  const slice=filtered.slice((currentPage-1)*perPage,currentPage*perPage);
  (document.getElementById('count-chip')||{}).textContent =total+' entr'+(total===1?'y':'ies');
  const tbody=document.getElementById('frn-tbody');`;

if (!c.includes(marker)) {
  console.log('ERROR: marker not found');
  process.exit(1);
}

// Check what comes after marker
const markerEnd = c.indexOf(marker) + marker.length;
const after = c.slice(markerEnd, markerEnd + 300);
console.log('After marker:', JSON.stringify(after.substring(0, 200)));

// Check if applyFilters already exists after marker
if (c.includes('function applyFilters()')) {
  console.log('applyFilters already present - just need to check state');
} else {
  // Insert missing functions after marker
  c = c.replace(marker, marker + '\n' + missing.trim());
  fs.writeFileSync(file, c, 'utf8');
  console.log('Inserted missing functions');
}
