const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/public/empunderep.html');
const content = fs.readFileSync(file, 'utf8');

const missingScript = `
function handleUnauth(res){
  if (res.status===401) {
    showToast('Session expired — logging out.','err');
    setTimeout(()=>{ localStorage.clear(); window.location.href='login.html'; },1500);
    throw new Error('Unauthorized');
  }
}

// ── Load from /api/emp/services, filter repType = TO/ADV SO ──
async function loadData() {
  setTableLoading(); setLoading(true);
  try {
    const res = await fetch(\`\${API}/api/emp/services\`, { headers: authHeaders() });
    handleUnauth(res);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const all = await res.json();
    UR_DATA = all
      .filter(d => d.repType === 'TO/ADV SO')
      .map((d, i) => ({
        ...d,
        _idx:         i + 1,
        pdays:        Math.floor((Date.now() - new Date(d.entryDate||d.createdAt).getTime()) / 86400000),
        urTypeWork:   d.urTypeWork  || d.typeWork  || 'UNDER REPAIR',
        urRepairTeam: d.urRepairTeam|| d.raEng     || '',
      }));
    populateFilters(); applyFilters(); updateStats();
    showToast('Loaded '+UR_DATA.length+' Under Repair record'+(UR_DATA.length!==1?'s':''), 'info');
  } catch (e) {
    if (e.message==='Unauthorized') return;
    setTableError('Could not load data: '+e.message);
    showToast('Load failed: '+e.message,'err');
  } finally { setLoading(false); }
}

function populateFilters() {
  const engs = [...new Set(UR_DATA.map(d=>d.scEng).filter(Boolean))].sort();
  const sel  = document.getElementById('fl-sceng');
  sel.innerHTML = '<option value="">All Engineers</option>';
  engs.forEach(e=>{ const o=document.createElement('option');o.value=e;o.textContent=e;sel.appendChild(o); });
}

async function openRepairModal(id) {
  const current = UR_DATA.find(x=>(x._id||x.id)===id);
  if (!current) return;
  if (current.rturSent||current.rtfrnSent) { showToast('Already sent to RT UR.','info'); return; }
  const sentAt = new Date().toISOString();
  const rtPayload = {
    entryDate: current.entryDate||sentAt.split('T')[0],
    division:  normalizeRtDivision(current),
    scRefNo:   current.scReNo||'',
    defGirNo:  current.defGir||'',
    category:  'UR',
    model:     current.model||'',
    defBrdModName: current.defMod||'',
    status:    'pending',
    submittedBy: EMP_NAME||'',
    submittedAt: sentAt,
  };
  try {
    const createRes = await fetch(\`\${API}/api/rtur\`,{ method:'POST',headers:authHeaders(),body:JSON.stringify(rtPayload) });
    handleUnauth(createRes);
    if (!createRes.ok) { const e=await createRes.json().catch(()=>({})); throw new Error(e.message||'HTTP '+createRes.status); }
    const flagRes = await fetch(\`\${API}/api/emp/services/\${id}\`,{ method:'PUT',headers:authHeaders(),body:JSON.stringify({ rturSent:true,rturSentAt:sentAt }) });
    handleUnauth(flagRes);
    const updated = await flagRes.json().catch(()=>null);
    const idx = UR_DATA.findIndex(d=>(d._id||d.id)===id);
    if (idx!==-1) UR_DATA[idx] = { ...UR_DATA[idx],...(updated||{}),rturSent:true,rturSentAt:sentAt };
    applyFilters(); updateStats();
    showToast('Sent to RT UR successfully.','ok');
  } catch(e) {
    if (e.message!=='Unauthorized') showToast('Repair send failed: '+e.message,'err');
  }
}

function updateStats() {
  const total   = UR_DATA.length;
  const overdue = UR_DATA.filter(d=>d.pdays>15).length;
  const mine    = UR_DATA.filter(d=>d.pdays>=7&&d.pdays<=15).length;
  const avg     = UR_DATA.filter(d=>d.pdays<7).length;
  document.getElementById('st-total').textContent   = total;
  document.getElementById('st-overdue').textContent = overdue;
  document.getElementById('st-mine').textContent    = mine;
  document.getElementById('st-avg').textContent     = avg;
}

function clearDateFilter(){ document.getElementById('fl-from').value=''; document.getElementById('fl-to').value=''; applyFilters(); }
function clearAllFilters(){
  ['fl-from','fl-to','fl-region','fl-unitsts','fl-sceng'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('tbl-search').value='';
  applyFilters();
}

function applyFilters(){
  const q     = document.getElementById('tbl-search').value.toLowerCase();
  const reg   = document.getElementById('fl-region').value;
  const uts   = document.getElementById('fl-unitsts').value;
  const sceng = document.getElementById('fl-sceng').value;
  const from  = document.getElementById('fl-from').value;
  const to    = document.getElementById('fl-to').value;
  filtered = UR_DATA.filter(d=>{
    const edate = (d.entryDate||'').slice(0,10);
    return (!q    || Object.values(d).some(v=>String(v||'').toLowerCase().includes(q))) &&
           (!reg   || d.reg===reg) &&
           (!uts   || d.unitSts===uts) &&
           (!sceng || d.scEng===sceng) &&
           (!from  || edate>=from) &&
           (!to    || edate<=to);
  });
  sortArr(); currentPage=1; renderTable();
}

function sortBy(k){ if(sortKey===k) sortDir*=-1; else{sortKey=k;sortDir=1;} sortArr(); renderTable(); }
function sortArr(){
  filtered.sort((a,b)=>{
    const av=a[sortKey]??'', bv=b[sortKey]??'';
    if(typeof av==='number'&&typeof bv==='number') return (av-bv)*sortDir;
    return String(av).toLowerCase()<String(bv).toLowerCase()?-sortDir:String(av).toLowerCase()>String(bv).toLowerCase()?sortDir:0;
  });
}

function renderTable(){
  const perPage = parseInt(document.getElementById('per-page').value)||10;
  const total   = filtered.length;
  const pages   = Math.max(1,Math.ceil(total/perPage));
  if(currentPage>pages) currentPage=pages;
  const slice = filtered.slice((currentPage-1)*perPage, currentPage*perPage);
  document.getElementById('count-pill').textContent = total+' entr'+(total===1?'y':'ies');
  const tbody = document.getElementById('ur-tbody');
  if(!total){
    tbody.innerHTML=\`<tr><td colspan="18"><div class="empty-st">
      <div class="ei">🛠</div>
      <div class="et">\${UR_DATA.length?'No records match the filters':'No Under Repair records yet'}</div>
      <div class="es">\${UR_DATA.length?'Try clearing the filters.':'Records appear here when a service is saved with REP Type = TO/ADV SO.'}</div>
    </div></td></tr>\`;
  } else {
    tbody.innerHTML = slice.map((d,i)=>{
      const rid   = d._id||d.id;
      const pdCls = d.pdays>30?'pdays-crit':d.pdays>15?'pdays-warn':'pdays-ok';
      const isOwn = d.eng===EMP_NAME||d.scEng===EMP_NAME||(d.raEng&&d.raEng===EMP_NAME);
      const isSent= d.rturSent||d.rtfrnSent;
      return \`<tr>
        <td class="mono" style="color:var(--muted);font-size:11px;">\${(currentPage-1)*perPage+i+1}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td><button class="btn-xs update" onclick="openUpdate('\${rid}')">✏ Update</button></td>
        <td style="font-weight:600;color:var(--accent);font-size:12px;">\${esc(d.scReNo||'—')}</td>
        <td style="font-size:12px;">\${esc(d.scEng||'—')}</td>
        <td class="mono">\${esc(String(d.frnNo||'—'))}</td>
        <td><span class="region-tag">\${esc(d.reg||'—')}</span></td>
        <td style="font-size:12px;\${isOwn?'font-weight:700;color:var(--accent);':''}">\${esc(d.eng||'—')}\${isOwn?' <span style="font-size:9px;background:var(--accent3);color:var(--accent);padding:1px 5px;border-radius:5px;font-weight:700;">ME</span>':''}</td>
        <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;font-size:12px;" title="\${esc(d.custName||d.customer||'')}">\${esc(d.custName||d.customer||'—')}</td>
        <td style="font-weight:600;font-size:12px;">\${esc(d.model||'—')}</td>
        <td>\${unitPill(d.unitSts)}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:11px;" title="\${esc(d.defMod||'')}">\${esc(d.defMod||'—')}</td>
        <td><span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;background:rgba(109,40,217,0.1);color:var(--purple);border:1px solid rgba(109,40,217,0.2);font-family:monospace;">\${esc(d.defGir||'—')}</span></td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--soft);" title="\${esc(d.finalRemarks||'')}">\${esc(d.finalRemarks||'—')}</td>
        <td><span class="work-tag">\${esc(d.urTypeWork||'UNDER REPAIR')}</span></td>
        <td class="\${pdCls}">\${d.pdays}</td>
        <td>
          <button class="btn-xs" onclick="openRepairModal('\${rid}')" \${isSent?'style="color:var(--green);border-color:rgba(4,120,87,0.3);" title="Sent to RT UR"':''}>\${isSent?'✔ Sent':'🔧 Repair'}</button>
        </td>
        <td><span class="repair-team-tag">\${esc(d.urRepairTeam||'—')}</span></td>
      </tr>\`;
    }).join('');
  }
  const fr = total?(currentPage-1)*perPage+1:0;
  document.getElementById('tbl-info').textContent = total
    ? \`Showing \${fr} to \${Math.min(currentPage*perPage,total)} of \${total} entries\`
    : '0 entries';
  renderPagination(pages);
}

function unitPill(s){
  const cls={OW:'up-ow',CAMC:'up-camc',LAMC:'up-lamc',EW:'up-ew',IW:'up-iw'};
  return \`<span class="unit-pill \${cls[s]||'up-other'}">\${esc(s||'—')}</span>\`;
}

// ── Open the full-screen update panel ─────────────────────────────
function openUpdate(id){
  const d = UR_DATA.find(x=>(x._id||x.id)===id);
  if(!d) return;

  document.getElementById('m-record-id').value   = id;
  document.getElementById('m-scref').textContent = d.scReNo||'—';
  document.getElementById('m-cust').textContent  = d.custName||d.customer||'—';
  document.getElementById('m-defgir').textContent= d.defGir||'—';
  document.getElementById('m-defmod').textContent= d.defMod||'—';
  document.getElementById('m-sceng').textContent = d.scEng||'—';
  document.getElementById('m-model').textContent = d.model||'—';
  document.getElementById('m-frn').textContent   = String(d.frnNo||'—');
  document.getElementById('m-unitsts').textContent = d.unitSts||'—';

  // Pre-fill form fields
  const set = (elId, val) => { const el=document.getElementById(elId); if(el) el.value=val||''; };
  set('m-raeng',       d.raEng||'');
  set('m-defunitgir',  d.defUnitGir||'');
  set('m-repbrd',      d.repBrd||'');
  set('m-repgirno',    d.repGirNo||'');
  set('m-revalue',     d.revalue||'');
  set('m-finalremarks',d.finalRemarks||'');
  set('m-techremarks', d.techRemarks||'');
  set('m-components',  d.components||'');
  set('m-typework',    d.urTypeWork||d.typeWork||'UNDER REPAIR');

  document.getElementById('modal-msg').className = 'fm-msg';

  // Show panel, hide main
  document.body.classList.add('panel-open');
  document.getElementById('update-panel').classList.add('open');
  document.getElementById('update-panel').scrollTo(0,0);
}

function closePanel(){
  document.body.classList.remove('panel-open');
  document.getElementById('update-panel').classList.remove('open');
}

// ── Save update back to service record ────────────────────────────
async function saveUpdate(){
`;

