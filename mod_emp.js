const fs = require('fs');
const file = 'frontend/public/emppendingfrn.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Destination -> Type of Work + Mandatory Destination
content = content.replace(
  /<div class=\"ff span2\">\s*<label>Destination<\/label>\s*<input type=\"text\" id=\"upd-destination\" placeholder=\"e\.g\. Chennai, Delhi, Nashik\.\.\.\"[\/]?>\s*<\/div>/g,
  `<div class="ff">
              <label>Destination <span class="req">*</span></label>
              <input type="text" id="upd-destination" required placeholder="e.g. Chennai, Delhi, Nashik..."/>
            </div>
            <div class="ff">
              <label>Type of Work</label>
              <select id="upd-typework">
                <option value="">Select Type of Work...</option>
                <option value="No Fault">No Fault</option>
                <option value="Returned as it is">Returned as it is</option>
              </select>
            </div>`
);

// 2. Tech remarks mandatory
content = content.replace(
  /<div class=\"ff\">\s*<label>Technical Remarks<\/label>\s*<textarea id=\"upd-techremarks\" rows=\"1\" placeholder=\"Technical diagnosis and findings\.\.\.\"><\/textarea>\s*<\/div>/g,
  `<div class="ff">
              <label>Technical Remarks <span class="req">*</span></label>
              <textarea id="upd-techremarks" required rows="1" placeholder="Technical diagnosis and findings..."></textarea>
            </div>`
);

// 3. set typework in openUpdateModal
content = content.replace(
  /set\('upd-destination',d\.destination\|\|''\);/g,
  `set('upd-destination',d.destination||'');\n  set('upd-typework',d.typeWork||'');`
);

// 4. payload in saveUpdate
content = content.replace(
  /destination:document\.getElementById\('upd-destination'\)\.value,status:statusVal/g,
  `destination:document.getElementById('upd-destination').value,typeWork:document.getElementById('upd-typework').value,status:statusVal`
);

fs.writeFileSync(file, content);
console.log('Modifications complete.');
