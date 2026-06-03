import re

with open('frontend/public/tours.html', 'r', encoding='utf-8') as f:
    tours_html = f.read()

with open('frontend/public/abir.html', 'r', encoding='utf-8') as f:
    abir_html = f.read()

# Extract sidebar from abir.html
sidebar_regex = re.compile(r'<aside class="sidebar">.*?</aside>', re.DOTALL)
abir_sidebar_match = sidebar_regex.search(abir_html)
if not abir_sidebar_match:
    raise ValueError("Could not find sidebar in abir.html")
abir_sidebar = abir_sidebar_match.group(0)

# Replace sidebar in tours.html
atour_html = sidebar_regex.sub(abir_sidebar, tours_html)

# Change role check
atour_html = re.sub(
    r'!token \|\| !\[.*\]\.includes\(role\)',
    r"!token || !['admin','superadmin','administrator'].includes(role)",
    atour_html
)

# Title
atour_html = atour_html.replace('<title>SchillerIndia - Tour Summary</title>', '<title>SchillerIndia - Admin Tour Summary</title>')

# Topbar changes
atour_html = atour_html.replace(
    '<div class="topbar-left"><div class="breadcrumb"><a href="employee-dashboard.html">Dashboard</a><span class="sep">&#8250;</span><span>Records</span><span class="sep">&#8250;</span><span>Tour Summary</span></div><div class="page-title">Tour Summary</div></div>',
    '<div class="topbar-left"><div class="breadcrumb"><a href="admin-dashboard.html">Dashboard</a><span class="sep">&#8250;</span><span>Activity Register</span><span class="sep">&#8250;</span><span>Tour Summary</span></div><div class="page-title">Admin Tour Summary</div></div>'
)

# Remove "Add New" and add "Delete Selected"
atour_html = atour_html.replace(
    '<button class="btn btn-primary" onclick="openTourModal()">&#43; Add New</button>',
    '<button class="btn btn-danger" onclick="deleteSelectedTours()" id="btn-del-selected" style="display:none;background:var(--red);color:#fff;border:none;border-radius:8px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;">&#128465; Delete Selected</button>'
)

# Change API endpoints
atour_html = atour_html.replace('/api/tours', '/api/atours')

# Add checkbox to tour cards
old_render = r'function renderTourCardGroup\(name, items, tourNum\).*?return html;\n\}'
new_render = r'''function renderTourCardGroup(name, items, tourNum){
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
}'''

atour_html = re.sub(old_render, new_render, atour_html, flags=re.DOTALL)

# Add logic for Delete Selected
del_script = '''
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
    updateDeleteSelectedBtn();
  } catch(e) {
    alert('Failed to delete: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteTour(id){'''

atour_html = atour_html.replace('async function deleteTour(id){', del_script)

# Include sourceType in Export
atour_html = atour_html.replace(
    '<th>Tour Name</th><th>Day</th><th>Start Date</th>',
    '<th>Tour Name</th><th>Day</th><th>Start Date</th><th>Source</th>'
)
atour_html = atour_html.replace(
    "+ '<td>' + esc(String(t.dayNo || 1)) + '</td>'\n      + '<td>' + esc(fmtDate(t.startDate)) + '</td>'",
    "+ '<td>' + esc(String(t.dayNo || 1)) + '</td>'\n      + '<td>' + esc(fmtDate(t.startDate)) + '</td>'\n      + '<td>' + esc(t.sourceType || 'Unknown') + '</td>'"
)

# Update init profile to use admin info
atour_html = atour_html.replace(
    "const name = u.name || 'Employee';\n  setText('emp-name', name); setText('emp-avatar', name.charAt(0).toUpperCase()); setText('emp-desig', u.designation || 'Field Engineer');",
    "const name = u.name || 'Admin';\n  setText('admin-name', name); setText('admin-avatar', name.charAt(0).toUpperCase());"
)

# Change role label in tour summary view
atour_html = atour_html.replace('<div style="padding:7px 12px 0;"><span class="emp-badge">Employee</span></div>', '')

with open('frontend/public/atour.html', 'w', encoding='utf-8') as f:
    f.write(atour_html)

print('atour.html generated successfully.')
