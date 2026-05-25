const fs = require('fs');
const file = 'frontend/public/emppendingfrn.html';
let c = fs.readFileSync(file, 'utf8');

const tbodyLine = "  const tbody=document.getElementById('frn-tbody');";
const tbodyIdx = c.indexOf(tbodyLine);
if (tbodyIdx === -1) { console.log('ERROR: tbody line not found'); process.exit(1); }

const afterTbody = c.indexOf('\n', tbodyIdx) + 1;
const nextChunk = c.slice(afterTbody, afterTbody + 200);
console.log('After tbody line:', JSON.stringify(nextChunk));

// Find anchor: the model td that starts the row columns
const anchor = '    <td style="font-weight:600;color:var(--accent2);">${esc(d.model';
const modelTdPos = c.indexOf(anchor, afterTbody);
if (modelTdPos === -1) { console.log('Anchor not found'); process.exit(1); }
console.log('Anchor found at pos:', modelTdPos);

const missingBlock = `  if(!total){tbody.innerHTML='<tr><td colspan="18" style="text-align:center;padding:40px;color:var(--muted);">No records found</td></tr>';return;}
  else{tbody.innerHTML=slice.map((d,i)=>{const rid=d._id||d.id;const pc=d.pdays>150?'pdays-crit':d.pdays>=80?'pdays-warn':'pdays-ok';const checked=selectedIds.has(rid)?'checked':'';const branchVal=d.branch||d.region||'-';return\`<tr class="\${selectedIds.has(rid)?'row-selected':''}">
    <td style="text-align:center;"><input type="checkbox" class="row-chk" \${checked} onchange="toggleRow('\${rid}',this.checked)"/></td>
    <td class="mono" style="color:var(--muted);">\${(currentPage-1)*perPage+i+1}</td>
    <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
    <td><button class="btn-xs update" onclick="openUpdateModal('\${rid}')" title="Update">&#9999;&#65039;</button></td>
    <td style="font-weight:600;color:var(--accent2);">\${d.scRno||'-'}</td>
    <td>\${d.scEng||'-'}</td>
    <td class="mono">\${String(d.frnNo||'-')}</td>
    <td><span class="branch-tag">\${branchVal}</span></td>
    <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;">\${d.eng||'-'}</td>
    <td style="max-width:190px;overflow:hidden;text-overflow:ellipsis;font-weight:500;">\${d.customer||'-'}</td>\n`;

c = c.slice(0, afterTbody) + missingBlock + c.slice(modelTdPos);
fs.writeFileSync(file, c, 'utf8');
console.log('Fixed!');
