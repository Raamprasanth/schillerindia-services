const fs = require('fs');

let content = fs.readFileSync('frontend/public/scsr.html', 'utf8');

// Title and headers
content = content.replace(/Pending Transfer Order/g, 'SC Service Request');
content = content.replace(/<div style="font-family:'Syne',sans-serif;font-weight:700;color:var\(--text\);font-size:15px;">TO Register<\/div>/, `<div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--text);font-size:15px;">SC Service Request</div>`);

fs.writeFileSync('frontend/public/scsr.html', content);

// Now SCCSR
let ctodr = fs.readFileSync('frontend/public/ctodr.html', 'utf8');
ctodr = ctodr.replace(/SchillerIndia - Closed TO Register/g, 'SchillerIndia - SC Closed Service Request');
ctodr = ctodr.replace(/Closed Transfer Order/g, 'SC Closed Service Request');
ctodr = ctodr.replace(/<div style="font-family:'Syne',sans-serif;font-weight:700;color:var\(--text\);font-size:15px;">Closed TO Register<\/div>/, `<div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--text);font-size:15px;">SC Closed Service Request</div>`);

// Table headers
ctodr = ctodr.replace(/<th>TO Req Date<\/th>[\s\S]*?<th>Spares Rcd Date<\/th>/, `<th>Part No</th>
              <th>Description</th>
              <th>Qty</th>
              <th>GIR No</th>
              <th>From Location</th>
              <th>To Location</th>
              <th>Remarks</th>
              <th>To No</th>
              <th>To Raised Date</th>
              <th>Spares Rcd Date</th>
              <th>Closed By</th>
              <th>Close Date</th>`);
              
// JS endpoints
ctodr = ctodr.replace(/\/api\/ctodr/g, '/api/sccsr');
// LoadData columns
ctodr = ctodr.replace(/<td>\$\{r\.entryDate \? new Date\(r\.entryDate\)\.toLocaleDateString\('en-IN'\) : '-'\}<\/td>[\s\S]*?<td>\$\{r\.sparesReceivedDate \? new Date\(r\.sparesReceivedDate\)\.toLocaleDateString\('en-IN'\) : '-'\}<\/td>/, `
        <td><span style="font-weight:700;color:var(--accent);">\${esc(r.partNo)}</span></td>
        <td class="wrap-cell">\${esc(r.description)}</td>
        <td>\${esc(r.qty || '-')}</td>
        <td class="mono">\${esc(r.girNo || '-')}</td>
        <td>\${esc(r.fromLocation || '-')}</td>
        <td>\${esc(r.toLocation || '-')}</td>
        <td>\${esc(r.remarks || '-')}</td>
        <td>\${esc(r.toNo || '-')}</td>
        <td>\${r.toRaisedDate ? new Date(r.toRaisedDate).toLocaleDateString('en-IN') : '-'}</td>
        <td>\${r.sparesReceivedDate ? new Date(r.sparesReceivedDate).toLocaleDateString('en-IN') : '-'}</td>
        <td>\${esc(r.closedBy || '-')}</td>
        <td>\${r.closeDate ? new Date(r.closeDate).toLocaleDateString('en-IN') : '-'}</td>
`);
ctodr = ctodr.replace(/colspan="12"/g, 'colspan="12"');
ctodr = ctodr.replace(/No closed TO entries found/g, 'No closed SC Service Requests found');

fs.writeFileSync('frontend/public/sccsr.html', ctodr);

console.log('HTML files generated successfully!');
