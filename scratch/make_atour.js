const fs = require('fs');

const toursHtml = fs.readFileSync('frontend/public/tours.html', 'utf8');
const abirHtml = fs.readFileSync('frontend/public/abir.html', 'utf8');

// Extract sidebar from abir.html
const sidebarRegex = /<aside class="sidebar">[\s\S]*?<\/aside>/;
const abirSidebarMatch = abirHtml.match(sidebarRegex);
if (!abirSidebarMatch) throw new Error("Could not find sidebar in abir.html");
const abirSidebar = abirSidebarMatch[0];

// Replace sidebar in tours.html
let atourHtml = toursHtml.replace(sidebarRegex, abirSidebar);

// Change role check
atourHtml = atourHtml.replace(
  /!token \|\| !\[.*\]\.includes\(role\)/,
  `!token || !['admin','superadmin','administrator'].includes(role)`
);

// Title
atourHtml = atourHtml.replace('<title>SchillerIndia - Tour Summary</title>', '<title>SchillerIndia - Admin Tour Summary</title>');

// Topbar changes
atourHtml = atourHtml.replace(
  '<div class="topbar-left"><div class="breadcrumb"><a href="employee-dashboard.html">Dashboard</a><span class="sep">&#8250;</span><span>Records</span><span class="sep">&#8250;</span><span>Tour Summary</span></div><div class="page-title">Tour Summary</div></div>',
  '<div class="topbar-left"><div class="breadcrumb"><a href="admin-dashboard.html">Dashboard</a><span class="sep">&#8250;</span><span>Activity Register</span><span class="sep">&#8250;</span><span>Tour Summary</span></div><div class="page-title">Admin Tour Summary</div></div>'
);

// Remove "Add New" and add "Delete Selected"
atourHtml = atourHtml.replace(
  '<button class="btn btn-primary" onclick="openTourModal()">&#43; Add New</button>',
  '<button class="btn btn-danger" onclick="deleteSelectedTours()" id="btn-del-selected" style="display:none;background:var(--red);color:#fff;">&#128465; Delete Selected</button>'
);

// Change API endpoints
atourHtml = atourHtml.replace(/\/api\/tours/g, '/api/atours');

// Add checkbox to tour cards
atourHtml = atourHtml.replace(
  /function renderTourCardGroup.*?return html;\n}/s,
  `function renderTourCardGroup(name, items, tourNum){
  const tourKey = escAttr(name);
  const sortedItems = [...items].sort((a,b) => String(a.startDate||'').localeCompare(String(b.startDate||'')));
  const firstDate = sortedItems[0] ? fmtDate(sortedItems[0].startDate) : '';
  const lastDate = sortedItems[sortedItems.length - 1] ? fmtDate(sortedItems[sortedItems.length - 1].startDate) : '';
  const dateText = (firstDate === lastDate || !lastDate) ? firstDate : (firstDate + ' - ' + lastDate);

  let html = '<div class="tour-card-wrapper" style="display: flex; align-items: flex-start; gap: 10px; width: 100%;">'
    + '<div class="tour-number" style="font-size: 13px; font-weight: 800; color: var(--muted); margin-top: 10px; background: var(--surface2); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); flex-shrink: 0;">' + tourNum + '</div>'
    + '<article class="tour-card" style="flex: 1; min-width: 0;">'
    + '<div class="tour-card-top" onclick="toggleTourBody(this)" style="cursor: pointer; user-select: none; border-bottom: none;"><div><div class="tour-day">' + esc(name) + '</div><div class="tour-date">' + dateText + ' (' + items.length + ' day' + (items.length === 1 ? '' : 's') + ' logged)</div></div>'
    + '<div class="tour-card-actions" onclick="event.stopPropagation()">'
    + '  <button class="pdf-day" onclick="generateTourExcel(&quot;' + tourKey + '&quot;)">&#128196; Excel</button>'
    + '</div></div>'
    + '<div class="tour-card-body" style="display: none; flex-direction: column; gap: 16px;">';
    
  items.forEach((t, idx) => {
    const photos = (t.images || []).filter(Boolean).map(src => '<img class="thumb" src="'+src+'" onclick="viewImg(&quot;'+esc(src)+'&quot;)" title="View photo">').join('') || '<span style="color:var(--muted);font-size:11.5px;">No photos</span>';
    
    if (idx > 0) {
      html += '<div style="border-top: 1px dashed var(--border); margin: 4px 0;"></div>';
    }
    
    const sourceTypeStr = t.sourceType ? (' <span style="font-size:10px; background:rgba(0,0,0,0.1); padding:2px 6px; border-radius:4px; color:var(--text);">' + esc(t.sourceType) + '</span>') : '';
    
    html += '<div class="tour-day-section" style="display:flex; flex-direction:column; gap:10px;">'
      + '  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">'
      + '    <div style="display:flex; align-items:center; gap:8px;">'
      + '      <input type="checkbox" class="tour-checkbox" value="'+(t._id||t.id)+'" onchange="updateDeleteSelectedBtn()" style="width:16px;height:16px;cursor:pointer;">'
      + '      <span style="font-size:12px; font-weight:800; color:var(--accent); background:rgba(0,104,181,.08); padding:3px 9px; border-radius:12px;">Day ' + esc(t.dayNo || 1) + '</span>'
      + '      <span style="font-size:12px; font-weight:700; color:var(--muted);">' + fmtDate(t.startDate) + '</span>'
      + sourceTypeStr
      + '    </div>'
      + '    <div class="tour-card-actions">'
      + '      <button class="del" onclick="deleteTour(&quot;'+(t._id||t.id)+'&quot;)">&#128465; Delete</button>'
      + '    </div>'
      + '  </div>'
      + '  <div class="tour-customer">' + esc(t.customerName || '-') + '</div>'
      + '  <div class="tour-meta-grid">'
      + '    ' + meta('Region', t.region) + meta('Branch', t.branch) + meta('Model', t.model) + meta('Unit Status', t.unitStatus) + meta('Unit SL No', t.unitSlNo)
      + '  </div>'
      + '  <div class="tour-notes">'
      + '    ' + note('Problem Reported', t.problemReported) + note('Problem Observed', t.problemObserved) + note('Action Taken', t.actionTaken)
      + '  </div>'
      + '  <div class="tour-photos">' + photos + '</div>'
      + '  <div style="font-size:11px; color:var(--muted); font-weight:700;">Added by ' + esc(t.createdBy || '-') + ' (' + esc(t.createdByDivision || 'Unknown Div') + ')</div>'
      + '</div>';
  });
  
  html += '</div></article></div>';
  return html;
}`
);

