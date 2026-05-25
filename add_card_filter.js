const fs = require('fs');

// ───────────────────────────────────────────────────────────────
// emppendingfrn.html
// ───────────────────────────────────────────────────────────────
{
  const file = 'frontend/public/emppendingfrn.html';
  let c = fs.readFileSync(file, 'utf8');

  // 1) Add CSS for active card
  c = c.replace(
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}',
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}\n.stat-card{cursor:pointer;}\n.stat-card.card-active{outline:2.5px solid var(--accent);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-md);}'
  );

  // 2) Add filterByCard and update updateStats to wire onclick on cards
  // Find the updateStats that sets s-normal, s-warn, s-critical and add onclick
  c = c.replace(
    "cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;3 days)</div><div class=\"stat-value\" id=\"s-norm",
    "cards[1].setAttribute('onclick',\"filterByCard('normal')\");cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;3 days)</div><div class=\"stat-value\" id=\"s-norm"
  );
  c = c.replace(
    "cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (3-7 days)</div><div class=\"stat-value\" id=\"s-warn\"",
    "cards[2].setAttribute('onclick',\"filterByCard('warning')\");cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (3-7 days)</div><div class=\"stat-value\" id=\"s-warn\""
  );
  c = c.replace(
    "cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;7 days)</div><div class=\"stat-value\" id=\"s-cr",
    "cards[3].setAttribute('onclick',\"filterByCard('critical')\");cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;7 days)</div><div class=\"stat-value\" id=\"s-cr"
  );

  // 3) Also wire the first (Total) card to reset
  c = c.replace(
    "cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-label\">Total SO Pending</div><div class=\"stat",
    "cards[0].setAttribute('onclick',\"filterByCard('all')\");cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-label\">Total SO Pending</div><div class=\"stat"
  );

  // 4) Add filterByCard function before applyFilters
  const filterByCardFRN = `
let _activeCardFilter = 'all';
function filterByCard(type) {
  _activeCardFilter = type;
  document.querySelectorAll('.stats-row .stat-card').forEach(c => c.classList.remove('card-active'));
  const idx = {all:0,normal:1,warning:2,critical:3}[type];
  if(idx !== undefined) {
    const cards = document.querySelectorAll('.stats-row .stat-card');
    if(cards[idx]) cards[idx].classList.add('card-active');
  }
  applyFilters();
  window.scrollTo({top: document.querySelector('.table-card') ? document.querySelector('.table-card').offsetTop - 10 : 0, behavior:'smooth'});
}
`;
  c = c.replace('function applyFilters(){', filterByCardFRN + 'function applyFilters(){');

  // 5) Inject card filter into applyFilters
  // Find the filter block that builds filtered and inject the card condition
  c = c.replace(
    "filtered=FRN_DATA.filter(d=>{",
    "filtered=FRN_DATA.filter(d=>{\n    if(_activeCardFilter==='normal' && !(d.pdays<3)) return false;\n    if(_activeCardFilter==='warning' && !(d.pdays>=3&&d.pdays<=7)) return false;\n    if(_activeCardFilter==='critical' && !(d.pdays>7)) return false;"
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log('emppendingfrn.html done');
}

