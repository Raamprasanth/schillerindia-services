const fs = require('fs');

const files = ['empestpend.html', 'emppendingfrn.html', 'empunderep.html'];

files.forEach(file => {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');

  // Fix HTML templates
  content = content.replace(/Pending FRN: - \| SO Pending: - \| Total: -/g, 'Total Queued: - | Next Run: -');
  content = content.replace(/Morning: - \| Afternoon: - \| Total: -/g, 'Total Queued: - | Next Run: -');
  content = content.replace(/Morning: - \| Evening: - \| Total: -/g, 'Total Queued: - | Next Run: -');

  // Fix loadEscalationStatus
  content = content.replace(
    /if\(metaEl\) metaEl\.textContent=`Pending FRN: \$\{frnCount\} \| SO Pending: \$\{estCount\} \| Total: \$\{totalCount\}`;/g,
    "if(metaEl) metaEl.textContent=`Total Queued: ${totalCount} | Next Run: ${queue?queue.nextRunLabel:'-'}`;"
  );
  content = content.replace(
    /if\(metaEl\) metaEl\.textContent='Pending FRN: - \| SO Pending: - \| Total: -';/g,
    "if(metaEl) metaEl.textContent='Total Queued: - | Next Run: -';"
  );
  content = content.replace(
    /if\(subEl\) subEl\.textContent=`Receivers: \$\{recipients\.length\?recipients\.join\(\', \'\):\'-\'\} \| Combined Excel queued for \$\{queue\?`\$\{queue\.slotLabel\} \$\{queue\.nextRunLabel\}`:\'next slot\'\}`;/g,
    "if(subEl) subEl.textContent=`Receivers: ${recipients.length?recipients.join(', '):'-'}`;"
  );

  // Fix bumpSrEscalationQueue
  content = content.replace(
    /if\(metaEl\)\{\s*const parts=\(metaEl\.textContent\.match\(\/\\d\+\/g\)\|\|\[\'0\',\'0\',\'0\'\]\)\.map\(v=>parseInt\(v,10\)\|\|0\);\s*const minutes=new Date\(\)\.getHours\(\)\*60\+new Date\(\)\.getMinutes\(\);\s*let morning=parts\[0\]\|\|0, afternoon=parts\[1\]\|\|0;\s*if\(minutes<660\) morning=Math\.max\(0,morning\+delta\);\s*else if\(minutes<900\) afternoon=Math\.max\(0,afternoon\+delta\);\s*else morning=Math\.max\(0,morning\+delta\);\s*metaEl\.textContent=`Morning: \$\{morning\} \| Afternoon: \$\{afternoon\} \| Total: \$\{Math\.max\(0,morning\+afternoon\)\}`;\s*\}/g,
    "if(metaEl){const currentTotal=parseInt((metaEl.textContent.match(/\\d+/)||['0'])[0],10)||0; metaEl.textContent=`Total Queued: ${Math.max(0,currentTotal+delta)} | Next Run: ${getNextSrRunLabel()}`;}"
  );

  // Fix bumpToEscalationQueue
  content = content.replace(
    /if\(metaEl\)\{\s*const parts=\(metaEl\.textContent\.match\(\/\\d\+\/g\)\|\|\[\'0\',\'0\',\'0\'\]\)\.map\(v=>parseInt\(v,10\)\|\|0\);\s*const minutes=new Date\(\)\.getHours\(\)\*60\+new Date\(\)\.getMinutes\(\);\s*let morning=parts\[0\]\|\|0, evening=parts\[1\]\|\|0;\s*if\(minutes<660\) morning=Math\.max\(0,morning\+delta\);\s*else if\(minutes<990\) evening=Math\.max\(0,evening\+delta\);\s*else morning=Math\.max\(0,morning\+delta\);\s*metaEl\.textContent=`Morning: \$\{morning\} \| Evening: \$\{evening\} \| Total: \$\{Math\.max\(0,morning\+evening\)\}`;\s*\}/g,
    "if(metaEl){const currentTotal=parseInt((metaEl.textContent.match(/\\d+/)||['0'])[0],10)||0; metaEl.textContent=`Total Queued: ${Math.max(0,currentTotal+delta)} | Next Run: ${getNextToRunLabel()}`;}"
  );

  // Fix loadSrEscalationStatus
  const newSrLoader = `async function loadSrEscalationStatus(moduleKey){
  ensureSrEscalationBanner(moduleKey);
  const textEl=document.getElementById(\`sr-banner-text-\${moduleKey}\`);
  const subEl=document.getElementById(\`sr-banner-sub-\${moduleKey}\`);
  const metaEl=document.getElementById(\`sr-banner-meta-\${moduleKey}\`);
  const countEl=document.getElementById(\`sr-banner-count-\${moduleKey}\`);
  try{
    const res=await fetch(API_BASE+'/api/escalation/status/sr',{headers:authHeaders()});
    if(res.status===401){sessionStorage.clear(); localStorage.clear();window.location.href='login.html';return;}
    if(!res.ok) throw new Error('Unable to fetch FRN Replacement Escalation status');
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    const totalCount=data?.queue?.totalCount||0;
    
    if(totalCount===0){
      if(typeof allRecords !== 'undefined') allRecords=allRecords.map(item=>item&&item.srEscalationQueuedAt?{...item,srEscalationQueuedAt:null,srEscalationQueuedBy:''}:item);
      if(typeof filtered !== 'undefined') filtered=filtered.map(item=>item&&item.srEscalationQueuedAt?{...item,srEscalationQueuedAt:null,srEscalationQueuedBy:''}:item);
      if(typeof renderTable === 'function') renderTable();
    }
    
    const latest=data.latest;
    if(textEl){
      if(totalCount>0){
        textEl.textContent=\`\${totalCount} FRN Replacement entr\${totalCount===1?'y is':'ies are'} queued for \${data?.queue?.nextRunLabel||getNextSrRunLabel()}.\`;
      }else if(latest){
        const slotLabel=String(latest.slot||'SR').replace(/_/g,' ').replace(/\\b\\w/g,m=>m.toUpperCase());
        const statusLabel=(latest.status||'pending').replace(/_/g,' ');
        const errorText=String(latest.error||'').trim();
        textEl.textContent=\`\${slotLabel} escalation \${statusLabel} on \${fmtEscalationTs(latest.sentAt||latest.createdAt)}.\${errorText?' Error: '+errorText:''}\`;
      }else{
        textEl.textContent='No FRN Replacement Escalation mail has been sent yet.';
      }
    }
    if(subEl) subEl.textContent=\`Receivers: \${recipients.length?recipients.join(', '):'-'}\`;
    if(metaEl) metaEl.textContent=\`Total Queued: \${totalCount} | Next Run: \${data?.queue?.nextRunLabel||'-'}\`;
    if(countEl) countEl.textContent=String(totalCount);
  }catch(e){
    if(textEl) textEl.textContent='FRN Replacement Escalation status unavailable right now.';
    if(subEl) subEl.textContent='Receivers: -';
    if(metaEl) metaEl.textContent='Total Queued: - | Next Run: -';
    if(countEl) countEl.textContent='-';
  }
}`;

  content = content.replace(/async function loadSrEscalationStatus\(moduleKey\)\{[\s\S]*?\}catch\(e\)\{[\s\S]*?\}\s*\}/, newSrLoader);

  // Fix loadToEscalationStatus
  const newToLoader = `async function loadToEscalationStatus(moduleKey){
  ensureToEscalationBanner(moduleKey);
  const textEl=document.getElementById(\`to-banner-text-\${moduleKey}\`);
  const subEl=document.getElementById(\`to-banner-sub-\${moduleKey}\`);
  const metaEl=document.getElementById(\`to-banner-meta-\${moduleKey}\`);
  const countEl=document.getElementById(\`to-banner-count-\${moduleKey}\`);
  try{
    const res=await fetch(API_BASE+'/api/escalation/status/to',{headers:authHeaders()});
    if(res.status===401){sessionStorage.clear(); localStorage.clear();window.location.href='login.html';return;}
    if(!res.ok) throw new Error('Unable to fetch In House FRN Replacement status');
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    const totalCount=data?.queue?.totalCount||0;

    if(totalCount===0){
      if(typeof allRecords !== 'undefined') allRecords=allRecords.map(item=>item&&item.toEscalationQueuedAt?{...item,toEscalationQueuedAt:null,toEscalationQueuedBy:''}:item);
      if(typeof filtered !== 'undefined') filtered=filtered.map(item=>item&&item.toEscalationQueuedAt?{...item,toEscalationQueuedAt:null,toEscalationQueuedBy:''}:item);
      if(typeof renderTable === 'function') renderTable();
    }
    
    const latest=data.latest;
    if(textEl){
      if(totalCount>0){
        textEl.textContent=\`\${totalCount} In House FRN Replacement entr\${totalCount===1?'y is':'ies are'} queued for \${data?.queue?.nextRunLabel||getNextToRunLabel()}.\`;
      }else if(latest){
        const slotLabel=String(latest.slot||'TO').replace(/_/g,' ').replace(/\\b\\w/g,m=>m.toUpperCase());
        const statusLabel=(latest.status||'pending').replace(/_/g,' ');
        const errorText=String(latest.error||'').trim();
        textEl.textContent=\`\${slotLabel} escalation \${statusLabel} on \${fmtEscalationTs(latest.sentAt||latest.createdAt)}.\${errorText?' Error: '+errorText:''}\`;
      }else{
        textEl.textContent='No In House FRN Replacement mail has been sent yet.';
      }
    }
    if(subEl) subEl.textContent=\`Receivers: \${recipients.length?recipients.join(', '):'-'}\`;
    if(metaEl) metaEl.textContent=\`Total Queued: \${totalCount} | Next Run: \${data?.queue?.nextRunLabel||'-'}\`;
    if(countEl) countEl.textContent=String(totalCount);
  }catch(e){
    if(textEl) textEl.textContent='In House FRN Replacement status unavailable right now.';
    if(subEl) subEl.textContent='Receivers: -';
    if(metaEl) metaEl.textContent='Total Queued: - | Next Run: -';
    if(countEl) countEl.textContent='-';
  }
}`;

  content = content.replace(/async function loadToEscalationStatus\(moduleKey\)\{[\s\S]*?\}catch\(e\)\{[\s\S]*?\}\s*\}/, newToLoader);

  fs.writeFileSync('frontend/public/' + file, content);
  console.log('Updated ' + file);
});
