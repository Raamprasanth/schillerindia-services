const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// 1. RTOA.HTML — make Add Activity modal full-screen
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = fs.readFileSync('frontend/public/Rtoa.html', 'utf8');

  // Change overlay to stretch full-screen (align-items:stretch instead of center)
  c = c.replace(
    '.overlay{position:fixed;inset:0;background:rgba(5,18,38,0.55);backdrop-filter:blur(5px);z-index:500;display:none;align-items:center;justify-content:center;}',
    '.overlay{position:fixed;inset:0;background:rgba(5,18,38,0.55);backdrop-filter:blur(5px);z-index:500;display:none;align-items:stretch;}'
  );

  // Make modal full width/height (remove fixed width, use width:100%/height:100%)
  c = c.replace(
    '.modal{background:var(--surface);width:620px;max-width:96vw;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);display:flex;flex-direction:column;max-height:92vh;}',
    '.modal{background:var(--surface);width:100%;height:100%;border-radius:0;overflow:hidden;box-shadow:none;display:flex;flex-direction:column;}'
  );

  // Give the modal a proper header accent bar like other full-screen modals
  c = c.replace(
    '.modal-head{padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
    '.modal-head{padding:16px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--surface);position:relative;}'
  );

  // Wider modal body padding
  c = c.replace(
    '.modal-body{padding:20px 22px;}',
    '.modal-body{padding:24px 28px;}'
  );

  // Wider modal foot padding
  c = c.replace(
    '.modal-foot{padding:14px 22px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;justify-content:flex-end;background:var(--surface3);flex-shrink:0;}',
    '.modal-foot{padding:14px 28px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;justify-content:flex-end;background:var(--surface3);flex-shrink:0;}'
  );

  // Upgrade form-grid to 3-column for wider display
  c = c.replace(
    '.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}',
    '.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}'
  );

  // Add accent bar after modal-head (inject it into the header HTML)
  c = c.replace(
    `    <div class="modal-head">\n      <div class="modal-htitle" id="modal-title">Add Other Activity</div>\n      <button class="modal-close" onclick="closeModal()">&#10005;</button>\n    </div>`,
    `    <div class="modal-head">\n      <div class="modal-htitle" id="modal-title">Add Other Activity</div>\n      <button class="modal-close" onclick="closeModal()">&#10005;</button>\n      <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--rep),var(--rep2),transparent);"></div>\n    </div>`
  );

  fs.writeFileSync('frontend/public/Rtoa.html', c, 'utf8');
  console.log('Rtoa.html - modal made full-screen');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RTCOA.HTML — replace table columns to match Rtoa's columns