// Add logic for Delete Selected
atourHtml = atourHtml.replace('async function deleteTour(id){', `
function updateDeleteSelectedBtn() {
  const checked = document.querySelectorAll('.tour-checkbox:checked');
  const btn = document.getElementById('btn-del-selected');
  if(checked.length > 0) {
    btn.style.display = 'inline-flex';
    btn.innerHTML = '&#128465; Delete Selected (' + checked.length + ')';
  } else {
    btn.style.display = 'none';
  }
}

async function deleteSelectedTours() {
  const checked = Array.from(document.querySelectorAll('.tour-checkbox:checked')).map(cb => cb.value);
  if(!checked.length) return;
  if(!confirm('Delete ' + checked.length + ' selected tour entries?')) return;
  const btn = document.getElementById('btn-del-selected');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    const res = await fetch('/api/atours/bulk-delete', {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({ ids: checked })
    });
    handleAuth(res);
    await loadTours();
  } catch(e) {
    alert('Failed to delete: ' + e.message);
  } finally {
    btn.disabled = false;
    updateDeleteSelectedBtn();
  }
}

async function deleteTour(id){`);

// Include sourceType in Export
atourHtml = atourHtml.replace(
  `<th>Tour Name</th><th>Day</th><th>Start Date</th>`,
  `<th>Tour Name</th><th>Day</th><th>Start Date</th><th>Source</th>`
);
atourHtml = atourHtml.replace(
  `+ '<td>' + esc(String(t.dayNo || 1)) + '</td>'\n      + '<td>' + esc(fmtDate(t.startDate)) + '</td>'`,
  `+ '<td>' + esc(String(t.dayNo || 1)) + '</td>'\n      + '<td>' + esc(fmtDate(t.startDate)) + '</td>'\n      + '<td>' + esc(t.sourceType || 'Unknown') + '</td>'`
);

// Update init profile to use admin info
atourHtml = atourHtml.replace(
  `const name = u.name || 'Employee';\n  setText('emp-name', name); setText('emp-avatar', name.charAt(0).toUpperCase()); setText('emp-desig', u.designation || 'Field Engineer');`,
  `const name = u.name || 'Admin';\n  setText('admin-name', name); setText('admin-avatar', name.charAt(0).toUpperCase());`
);

// Change role label in tour summary view
atourHtml = atourHtml.replace('<div style="padding:7px 12px 0;"><span class="emp-badge">Employee</span></div>', '');

fs.writeFileSync('frontend/public/atour.html', atourHtml);
console.log('atour.html generated successfully.');
