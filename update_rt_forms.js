const fs = require('fs');
const path = require('path');

const dir = 'frontend/public';

// The new remarks section (same for all 3 files):
// - Remove: Remarks (from service team)
// - Keep: Technical Remarks
// - Add: Repair Team Remarks (after Technical Remarks)
// - Keep: Components Used
// - Add: Cost (after Components Used)
// - Add: Time Taken to Repair (after Cost)
// - Add: Repair Status dropdown (Not Repairable, Returned as it is)
// - Remove: Final Remarks

// The new details section addition:
// - After Repaired Date, add Completed Date

// ---------- Rtfrn.html ----------
{
  let f = fs.readFileSync(path.join(dir, 'Rtfrn.html'), 'utf8');

  // 1) Replace the entire remarks section in the modal
  f = f.replace(
    `        <!-- Section 1 - Remarks -->\r\n        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff">\r\n              <label>Remarks (from service team)</label>\r\n              <textarea id="u-fieldremarks" placeholder="-" readonly></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Technical Remarks</label>\r\n              <textarea id="u-techremarks" placeholder="Root cause, technical diagnosis-"></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Components Used</label>\r\n              <textarea id="u-components" placeholder="List components replaced or used-"></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Final Remarks <span class="req">*</span></label>\r\n              <textarea id="u-finalremarks" placeholder="Describe resolution or current status-"></textarea>\r\n            </div>\r\n          </div>\r\n        </div>`,
    `        <!-- Section 1 - Remarks -->\r\n        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff">\r\n              <label>Technical Remarks</label>\r\n              <textarea id="u-techremarks" placeholder="Root cause, technical diagnosis-"></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Repair Team Remarks</label>\r\n              <textarea id="u-repairremarks" placeholder="Repair team observations and findings-"></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Components Used</label>\r\n              <textarea id="u-components" placeholder="List components replaced or used-"></textarea>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Cost</label>\r\n              <input type="text" id="u-cost" placeholder="e.g. 1500"/>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Time Taken to Repair</label>\r\n              <input type="text" id="u-timetaken" placeholder="e.g. 3 days, 2 hours"/>\r\n            </div>\r\n            <div class="ff">\r\n              <label>Repair Status</label>\r\n              <select id="u-repairstatus">\r\n                <option value="">Select...</option>\r\n                <option value="not_repairable">Not Repairable</option>\r\n                <option value="returned_as_is">Returned as it is</option>\r\n              </select>\r\n            </div>\r\n          </div>\r\n        </div>`
  );

  // 2) Add Completed Date after Repaired Date in Details section
  f = f.replace(
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n          </div>\r\n        </div>`,
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n            <div class="ff"><label>Completed Date</label><input type="date" id="u-completeddate"/></div>\r\n          </div>\r\n        </div>`
  );

  // 3) Update openUpdate to set new fields
  f = f.replace(
    `  set('u-fieldremarks',d.fieldRemarks||'');\r\n  set('u-finalremarks',d.finalRemarks||'');\r\n  set('u-techremarks', d.techRemarks||'');\r\n  set('u-components',  d.components||'');`,
    `  set('u-techremarks',   d.techRemarks||'');\r\n  set('u-repairremarks', d.repairRemarks||'');\r\n  set('u-components',    d.components||'');\r\n  set('u-cost',          d.cost||'');\r\n  set('u-timetaken',     d.timeTaken||'');\r\n  set('u-repairstatus',  d.repairStatus||'');\r\n  set('u-completeddate', d.completedDate||'');`
  );

  // 4) Update submitUpdate validation (remove finalRem requirement)
  f = f.replace(
    `  const finalRem   = document.getElementById('u-finalremarks').value.trim();\r\n  const errEl = document.getElementById('modal-err');\r\n  const okEl  = document.getElementById('modal-ok');\r\n  errEl.classList.remove('show'); okEl.classList.remove('show');\r\n\r\n  if (!repairedBy || !status || !finalRem) {\r\n    errEl.textContent = '? Repaired By, Status and Final Remarks are required.';\r\n    errEl.classList.add('show'); return;\r\n  }`,
    `  const errEl = document.getElementById('modal-err');\r\n  const okEl  = document.getElementById('modal-ok');\r\n  errEl.classList.remove('show'); okEl.classList.remove('show');\r\n\r\n  if (!repairedBy || !status) {\r\n    errEl.textContent = '⚠ Repaired By and Status are required.';\r\n    errEl.classList.add('show'); return;\r\n  }`
  );

  // 5) Update payload in submitUpdate to use new fields
  f = f.replace(
    `    repairedBy,\r\n    status,\r\n    doi:          document.getElementById('u-doi').value,\r\n    fieldRemarks: document.getElementById('u-fieldremarks').value.trim(),\r\n    repairedDate: document.getElementById('u-repaireddate').value,\r\n    finalRemarks: finalRem,\r\n    techRemarks:  document.getElementById('u-techremarks').value.trim(),\r\n    components:   document.getElementById('u-components').value.trim(),\r\n    updatedBy:    EMP_NAME,\r\n    updatedAt:    new Date().toISOString(),`,
    `    repairedBy,\r\n    status,\r\n    doi:           document.getElementById('u-doi').value,\r\n    repairedDate:  document.getElementById('u-repaireddate').value,\r\n    completedDate: document.getElementById('u-completeddate').value,\r\n    techRemarks:   document.getElementById('u-techremarks').value.trim(),\r\n    repairRemarks: document.getElementById('u-repairremarks').value.trim(),\r\n    components:    document.getElementById('u-components').value.trim(),\r\n    cost:          document.getElementById('u-cost').value.trim(),\r\n    timeTaken:     document.getElementById('u-timetaken').value.trim(),\r\n    repairStatus:  document.getElementById('u-repairstatus').value,\r\n    updatedBy:     EMP_NAME,\r\n    updatedAt:     new Date().toISOString(),`
  );

  fs.writeFileSync(path.join(dir, 'Rtfrn.html'), f, 'utf8');
  console.log('Rtfrn.html updated');
}