const replaceRegex = /function handleUnauth\(res\)\{\s*if\s*\(res\.status===401\)\s*\{\s*updatedBy:\s*EMP_NAME,\s*updatedAt:\s*new\s*Date\(\)\.toISOString\(\),\s*\};\s*try\s*\{\s*const\s*res\s*=\s*await\s*fetch\(`\$\{API\}\/api\/emp\/services\/\$\{id\}`,\{\s*method:'PUT',\s*headers:authHeaders\(\),\s*body:JSON\.stringify\(payload\)\s*\}\);\s*handleUnauth\(res\);/g;

// To make it easy, we just find "function handleUnauth(res){" and replace EVERYTHING UP TO the end of saveUpdate with the full missingScript + saveUpdate body.
const idx = content.indexOf('function handleUnauth(res){');
if (idx !== -1) {
  const before = content.substring(0, idx);
  // find the end of saveUpdate
  const endIdx = content.indexOf('function exportCSV()');
  const after = content.substring(endIdx);
  
  const saveUpdateBody = `
  const id           = document.getElementById('m-record-id').value;
  const finalRemarks = document.getElementById('m-finalremarks').value.trim();
  const typeWork     = document.getElementById('m-typework').value;
  const raEng        = document.getElementById('m-raeng').value;
  const msgEl        = document.getElementById('modal-msg');

  if(!finalRemarks||!typeWork){
    msgEl.textContent='⚠ Final Remarks and Type of Work are required.';
    msgEl.className='fm-msg err'; return;
  }

  const btns = [document.getElementById('panel-save-btn'), document.getElementById('panel-save-btn-2')];
  btns.forEach(b=>{ if(b){b.disabled=true;b.innerHTML='<span class="spin"></span> Saving…';} });

  const payload = {
    raEng,
    defUnitGir:   document.getElementById('m-defunitgir').value.trim(),
    repBrd:       document.getElementById('m-repbrd').value,
    repGirNo:     document.getElementById('m-repgirno').value.trim(),
    revalue:      document.getElementById('m-revalue').value ? Number(document.getElementById('m-revalue').value) : 0,
    finalRemarks,
    techRemarks:  document.getElementById('m-techremarks').value.trim(),
    components:   document.getElementById('m-components').value.trim(),
    urTypeWork:   typeWork,
    typeWork,
    urRepairTeam: raEng,
    updatedBy:    EMP_NAME,
    updatedAt:    new Date().toISOString(),
  };

  try {
    const res = await fetch(\`\${API}/api/emp/services/\${id}\`,{
      method:'PUT', headers:authHeaders(), body:JSON.stringify(payload)
    });
    // Use an inline handler since we overwrote the handleUnauth local reference? No, it's defined above.
    if (res.status === 401) throw new Error('Unauthorized');
    if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.message||'Update failed'); }

    if(typeWork==='Scrap') bumpUrEscalationQueue('scrap');
    else bumpUrEscalationQueue('followup');

    const idx = UR_DATA.findIndex(d=>(d._id||d.id)===id);
    if(idx!==-1) {
      if (typeWork === 'Completed') {
         UR_DATA.splice(idx,1);
      } else {
         Object.assign(UR_DATA[idx], payload);
      }
    }
    applyFilters(); updateStats();

    if (typeWork === 'Completed') {
      msgEl.textContent='✔ Moved to Completed FRN successfully!';
      msgEl.className='fm-msg ok';
      showToast('Moved to Completed FRN.','ok');
      setTimeout(()=>{ closePanel(); window.location.href='completed-frn.html'; }, 1200);
    } else {
      msgEl.textContent='✔ Update successful!';
      msgEl.className='fm-msg ok';
      showToast('Record updated.','ok');
      setTimeout(()=>{ closePanel(); }, 1200);
    }
  } catch(e){
    if(e.message!=='Unauthorized'){
      msgEl.textContent='Save failed: '+e.message;
      msgEl.className='fm-msg err';
      showToast('Save failed: '+e.message,'err');
    }
  } finally {
    btns.forEach(b=>{ if(b){b.disabled=false;b.textContent='💾 Save Update';} });
  }
}
`;
  
  fs.writeFileSync(file, before + missingScript + saveUpdateBody + '\n' + after, 'utf8');
  console.log('Successfully injected missing JS.');
} else {
  console.log('Could not find handleUnauth');
}
