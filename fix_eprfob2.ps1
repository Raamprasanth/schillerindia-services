$file = "c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\eprfob.html"
$content = [System.IO.File]::ReadAllText($file)

# 1. Remove generateDemoData entirely
$pattern1 = '(?s)function generateDemoData\(\).*?return data;\s*\}'
$content = [regex]::Replace($content, $pattern1, '')

# 2. Rewrite loadData
$pattern2 = '(?s)/\*\s*----------- LOAD DATA -----------\s*\*/.*?async function loadData\(\)\{.*?\}'
$newLoadData = '/* ----------- LOAD DATA ----------- */
async function loadData(){
  try{
    const res=await fetch(API+''/api/prfob'',{headers:authH()});
    if(res.status===401||res.status===403){showToast(''Session expired.'',''err'');setTimeout(()=>window.location.href=''login.html'',1500);return;}
    if(!res.ok) throw new Error(''HTTP ''+res.status);
    const result = await res.json();
    prfobData = result.data || result || [];
  }catch(e){
    console.error(e);
    prfobData = [];
  }
  filteredData=[...prfobData];
  updateStats();
  updateBadges();
  applyDateFilter();
}'
$content = [regex]::Replace($content, $pattern2, $newLoadData)

[System.IO.File]::WriteAllText($file, $content)
