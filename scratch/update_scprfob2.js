const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/scprfob.html');
let content = fs.readFileSync(p, 'utf8');

const oldCards = `      <div class="stat-card sc-purple">
        <div class="stat-icon si-purple">&#128221;</div><div class="stat-label">TO Entries</div>
        <div class="stat-value" id="s-prf">-</div><div class="stat-sub">Transfer orders</div>
      </div>
      <div class="stat-card sc-amber">
        <div class="stat-icon si-amber">&#128230;</div><div class="stat-label">SO Entries</div>
        <div class="stat-value" id="s-ob">-</div><div class="stat-sub">Sales orders</div>
      </div>
      <div class="stat-card sc-green">
        <div class="stat-icon si-green">&#9989;</div><div class="stat-label">Open Entries</div>
        <div class="stat-value" id="s-open">-</div><div class="stat-sub">Currently active</div>
      </div>`;

const newCards = `      <div class="stat-card sc-purple">
        <div class="stat-icon si-purple">&#128221;</div><div class="stat-label">Below 1 Day</div>
        <div class="stat-value" id="s-prf">-</div><div class="stat-sub">Entries < 1 day</div>
      </div>
      <div class="stat-card sc-amber">
        <div class="stat-icon si-amber">&#128230;</div><div class="stat-label">1 to 3 Days</div>
        <div class="stat-value" id="s-ob">-</div><div class="stat-sub">Entries 1 to 3 days</div>
      </div>
      <div class="stat-card sc-green">
        <div class="stat-icon si-green">&#9989;</div><div class="stat-label">Greater than 3 Days</div>
        <div class="stat-value" id="s-open">-</div><div class="stat-sub">Entries > 3 days</div>
      </div>`;

content = content.replace(oldCards, newCards);

const oldStats = `function updateStats(){
  (document.getElementById('s-total')||{}).textContent = DATA.length;
  (document.getElementById('s-prf')||{}).textContent = DATA.filter(d => normalizeToSoType(d.type) === 'TO').length;
  (document.getElementById('s-ob')||{}).textContent = DATA.filter(d => normalizeToSoType(d.type) === 'SO').length;
  (document.getElementById('s-open')||{}).textContent = DATA.filter(d => d.status === 'Open').length;
}`;

const newStats = `function updateStats(){
  (document.getElementById('s-total')||{}).textContent = DATA.length;
  
  const now = new Date();
  now.setHours(0,0,0,0);
  
  let below1 = 0, oneTo3 = 0, greater3 = 0;
  
  DATA.forEach(d => {
    const dStr = d.entryDate || d.raisedDate || d.createdAt;
    if(!dStr) { greater3++; return; }
    const ed = new Date(dStr);
    ed.setHours(0,0,0,0);
    const diffDays = Math.floor((now - ed) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) below1++;
    else if (diffDays <= 3) oneTo3++;
    else greater3++;
  });

  (document.getElementById('s-prf')||{}).textContent = below1;
  (document.getElementById('s-ob')||{}).textContent = oneTo3;
  (document.getElementById('s-open')||{}).textContent = greater3;
}`;

content = content.replace(oldStats, newStats);

fs.writeFileSync(p, content, 'utf8');
console.log('done2');
