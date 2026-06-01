const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'dr.html');
let content = fs.readFileSync(p, 'utf8');

const regex = /async function updateDateField[\s\S]*?async function saveRecord/m;
const replacement = `async function updateDateField(id, field, value) {
    try {
      const payload = {};
      payload[field] = value;
      const res = await fetch(\`/api/dr/\${id}\`, {
        method: 'PUT',
        headers: hdrs(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>{});
      if(!res.ok) {
        msg(data.message || 'Failed to update date', true);
        loadData();
      } else {
        const idx = records.findIndex(r => r._id === id);
        if (idx !== -1) records[idx][field] = value;
        msg('Date updated successfully');
      }
    } catch(e) {
      msg('Error updating date: ' + e.message, true);
      loadData();
    }
  }

  function openAddModal() {
    document.getElementById('f-id').value = '';
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('f-frn').value = '';
    document.getElementById('f-part').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-action').value = '';
    document.getElementById('m-title').innerHTML = '&#10133; Add DR';
    msg('');
    document.getElementById('dr-modal').classList.add('open');
  }

  function openEdit(id) {
    const r = records.find(x => x._id === id);
    if(!r) return;
    document.getElementById('f-id').value = r._id;
    document.getElementById('f-date').value = r.entryDate ? new Date(r.entryDate).toISOString().split('T')[0] : '';
    document.getElementById('f-frn').value = r.frnNo || '';
    document.getElementById('f-part').value = r.partNo || '';
    document.getElementById('f-desc').value = r.description || '';
    document.getElementById('f-action').value = r.action || '';
    document.getElementById('m-title').innerHTML = '&#9998; Edit DR';
    msg('');
    document.getElementById('dr-modal').classList.add('open');
  }

  function closeModal() { document.getElementById('dr-modal').classList.remove('open'); }
  function msg(m, err=false) { 
    const e=document.getElementById('m-msg'); 
    e.textContent=m; 
    e.style.display=m?'block':'none';
    if(err) { e.style.background='rgba(185,28,28,0.1)'; e.style.color='var(--red)'; }
    else { e.style.background='rgba(4,120,87,0.1)'; e.style.color='var(--green)'; }
  }

  async function saveRecord`;
content = content.replace(regex, replacement);
fs.writeFileSync(p, content, 'utf8');
console.log('Fixed dr.html script');
