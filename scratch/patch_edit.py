import re

def patch_css(html):
    html = html.replace('.kb-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;', 
                        '.kb-card{background:var(--card);border:2px solid var(--border);border-radius:14px;padding:22px 20px;')
    html = html.replace('.kb-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--accent);}',
                        '.kb-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:var(--accent);}')
    html = html.replace('.kb-activity{font-size:13.5px;font-weight:600;', 
                        '.kb-activity{font-size:15px;font-weight:800;')
    html = html.replace('.kb-del{background:rgba(185,28,28,0.08);color:var(--red);border:1px solid rgba(185,28,28,0.15);width:26px;height:26px;', 
                        '.kb-del{background:rgba(185,28,28,0.08);color:var(--red);border:1px solid rgba(185,28,28,0.15);width:28px;height:28px;')
    
    if '.kb-edit' not in html:
        html = html.replace('.kb-del:hover', '.kb-edit{background:rgba(0,104,181,0.08);color:var(--accent);border:1px solid rgba(0,104,181,0.15);width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;}\n.kb-edit:hover{background:var(--accent);color:#fff;}\n.kb-del:hover')
    return html

def patch_dailyw():
    with open('frontend/public/dailyw.html', 'r', encoding='utf-8') as f:
        html = f.read()

    html = patch_css(html)

    # UI foot buttons
    kb_foot_old = """      <div class="kb-foot">
        <div class="kb-user">By <span>${esc(t.addedBy||'Employee')}</span></div>
        <button class="kb-del" onclick="deleteDw(${t._origIdx})" title="Delete Entry">&#128465;</button>
      </div>"""
    kb_foot_new = """      <div class="kb-foot">
        <div class="kb-user">By <span>${esc(t.addedBy||'Employee')}</span></div>
        <div style="display:flex;gap:6px;">
          <button class="kb-edit" onclick="editDw(${t._origIdx})" title="Edit Entry">&#9998;</button>
          <button class="kb-del" onclick="deleteDw(${t._origIdx})" title="Delete Entry">&#128465;</button>
        </div>
      </div>"""
    html = html.replace(kb_foot_old, kb_foot_new)

    # JS edits
    if 'let editId = null;' not in html:
        html = html.replace('let currentDate = new Date();', 'let currentDate = new Date();\nlet editId = null;')

    open_old = """function openDwModal(){ 
  clearForm(); 
  document.getElementById('dw-date').value = selectedDateStr; 
  document.getElementById('dw-rows-container').innerHTML = '';
  addDwRow();
  document.getElementById('dw-overlay').classList.add('open'); 
  setTimeout(()=>document.querySelector('.row-act')?.focus(),50); 
}"""
    open_new = """function openDwModal(){ 
  editId = null;
  clearForm(); 
  document.getElementById('dw-date').value = selectedDateStr; 
  document.getElementById('dw-rows-container').innerHTML = '';
  addDwRow();
  document.querySelector(".modal-title").innerHTML = "&#128197; Add New Daily Work";
  document.getElementById("save-btn").innerHTML = "&#128190; Save Entry";
  document.getElementById("add-row-btn").style.display = "flex";
  document.getElementById('dw-overlay').classList.add('open'); 
  setTimeout(()=>document.querySelector('.row-act')?.focus(),50); 
}

function editDw(idx) {
  editId = idx;
  const list = getDwList();
  const entry = list[idx];
  if(!entry) return;
  
  clearForm();
  document.getElementById("dw-date").value = entry.date;
  document.getElementById("dw-team").value = entry.team || "";
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  
  setTimeout(() => {
    document.querySelector(".row-act").value = entry.activity;
    document.querySelector(".row-from").value = entry.fromTime;
    document.querySelector(".row-to").value = entry.toTime;
    calcTotalHours();
    document.querySelector(".modal-title").innerHTML = "&#9998; Edit Daily Work";
    document.getElementById("save-btn").innerHTML = "&#128190; Update Entry";
    document.getElementById("add-row-btn").style.display = "none";
    document.getElementById("dw-overlay").classList.add("open"); 
  }, 50);
}"""
    html = html.replace(open_old, open_new)
    
    html = html.replace('onclick="addDwRow()">+ Add Row</button>', 'id="add-row-btn" onclick="addDwRow()">+ Add Row</button>')

    save_old = """function saveDw(){
  const date = val('dw-date');"""
    
    save_new = """function saveDw(){
  const date = val('dw-date');"""

    # We need to replace the core logic of saveDw to handle editId
    core_old = """    entries.reverse().forEach(ent => {
       list.unshift({
          date, team, 
          activity: ent.activity, 
          fromTime: ent.fromTime, 
          toTime: ent.toTime,
          dayTotal: durationFormatted, // Store total for reference if needed
          addedBy: u.name || 'Employee',
          createdAt: new Date().toISOString()
       });
    });"""

    core_new = """    if (editId !== null) {
       list[editId] = {
          ...list[editId],
          date, team,
          activity: entries[0].activity,
          fromTime: entries[0].fromTime,
          toTime: entries[0].toTime,
          dayTotal: durationFormatted
       };
       editId = null;
    } else {
       entries.reverse().forEach(ent => {
          list.unshift({
             date, team, 
             activity: ent.activity, 
             fromTime: ent.fromTime, 
             toTime: ent.toTime,
             dayTotal: durationFormatted, // Store total for reference if needed
             addedBy: u.name || 'Employee',
             createdAt: new Date().toISOString()
          });
       });
    }"""
    html = html.replace(core_old, core_new)

    with open('frontend/public/dailyw.html', 'w', encoding='utf-8') as f:
        f.write(html)

