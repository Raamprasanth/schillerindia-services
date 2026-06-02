import re

file_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\ebir.html"

with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove stats section
html = re.sub(r'<!-- STATS -->.*?</div>\s*</div>\s*<!-- DATE FILTER -->', '<!-- DATE FILTER -->', html, flags=re.DOTALL)

# 2. Remove filter section
html = re.sub(r'<!-- DATE FILTER -->.*?</div>\s*</div>\s*<!-- TABLE -->', '<!-- TABLE -->', html, flags=re.DOTALL)

# 3. Update exportCSV function
start = html.find("function exportCSV(){")
if start != -1:
    end = html.find("}", start) + 1
    new_export = """function exportCSV(){
  if (!filtered.length) { showToast('No records to export.', 'err'); return; }
  const headers=['#','Inward Date','Division','Model','Configuration','Received Qty','Prev SW Version','HW Changes','Accessory Details','CNR Circulation','BIR Ref No.','Status','SC Inward Date','SC Action Plan','Tentative Date','Ship Date to FQC','SC Final Remarks','FQC Observation'];
  const rows = filtered.map((d,i)=>[
    i+1,d.inwardDate,d.division,d.model,d.configuration,d.receivedQty,
    d.prevSwVersion,d.hwChanges,d.accessoryDetails,d.cnrCirculation,
    d.birRefNo,d.finalStatus,d.scInwardDate,d.scActionPlan,d.tentativeDate,d.shipDateToFqc,d.fqcFinalRemarks,d.fqcObservation
  ]);
  let csv = headers.join(',') + '\\n';
  rows.forEach(r => {
    csv += r.map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(',') + '\\n';
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bir-list-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ' + filtered.length + ' records.', 'ok');
}"""
    html = html[:start] + new_export + html[end:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("done")
