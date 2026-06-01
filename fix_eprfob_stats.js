const fs = require('fs');
const path = require('path');

const eprfobPath = path.join(__dirname, 'frontend/public/eprfob.html');
let eprfob = fs.readFileSync(eprfobPath, 'utf8');

// 1. Replace the stats-row HTML
const statsRowRegex = /<div class="stats-row">[\s\S]*?<!-- TO\/SO Details -->/;
const newStatsRow = `<div class="stats-row">
          <div class="stat-card sc-blue">
            <div class="stat-icon si-blue">&#128196;</div><div class="stat-label">Total Entries</div>
            <div class="stat-value" id="s-total">-</div><div class="stat-sub">TO/SO records</div>
          </div>
          <div class="stat-card sc-purple">
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
          </div>
        </div>

        <!-- TO/SO Details -->`;

eprfob = eprfob.replace(statsRowRegex, newStatsRow);

// 2. Replace the calcDays and updateStats JS functions
const updateStatsRegex = /function calcDays\(d\) \{[\s\S]*?function updateStats\(\) \{[\s\S]*?\}\s*async function savePRFEntry\(\)/;
const newUpdateStats = `function updateStats() {
      const d = prfobData;
      (document.getElementById('s-total')||{}).textContent = d.length;
      
      const now = new Date();
      now.setHours(0,0,0,0);
      
      let below1 = 0, oneTo3 = 0, greater3 = 0;
      
      d.forEach(row => {
        const dStr = row.entryDate || row.raisedDate || row.createdAt;
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
    }

    async function savePRFEntry()`;

eprfob = eprfob.replace(updateStatsRegex, newUpdateStats);

fs.writeFileSync(eprfobPath, eprfob, 'utf8');
console.log('Successfully updated eprfob summary cards.');
