const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/scprfob.html');
let content = fs.readFileSync(p, 'utf8');

const theadOld = `          <thead><tr>
            <th onclick="sortBy('_id')" class="sorted" style="width:46px;">Id <span class="si">&#8597;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8597;</span></th>
            <th onclick="sortBy('entryDate')">Entry Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('scEng')">SC Engg <span class="si">&#8597;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8597;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8597;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8597;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8597;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('refNo')">TO/SO Ref No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('crmRefNo')">GIR No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('sparesReceivedAtSvc')">Spares Rcv Date <span class="si">&#8597;</span></th>
            <th class="no-sort">Action</th>
          </tr></thead>`;
const theadNew = `          <thead><tr>
            <th onclick="sortBy('entryDate')" class="sorted">Entry Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('receivedDate')">Received Date <span class="si">&#8597;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8597;</span></th>
            <th onclick="sortBy('type')">Type <span class="si">&#8597;</span></th>
            <th onclick="sortBy('branch')">Branch <span class="si">&#8597;</span></th>
            <th onclick="sortBy('eng')">Engineer <span class="si">&#8597;</span></th>
            <th onclick="sortBy('model')">Model <span class="si">&#8597;</span></th>
            <th onclick="sortBy('warrantyStatus')">Warranty Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('refNo')">TO/SO Ref No <span class="si">&#8597;</span></th>
            <th onclick="sortBy('status')">Status <span class="si">&#8597;</span></th>
            <th onclick="sortBy('sparesReceivedAtSvc')">Spares Rcv Date <span class="si">&#8597;</span></th>
            <th class="no-sort">Action</th>
          </tr></thead>`;

content = content.replace(theadOld, theadNew);
content = content.replace('colspan="15"', 'colspan="12"');
content = content.replace('colspan="15"', 'colspan="12"');

const tbodyOld = `        <td class="mono" style="color:var(--muted);">\${(currentPage-1)*perPage+i+1}</td>
        <td><span class="div-tag">\${esc(d.division||'-')}</span></td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-weight:600;">\${esc(d.scEng||'-')}</td>
        <td>\${typePill(d.type)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="branch-tag">\${esc(d.branch||'-')}</span></td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||'-')}</td>
        <td style="font-weight:600;">\${esc(d.model||'-')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||'-')}</td>
        <td class="mono">\${esc(d.crmRefNo||'-')}</td>
        <td>\${statusPill(d.status)}</td>
        <td>\${d.status === 'Open' ? \`<input type="date" id="inline-date-\${rid}" value="\${d.sparesReceivedAtSvc||''}" class="frm-inp" style="padding: 2px 4px; font-size: 11px; max-width: 110px;">\` : \`<span style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</span>\`}</td>`;

const tbodyNew = `        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.entryDate)}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.receivedDate)}</td>
        <td><span class="div-tag">\${esc(d.division||'-')}</span></td>
        <td>\${typePill(d.type)}</td>
        <td><span class="branch-tag">\${esc(d.branch||'-')}</span></td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="\${esc(d.eng||'')}">\${esc(d.eng||'-')}</td>
        <td style="font-weight:600;">\${esc(d.model||'-')}</td>
        <td>\${warrantyPill(d.warrantyStatus)}</td>
        <td style="font-weight:600;">\${esc(d.refNo||'-')}</td>
        <td>\${statusPill(d.status)}</td>
        <td>\${d.status === 'Open' ? \`<input type="date" id="inline-date-\${rid}" value="\${d.sparesReceivedAtSvc||''}" class="frm-inp" style="padding: 2px 4px; font-size: 11px; max-width: 110px;">\` : \`<span style="font-size:11px;color:var(--soft);">\${fmtDate(d.sparesReceivedAtSvc)}</span>\`}</td>`;

content = content.replace(tbodyOld, tbodyNew);
fs.writeFileSync(p, content, 'utf8');
console.log('done');
