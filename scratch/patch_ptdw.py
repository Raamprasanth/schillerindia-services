import re

def update_ptdw():
    with open('frontend/public/ptdw.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add SheetJS
    if 'xlsx.full.min.js' not in html:
        html = html.replace('</title>', '</title>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>')

    # 2. Add Export Button
    if 'exportToExcel()' not in html:
        html = html.replace('<button class="btn btn-primary" onclick="openDwModal()">&#43; Add Entry</button>',
                            '<button class="btn btn-primary" style="background:#047857;" onclick="exportToExcel()">&#128229; Export</button>\n      <button class="btn btn-primary" onclick="openDwModal()">&#43; Add Entry</button>')

    # 3. Replace Modal Body
    modal_body_orig = """<div class="modal-body">
      <div class="section-title">Work Details</div>
      <div class="fg2">
        <div class="field"><label>Date <span class="req">*</span></label><input type="date" id="dw-date"></div>
        <div class="field"><label>Activity Done <span class="req">*</span></label><input type="text" id="dw-activity" placeholder="e.g. Server Maintenance..."></div>
      </div>
      <div class="fg2">
        <div class="field"><label>From Time <span class="req">*</span></label><input type="time" id="dw-from"></div>
        <div class="field"><label>To Time <span class="req">*</span></label><input type="time" id="dw-to"></div>
      </div>
    </div>"""

    modal_body_new = """<div class="modal-body">
      <div class="section-title">Work Details</div>
      <div class="fg2">
        <div class="field"><label>Date <span class="req">*</span></label><input type="date" id="dw-date"></div>
        <div class="field">
          <label>Team / Division <span class="req">*</span></label>
          <input type="text" id="dw-team" list="team-options" placeholder="e.g. Production, FQC...">
          <datalist id="team-options">
            <option value="Production"></option>
            <option value="FQC"></option>
            <option value="Field Support"></option>
          </datalist>
        </div>
      </div>
      <div class="section-title" style="margin-top:15px;display:flex;justify-content:space-between;border-bottom:none;">
        <span>Activities</span>
        <span id="dw-total-hours" style="color:var(--accent);">Total: 0h 0m</span>
      </div>
      <div id="dw-rows-container"></div>
      <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:5px;" onclick="addDwRow()">+ Add Row</button>
    </div>"""
    
    html = html.replace(modal_body_orig, modal_body_new)

    # 4. Modify clearForm, openDwModal, saveDw
    # Replace openDwModal
    open_orig = """function openDwModal(){ \n  clearForm(); \n  document.getElementById("dw-date").value = selectedDateStr; \n  document.getElementById("dw-overlay").classList.add("open"); \n  setTimeout(()=>document.getElementById("dw-activity").focus(),50); \n}"""
    open_new = """function openDwModal(){ 
  clearForm(); 
  document.getElementById("dw-date").value = selectedDateStr; 
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  document.getElementById("dw-overlay").classList.add("open"); 
  setTimeout(()=>document.querySelector(".row-act")?.focus(),50); 
}"""
    if 'document.getElementById("dw-activity").focus()' in html:
        html = html.replace(open_orig, open_new)

    # Replace clearForm
    clear_orig = """function clearForm(){ ["dw-date","dw-activity","dw-from","dw-to"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";}); showMsg(""); }"""
    clear_new = """function clearForm(){ ["dw-date","dw-team"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";}); document.getElementById("dw-rows-container").innerHTML=""; document.getElementById("dw-total-hours").textContent="Total: 0h 0m"; showMsg(""); }"""
    if '["dw-date","dw-activity","dw-from","dw-to"]' in html:
        html = html.replace(clear_orig, clear_new)

    # Replace saveDw
    save_orig = """async function saveDw(){
  const payload = { date: val("dw-date"), activity: val("dw-activity"), fromTime: val("dw-from"), toTime: val("dw-to") };
  if(!payload.date || !payload.activity || !payload.fromTime || !payload.toTime){ showMsg("Required: All fields are required."); return; }
  
  const btn=document.getElementById("save-btn"); btn.disabled=true; btn.textContent="Saving...";
  try{
    const res = await fetch("/api/ptdw", { method: "POST", headers: hdrs(), body: JSON.stringify(payload) });
    const json = await res.json().catch(()=>{});
    if(!res.ok) throw new Error(json?.message || "HTTP "+res.status);
    
    if(payload.date !== selectedDateStr){
       selectedDateStr = payload.date;
       const d = new Date(payload.date);
       currentMonth = d.getMonth();
       currentYear = d.getFullYear();
    }
    
    closeDwModal(); 
    await renderCalendar(); 
  }catch(e){ showMsg("Save failed: "+e.message); }
  finally{ btn.disabled=false; btn.innerHTML="&#128190; Save Entry"; }
}"""
    
    save_new = """async function saveDw(){
  const date = val("dw-date");
  const team = val("dw-team");
  if(!date || !team){ showMsg("Date and Team/Division are required."); return; }
  
  const acts = document.querySelectorAll(".row-act");
  const froms = document.querySelectorAll(".row-from");
  const tos = document.querySelectorAll(".row-to");
  
  let entries = [];
  for(let i=0; i<acts.length; i++){
    if(!acts[i].value || !froms[i].value || !tos[i].value){
       showMsg("All activity rows must have an activity, from time, and to time."); return;
    }
    entries.push({ activity: acts[i].value, fromTime: froms[i].value, toTime: tos[i].value });
  }
  if(!entries.length){ showMsg("Please add at least one activity row."); return; }
  
  const btn=document.getElementById("save-btn"); btn.disabled=true; btn.textContent="Saving...";
  try{
    let durationFormatted = document.getElementById("dw-total-hours").textContent.replace("Total: ", "");
    
    // Save each row sequentially
    for (const ent of entries) {
      const payload = {
        date, team,
        activity: ent.activity,
        fromTime: ent.fromTime,
        toTime: ent.toTime,
        dayTotal: durationFormatted
      };
      const res = await fetch("/api/ptdw", { method: "POST", headers: hdrs(), body: JSON.stringify(payload) });
      if(!res.ok) {
        const json = await res.json().catch(()=>{});
        throw new Error(json?.message || "HTTP "+res.status);
      }
    }
    
    if(date !== selectedDateStr){
       selectedDateStr = date;
       const d = new Date(date);
       currentMonth = d.getMonth();
       currentYear = d.getFullYear();
    }
    
    closeDwModal(); 
    await renderCalendar(); 
  }catch(e){ showMsg("Save failed: "+e.message); }
  finally{ btn.disabled=false; btn.innerHTML="&#128190; Save Entry"; }
}

function addDwRow() {
  const container = document.getElementById("dw-rows-container");
  const rowId = Date.now() + Math.floor(Math.random()*1000);
  const rowHtml = `
    <div class="dw-row" id="row-${rowId}" style="display:grid;grid-template-columns:2fr 1fr 1fr 34px;gap:8px;margin-bottom:10px;align-items:end;">
       <div class="field"><label>Activity</label><input type="text" class="row-act" placeholder="Activity done"></div>
       <div class="field"><label>From</label><input type="time" class="row-from" onchange="calcTotalHours()"></div>
       <div class="field"><label>To</label><input type="time" class="row-to" onchange="calcTotalHours()"></div>
       <button class="kb-del" style="height:35px;width:34px;margin-bottom:2px;" onclick="document.getElementById('row-${rowId}').remove(); calcTotalHours();" title="Remove">&#128465;</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", rowHtml);
}

function calcTotalHours() {
  let totalMins = 0;
  const froms = document.querySelectorAll(".row-from");
  const tos = document.querySelectorAll(".row-to");
  for(let i=0; i<froms.length; i++) {
     const f = froms[i].value;
     const t = tos[i].value;
     if(f && t) {
        const [fh, fm] = f.split(":").map(Number);
        const [th, tm] = t.split(":").map(Number);
        let mins = (th*60+tm) - (fh*60+fm);
        if(mins < 0) mins += 24*60; 
        totalMins += mins;
     }
  }
  const h = Math.floor(totalMins/60);
  const m = totalMins % 60;
  document.getElementById("dw-total-hours").textContent = `Total: ${h}h ${m}m`;
  return totalMins;
}

function exportToExcel() {
  if(!DW_LIST.length) return alert('No data to export.');
  
  const data = DW_LIST.map(item => {
     let mins = 0;
     if(item.fromTime && item.toTime){
        const [fh, fm] = item.fromTime.split(':').map(Number);
        const [th, tm] = item.toTime.split(':').map(Number);
        mins = (th*60+tm) - (fh*60+fm);
        if(mins < 0) mins += 24*60;
     }
     const h = Math.floor(mins/60);
     const m = mins%60;
     
     return {
        'Date': item.date,
        'Team / Division': item.team || '',
        'Activity': item.activity,
        'From Time': item.fromTime,
        'To Time': item.toTime,
        'Duration': `${h}h ${m}m`,
        'Day Total': item.dayTotal || '',
        'Added By': item.addedBy || 'User'
     };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daily Work");
  XLSX.writeFile(wb, "Daily_Work_Export.xlsx");
}
"""
    if "async function saveDw(){" in html and "function exportToExcel()" not in html:
        html = html.replace(save_orig, save_new)

    with open('frontend/public/ptdw.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    update_ptdw()
    print("ptdw.html updated")
