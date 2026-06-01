const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/sccr.html');
let content = fs.readFileSync(p, 'utf8');

// 1. thead changes
const theadOld = `          <thead><tr>
            <th onclick="sortBy('_id')" class="sorted" style="width:46px;">Id <span class="si">&#8693;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8693;</span></th>
            <th onclick="sortBy('entryDate')">Entry Date <span class="si">&#8693;</span></th>
            <th onclick="sortBy('scEng')">Sc Engg <span class="si">&#8693;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8693;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8693;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8693;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8693;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8693;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8693;</span></th>
            <th onclick="sortBy('refNo')">PRF/OB Ref No. <span class="si">&#8693;</span></th>
            <th onclick="sortBy('crmRefNo')">CRM Ref no. <span class="si">&#8693;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8693;</span></th>
            <th onclick="sortBy('executedDate')">Executed Date <span class="si">&#8693;</span></th>
            <th class="no-sort">Action</th>
          </tr></thead>`;
const theadNew = `          <thead><tr>
            <th onclick="sortBy('entryDate')" class="sorted">Entry Date <span class="si">&#8693;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8693;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8693;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8693;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8693;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8693;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8693;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8693;</span></th>
            <th onclick="sortBy('refNo')">PRF/OB Ref No. <span class="si">&#8693;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8693;</span></th>
            <th onclick="sortBy('crmRefNo')">GIR No <span class="si">&#8693;</span></th>
            <th onclick="sortBy('executedDate')">Executed Date <span class="si">&#8693;</span></th>
          </tr></thead>`;

content = content.replace(theadOld, theadNew);
content = content.replace(/colspan="15"/g, 'colspan="12"');

// 2. tbody changes
const tbodyOld = `        <td class="mono" style="color:var(--muted);">\${(currentPage-1)*perPage+i+1}</td>
        <td><span class="div-tag">\${esc(d.division||' ')}</span></td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-weight:600;">\${esc(d.scEng||' ')}</td>
        <td>\${typePill(d.type)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="branch-tag">\${esc(d.branch||' ')}</span></td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||' ')}</td>
        <td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.model||'')}">\${esc(d.model||' ')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||' ')}</td>
        <td class="wrap-cell" style="max-width:200px;font-size:11px;color:var(--soft);" title="\${esc(d.crmRefNo||'')}">\${esc((d.crmRefNo||' ').slice(0,40))}\${(d.crmRefNo||'').length>40?' ':''}</td>
        <td>\${statusPill(d.status)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>
        <td><button class="btn-xs update" onclick="openUpdateModal('\${rid}')" title="Update">&#9999;&#65039;</button></td>`;

const tbodyNew = `        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="div-tag">\${esc(d.division||' ')}</span></td>
        <td>\${typePill(d.type)}</td>
        <td><span class="branch-tag">\${esc(d.branch||' ')}</span></td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||' ')}</td>
        <td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.model||'')}">\${esc(d.model||' ')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||' ')}</td>
        <td>\${statusPill(d.status)}</td>
        <td class="wrap-cell" style="max-width:200px;font-size:11px;color:var(--soft);" title="\${esc(d.crmRefNo||'')}">\${esc((d.crmRefNo||' ').slice(0,40))}\${(d.crmRefNo||'').length>40?' ':''}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.executedDate)}</td>`;

content = content.replace(tbodyOld, tbodyNew);
fs.writeFileSync(p, content, 'utf8');
console.log('done!');
