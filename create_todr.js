const fs = require('fs');

let sccr = fs.readFileSync('frontend/public/sccr.html', 'utf8');

// Title
sccr = sccr.replace('<title>SchillerIndia   Closed PRF/OB Register</title>', '<title>SchillerIndia - TO/DR Register</title>');

sccr = sccr.replace('<a class="nav-item active" href="sccr.html">', '<a class="nav-item" href="sccr.html">');
const todrLink = '<a class="nav-item active" href="todr.html"><span class="ico">&#128196;</span> TO/DR</a>';
sccr = sccr.replace(/<div class="nav-sec">Work Orders<\/div>/, `<div class="nav-sec">Work Orders</div>\n    ${todrLink}`);

const contentStart = sccr.indexOf('<div class="content">');
if (contentStart === -1) throw new Error('Could not find content div');

const headerPart = sccr.substring(0, contentStart);

const newContentAndScript = `
  <div class="content">
    <div class="table-card">
      <div class="table-top">
        <div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--text);font-size:15px;">TO/DR Register</div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary btn-sm" onclick="openAddModal()">&#43; Add New Entry</button>
          <button class="btn btn-outline btn-sm" onclick="loadData()">&#10227; Refresh</button>
        </div>
      </div>
      
      <div class="table-wrap">
        <table class="frn-table">
          <thead>
            <tr>
              <th>Entry Date</th>
              <th>FRN No</th>
              <th>Part No</th>
              <th>Description</th>
              <th>Action</th>
              <th style="width:70px;text-align:center;">Edit</th>
              <th style="width:70px;text-align:center;">Del</th>
            </tr>
          </thead>
          <tbody id="tb">
            <tr><td colspan="7" style="text-align:center;padding:30px;">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</main>

<!-- ADD / UPDATE MODAL -->
<div class="modal-overlay" id="todr-modal">
  <div class="add-modal-box">
    <div class="modal-head">
      <div>
        <div class="modal-title" id="m-title">Add TO/DR</div>
        <div class="modal-sub">Fill out the form below</div>
      </div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body" style="background:#fff;">
      <input type="hidden" id="f-id">
      
      <div class="detail-item">
        <div class="detail-section-title">Record Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" class="ff">
          <div><label style="font-size:10px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">Entry Date</label><input type="date" id="f-date"></div>
          <div><label style="font-size:10px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">FRN No</label><input type="text" id="f-frn" placeholder="Enter FRN"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;" class="ff">
          <div><label style="font-size:10px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">Part No</label><input type="text" id="f-part" placeholder="Enter Part No"></div>
          <div><label style="font-size:10px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">Action</label><input type="text" id="f-action" placeholder="Enter Action"></div>
        </div>
        <div style="margin-top:14px;" class="ff">
          <label style="font-size:10px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">Description</label>
          <textarea id="f-desc" rows="3" placeholder="Enter Description"></textarea>
        </div>
      </div>
    </div>
    <div class="modal-foot" style="background:var(--surface3);padding:16px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
      <div id="m-msg" class="form-msg"></div>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-btn" onclick="saveRecord()">&#128190; Save Record</button>
    </div>
  </div>
</div>

<script>
  // Topbar dates and user
  const u = JSON.parse(sessionStorage.getItem('schiller_user') || '{}');
  const dstr = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const tbd = document.getElementById('topbar-date'); if(tbd) tbd.textContent = dstr;
  const nms = document.querySelectorAll('#admin-name, #user-nm'); nms.forEach(e => { if(e) e.textContent = u.name || 'User'; });
  const avs = document.querySelectorAll('#admin-avatar, #user-av'); avs.forEach(e => { if(e) e.textContent = (u.name||'U').charAt(0).toUpperCase(); });
  const rls = document.querySelectorAll('#admin-role, #user-rl'); rls.forEach(e => { if(e) e.textContent = u.designation || 'Coordinator'; });

  function hdrs(){ return {"Content-Type":"application/json", "Authorization":"Bearer "+(sessionStorage.getItem('schiller_token')||"")}; }
  function logout(){ sessionStorage.clear(); localStorage.clear(); window.location.href="login.html"; }

  let records = [];

  async function loadData() {
    try {
      const res = await fetch('/api/todr', { headers: hdrs() });
      if(res.status===401||res.status===403) return logout();
      const data = await res.json();
      if(res.ok) { records = data; renderTable(); }
    } catch(e) { console.error(e); }
  }

  function renderTable() {
    const tb = document.getElementById('tb');
    if(!records.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">No TO/DR entries found.</td></tr>'; return; }
    
    tb.innerHTML = records.map(r => \`
      <tr>
        <td>\${r.entryDate ? new Date(r.entryDate).toLocaleDateString('en-IN') : '-'}</td>
        <td><span style="font-weight:700;color:var(--accent);">\${esc(r.frnNo)}</span></td>
        <td>\${esc(r.partNo)}</td>
        <td class="wrap-cell">\${esc(r.description)}</td>
        <td><span style="background:var(--surface2);padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;">\${esc(r.action)}</span></td>
        <td style="text-align:center;"><button class="btn-xs update" onclick="openEdit('\${r._id}')">&#9999;&#65039;</button></td>
        <td style="text-align:center;"><button class="btn-xs" style="color:var(--red);" onclick="delRecord('\${r._id}')">&#128465;</button></td>
      </tr>
    \`).join('');
  }

  function openAddModal() {
    document.getElementById('f-id').value = '';
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('f-frn').value = '';
    document.getElementById('f-part').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-action').value = '';
    document.getElementById('m-title').innerHTML = '&#10133; Add TO/DR';
    msg('');
    document.getElementById('todr-modal').classList.add('open');
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
    document.getElementById('m-title').innerHTML = '&#9998; Edit TO/DR';
    msg('');
    document.getElementById('todr-modal').classList.add('open');
  }

  function closeModal() { document.getElementById('todr-modal').classList.remove('open'); }
  function msg(m, err=false) { 
    const e=document.getElementById('m-msg'); 
    e.textContent=m; 
    e.style.display=m?'block':'none';
    if(err) { e.style.background='rgba(185,28,28,0.1)'; e.style.color='var(--red)'; }
    else { e.style.background='rgba(4,120,87,0.1)'; e.style.color='var(--green)'; }
  }

  async function saveRecord() {
    const id = document.getElementById('f-id').value;
    const payload = {
      entryDate: document.getElementById('f-date').value,
      frnNo: document.getElementById('f-frn').value,
      partNo: document.getElementById('f-part').value,
      description: document.getElementById('f-desc').value,
      action: document.getElementById('f-action').value
    };
    if(!payload.entryDate || !payload.frnNo || !payload.partNo || !payload.description || !payload.action) {
      return msg('All fields are required.', true);
    }
    
    const btn = document.getElementById('save-btn');
    btn.disabled=true; btn.textContent='Saving...';
    try {
      const url = id ? \`/api/todr/\${id}\` : '/api/todr';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(payload) });
      const json = await res.json().catch(()=>{});
      if(!res.ok) throw new Error(json?.message || 'Server error');
      closeModal();
      loadData();
    } catch(e) {
      msg(e.message, true);
    } finally {
      btn.disabled=false; btn.innerHTML='&#128190; Save Record';
    }
  }

  async function delRecord(id) {
    if(!confirm('Delete this record permanently?')) return;
    try {
      await fetch(\`/api/todr/\${id}\`, { method: 'DELETE', headers: hdrs() });
      loadData();
    } catch(e) { alert('Failed to delete'); }
  }

  function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  
  // Close modal when clicking outside
  document.getElementById('todr-modal').addEventListener('click', e => { if(e.target.id==='todr-modal') closeModal(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

  loadData();
</script>
</body>
</html>
`;

// Inject basic modal styles missing from sccr
const modalStyles = `
<style>
.modal-overlay{position:fixed;inset:0;background:rgba(5,18,38,0.6);backdrop-filter:blur(5px);z-index:2000;display:none;align-items:center;justify-content:center;}
.modal-overlay.open{display:flex;}
.add-modal-box{background:var(--surface);width:90%;max-width:650px;border-radius:14px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;animation:fadeUp 0.2s ease;}
.modal-head{padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface3);border-radius:14px 14px 0 0;}
.modal-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;}
.modal-sub{font-size:11px;color:var(--muted);}
.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);}
.modal-close:hover{color:var(--red);}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
</style>
`;

let finalHtml = headerPart.replace('</head>', modalStyles + '\n</head>') + newContentAndScript;

fs.writeFileSync('frontend/public/todr.html', finalHtml, 'utf8');
console.log('Created todr.html');