// ---------- Rtob.html ----------
{
  let f = fs.readFileSync(path.join(dir, 'Rtob.html'), 'utf8');

  // 1) Replace remarks section
  f = f.replace(
    `        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff"><label>Remarks (from service team)</label><textarea id="u-fieldremarks" rows="1" style="height:38px;min-height:38px;resize:none;" readonly placeholder="-"></textarea></div>\r\n            <div class="ff"><label>Technical Remarks</label><textarea id="u-techremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Root cause, technical diagnosis-"></textarea></div>\r\n            <div class="ff"><label>Components Used</label><textarea id="u-components" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="List components replaced or used-"></textarea></div>\r\n            <div class="ff"><label>Final Remarks</label><textarea id="u-finalremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Describe resolution or current OB status-"></textarea></div>\r\n          </div>\r\n        </div>`,
    `        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff"><label>Technical Remarks</label><textarea id="u-techremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Root cause, technical diagnosis-"></textarea></div>\r\n            <div class="ff"><label>Repair Team Remarks</label><textarea id="u-repairremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Repair team observations and findings-"></textarea></div>\r\n            <div class="ff"><label>Components Used</label><textarea id="u-components" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="List components replaced or used-"></textarea></div>\r\n            <div class="ff"><label>Cost</label><input type="text" id="u-cost" placeholder="e.g. 1500"/></div>\r\n            <div class="ff"><label>Time Taken to Repair</label><input type="text" id="u-timetaken" placeholder="e.g. 3 days, 2 hours"/></div>\r\n            <div class="ff"><label>Repair Status</label>\r\n              <select id="u-repairstatus">\r\n                <option value="">Select...</option>\r\n                <option value="not_repairable">Not Repairable</option>\r\n                <option value="returned_as_is">Returned as it is</option>\r\n              </select>\r\n            </div>\r\n          </div>\r\n        </div>`
  );

  // 2) Add Completed Date after Repaired Date
  f = f.replace(
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n          </div>\r\n        </div>`,
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n            <div class="ff"><label>Completed Date</label><input type="date" id="u-completeddate"/></div>\r\n          </div>\r\n        </div>`
  );

  // 3) Update openUpdate to load new fields
  f = f.replace(
    `  set('u-repaireddate',d.repairedDate||'');\r\n  set('u-fieldremarks',d.fieldRemarks||'');\r\n  set('u-finalremarks',d.finalRemarks); set('u-techremarks',d.techRemarks); set('u-components',d.components);`,
    `  set('u-repaireddate',  d.repairedDate||'');\r\n  set('u-completeddate', d.completedDate||'');\r\n  set('u-techremarks',   d.techRemarks||'');\r\n  set('u-repairremarks', d.repairRemarks||'');\r\n  set('u-components',    d.components||'');\r\n  set('u-cost',          d.cost||'');\r\n  set('u-timetaken',     d.timeTaken||'');\r\n  set('u-repairstatus',  d.repairStatus||'');`
  );

  // 4) Update submitUpdate validation
  f = f.replace(
    `  if(!repairedBy||!status){\r\n    errEl.textContent='Required: Repaired By and Status.';\r\n    errEl.classList.add('show'); return;\r\n  }`,
    `  if(!repairedBy||!status){\r\n    errEl.textContent='⚠ Required: Repaired By and Status.';\r\n    errEl.classList.add('show'); return;\r\n  }`
  );

  // 5) Update payload
  f = f.replace(
    `  const payload={repairedBy,status,doi:document.getElementById('u-doi').value,fieldRemarks:document.getElementById('u-fieldremarks').value.trim(),repairedDate:document.getElementById('u-repaireddate').value,finalRemarks:document.getElementById('u-finalremarks').value.trim(),techRemarks:document.getElementById('u-techremarks').value.trim(),components:document.getElementById('u-components').value.trim(),updatedBy:EMP_NAME,updatedAt:new Date().toISOString()};`,
    `  const payload={repairedBy,status,doi:document.getElementById('u-doi').value,repairedDate:document.getElementById('u-repaireddate').value,completedDate:document.getElementById('u-completeddate').value,techRemarks:document.getElementById('u-techremarks').value.trim(),repairRemarks:document.getElementById('u-repairremarks').value.trim(),components:document.getElementById('u-components').value.trim(),cost:document.getElementById('u-cost').value.trim(),timeTaken:document.getElementById('u-timetaken').value.trim(),repairStatus:document.getElementById('u-repairstatus').value,updatedBy:EMP_NAME,updatedAt:new Date().toISOString()};`
  );

  fs.writeFileSync(path.join(dir, 'Rtob.html'), f, 'utf8');
  console.log('Rtob.html updated');
}

