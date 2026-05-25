import os
import re

files = ['Rtfrn.html', 'Rtob.html', 'Rtur.html', 'Rtcrl.html']
base = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public'

new_export_csv = """function exportCSV() {
  const headers = [
    'Entry Date', 'Division', 'SC Ref No', 'DEF GIR No', 'Category/OB Type', 'Model', 'Def Brd/Mod Name', 'No of Days', 'Status',
    'Technical Remarks', 'Repair Team Remarks', 'Components Used to Repaired', 'Cost in INR', 'Time Taken to Repair', 'Repair Status',
    'DOI (Date of Installation)', 'Repaired By', 'Repaired Date', 'Type of Work', 'RA Engineer', 'DEF Unit GIR No', 'Repaired GIR No', 'Repaired BRD Stk Date',
    'Type of Report', 'DC No', 'Field Remarks', 'Final Remarks', 'Additional Notes', 'Return DC No', 'Destination', 'Shipped SC', 'Shipped Commercial',
    'PRF/OB No', 'Submitted By', 'Submitted At'
  ];
  const rows = filtered.map(d => [
    fmtDate(d.entryDate), d.division || '-', d.scRefNo || '-', d.defGirNo || '-', d.category || d.obType || '-', d.model || '-', d.defBrdModName || '-', d.noOfDays || 0, d.status || '-',
    d.techRemarks || '-', d.repairRemarks || '-', d.components || d.compUsedToRepair || '-', d.cost || '-', d.timeTaken || '-', d.repairStatus || '-',
    d.doi || '-', d.repairedBy || '-', d.repairedDate ? fmtDate(d.repairedDate) : '-', d.typeWork || '-', d.raEng || '-', d.defUnitGir || '-', d.repGirNo || '-', (d.repBrd || d.repBrdDate) ? fmtDate(d.repBrd || d.repBrdDate) : '-',
    d.typeReport || '-', d.dcNo || '-', d.fieldRemarks || '-', d.finalRemarks || '-', d.addNotes || '-', d.returnDcNo || '-', d.destination || '-', d.shipSc ? fmtDate(d.shipSc) : '-', d.shipComm ? fmtDate(d.shipComm) : '-',
    d.prfObNo || '-', d.submittedBy || '-', d.submittedAt ? fmtDate(d.submittedAt) : '-'
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'export-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('Exported ' + filtered.length + ' records.', 'ok');
}"""

for f in files:
    path = os.path.join(base, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Use regex to find the exportCSV function block
    pattern = re.compile(r'function exportCSV\(\)\s*\{.*?showToast.*?\}', re.DOTALL)
    
    if pattern.search(content):
        # We replace the exportCSV function completely
        new_content = pattern.sub(new_export_csv, content)
        # Update the download filename dynamically based on the file name
        prefix = f.replace('.html', '').lower()
        new_content = new_content.replace("'export-' +", f"'{prefix}-' +")
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Updated {f}")
    else:
        print(f"exportCSV not found in {f}")
