const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'cli.html');
let content = fs.readFileSync(p, 'utf8');

// Replace table header
const theadRegex = /<thead><tr>[\s\S]*?<\/tr><\/thead>/;
const theadReplacement = `<thead><tr>
            <th onclick="sortBy('_id')" class="sorted" style="width:46px;">Id <span class="si">&#8693;</span></th>
            <th onclick="sortBy('date')">Date <span class="si">&#8693;</span></th>
            <th onclick="sortBy('division')">Division <span class="si">&#8693;</span></th>
            <th onclick="sortBy('partNo')">Part No <span class="si">&#8693;</span></th>
            <th onclick="sortBy('description')">Description <span class="si">&#8693;</span></th>
            <th onclick="sortBy('revalue')">Revalue <span class="si">&#8693;</span></th>
            <th onclick="sortBy('girNo')">GIR No <span class="si">&#8693;</span></th>
            <th onclick="sortBy('opt')">Status <span class="si">&#8693;</span></th>
            <th onclick="sortBy('remarks')">Remarks <span class="si">&#8693;</span></th>
            <th onclick="sortBy('toRaisedDate')">TO raised date <span class="si">&#8693;</span></th>
          </tr></thead>`;
content = content.replace(theadRegex, theadReplacement);

// Replace colspans
content = content.replace(/colspan="7"/g, 'colspan="10"');

// Replace renderTable inner HTML mapping
const tbodyRegex = /return `<tr>\s*<td class="mono"[\s\S]*?<\/tr>`;/g;
const tbodyReplacement = `return \`<tr>
        <td class="mono" style="color:var(--muted);">\${(currentPage - 1) * perPage + i + 1}</td>
        <td style="font-size:11px;color:var(--soft);">\${fmtDate(d.date)}</td>
        <td><span class="div-tag">\${esc(d.division || '-')}</span></td>
        <td class="mono" style="font-weight:700;">\${esc(d.partNo || '-')}</td>
        <td class="wrap-cell" title="\${esc(d.description || '')}">\${esc(d.description || '-')}</td>
        <td class="mono" style="font-weight:700;">\${esc(d.revalue ? Number(d.revalue).toLocaleString('en-IN') : '-')}</td>
        <td class="mono">\${esc(d.girNo || '-')}</td>
        <td><span class="div-tag" style="background:\${d.opt==='scrap'?'#fecaca':(d.opt==='stock'?'#bbf7d0':(d.opt==='dispatch'?'#bfdbfe':'#e2e8f0'))}; color:#1e293b;">\${esc((d.opt||'-').toUpperCase())}</span></td>
        <td class="wrap-cell" title="\${esc(d.remarks || '')}">\${esc(d.remarks || '-')}</td>
        <td style="font-size:11px;">\${d.toRaisedDate ? d.toRaisedDate.split('T')[0] : '-'}</td>
      </tr>\`;`;
content = content.replace(tbodyRegex, tbodyReplacement);

// Update exportCSV
const csvRegex = /const headers = \['#','Date','Division','Part No','Description','GIR No','Remarks'\];\s*const rows = filtered\.map\(\(d,i\) => \[i\+1,d\.date,d\.division,d\.partNo,d\.description,d\.girNo,d\.remarks\]\);/;
const csvReplacement = `const headers = ['#','Date','Division','Part No','Description','Revalue','GIR No','Status','Remarks','TO raised date'];
  const rows = filtered.map((d,i) => [i+1,d.date,d.division,d.partNo,d.description,d.revalue,d.girNo,d.opt,d.remarks,d.toRaisedDate ? d.toRaisedDate.split('T')[0] : '']);`;
content = content.replace(csvRegex, csvReplacement);

// Update applyFilters search string
const filterRegex = /\(!q \|\| \(\(d\.partNo\|\|''\)\+' '\+\(d\.description\|\|''\)\+' '\+\(d\.girNo\|\|''\)\+' '\+\(d\.division\|\|''\)\)\.toLowerCase\(\)\.includes\(q\)\)/;
const filterReplacement = `(!q || ((d.partNo||'')+' '+(d.description||'')+' '+(d.revalue||'')+' '+(d.girNo||'')+' '+(d.opt||'')+' '+(d.division||'')).toLowerCase().includes(q))`;
content = content.replace(filterRegex, filterReplacement);

fs.writeFileSync(p, content, 'utf8');
console.log('cli.html updated successfully!');
