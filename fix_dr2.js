const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'dr.html');
let content = fs.readFileSync(p, 'utf8');

const regex = /let records = \[\];[\s\S]*?async function updateDateField/m;
const replacement = `let records = [];

  async function loadData() {
    try {
      const res = await fetch('/api/dr', { headers: hdrs() });
      if(res.status===401||res.status===403) return logout();
      const data = await res.json();
      if(res.ok) { records = data; renderTable(); }
    } catch(e) { console.error(e); }
  }

  function renderTable() {
    const tb = document.getElementById('tb');
    if(!records.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No DR entries found.</td></tr>'; return; }
    
    tb.innerHTML = records.map(r => \`
      <tr>
        <td>\${r.entryDate ? new Date(r.entryDate).toLocaleDateString('en-IN') : '-'}</td>
        <td><span style="font-weight:700;color:var(--accent);">\${esc(r.frnNo)}</span></td>
        <td>\${esc(r.partNo)}</td>
        <td>\${esc(r.model || '-')}</td>
        <td class="wrap-cell">\${esc(r.description)}</td>
        <td>\${esc(r.unitStatus || '-')}</td>
        <td><input type="date" max="\${TODAY_ISO}" value="\${dateInputValue(r.sparesReceivedDate)}" onchange="updateDateField('\${r._id}','sparesReceivedDate',this.value)" style="width:130px; padding:4px; border:1px solid var(--border); border-radius:4px; font-family:'Plus Jakarta Sans',sans-serif; font-size:12px;"></td>
        <td style="text-align:center;"><button class="btn btn-primary btn-sm" onclick="markFulfilled('\${r._id}')">Fulfilled</button></td>
      </tr>
    \`).join('');
  }

  const TODAY_ISO = new Date().toISOString().split('T')[0];
  function dateInputValue(val) {
    if (!val) return '';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  async function updateDateField`;
content = content.replace(regex, replacement);
fs.writeFileSync(p, content, 'utf8');
console.log('Fixed dr.html script again');
