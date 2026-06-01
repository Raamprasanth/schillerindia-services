const fs = require('fs');
let file = fs.readFileSync('frontend/public/scprfob.html', 'utf8');

// Replace table cell for Spares Rcv Date
file = file.replace(
  /<td style="font-size:11px;color:var\(--soft\);">\$\{fmtDate\(d\.sparesReceivedAtSvc\)\}<\/td>/,
  `<td>\${d.status === 'Open' ? \`<input type="date" id="inline-date-\${rid}" value="\${d.sparesReceivedAtSvc||''}" class="frm-inp" style="padding: 2px 4px; font-size: 11px; max-width: 110px;">\` : \`<span style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</span>\`}</td>`
);

// Replace Action column
file = file.replace(
  /<td style="display:flex;gap:5px;">[\s\S]*?<\/td>/,
  `<td style="display:flex;gap:5px;">
          \${d.status === 'Open' 
            ? \`<button class="btn-xs" style="color:var(--green);border-color:rgba(4,120,87,0.3);background:var(--green-bg);" onclick="inlineMarkPending('\${rid}')" title="Send to Employee">&#10004;&#65039;</button>\` 
            : \`<button class="btn-xs update" onclick="openEditModal('\${rid}')" title="Update">&#9999;&#65039;</button>\`}
        </td>`
);

// Add inlineMarkPending function
const inlineMarkPendingFunc = `
async function inlineMarkPending(id) {
  const d = DATA.find(x=>(x._id||x.id)===id);
  if(!d) return;
  const dateInput = document.getElementById('inline-date-' + id);
  const dateVal = dateInput ? dateInput.value : '';
  if(!dateVal) {
    showToast("Please enter Spares Rcv Date directly in the table row.", "err");
    return;
  }
  if(!confirm("Are you sure you want to send this entry to the engineer?")) return;
  
  try {
    const res = await fetch(API + '/api/emp/prfob/' + id, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'Pending', sparesReceivedAtSvc: dateVal })
    });
    if(!res.ok) throw new Error("Failed to update status");
    showToast("Entry marked as Pending and sent to engineer.", "ok");
    loadData();
  } catch(e) {
    showToast(e.message, "err");
  }
}
`;

file = file.replace(
  /async function markPending\(id\) \{[\s\S]*?\}\s*function closeFormModal\(\)\{/,
  `${inlineMarkPendingFunc}\n\nfunction closeFormModal(){`
);

fs.writeFileSync('frontend/public/scprfob.html', file);
console.log('scprfob.html modified successfully.');
