const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend/public/eprfob.html');
let c = fs.readFileSync(p, 'utf8');

// --- TABLE 1: Open/Pending ---
// thead
const thead1Regex = /<th onclick="sortTable\('id'\)">[\s\S]*?<th>Action<\/th>/;
const newThead1 = `<th onclick="sortTable('entryDate')">Entry Date<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('division')">Division<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('type')">Type<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('branch')">Branch<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('engineer')">Engineer<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('model')">Model<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('warranty')">Warr Status<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('prfobRef')">TO/SO Ref No<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('status')">Status<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th onclick="sortTable('sparesReceivedAtSvc')">Spares Rcv Date<span class="sort-icon"><span>&#9650;</span><span>&#9660;</span></span></th>
                  <th>Action</th>`;
c = c.replace(thead1Regex, newThead1);

// tbody 1
const tbody1Regex = /<tr>\s*<td>\$\{esc\(e\.id\)\}<\/td>[\s\S]*?<td><button class="btn-xs" onclick="openEmployeeUpdateModal\('\$\{e\._id\}'\)" title="Update">&#9999;&#65039;<\/button><\/td>\s*<\/tr>/;
const newTbody1 = `<tr>
        <td>\${esc(e.entryDate)}</td>
        <td><span style="font-size:12px;font-weight:600;color:var(--accent);">\${esc(e.division)}</span></td>
        <td>\${esc(e.type)}</td>
        <td>\${esc(e.branch)}</td>
        <td style="font-weight:600;">\${esc(e.engineer)}</td>
        <td>\${esc(e.model)}</td>
        <td>\${esc(e.warranty)}</td>
        <td><span class="chip">\${esc(e.prfobRef)}</span></td>
        <td><span class="\${statusClass(e.status)}">\${esc(e.status)}</span></td>
        <td>\${esc(e.sparesReceivedAtSvc || '')}</td>
        <td><button class="btn-xs" onclick="openEmployeeUpdateModal('\${e._id}')" title="Update">&#9999;&#65039;</button></td>
      </tr>`;
c = c.replace(tbody1Regex, newTbody1);

// --- TABLE 2: Closed ---
// thead 2
const thead2Regex = /<th>Id<\/th>\s*<th>Division<\/th>\s*<th>Entry Date<\/th>\s*<th>Sc Engg<\/th>\s*<th>Type<\/th>\s*<th>Engineer<\/th>\s*<th>Branch<\/th>\s*<th>Model<\/th>\s*<th>Warranty<\/th>\s*<th>TO\/SO Ref<\/th>\s*<th>CRM Ref<\/th>\s*<th>Executed Date<\/th>\s*<th>Action<\/th>/;
const newThead2 = `<th>Entry Date</th>
                  <th>Division</th>
                  <th>Type</th>
                  <th>Branch</th>
                  <th>Engineer</th>
                  <th>Model</th>
                  <th>Warr Status</th>
                  <th>TO/SO Ref No</th>
                  <th>Status</th>
                  <th>Spares Rcv Date</th>
                  <th>Action</th>`;
c = c.replace(thead2Regex, newThead2);

// tbody 2
const tbody2Regex = /<tr>\s*<td>\$\{esc\(e\.id\)\}<\/td><td>\$\{esc\(e\.division\)\}<\/td><td>\$\{esc\(e\.entryDate\)\}<\/td><td>\$\{esc\(e\.scEngg\)\}<\/td><td>\$\{esc\(e\.type\)\}<\/td><td>\$\{esc\(e\.engineer\)\}<\/td><td>\$\{esc\(e\.branch\)\}<\/td><td>\$\{esc\(e\.model\)\}<\/td><td>\$\{esc\(e\.warranty\)\}<\/td><td>\$\{esc\(e\.prfobRef\)\}<\/td><td>\$\{esc\(e\.crmRef\)\}<\/td><td>\$\{esc\(e\.executedDate \|\| ''\)\}<\/td>\s*<td><button class="btn-xs" onclick="openEmployeeUpdateModal\('\$\{e\._id\}'\)">&#128065; View<\/button><\/td>\s*<\/tr>/;
const newTbody2 = `<tr>
        <td>\${esc(e.entryDate)}</td><td>\${esc(e.division)}</td><td>\${esc(e.type)}</td><td>\${esc(e.branch)}</td><td>\${esc(e.engineer)}</td><td>\${esc(e.model)}</td><td>\${esc(e.warranty)}</td><td>\${esc(e.prfobRef)}</td><td>\${esc(e.status)}</td><td>\${esc(e.sparesReceivedAtSvc || '')}</td>
        <td><button class="btn-xs" onclick="openEmployeeUpdateModal('\${e._id}')">&#128065; View</button></td>
      </tr>`;
c = c.replace(tbody2Regex, newTbody2);

// Fix colspans for empty rows
c = c.replace(/colspan="14"/g, 'colspan="11"');
c = c.replace(/colspan="13"/g, 'colspan="11"'); // table 2 empty row currently has 13

// Fix CSV Export matching the same headers
const csvRegex = /const csv = \['Id,Division,Entry Date,Sc Engg,Type,Received Date,Branch,Engineer,Model,Warranty,PRF\/OB Ref,CRM Ref,Status,Executed Date,Remarks', \.\.\.d\.map\(e => \[e\.id, e\.division, e\.entryDate, e\.scEngg, e\.type, e\.receivedDate, e\.branch, e\.engineer, e\.model, e\.warranty, e\.prfobRef, e\.crmRef, e\.status, e\.executedDate, '"' \+ \(e\.remarks \|\| ''\)\.replace\(\/"\/g, '""'\) \+ '"'\]\.join\(','\)\)\]\.join\('\\n'\);/;
const newCsv = `const csv = ['Entry Date,Division,Type,Branch,Engineer,Model,Warr Status,TO/SO Ref No,Status,Spares Rcv Date,Remarks', ...d.map(e => [e.entryDate, e.division, e.type, e.branch, e.engineer, e.model, e.warranty, e.prfobRef, e.status, e.sparesReceivedAtSvc, '"' + (e.remarks || '').replace(/"/g, '""') + '"'].join(','))].join('\\n');`;
c = c.replace(csvRegex, newCsv);


fs.writeFileSync(p, c, 'utf8');
console.log('Successfully aligned eprfob layout with scprfob');
