const fs = require('fs');
let htmlFile = 'frontend/public/Reports.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// 1. Rearrange Employee and Division dropdowns in the Individual Analysis tab
const uiSearch = `<div id="perf-emp-field">
                <label class="field-label">Employee</label>
                <select class="field-select" id="perf-employee">
                  <option value=""> Select Employee </option>
                </select>
                <div style="margin-top:8px;">
                  <label class="field-label">Employee's Division</label>
                  <select class="field-select" id="perf-emp-division">
                    <option value=""> Division (for report) </option>
                  </select>
                </div>
              </div>`;

const uiReplace = `<div id="perf-emp-field">
                <div>
                  <label class="field-label">Employee's Division</label>
                  <select class="field-select" id="perf-emp-division">
                    <option value=""> Division (for report) </option>
                  </select>
                </div>
                <div style="margin-top:8px;">
                  <label class="field-label">Employee</label>
                  <select class="field-select" id="perf-employee">
                    <option value=""> Select Employee </option>
                  </select>
                </div>
              </div>`;

html = html.replace(uiSearch, uiReplace);

// 2. Add dependent filtering logic for the dropdowns
// Currently there's a logic syncing division from employee. We want to invert that or add filtering.
/*
    const empSel = document.getElementById('perf-employee');
    if(empSel && !empSel.dataset.boundDivisionSync){
      empSel.dataset.boundDivisionSync = '1';
      empSel.addEventListener('change', () => {
        const emp = (perfOptions.employees || []).find(e => optionLabel(e) === empSel.value);
        const divSel = document.getElementById('perf-emp-division');
        if(emp && emp.division && divSel){
          divSel.value = emp.division;
        }
      });
    }
*/
const jsSearch = `    const empSel = document.getElementById('perf-employee');
    if(empSel && !empSel.dataset.boundDivisionSync){
      empSel.dataset.boundDivisionSync = '1';
      empSel.addEventListener('change', () => {
        const emp = (perfOptions.employees || []).find(e => optionLabel(e) === empSel.value);
        const divSel = document.getElementById('perf-emp-division');
        if(emp && emp.division && divSel){
          divSel.value = emp.division;
        }
      });
    }`;

const jsReplace = `    const empSel = document.getElementById('perf-employee');
    const divSel = document.getElementById('perf-emp-division');
    
    // Add filtering logic to Division dropdown
    if (divSel && !divSel.dataset.boundEmpFilter) {
      divSel.dataset.boundEmpFilter = '1';
      divSel.addEventListener('change', () => {
        const selectedDiv = divSel.value;
        const allEmps = perfOptions.employees || [];
        
        let filteredEmps = allEmps;
        if (selectedDiv) {
          filteredEmps = allEmps.filter(e => e.division === selectedDiv);
        }
        
        const currentEmp = empSel.value;
        setOptions(empSel, filteredEmps, ' Select Employee ');
        if (filteredEmps.some(e => optionLabel(e) === currentEmp)) {
          empSel.value = currentEmp;
        }
      });
    }

    // Still sync division if employee is selected without a division chosen
    if(empSel && !empSel.dataset.boundDivisionSync){
      empSel.dataset.boundDivisionSync = '1';
      empSel.addEventListener('change', () => {
        const emp = (perfOptions.employees || []).find(e => optionLabel(e) === empSel.value);
        if(emp && emp.division && divSel && !divSel.value){
          divSel.value = emp.division;
        }
      });
    }`;

html = html.replace(jsSearch, jsReplace);

fs.writeFileSync(htmlFile, html);
console.log('Reports.html updated');
