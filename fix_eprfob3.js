const fs = require('fs');
const file = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/eprfob.html';
let html = fs.readFileSync(file, 'utf8');

const regex = /function generateDemoData\(\)\{[\s\S]*?return data;\r?\n\}/;
html = html.replace(regex, '');

const loadDataOld = /async function loadData\(\)\{[\s\S]*?applyDateFilter\(\);\r?\n\}/;
const loadDataNew = `async function loadData(){
  try{
    const res=await fetch('/api/prfob',{headers:authH()});
    if(res.status===401||res.status===403){showToast('Session expired.','err');setTimeout(()=>window.location.href='login.html',1500);return;}
    if(!res.ok) throw new Error('HTTP '+res.status);
    const result = await res.json();
    prfobData = result.data || result || [];
  }catch(e){
    console.error(e);
    prfobData = [];
    showToast('Failed to load API data','err');
  }
  filteredData=[...prfobData];
  updateStats();
  updateBadges();
  applyDateFilter();
}`;
html = html.replace(loadDataOld, loadDataNew);

fs.writeFileSync(file, html, 'utf8');
console.log('eprfob.html cleaned up generateDemoData successfully.');
