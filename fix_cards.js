const fs = require('fs');

// Patch employee-ob-pending.html
let obContent = fs.readFileSync('frontend/public/employee-ob-pending.html', 'utf8');

// updateStats
obContent = obContent.replace(
  /function updateStats\(\)\{\s*\(document\.getElementById\('stat-total'\)\|\|\{\}\)\.textContent = allRecords\.length;\s*\(document\.getElementById\('stat-high'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdOb>90\)\.length;\s*\(document\.getElementById\('stat-mid'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdOb>=30&&s\.pdOb<=90\)\.length;\s*\(document\.getElementById\('stat-low'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdOb<30\)\.length;\s*\}/,
  `function updateStats(){
  (document.getElementById('stat-total')||{}).textContent = allRecords.length;
  (document.getElementById('stat-high')||{}).textContent = allRecords.filter(s=>s.pdOb>5).length;
  (document.getElementById('stat-mid')||{}).textContent = allRecords.filter(s=>s.pdOb>=3&&s.pdOb<=5).length;
  (document.getElementById('stat-low')||{}).textContent = allRecords.filter(s=>s.pdOb<3).length;
}`
);

// applyFilters logic
obContent = obContent.replace(
  /if\(_activeCardFilter==='normal' && !\(s\.pdOb<30\)\) return false;\s*if\(_activeCardFilter==='warning' && !\(s\.pdOb>=30&&s\.pdOb<=90\)\) return false;\s*if\(_activeCardFilter==='critical' && !\(s\.pdOb>90\)\) return false;/,
  `if(_activeCardFilter==='normal' && !(s.pdOb<3)) return false;
    if(_activeCardFilter==='warning' && !(s.pdOb>=3&&s.pdOb<=5)) return false;
    if(_activeCardFilter==='critical' && !(s.pdOb>5)) return false;`
);
obContent = obContent.replace(
  /if\(pdays==='high'\) mP=s\.pdOb>90;\s*if\(pdays==='mid'\)\s*mP=s\.pdOb>=30&&s\.pdOb<=90;\s*if\(pdays==='low'\)\s*mP=s\.pdOb<30;/,
  `if(pdays==='high') mP=s.pdOb>5;
    if(pdays==='mid')  mP=s.pdOb>=3&&s.pdOb<=5;
    if(pdays==='low')  mP=s.pdOb<3;`
);

// configureObStatCards
obContent = obContent.replace(
  /cards\[0\]\.innerHTML='<div class="stat-icon si-blue">&#128202;<\/div><div class="stat-label">Total Estimation<\/div><div class="stat-value" id="stat-total">-<\/div><div class="stat-sub">Active records<\/div>';\s*cards\[1\]\.className='stat-card sc-green';\s*cards\[1\]\.setAttribute\('onclick',"filterByCard\('normal'\)"\);cards\[1\]\.innerHTML='<div class="stat-icon si-green">&#9989;<\/div><div class="stat-label">Normal \(&lt;30 days\)<\/div><div class="stat-value" id="stat-low">-<\/div><div class="stat-sub">Within acceptable range<\/div>';\s*cards\[2\]\.className='stat-card sc-amber';\s*cards\[2\]\.setAttribute\('onclick',"filterByCard\('warning'\)"\);cards\[2\]\.innerHTML='<div class="stat-icon si-amber">&#9888;<\/div><div class="stat-label">Warning \(30-90 days\)<\/div><div class="stat-value" id="stat-mid">-<\/div><div class="stat-sub">Monitor closely<\/div>';\s*cards\[3\]\.className='stat-card sc-red';\s*cards\[3\]\.setAttribute\('onclick',"filterByCard\('critical'\)"\);cards\[3\]\.innerHTML='<div class="stat-icon si-red">&#128308;<\/div><div class="stat-label">Critical \(&gt;90 days\)<\/div><div class="stat-value" id="stat-high">-<\/div><div class="stat-sub">Needs immediate action<\/div>';/,
  `cards[0].innerHTML='<div class="stat-icon si-blue">&#128202;</div><div class="stat-label">Total OB Pending</div><div class="stat-value" id="stat-total">-</div><div class="stat-sub">Active records</div>';
  cards[1].className='stat-card sc-green';
  cards[1].setAttribute('onclick',"filterByCard('normal')");cards[1].innerHTML='<div class="stat-icon si-green">&#9989;</div><div class="stat-label">Below 3 Days</div><div class="stat-value" id="stat-low">-</div><div class="stat-sub">Fresh pending entries</div>';
  cards[2].className='stat-card sc-amber';
  cards[2].setAttribute('onclick',"filterByCard('warning')");cards[2].innerHTML='<div class="stat-icon si-amber">&#9888;</div><div class="stat-label">3 to 5 Days</div><div class="stat-value" id="stat-mid">-</div><div class="stat-sub">Needs follow-up</div>';
  cards[3].className='stat-card sc-red';
  cards[3].setAttribute('onclick',"filterByCard('critical')");cards[3].innerHTML='<div class="stat-icon si-red">&#128308;</div><div class="stat-label">Above 5 Days</div><div class="stat-value" id="stat-high">-</div><div class="stat-sub">Needs immediate action</div>';`
);

// HTML static fallback for ob cards (just in case)
obContent = obContent.replace(
  /<div class="stat-label">Total OB Pending<\/div>/g,
  '<div class="stat-label">Total OB Pending</div>'
); // Ensure naming

fs.writeFileSync('frontend/public/employee-ob-pending.html', obContent);


// Patch empestpend.html
let estContent = fs.readFileSync('frontend/public/empestpend.html', 'utf8');

// updateStats
estContent = estContent.replace(
  /function updateStats\(\)\{\s*\(document\.getElementById\('stat-total'\)\|\|\{\}\)\.textContent = allRecords\.length;\s*\(document\.getElementById\('stat-high'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdEst>20\)\.length;\s*\(document\.getElementById\('stat-repair'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdEst>=10&&s\.pdEst<=20\)\.length;\s*\(document\.getElementById\('stat-new'\)\|\|\{\}\)\.textContent = allRecords\.filter\(s=>s\.pdEst<10\)\.length;\s*\}/,
  `function updateStats(){
  (document.getElementById('stat-total')||{}).textContent = allRecords.length;
  (document.getElementById('stat-new')||{}).textContent = allRecords.filter(s=>s.pdEst<3).length;
  (document.getElementById('stat-repair')||{}).textContent = allRecords.filter(s=>s.pdEst>=3&&s.pdEst<=7).length;
  (document.getElementById('stat-high')||{}).textContent = allRecords.filter(s=>s.pdEst>7).length;
}`
);

// applyFilters logic
estContent = estContent.replace(
  /if\(_activeCardFilter==='normal' && !\(pd<10\)\) return false;\s*if\(_activeCardFilter==='warning' && !\(pd>=10&&pd<=20\)\) return false;\s*if\(_activeCardFilter==='critical' && !\(pd>20\)\) return false;/,
  `if(_activeCardFilter==='normal' && !(pd<3)) return false;
    if(_activeCardFilter==='warning' && !(pd>=3&&pd<=7)) return false;
    if(_activeCardFilter==='critical' && !(pd>7)) return false;`
);

estContent = estContent.replace(
  /if\(pdays==='high' && !\(pd>20\)\) return false;\s*if\(pdays==='mid' && !\(pd>=10&&pd<=20\)\) return false;\s*if\(pdays==='low' && !\(pd<10\)\) return false;/,
  `if(pdays==='high' && !(pd>7)) return false;
    if(pdays==='mid' && !(pd>=3&&pd<=7)) return false;
    if(pdays==='low' && !(pd<3)) return false;`
);


// Replace static HTML cards for empestpend.html
const oldEstCards = `<div class="stat-card sc-blue"><div class="stat-icon si-blue">&#128202;</div><div class="stat-label">Total Estimation</div><div class="stat-value" id="stat-total">-</div><div class="stat-sub">Active records</div></div>
      <div class="stat-card sc-red"><div class="stat-icon si-red">&#128308;</div><div class="stat-label">Critical (&gt;60 days)</div><div class="stat-value" id="stat-high">-</div><div class="stat-sub">Needs immediate follow-up</div></div>
      <div class="stat-card sc-amber"><div class="stat-icon si-amber">&#9888;</div><div class="stat-label">Repair Orders</div><div class="stat-value" id="stat-repair">-</div><div class="stat-sub">Order Type: Repair</div></div>
      <div class="stat-card sc-green"><div class="stat-icon si-green">&#9989;</div><div class="stat-label">New Orders</div><div class="stat-value" id="stat-new">-</div><div class="stat-sub">Order Type: New</div></div>`;

const newEstCards = `<div class="stat-card sc-blue" onclick="filterByCard('all')"><div class="stat-icon si-blue">&#128202;</div><div class="stat-label">Total Estimation</div><div class="stat-value" id="stat-total">-</div><div class="stat-sub">Active records</div></div>
      <div class="stat-card sc-green" onclick="filterByCard('normal')"><div class="stat-icon si-green">&#9989;</div><div class="stat-label">Normal (&lt;3 days)</div><div class="stat-value" id="stat-new">-</div><div class="stat-sub">Fresh pending entries</div></div>
      <div class="stat-card sc-amber" onclick="filterByCard('warning')"><div class="stat-icon si-amber">&#9888;</div><div class="stat-label">Warning (3-7 days)</div><div class="stat-value" id="stat-repair">-</div><div class="stat-sub">Needs follow-up</div></div>
      <div class="stat-card sc-red" onclick="filterByCard('critical')"><div class="stat-icon si-red">&#128308;</div><div class="stat-label">Critical (&gt;7 days)</div><div class="stat-value" id="stat-high">-</div><div class="stat-sub">Needs immediate action</div></div>`;

estContent = estContent.replace(oldEstCards, newEstCards);

fs.writeFileSync('frontend/public/empestpend.html', estContent);
console.log('Fixed both OB pending and EST pending');
