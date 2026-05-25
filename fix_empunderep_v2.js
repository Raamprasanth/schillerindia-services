const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/public/empunderep.html');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Keep lines 1 to 473
let newLines = lines.slice(0, 473);

// In the original first copy, line 473 is: <input type="text" id="m-defunitgir" placeholder="e.g. X-105763"/>
// Let's add the rest of the form
newLines.push(
`          </div>
          <div class="field">
            <label>Repaired BRD STK Date</label>
            <input type="date" id="m-repbrd"/>
          </div>
          <div class="field">
            <label>REP GIR SNO_UR</label>
            <input type="text" id="m-repgirno" placeholder="e.g. M003E009469-BM100A"/>
          </div>
          <div class="field">
            <label>Revalue (INR)</label>
            <input type="number" id="m-revalue" placeholder="e.g. 1500" min="0"/>
          </div>
        </div>
      </div>`
);

// Now we need the rest of the file from line 685 (Section 2) to 762 (function normalizeRtDivision closing brace)
// Wait, Section 2 starts at line 685 in the current file.
let startSection2 = lines.findIndex((l, i) => i > 600 && l.includes('<!-- Section 2 — Remarks & Findings -->'));
let startSaveUpdateMangled = lines.findIndex((l, i) => i > startSection2 && l.includes('function handleUnauth(res){'));

newLines.push(...lines.slice(startSection2, startSaveUpdateMangled));

// Now inject the proper handleUnauth and saveUpdate
newLines.push(`function handleUnauth(res){
  if (res.status===401) {
    showToast('Session expired — logging out.','err');
    setTimeout(()=>{ localStorage.clear(); window.location.href='login.html'; },1500);
    throw new Error('Unauthorized');
  }
}

// ── Save update back to service record ────────────────────────────
async function saveUpdate(){
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
    handleUnauth(res);
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
}`);

// Now find where the rest of the file continues
let restIndex = lines.findIndex((l, i) => i > startSaveUpdateMangled && l.includes('function exportCSV()'));
newLines.push(...lines.slice(restIndex));

fs.writeFileSync(file, newLines.join('\n'), 'utf8');
console.log('Fixed empunderep.html');