def patch_ptdw():
    with open('frontend/public/ptdw.html', 'r', encoding='utf-8') as f:
        html = f.read()

    html = patch_css(html)

    # UI foot buttons
    kb_foot_old = """      <div class="kb-foot">
        <div class="kb-user">By <span>${esc(t.addedBy||"User")}</span></div>
        <button class="kb-del" onclick="deleteDw(` + "`" + `${t._id}` + "`" + `)" title="Delete Entry">&#128465;</button>
      </div>"""
    kb_foot_new = """      <div class="kb-foot">
        <div class="kb-user">By <span>${esc(t.addedBy||"User")}</span></div>
        <div style="display:flex;gap:6px;">
          <button class="kb-edit" onclick="editDw(` + "`" + `${t._id}` + "`" + `)" title="Edit Entry">&#9998;</button>
          <button class="kb-del" onclick="deleteDw(` + "`" + `${t._id}` + "`" + `)" title="Delete Entry">&#128465;</button>
        </div>
      </div>"""
    html = html.replace(kb_foot_old, kb_foot_new)

    # JS edits
    if 'let editId = null;' not in html:
        html = html.replace('let currentDate = new Date();', 'let currentDate = new Date();\nlet editId = null;')

    open_old = """function openDwModal(){ 
  clearForm(); 
  document.getElementById("dw-date").value = selectedDateStr; 
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  document.getElementById("dw-overlay").classList.add("open"); 
  setTimeout(()=>document.querySelector(".row-act")?.focus(),50); 
}"""
    open_new = """function openDwModal(){ 
  editId = null;
  clearForm(); 
  document.getElementById("dw-date").value = selectedDateStr; 
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  document.querySelector(".modal-title").innerHTML = "&#128197; Add New Daily Work";
  document.getElementById("save-btn").innerHTML = "&#128190; Save Entry";
  document.getElementById("add-row-btn").style.display = "flex";
  document.getElementById("dw-overlay").classList.add("open"); 
  setTimeout(()=>document.querySelector(".row-act")?.focus(),50); 
}

function editDw(id) {
  editId = id;
  const entry = DW_LIST.find(t => t._id === id);
  if(!entry) return;
  
  clearForm();
  document.getElementById("dw-date").value = entry.date;
  document.getElementById("dw-team").value = entry.team || "";
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  
  setTimeout(() => {
    document.querySelector(".row-act").value = entry.activity;
    document.querySelector(".row-from").value = entry.fromTime;
    document.querySelector(".row-to").value = entry.toTime;
    calcTotalHours();
    document.querySelector(".modal-title").innerHTML = "&#9998; Edit Daily Work";
    document.getElementById("save-btn").innerHTML = "&#128190; Update Entry";
    document.getElementById("add-row-btn").style.display = "none";
    document.getElementById("dw-overlay").classList.add("open"); 
  }, 50);
}"""
    html = html.replace(open_old, open_new)
    
    html = html.replace('onclick="addDwRow()">+ Add Row</button>', 'id="add-row-btn" onclick="addDwRow()">+ Add Row</button>')

    # Replace the core logic in saveDw
    core_old = """    // Save each row sequentially
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
    }"""

    core_new = """    if (editId !== null) {
      const payload = {
        date, team,
        activity: entries[0].activity,
        fromTime: entries[0].fromTime,
        toTime: entries[0].toTime,
        dayTotal: durationFormatted
      };
      const res = await fetch("/api/ptdw/" + editId, { method: "PUT", headers: hdrs(), body: JSON.stringify(payload) });
      if(!res.ok) {
        const json = await res.json().catch(()=>{});
        throw new Error(json?.message || "HTTP "+res.status);
      }
      editId = null;
    } else {
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
    }"""
    html = html.replace(core_old, core_new)

    with open('frontend/public/ptdw.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    patch_dailyw()
    patch_ptdw()
    print("Both pages updated")