// ---------- Rtur.html ----------
{
  let f = fs.readFileSync(path.join(dir, 'Rtur.html'), 'utf8');

  // 1) Replace remarks section
  f = f.replace(
    `        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff"><label>Remarks (from service team)</label><textarea id="u-fieldremarks" rows="1" style="height:38px;min-height:38px;resize:none;" readonly placeholder="-"></textarea></div>\r\n            <div class="ff"><label>Technical Remarks</label><textarea id="u-techremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Root cause, technical diagnosis-"></textarea></div>\r\n            <div class="ff"><label>Components Used</label><textarea id="u-components" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="List components replaced or used-"></textarea></div>\r\n            <div class="ff"><label>Final Remarks</label><textarea id="u-finalremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Describe resolution or current status-"></textarea></div>\r\n          </div>\r\n        </div>`,
    `        <div class="form-sec">\r\n          <div class="form-sec-title">&#128172; Remarks &amp; Findings</div>\r\n          <div class="fg-3">\r\n            <div class="ff"><label>Technical Remarks</label><textarea id="u-techremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Root cause, technical diagnosis-"></textarea></div>\r\n            <div class="ff"><label>Repair Team Remarks</label><textarea id="u-repairremarks" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="Repair team observations and findings-"></textarea></div>\r\n            <div class="ff"><label>Components Used</label><textarea id="u-components" rows="1" style="height:38px;min-height:38px;resize:none;" placeholder="List components replaced or used-"></textarea></div>\r\n            <div class="ff"><label>Cost</label><input type="text" id="u-cost" placeholder="e.g. 1500"/></div>\r\n            <div class="ff"><label>Time Taken to Repair</label><input type="text" id="u-timetaken" placeholder="e.g. 3 days, 2 hours"/></div>\r\n            <div class="ff"><label>Repair Status</label>\r\n              <select id="u-repairstatus">\r\n                <option value="">Select...</option>\r\n                <option value="not_repairable">Not Repairable</option>\r\n                <option value="returned_as_is">Returned as it is</option>\r\n              </select>\r\n            </div>\r\n          </div>\r\n        </div>`
  );

  // 2) Add Completed Date after Repaired Date
  f = f.replace(
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n          </div>\r\n        </div>`,
    `            <div class="ff"><label>Repaired Date</label><input type="date" id="u-repaireddate"/></div>\r\n            <div class="ff"><label>Completed Date</label><input type="date" id="u-completeddate"/></div>\r\n          </div>\r\n        </div>`
  );

  // 3) Update openUpdate to load new fields
  f = f.replace(
    `  set('u-repaireddate',d.repairedDate||'');\r\n  set('u-fieldremarks',d.fieldRemarks||'');\r\n  set('u-finalremarks',d.finalRemarks); set('u-techremarks',d.techRemarks); set('u-components',d.compUsedToRepair||d.components);`,
    `  set('u-repaireddate',  d.repairedDate||'');\r\n  set('u-completeddate', d.completedDate||'');\r\n  set('u-techremarks',   d.techRemarks||'');\r\n  set('u-repairremarks', d.repairRemarks||'');\r\n  set('u-components',    d.compUsedToRepair||d.components||'');\r\n  set('u-cost',          d.cost||'');\r\n  set('u-timetaken',     d.timeTaken||'');\r\n  set('u-repairstatus',  d.repairStatus||'');`
  );

  // 4) Update payload - find the payload line in Rtur.html
  f = f.replace(
    `  const payload={repairedBy,status,doi:document.getElementById('u-doi').value,fieldRemarks:document.getElementById('u-fieldremarks').value.trim(),repairedDate:document.getElementById('u-repaireddate').value,finalRemarks:document.getElementById('u-finalremarks').value.trim(),techRemarks:document.getElementById('u-techremarks').value.trim(),components:document.getElementById('u-components').value.trim(),updatedBy:EMP_NAME,updatedAt:new Date().toISOString()};`,
    `  const payload={repairedBy,status,doi:document.getElementById('u-doi').value,repairedDate:document.getElementById('u-repaireddate').value,completedDate:document.getElementById('u-completeddate').value,techRemarks:document.getElementById('u-techremarks').value.trim(),repairRemarks:document.getElementById('u-repairremarks').value.trim(),components:document.getElementById('u-components').value.trim(),cost:document.getElementById('u-cost').value.trim(),timeTaken:document.getElementById('u-timetaken').value.trim(),repairStatus:document.getElementById('u-repairstatus').value,updatedBy:EMP_NAME,updatedAt:new Date().toISOString()};`
  );

  fs.writeFileSync(path.join(dir, 'Rtur.html'), f, 'utf8');
  console.log('Rtur.html updated');
}

console.log('All 3 files done!');
