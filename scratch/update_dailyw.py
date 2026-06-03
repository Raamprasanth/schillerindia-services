import re

with open('frontend/public/dailyw.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_start = content.find('<script>\nlet currentDate = new Date();')
script_end = content.find('</script>\n<script src="tab-fix.js"></script>')

if script_start != -1 and script_end != -1:
    new_script = """<script>
let currentDate = new Date();
let editId = null;
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
const offsetToday = currentDate.getTimezoneOffset() * 60000;
let selectedDateStr = new Date(currentDate.getTime() - offsetToday).toISOString().split('T')[0];

let currentData = [];

(function init(){
  const u = JSON.parse(sessionStorage.getItem('schiller_user') || '{}');
  const name = u.name || 'Employee';
  
  const els = ['emp-name', 'tb-name'];
  els.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = name; });
  
  const avs = ['emp-avatar', 'tb-avatar'];
  avs.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = name.charAt(0).toUpperCase(); });
  
  const rls = ['emp-desig', 'tb-role'];
  rls.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = u.designation || 'Field Engineer'; });
  
  const tbDate = document.getElementById('topbar-date');
  if(tbDate) tbDate.textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  loadData();
})();

async function loadData() {
  try {
    const res = await fetch('/api/empdw', {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('schiller_token')}` }
    });
    if(!res.ok) throw new Error('Failed to fetch data');
    currentData = await res.json();
    renderCalendar();
  } catch(e) {
    console.error(e);
  }
}

function getDwList() { return currentData; }

function renderCalendar() {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const calTitle = document.getElementById('cal-title');
  if(calTitle) calTitle.textContent = monthNames[currentMonth] + ' ' + currentYear;
  
  const grid = document.getElementById('cal-grid');
  if(!grid) return;
  grid.innerHTML = '';
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const today = new Date();
  const offsetNow = today.getTimezoneOffset() * 60000;
  const todayStr = new Date(today.getTime() - offsetNow).toISOString().split('T')[0];
  
  const list = getDwList();
  const entryDates = new Set(list.map(t => t.date));
  
  for(let i=0; i<firstDay; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty-cell';
    grid.appendChild(cell);
  }
  
  for(let i=1; i<=daysInMonth; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.textContent = i;
    
    const cellDate = new Date(currentYear, currentMonth, i);
    const offset = cellDate.getTimezoneOffset() * 60000;
    const cellDateStr = new Date(cellDate.getTime() - offset).toISOString().split('T')[0];
    
    if(cellDateStr === todayStr) cell.classList.add('today');
    if(cellDateStr === selectedDateStr) cell.classList.add('selected');
    
    if(entryDates.has(cellDateStr)){
      const dot = document.createElement('span');
      dot.className = 'has-entry-dot';
      cell.appendChild(dot);
    }
    
    cell.onclick = () => {
      selectedDateStr = cellDateStr;
      renderCalendar(); 
    };
    
    grid.appendChild(cell);
  }
  
  renderKanban();
}

function prevMonth(){
  currentMonth--;
  if(currentMonth < 0){ currentMonth = 11; currentYear--; }
  renderCalendar();
}

function nextMonth(){
  currentMonth++;
  if(currentMonth > 11){ currentMonth = 0; currentYear++; }
  renderCalendar();
}

function renderKanban() {
  const kbTitle = document.getElementById('kb-date-title');
  const kbCount = document.getElementById('kb-count');
  const grid = document.getElementById('kb-grid');
  if(!kbTitle || !kbCount || !grid) return;

  const displayDate = new Date(selectedDateStr).toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
  kbTitle.textContent = 'Entries for ' + displayDate;
  
  const list = getDwList();
  const dayEntries = list.map((entry, idx) => ({...entry, _origIdx: idx})).filter(t => t.date === selectedDateStr);
  
  kbCount.textContent = dayEntries.length + (dayEntries.length === 1 ? ' entry found' : ' entries found');
  
  if(!dayEntries.length){
    grid.innerHTML = `<div class="kb-empty" style="grid-column:1/-1;">
      <div class="kb-empty-ico">&#128198;</div>
      <div class="kb-empty-txt">No entries for this date</div>
      <div class="kb-empty-sub">Click "Add Entry" at the top to log your work.</div>
    </div>`;
    grid.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  grid.innerHTML = dayEntries.map((t, i) => `
    <div class="kb-card">
      <div class="kb-top">
        <div class="kb-num">#${i+1}</div>
        <div class="kb-time"><span class="ico">&#128336;</span> ${esc(t.fromTime||'--')} to ${esc(t.toTime||'--')}</div>
      </div>
      <div class="kb-activity">${esc(t.activity||'')}</div>
      <div class="kb-foot">
        <div class="kb-user">By <span>${esc(t.addedBy||'Employee')}</span></div>
        <button class="kb-view" onclick="viewDw(${t._origIdx})" title="View Entry">View</button>
      </div>
    </div>
  `).join('');
}

function viewDw(idx){
  const entry = getDwList()[idx];
  if(!entry) return;
  const date = entry.date ? new Date(entry.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-';
  document.getElementById('view-sub').textContent = date;
  document.getElementById('dw-view-body').innerHTML = `
    <div class="view-detail-grid">
      <div class="view-detail"><div class="view-label">Date</div><div class="view-value">${esc(date)}</div></div>
      <div class="view-detail"><div class="view-label">Team / Division</div><div class="view-value">${esc(entry.team || '-')}</div></div>
      <div class="view-detail"><div class="view-label">From</div><div class="view-value">${esc(entry.fromTime || '-')}</div></div>
      <div class="view-detail"><div class="view-label">To</div><div class="view-value">${esc(entry.toTime || '-')}</div></div>
      <div class="view-detail"><div class="view-label">Total</div><div class="view-value">${esc(entry.dayTotal || '-')}</div></div>
      <div class="view-detail"><div class="view-label">Added By</div><div class="view-value">${esc(entry.addedBy || 'Employee')}</div></div>
      <div class="view-detail full"><div class="view-label">Activity</div><div class="view-value">${esc(entry.activity || '-')}</div></div>
    </div>`;
  document.getElementById('dw-view-overlay').classList.add('open');
}
function closeDwView(){ document.getElementById('dw-view-overlay').classList.remove('open'); }

function openDwModal(){ 
  editId = null;
  clearForm(); 
  document.getElementById('dw-date').value = selectedDateStr; 
  document.getElementById('dw-rows-container').innerHTML = '';
  addDwRow();
  document.querySelector(".modal-title").innerHTML = "&#128197; Add New Daily Work";
  document.getElementById("save-btn").innerHTML = "&#128190; Save Entry";
  document.getElementById("add-row-btn").style.display = "flex";
  document.getElementById('dw-overlay').classList.add('open'); 
  setTimeout(()=>document.querySelector('.row-team')?.focus(),50); 
}

function editDw(idx) {
  editId = idx;
  const list = getDwList();
  const entry = list[idx];
  if(!entry) return;
  
  clearForm();
  document.getElementById("dw-date").value = entry.date;
  document.getElementById("dw-rows-container").innerHTML = "";
  addDwRow();
  
  setTimeout(() => {
    document.querySelector(".row-team").value = entry.team || "";
    document.querySelector(".row-act").value = entry.activity;
    document.querySelector(".row-from").value = entry.fromTime;
    document.querySelector(".row-to").value = entry.toTime;
    calcTotalHours();
    document.querySelector(".modal-title").innerHTML = "&#9998; Edit Daily Work";
    document.getElementById("save-btn").innerHTML = "&#128190; Update Entry";
    document.getElementById("add-row-btn").style.display = "none";
    document.getElementById("dw-overlay").classList.add("open"); 
  }, 50);
}
function closeDwModal(){ document.getElementById('dw-overlay').classList.remove('open'); }
function clearForm(){ ['dw-date'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';}); document.getElementById('dw-rows-container').innerHTML=''; document.getElementById('dw-total-hours').textContent='Total: 0h 0m'; showMsg(''); }

async function saveDw(){
  const date = val('dw-date');
  if(!date){ showMsg('Date is required.'); return; }
  
  const teams = document.querySelectorAll('.row-team');
  const acts = document.querySelectorAll('.row-act');
  const froms = document.querySelectorAll('.row-from');
  const tos = document.querySelectorAll('.row-to');
  
  let entries = [];
  for(let i=0; i<acts.length; i++){
    if(!teams[i].value || !acts[i].value || !froms[i].value || !tos[i].value){
       showMsg('All activity rows must have Team/Division, Activity, From time, and To time.'); return;
    }
    entries.push({ team: teams[i].value, activity: acts[i].value, fromTime: froms[i].value, toTime: tos[i].value });
  }
  if(!entries.length){ showMsg('Please add at least one activity row.'); return; }
  
  const btn=document.getElementById('save-btn'); btn.disabled=true; btn.textContent='Saving...';
  try{
    let durationFormatted = document.getElementById('dw-total-hours').textContent.replace('Total: ', '');

    if (editId !== null) {
       const entry = currentData[editId];
       await fetch('/api/empdw/' + entry._id, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('schiller_token')}` },
           body: JSON.stringify({
               date, team: entries[0].team, activity: entries[0].activity, fromTime: entries[0].fromTime, toTime: entries[0].toTime, dayTotal: durationFormatted
           })
       });
       editId = null;
    } else {
       for (const ent of entries.reverse()) {
           await fetch('/api/empdw', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('schiller_token')}` },
               body: JSON.stringify({
                   date, team: ent.team, activity: ent.activity, fromTime: ent.fromTime, toTime: ent.toTime, dayTotal: durationFormatted
               })
           });
       }
    }
    
    if(date !== selectedDateStr){
       selectedDateStr = date;
       const d = new Date(date);
       currentMonth = d.getMonth();
       currentYear = d.getFullYear();
    }
    
    closeDwModal(); 
    await loadData();
  }catch(e){ showMsg('Save failed: '+e.message); }
  finally{ btn.disabled=false; btn.innerHTML='&#128190; Save Entry'; }
}

function addDwRow() {
  const container = document.getElementById('dw-rows-container');
  const rowId = Date.now() + Math.floor(Math.random()*1000);
  const rowHtml = `
    <div class="dw-row" id="row-${rowId}">
       <div class="field"><label>Team / Division</label><input type="text" class="row-team" list="team-options" placeholder="Team / Division"></div>
       <div class="field"><label>Activity</label><textarea class="row-act" placeholder="Activity done" rows="3"></textarea></div>
       <div class="field"><label>From</label><input type="time" class="row-from" onchange="calcTotalHours()"></div>
       <div class="field"><label>To</label><input type="time" class="row-to" onchange="calcTotalHours()"></div>
       <button class="kb-del" style="height:35px;width:34px;margin-bottom:2px;" onclick="document.getElementById('row-${rowId}').remove(); calcTotalHours();" title="Remove">&#128465;</button>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', rowHtml);
}

function calcTotalHours() {
  let totalMins = 0;
  const froms = document.querySelectorAll('.row-from');
  const tos = document.querySelectorAll('.row-to');
  for(let i=0; i<froms.length; i++) {
     const f = froms[i].value;
     const t = tos[i].value;
     if(f && t) {
        const [fh, fm] = f.split(':').map(Number);
        const [th, tm] = t.split(':').map(Number);
        let mins = (th*60+tm) - (fh*60+fm);
        if(mins < 0) mins += 24*60; 
        totalMins += mins;
     }
  }
  const h = Math.floor(totalMins/60);
  const m = totalMins % 60;
  document.getElementById('dw-total-hours').textContent = `Total: ${h}h ${m}m`;
  return totalMins;
}

function exportToExcel() {
  const list = getDwList();
  if(!list.length) return alert('No data to export.');
  
  const data = list.map(item => {
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
        'Added By': item.addedBy
     };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daily Work");
  XLSX.writeFile(wb, "Daily_Work_Export.xlsx");
}

async function deleteDw(origIdx){ 
  if(!confirm('Delete this entry?')) return; 
  const entry = currentData[origIdx];
  try {
     await fetch('/api/empdw/' + entry._id, {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${sessionStorage.getItem('schiller_token')}` }
     });
     await loadData();
  } catch(e) {
     console.error(e);
  }
}

function val(id){ return (document.getElementById(id)?.value || '').trim(); }
function showMsg(m){ const el=document.getElementById('dw-msg'); if(!el) return; el.textContent=m; el.style.display=m?'block':'none'; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function logout(){ sessionStorage.clear(); localStorage.clear(); window.location.href='login.html'; }

document.getElementById('dw-overlay').addEventListener('click', e => {
  if (e.target.id === 'dw-overlay') closeDwModal();
});
document.getElementById('dw-view-overlay').addEventListener('click', e => {
  if (e.target.id === 'dw-view-overlay') closeDwView();
});
</script>"""

    content = content[:script_start] + new_script + content[script_end:]
    with open('frontend/public/dailyw.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated dailyw.html successfully")
else:
    print("Could not find script block")