// ───────────────────────────────────────────────────────────────
// employee-ob-pending.html
// ───────────────────────────────────────────────────────────────
{
  const file = 'frontend/public/employee-ob-pending.html';
  let c = fs.readFileSync(file, 'utf8');

  c = c.replace(
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}',
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}\n.stat-card{cursor:pointer;}\n.stat-card.card-active{outline:2.5px solid var(--accent);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-md);}'
  );

  c = c.replace(
    "cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-label\">Total Estimation</div><div class=\"stat-value\" id=\"stat-tot",
    "cards[0].setAttribute('onclick',\"filterByCard('all')\");cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-label\">Total Estimation</div><div class=\"stat-value\" id=\"stat-tot"
  );
  c = c.replace(
    "cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;3 days)</div><div class=\"stat-value\" id=\"stat-l",
    "cards[1].setAttribute('onclick',\"filterByCard('normal')\");cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;3 days)</div><div class=\"stat-value\" id=\"stat-l"
  );
  c = c.replace(
    "cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (3-7 days)</div><div class=\"stat-value\" id=\"stat-mi",
    "cards[2].setAttribute('onclick',\"filterByCard('warning')\");cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (3-7 days)</div><div class=\"stat-value\" id=\"stat-mi"
  );
  c = c.replace(
    "cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;7 days)</div><div class=\"stat-value\" id=\"stat",
    "cards[3].setAttribute('onclick',\"filterByCard('critical')\");cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;7 days)</div><div class=\"stat-value\" id=\"stat"
  );

  // OB uses pdOb field; low=<30, mid=30-90, high=>90
  const filterByCardOB = `
let _activeCardFilter = 'all';
function filterByCard(type) {
  _activeCardFilter = type;
  document.querySelectorAll('.stats-row .stat-card').forEach(c => c.classList.remove('card-active'));
  const idx = {all:0,normal:1,warning:2,critical:3}[type];
  if(idx !== undefined) {
    const cards = document.querySelectorAll('.stats-row .stat-card');
    if(cards[idx]) cards[idx].classList.add('card-active');
  }
  applyFilters();
  window.scrollTo({top: document.querySelector('.table-card') ? document.querySelector('.table-card').offsetTop - 10 : 0, behavior:'smooth'});
}
`;
  c = c.replace('function applyFilters(){', filterByCardOB + 'function applyFilters(){');

  // OB applyFilters uses pdOb field; normal=<3days used in card labels for est tab
  // But the OB data uses pdOb: low<30, mid 30-90, high>90
  c = c.replace(
    "filtered=allRecords.filter(s=>{",
    "filtered=allRecords.filter(s=>{\n    if(_activeCardFilter==='normal' && !(s.pdOb<30)) return false;\n    if(_activeCardFilter==='warning' && !(s.pdOb>=30&&s.pdOb<=90)) return false;\n    if(_activeCardFilter==='critical' && !(s.pdOb>90)) return false;"
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log('employee-ob-pending.html done');
}

// ───────────────────────────────────────────────────────────────
// empestpend.html
// ───────────────────────────────────────────────────────────────
{
  const file = 'frontend/public/empestpend.html';
  let c = fs.readFileSync(file, 'utf8');

  c = c.replace(
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}',
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}\n.stat-card{cursor:pointer;}\n.stat-card.card-active{outline:2.5px solid var(--accent);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-md);}'
  );

  c = c.replace(
    "cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;10 days)</div><div class=\"s",
    "cards[1].setAttribute('onclick',\"filterByCard('normal')\");cards[1].innerHTML='<div class=\"stat-icon si-green\">&#9989;</div><div class=\"stat-label\">Normal (&lt;10 days)</div><div class=\"s"
  );
  c = c.replace(
    "cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (10-20 days)</div><div class=\"s",
    "cards[2].setAttribute('onclick',\"filterByCard('warning')\");cards[2].innerHTML='<div class=\"stat-icon si-amber\">&#9888;</div><div class=\"stat-label\">Warning (10-20 days)</div><div class=\"s"
  );
  c = c.replace(
    "cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;20 days)</div><div class=",
    "cards[3].setAttribute('onclick',\"filterByCard('critical')\");cards[3].innerHTML='<div class=\"stat-icon si-red\">&#128308;</div><div class=\"stat-label\">Critical (&gt;20 days)</div><div class="
  );
  c = c.replace(
    "cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-lbl\">Total Estimation</div><div class=\"stat",
    "cards[0].setAttribute('onclick',\"filterByCard('all')\");cards[0].innerHTML='<div class=\"stat-icon si-blue\">&#128202;</div><div class=\"stat-lbl\">Total Estimation</div><div class=\"stat"
  );

  const filterByCardEst = `
let _activeCardFilter = 'all';
function filterByCard(type) {
  _activeCardFilter = type;
  document.querySelectorAll('.stats-row .stat-card').forEach(c => c.classList.remove('card-active'));
  const idx = {all:0,normal:1,warning:2,critical:3}[type];
  if(idx !== undefined) {
    const cards = document.querySelectorAll('.stats-row .stat-card');
    if(cards[idx]) cards[idx].classList.add('card-active');
  }
  applyFilters();
  window.scrollTo({top: document.querySelector('.table-card') ? document.querySelector('.table-card').offsetTop - 10 : 0, behavior:'smooth'});
}
`;
  c = c.replace('function applyFilters(){', filterByCardEst + 'function applyFilters(){');

  c = c.replace(
    "filtered=allRecords.filter(s=>{",
    "filtered=allRecords.filter(s=>{\n    if(_activeCardFilter==='normal' && !(s.pdEst<10)) return false;\n    if(_activeCardFilter==='warning' && !(s.pdEst>=10&&s.pdEst<=20)) return false;\n    if(_activeCardFilter==='critical' && !(s.pdEst>20)) return false;"
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log('empestpend.html done');
}

