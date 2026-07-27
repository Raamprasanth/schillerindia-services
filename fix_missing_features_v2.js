const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

const fallbackOld = `      const fallbackReports = [
        { type: 'CRM', label: 'CRM Reports', schedule: 'Every Tuesday' },
        { type: 'PendingActivity', label: 'Pending Activity', schedule: 'Every Monday' },
        { type: 'NonSaleable', label: 'Non Saleable', schedule: '2nd & 16th' },
        { type: 'SupplierWarranty', label: 'Supplier Warranty', schedule: '3rd & 16th' },
        { type: 'CriticalPendingReport', label: 'Critical Pending Report', schedule: '2nd' },
        { type: 'PIRequest', label: 'PI Request', schedule: '5th' }
      ];`;
      
const fallbackNew = `      const fallbackReports = [
        { type: 'CRM', label: 'CRM Reports', schedule: 'Every Tuesday' },
        { type: 'PendingActivity', label: 'Pending Activity', schedule: 'Every Monday' },
        { type: 'NonSaleable', label: 'Non Saleable', schedule: '2nd & 16th' },
        { type: 'SupplierWarranty', label: 'Supplier Warranty', schedule: '3rd & 16th' },
        { type: 'CriticalPendingReport', label: 'Critical Pending Report', schedule: '2nd' },
        { type: 'PIRequest', label: 'PI Request', schedule: '5th' }
      ];
      if (monthStr.endsWith('-04') || monthStr.endsWith('-08') || monthStr.endsWith('-12') || monthStr === '4' || monthStr === '8' || monthStr === '12' || monthStr === '04' || monthStr === '08') {
        fallbackReports.push({ type: 'BuyBack', label: 'Buy Back', schedule: '15th' });
      }`;

html = html.replace(fallbackOld, fallbackNew);

const btnOld = `<button class="btn btn-green" onclick="exportIndividualAllPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
        </div>
        
        <div id="indall-pdf-content" style="padding:0 24px 24px 24px;">`;

const btnNew = `<button class="btn btn-green" onclick="exportIndividualAllPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
        </div>
        <div style="margin-top:0px;padding:15px 24px 0 24px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-indall" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>
        
        <div id="indall-pdf-content" style="padding:0 24px 24px 24px;">`;

html = html.replace(btnOld, btnNew);

const exportOld = `async function exportIndividualAllPDF() {
    const el = document.getElementById('indall-pdf-content');
    if (!el) return;
    const month = document.getElementById('perf-indall-month').value || 'Report';
    await generatePremiumPDF(el.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', 'All Employees', month, 'Individual_Performance');
  }`;

const exportNew = `async function exportIndividualAllPDF() {
    const el = document.getElementById('indall-pdf-content');
    if (!el) return;
    const month = document.getElementById('perf-indall-month').value || 'Report';
    const scRemarks = document.getElementById('sc-remarks-indall')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'INDIVIDUAL PERFORMANCE REPORT', 'All Employees', month, 'Individual_Performance', scRemarks);
  }`;

html = html.replace(exportOld, exportNew);

fs.writeFileSync(file, html);
console.log('Fixed reports');