//    Rtoa columns: Entry Date | Repaired By | Division | Model | Part No |
//                  Description | Problem Observed | Components Used |
//                  Final Remarks | Repaired Date | Remarks | Actions(View)
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = fs.readFileSync('frontend/public/Rtcoa.html', 'utf8');

  // ── 2a. Widen the table min-width to match Rtoa
  c = c.replace(
    'table.coa-table{width:100%;border-collapse:collapse;font-size:11.5px;min-width:1000px;}',
    'table.coa-table{width:100%;border-collapse:collapse;font-size:11.5px;min-width:1600px;}'
  );

  // ── 2b. Replace thead columns
  c = c.replace(
    `          <thead><tr>\n            <th onclick="sortBy('date')">Date &#8597;</th>\n            <th onclick="sortBy('closedDate')">Closed Date &#8597;</th>\n            <th onclick="sortBy('activityType')">Type &#8597;</th>\n            <th onclick="sortBy('description')">Description &#8597;</th>\n            <th onclick="sortBy('engineer')">Engineer &#8597;</th>\n            <th onclick="sortBy('division')">Division &#8597;</th>\n            <th onclick="sortBy('priority')">Priority &#8597;</th>\n            <th onclick="sortBy('closedBy')">Closed By &#8597;</th>\n            <th onclick="sortBy('daysToClose')">Days to Close &#8597;</th>\n            <th>View</th>\n          </tr></thead>`,
    `          <thead><tr>\n            <th onclick="sortBy('entryDate')">Entry Date &#8597;</th>\n            <th onclick="sortBy('closedDate')">Closed Date &#8597;</th>\n            <th onclick="sortBy('repairedBy')">Repaired By &#8597;</th>\n            <th onclick="sortBy('division')">Division &#8597;</th>\n            <th onclick="sortBy('model')">Model &#8597;</th>\n            <th onclick="sortBy('partNumber')">Part No &#8597;</th>\n            <th onclick="sortBy('description')">Description &#8597;</th>\n            <th onclick="sortBy('problemObserved')">Problem Observed &#8597;</th>\n            <th onclick="sortBy('componentsUsed')">Components Used &#8597;</th>\n            <th onclick="sortBy('finalRemarks')">Final Remarks &#8597;</th>\n            <th onclick="sortBy('repairedDate')">Repaired Date &#8597;</th>\n            <th onclick="sortBy('remarks')">Remarks &#8597;</th>\n            <th>View</th>\n          </tr></thead>`
  );

  // ── 2c. Update loading colspan
  c = c.replace(
    `<tr><td colspan="10" style="text-align:center;padding:44px;color:var(--muted);"><span class="spin"></span>Loading...</td></tr>`,
    `<tr><td colspan="13" style="text-align:center;padding:44px;color:var(--muted);"><span class="spin"></span>Loading...</td></tr>`
  );

  // ── 2d. Update empty state colspan in showError
  c = c.replace(
    '`<tr><td colspan="10"><div class="empty-st">',
    '`<tr><td colspan="13"><div class="empty-st">'
  );

  // ── 2e. Update empty state colspan in renderTable (no records)
  c = c.replace(
    '`<tr><td colspan="10"><div class="empty-st">\n      <div class="ei">&#9989;</div>',
    '`<tr><td colspan="13"><div class="empty-st">\n      <div class="ei">&#9989;</div>'
  );

  // ── 2f. Replace the renderTable row rendering
  c = c.replace(
    `  } else {\n    tbody.innerHTML = slice.map(d => {\n      const id   = d._id || d.id;\n      const desc = esc(d.description || '-');\n      const descS= desc.length > 45 ? desc.substring(0,42) + '...' : desc;\n      const days = d.daysToClose || 0;\n      const dCls = days <= 7 ? 'color:var(--green);font-weight:700;' : days <= 30 ? 'color:var(--amber);font-weight:700;' : 'color:var(--red);font-weight:700;';\n      return \`<tr>\n        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.date)}</td>\n        <td style="font-size:11px;color:var(--green);font-weight:600;">\${fmtDate(d.closedDate)}</td>\n        <td><span style="font-size:11px;font-weight:600;color:var(--teal);">\${esc(d.activityType||'-')}</span></td>\n        <td style="max-width:180px;" title="\${desc}">\${descS}</td>\n        <td style="font-size:11.5px;">\${esc(d.engineer||'-')}</td>\n        <td><span style="font-size:10px;background:rgba(91,33,182,0.08);color:#5b21b6;border:1px solid rgba(91,33,182,0.18);border-radius:8px;padding:2px 8px;font-weight:700;">\${esc(d.division||'-')}</span></td>\n        <td><span class="pri-pill \${priClass(d.priority)}">\${esc(d.priority||'Low')}</span></td>\n        <td style="font-size:11px;color:var(--muted);">\${esc(d.closedBy||'-')}</td>\n        <td><span style="\${dCls}">\${days}</span></td>\n        <td><button class="btn-xs view" onclick="openDetail('\${id}')">View</button></td>\n      </tr>\`;\n    }).join('');\n  }`,
    `  } else {\n    tbody.innerHTML = slice.map(d => {\n      const id = d._id || d.id;\n      const trunc = (s,n) => { const t = esc(s||'-'); return t.length > n ? t.substring(0,n-2)+'...' : t; };\n      return \`<tr>\n        <td style="font-size:11px;color:var(--soft);white-space:nowrap;">\${fmtDate(d.entryDate)}</td>\n        <td style="font-size:11px;color:var(--green);font-weight:600;white-space:nowrap;">\${fmtDate(d.closedDate)}</td>\n        <td style="font-weight:600;white-space:nowrap;">\${esc(d.repairedBy||'-')}</td>\n        <td><span style="font-size:10px;background:rgba(91,33,182,0.08);color:#5b21b6;border:1px solid rgba(91,33,182,0.18);border-radius:8px;padding:2px 8px;font-weight:700;">\${esc(d.division||'-')}</span></td>\n        <td style="font-weight:600;">\${esc(d.model||'-')}</td>\n        <td style="font-family:monospace;font-size:10.5px;">\${esc(d.partNumber||'-')}</td>\n        <td style="max-width:150px;" title="\${esc(d.description||'')}">\${trunc(d.description,50)}</td>\n        <td style="max-width:150px;" title="\${esc(d.problemObserved||'')}">\${trunc(d.problemObserved,50)}</td>\n        <td style="max-width:150px;" title="\${esc(d.componentsUsed||'')}">\${trunc(d.componentsUsed,50)}</td>\n        <td style="max-width:150px;" title="\${esc(d.finalRemarks||'')}">\${trunc(d.finalRemarks,50)}</td>\n        <td style="font-size:11px;color:var(--soft);white-space:nowrap;">\${fmtDate(d.repairedDate)}</td>\n        <td style="max-width:130px;" title="\${esc(d.remarks||'')}">\${trunc(d.remarks,40)}</td>\n        <td><button class="btn-xs view" onclick="openDetail('\${id}')">View</button></td>\n      </tr>\`;\n    }).join('');\n  }`
  );

  // ── 2g. Update sortKey default from 'closedDate' to 'entryDate' only in the var declaration
  c = c.replace(
    "let allData = [], filtered = [], sortKey = 'closedDate', sortDir = -1, currentPage = 1;",
    "let allData = [], filtered = [], sortKey = 'entryDate', sortDir = -1, currentPage = 1;"
  );

  // ── 2h. Update the detail modal to show Rtoa fields
  c = c.replace(
    `        <div class="detail-grid">\n          <div class="df"><label>Date</label><div class="dval" id="d-date">-</div></div>\n          <div class="df"><label>Closed Date</label><div class="dval hl" id="d-closedDate">-</div></div>\n          <div class="df"><label>Activity Type</label><div class="dval" id="d-activityType">-</div></div>\n          <div class="df"><label>Engineer</label><div class="dval" id="d-engineer">-</div></div>\n          <div class="df"><label>Division</label><div class="dval" id="d-division">-</div></div>\n          <div class="df"><label>Priority</label><div class="dval" id="d-priority">-</div></div>\n          <div class="df"><label>Status</label><div class="dval" id="d-status">-</div></div>\n          <div class="df"><label>Closed By</label><div class="dval" id="d-closedBy">-</div></div>\n          <div class="df dg-full"><label>Description</label><div class="dval long" id="d-description">-</div></div>\n          <div class="df dg-full"><label>Remarks</label><div class="dval long" id="d-remarks">-</div></div>\n        </div>`,
    `        <div class="detail-grid">\n          <div class="df"><label>Entry Date</label><div class="dval" id="d-entryDate">-</div></div>\n          <div class="df"><label>Closed Date</label><div class="dval hl" id="d-closedDate">-</div></div>\n          <div class="df"><label>Repaired By</label><div class="dval" id="d-repairedBy">-</div></div>\n          <div class="df"><label>Division</label><div class="dval" id="d-division">-</div></div>\n          <div class="df"><label>Model</label><div class="dval" id="d-model">-</div></div>\n          <div class="df"><label>Part Number</label><div class="dval" id="d-partNumber">-</div></div>\n          <div class="df"><label>Repaired Date</label><div class="dval" id="d-repairedDate">-</div></div>\n          <div class="df"><label>Closed By</label><div class="dval" id="d-closedBy">-</div></div>\n          <div class="df dg-full"><label>Description</label><div class="dval long" id="d-description">-</div></div>\n          <div class="df dg-full"><label>Problem Observed</label><div class="dval long" id="d-problemObserved">-</div></div>\n          <div class="df dg-full"><label>Components Used</label><div class="dval long" id="d-componentsUsed">-</div></div>\n          <div class="df dg-full"><label>Final Remarks</label><div class="dval long" id="d-finalRemarks">-</div></div>\n          <div class="df dg-full"><label>Remarks</label><div class="dval long" id="d-remarks">-</div></div>\n        </div>`
  );

  // ── 2i. Update openDetail function to populate new field IDs
  c = c.replace(
    `  set('d-date', fmtDate(d.date));\n  set('d-closedDate', fmtDate(d.closedDate));\n  set('d-activityType', d.activityType);\n  set('d-engineer', d.engineer);\n  set('d-division', d.division);\n  set('d-priority', d.priority);\n  set('d-status', d.status);\n  set('d-closedBy', d.closedBy);\n  set('d-description', d.description);\n  set('d-remarks', d.remarks);`,
    `  set('d-entryDate', fmtDate(d.entryDate));\n  set('d-closedDate', fmtDate(d.closedDate));\n  set('d-repairedBy', d.repairedBy);\n  set('d-division', d.division);\n  set('d-model', d.model);\n  set('d-partNumber', d.partNumber);\n  set('d-repairedDate', fmtDate(d.repairedDate));\n  set('d-closedBy', d.closedBy);\n  set('d-description', d.description);\n  set('d-problemObserved', d.problemObserved);\n  set('d-componentsUsed', d.componentsUsed);\n  set('d-finalRemarks', d.finalRemarks);\n  set('d-remarks', d.remarks);`
  );

  // ── 2j. Update openDetail className logic to include new long fields
  c = c.replace(
    "el.className = 'dval' + (['d-description','d-remarks'].includes(eid) ? ' long' : '') + (!val ? ' empty' : '');",
    "el.className = 'dval' + (['d-description','d-problemObserved','d-componentsUsed','d-finalRemarks','d-remarks'].includes(eid) ? ' long' : '') + (!val ? ' empty' : '');"
  );

  // ── 2k. Update filter bar - remove type/priority filters, add repairedBy filter like Rtoa
  c = c.replace(
    `    <div class="filter-bar">\n      <div class="fb-grp">\n        <div class="fb-lbl">Type</div>\n        <select class="fb-sel" id="f-type" onchange="applyFilters()">\n          <option value="">All Types</option>\n          <option>Maintenance</option>\n          <option>Inspection</option>\n          <option>Calibration</option>\n          <option>Cleaning</option>\n          <option>Training</option>\n          <option>Documentation</option>\n          <option>Other</option>\n        </select>\n      </div>\n      <div class="fb-grp">\n        <div class="fb-lbl">Priority</div>\n        <select class="fb-sel" id="f-priority" onchange="applyFilters()">\n          <option value="">All Priorities</option>\n          <option>Low</option>\n          <option>Medium</option>\n          <option>High</option>\n        </select>\n      </div>\n      <div class="fb-right">\n        <button class="btn btn-outline btn-sm" onclick="clearFilters()">&#10005; Clear</button>\n      </div>\n    </div>`,
    `    <div class="filter-bar">\n      <div class="fb-grp">\n        <div class="fb-lbl">Division</div>\n        <input type="text" class="fb-inp" id="f-division" placeholder="Filter division..." oninput="applyFilters()" style="width:150px;"/>\n      </div>\n      <div class="fb-grp">\n        <div class="fb-lbl">Repaired By</div>\n        <input type="text" class="fb-inp" id="f-repairedby" placeholder="Filter engineer..." oninput="applyFilters()" style="width:150px;"/>\n      </div>\n      <div class="fb-right">\n        <button class="btn btn-outline btn-sm" onclick="clearFilters()">&#10005; Clear</button>\n      </div>\n    </div>`
  );

  // ── 2l. Update applyFilters to use new filters
  c = c.replace(
    `function applyFilters() {\n  const q  = document.getElementById('tbl-search').value.toLowerCase();\n  const ft = document.getElementById('f-type').value;\n  const fp = document.getElementById('f-priority').value;\n  filtered = allData.filter(d => {\n    const mQ = !q  || Object.values(d).some(v => String(v||'').toLowerCase().includes(q));\n    const mT = !ft || d.activityType === ft;\n    const mP = !fp || d.priority === fp;\n    return mQ && mT && mP;\n  });\n  sortArr(); currentPage = 1; renderTable();\n}`,
    `function applyFilters() {\n  const q  = document.getElementById('tbl-search').value.toLowerCase();\n  const fd = document.getElementById('f-division').value.toLowerCase();\n  const fr = document.getElementById('f-repairedby').value.toLowerCase();\n  filtered = allData.filter(d => {\n    const mQ = !q  || Object.values(d).some(v => String(v||'').toLowerCase().includes(q));\n    const mD = !fd || String(d.division||'').toLowerCase().includes(fd);\n    const mR = !fr || String(d.repairedBy||'').toLowerCase().includes(fr);\n    return mQ && mD && mR;\n  });\n  sortArr(); currentPage = 1; renderTable();\n}`
  );

  // ── 2m. Update clearFilters to clear new filter inputs
  c = c.replace(
    `function clearFilters() {\n  document.getElementById('tbl-search').value = '';\n  document.getElementById('f-type').value = '';\n  document.getElementById('f-priority').value = '';\n  applyFilters();\n}`,
    `function clearFilters() {\n  document.getElementById('tbl-search').value = '';\n  document.getElementById('f-division').value = '';\n  document.getElementById('f-repairedby').value = '';\n  applyFilters();\n}`
  );

  // ── 2n. Update exportCSV columns
  c = c.replace(
    "  const headers = ['Date','Closed Date','Type','Description','Engineer','Division','Priority','Closed By','Days to Close'];\n  const rows = filtered.map(d => [\n    fmtDate(d.date), fmtDate(d.closedDate), d.activityType||'-', d.description||'-',\n    d.engineer||'-', d.division||'-', d.priority||'-', d.closedBy||'-', d.daysToClose||0\n  ]);",
    "  const headers = ['Entry Date','Closed Date','Repaired By','Division','Model','Part No','Description','Problem Observed','Components Used','Final Remarks','Repaired Date','Remarks','Closed By'];\n  const rows = filtered.map(d => [\n    fmtDate(d.entryDate), fmtDate(d.closedDate), d.repairedBy||'-', d.division||'-',\n    d.model||'-', d.partNumber||'-', d.description||'-', d.problemObserved||'-',\n    d.componentsUsed||'-', d.finalRemarks||'-', fmtDate(d.repairedDate), d.remarks||'-', d.closedBy||'-'\n  ]);"
  );

  fs.writeFileSync('frontend/public/Rtcoa.html', c, 'utf8');
  console.log('Rtcoa.html - table columns matched to Rtoa');
}

console.log('\nAll done!');