// ───────────────────────────────────────────────────────────────
// empunderep.html
// ───────────────────────────────────────────────────────────────
{
  const file = 'frontend/public/empunderep.html';
  let c = fs.readFileSync(file, 'utf8');

  c = c.replace(
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}',
    '.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}\n.stat-card{cursor:pointer;}\n.stat-card.card-active{outline:2.5px solid var(--accent);outline-offset:2px;transform:translateY(-2px);box-shadow:var(--shadow-md);}'
  );

  c = c.replace(
    "cards[1].innerHTML='<div class=\"stat-ico ico-green\">&#9989;</div><div class=\"stat-lbl\">Normal (&lt;7 days)</div><div class=\"stat",
    "cards[1].setAttribute('onclick',\"filterByCard('normal')\");cards[1].innerHTML='<div class=\"stat-ico ico-green\">&#9989;</div><div class=\"stat-lbl\">Normal (&lt;7 days)</div><div class=\"stat"
  );
  c = c.replace(
    "cards[2].innerHTML='<div class=\"stat-ico ico-amber\">&#9888;</div><div class=\"stat-lbl\">Warning (7-15 days)</div><div class=\"stat",
    "cards[2].setAttribute('onclick',\"filterByCard('warning')\");cards[2].innerHTML='<div class=\"stat-ico ico-amber\">&#9888;</div><div class=\"stat-lbl\">Warning (7-15 days)</div><div class=\"stat"
  );
  c = c.replace(
    "cards[3].innerHTML='<div class=\"stat-ico ico-red\">&#128308;</div><div class=\"stat-lbl\">Critical (&gt;15 days)</div><div class=\"s",
    "cards[3].setAttribute('onclick',\"filterByCard('critical')\");cards[3].innerHTML='<div class=\"stat-ico ico-red\">&#128308;</div><div class=\"stat-lbl\">Critical (&gt;15 days)</div><div class=\"s"
  );
  c = c.replace(
    "cards[0].innerHTML='<div class=\"stat-ico ico-blue\">&#128202;</div><div class=\"stat-lbl\">Total Under Repair</div><div class=\"stat",
    "cards[0].setAttribute('onclick',\"filterByCard('all')\");cards[0].innerHTML='<div class=\"stat-ico ico-blue\">&#128202;</div><div class=\"stat-lbl\">Total Under Repair</div><div class=\"stat"
  );

  const filterByCardUR = `
let _activeCardFilter = 'all';
function filterByCard(type) {
  _activeCardFilter = type;
  document.querySelectorAll('.stats-row .stat-card').forEach(c => c.classList.remove('card-active'));
  const idx = {all:0,normal:1,warning:2,critical:3}[type];
  if(idx !== undefined) {
    const cards = document.querySelectorAll('.stats-row .stat-card');
    if(cards[idx]) cards[idx].classList.add('card-active');
  }
  applyFilters();
  window.scrollTo({top: document.querySelector('.table-card') ? document.querySelector('.table-card').offsetTop - 10 : 0, behavior:'smooth'});
}
`;
  c = c.replace('function applyFilters(){', filterByCardUR + 'function applyFilters(){');

  c = c.replace(
    "filtered = UR_DATA.filter(d=>{",
    "filtered = UR_DATA.filter(d=>{\n    if(_activeCardFilter==='normal' && !(d.pdays<7)) return false;\n    if(_activeCardFilter==='warning' && !(d.pdays>=7&&d.pdays<=15)) return false;\n    if(_activeCardFilter==='critical' && !(d.pdays>15)) return false;"
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log('empunderep.html done');
}

console.log('\nAll 4 pages updated!');
