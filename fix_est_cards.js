const fs = require('fs');
let estContent = fs.readFileSync('frontend/public/empestpend.html', 'utf8');

// updateStats
estContent = estContent.replace(
  /function updateStats\(\)\{[\s\S]*?\}\s*function clearDates/,
  `function updateStats(){
  (document.getElementById('stat-total')||{}).textContent = allRecords.length;
  (document.getElementById('stat-new')||{}).textContent = allRecords.filter(s=>s.pdEst<3).length;
  (document.getElementById('stat-repair')||{}).textContent = allRecords.filter(s=>s.pdEst>=3&&s.pdEst<=7).length;
  (document.getElementById('stat-high')||{}).textContent = allRecords.filter(s=>s.pdEst>7).length;
}

function clearDates`
);

// applyFilters logic
estContent = estContent.replace(
  /if\(_activeCardFilter==='normal' && !\(pd<10\)\) return false;[\s\S]*?if\(_activeCardFilter==='critical' && !\(pd>20\)\) return false;/,
  `if(_activeCardFilter==='normal' && !(pd<3)) return false;
    if(_activeCardFilter==='warning' && !(pd>=3&&pd<=7)) return false;
    if(_activeCardFilter==='critical' && !(pd>7)) return false;`
);

estContent = estContent.replace(
  /if\(pdays==='high' && !\(pd>20\)\) return false;[\s\S]*?if\(pdays==='low' && !\(pd<10\)\) return false;/,
  `if(pdays==='high' && !(pd>7)) return false;
    if(pdays==='mid' && !(pd>=3&&pd<=7)) return false;
    if(pdays==='low' && !(pd<3)) return false;`
);

// Replace static HTML cards for empestpend.html by slicing out the specific chunk
const oldCardsRegex = /<div class="stat-card sc-blue">[\s\S]*?<div class="stat-card sc-green">.*?<\/div>/;
const newEstCards = `<div class="stat-card sc-blue" onclick="filterByCard('all')"><div class="stat-icon si-blue">&#128202;</div><div class="stat-label">Total Estimation</div><div class="stat-value" id="stat-total">-</div><div class="stat-sub">Active records</div></div>
      <div class="stat-card sc-green" onclick="filterByCard('normal')"><div class="stat-icon si-green">&#9989;</div><div class="stat-label">Normal (&lt;3 days)</div><div class="stat-value" id="stat-new">-</div><div class="stat-sub">Fresh pending entries</div></div>
      <div class="stat-card sc-amber" onclick="filterByCard('warning')"><div class="stat-icon si-amber">&#9888;</div><div class="stat-label">Warning (3-7 days)</div><div class="stat-value" id="stat-repair">-</div><div class="stat-sub">Needs follow-up</div></div>
      <div class="stat-card sc-red" onclick="filterByCard('critical')"><div class="stat-icon si-red">&#128308;</div><div class="stat-label">Critical (&gt;7 days)</div><div class="stat-value" id="stat-high">-</div><div class="stat-sub">Needs immediate action</div></div>`;

estContent = estContent.replace(oldCardsRegex, newEstCards);

fs.writeFileSync('frontend/public/empestpend.html', estContent);
console.log('Fixed EST pending HTML cards');
