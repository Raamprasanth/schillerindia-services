const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /async function exportPriorityDivisionPDF\(\)\{[\s\S]*?const scRemarks = document\.getElementById\('division-sc-remarks'\)\?\.value \|\| '';/g;

const replacement = `async function exportPriorityDivisionPDF(){
  try{
    const month=document.getElementById('perf-month').value;
    if(!month){toast('Please select a month','error');return;}
    if(!perfOptionsLoaded) await loadPerfOptions();
    const wanted=[
      {label:'Ventilator',patterns:['VENTILATOR']},
      {label:'Vent Con',patterns:['VENT CON','VENTCON']},
      {label:'Patient Monitors',patterns:['PATIENT MONITOR','MONITOR'],exclude:[' CON',' PM','PM CM']},
      {label:'PM CM',patterns:['PM CM','PMCM','MONITOR CON','MONITORS CON']}
    ];
    const divisions=(perfOptions.divisions||[]).map(d=>d.name||d);
    
    const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFLib) { toast('PDF library not loaded', 'error'); return; }
    const doc = new jsPDFLib('l', 'mm', 'a4'); 
    
    let isFirst = true;

    for(const item of wanted){
      const division=divisions.find(name=>{
        const upper=String(name||'').toUpperCase();
        return item.patterns.some(p=>upper.includes(p)) && !(item.exclude||[]).some(p=>upper.includes(p));
      })||item.label;
      const qs=new URLSearchParams({scope:'division',month,division}).toString();
      const res=await fetch('/api/reports/performance/summary?'+qs,{headers:hdrs()});
      const payload=await res.json();
      if(!res.ok) throw new Error(payload.message||\`Failed to load \${division}\`);
      
      if (!isFirst) {
         doc.addPage();
      }
      isFirst = false;
      
      const scRemarks = document.getElementById('division-sc-remarks')?.value || '';
      drawPerfPdfPage(doc, payload.data, month, 'Division', division, scRemarks);
    }
    
    doc.save(\`Performance_Division_Pack_\${month}.pdf\`);
    toast('Division pack PDF export completed!','success');
  }catch(e){
    toast('Division pack PDF failed: '+e.message,'error');
  }
}

// --------------------------------------------------------------
//  TAB 3  ANALYTICS
// --------------------------------------------------------------`;

content = content.replace(regex, replacement);
fs.writeFileSync(FILE_PATH, content);
console.log('Restored exportPriorityDivisionPDF');
