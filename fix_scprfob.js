const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/scprfob.html');
let content = fs.readFileSync(p, 'utf8');

// 1. thead changes
const theadOld = `          <thead><tr>
            <th onclick="sortBy('_id')" class="sorted" style="width:46px;">Id <span class="si">&#8597;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8597;</span></th>
            <th onclick="sortBy('entryDate')">Entry Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('scEng')">SC Engg <span class="si">&#8597;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8597;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8597;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8597;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8597;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('refNo')">TO/SO Ref No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('crmRefNo')">GIR No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('sparesReceivedAtSvc')">Spares Rcv Date <span class="si">&#8597;</span></th>
            <th class="no-sort">Action</th>
          </tr></thead>`;
const theadNew = `          <thead><tr>
            <th onclick="sortBy('entryDate')" class="sorted">Entry Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8597;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8597;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8597;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8597;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8597;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('refNo')">TO/SO Ref No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('sparesReceivedAtSvc')">Spares Rcv Date <span class="si">&#8597;</span></th>
            <th class="no-sort">Action</th>
          </tr></thead>`;

content = content.replace(theadOld, theadNew);
content = content.replace('colspan="15"', 'colspan="12"');
content = content.replace('colspan="15"', 'colspan="12"');

// 2. tbody changes
const tbodyOld = `        <td class="mono" style="color:var(--muted);">\${(currentPage-1)*perPage+i+1}</td>
        <td><span class="div-tag">\${esc(d.division||'-')}</span></td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-weight:600;">\${esc(d.scEng||'-')}</td>
        <td>\${typePill(d.type)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="branch-tag">\${esc(d.branch||'-')}</span></td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||'-')}</td>
        <td style="font-weight:600;">\${esc(d.model||'-')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||'-')}</td>
        <td class="mono">\${esc(d.crmRefNo||'-')}</td>
        <td>\${statusPill(d.status)}</td>
        <td>\${d.status === 'Open' ? \`<input type="date" id="inline-date-\${rid}" value="\${d.sparesReceivedAtSvc||''}" class="frm-inp" style="padding: 2px 4px; font-size: 11px; max-width: 110px;">\` : \`<span style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</span>\`}</td>`;

const tbodyNew = `        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="div-tag">\${esc(d.division||'-')}</span></td>
        <td>\${typePill(d.type)}</td>
        <td><span class="branch-tag">\${esc(d.branch||'-')}</span></td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||'-')}</td>
        <td style="font-weight:600;">\${esc(d.model||'-')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||'-')}</td>
        <td>\${statusPill(d.status)}</td>
        <td>\${d.status === 'Open' ? \`<input type="date" id="inline-date-\${rid}" value="\${d.sparesReceivedAtSvc||''}" class="frm-inp" style="padding: 2px 4px; font-size: 11px; max-width: 110px;">\` : \`<span style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</span>\`}</td>`;

content = content.replace(tbodyOld, tbodyNew);

// 3. aging buckets
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

// 4. aging logic
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
console.log('Done replacing everything!');
