const fs = require('fs');
let content = fs.readFileSync('frontend/public/empunderep.html', 'utf8');

const oldBannersStart = 'function ensureUrEscalationBanners(){';
const oldBannersEnd = 'function getToMsgEl()';

const startIdx = content.indexOf(oldBannersStart);
const endIdx = content.indexOf(oldBannersEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newCode = `function getMailAckWrapStr(idPrefix, title, themeColor) {
  return \`
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Escalation Name</div><div class="mail-ack-value">\${title}</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Receivers</div><div class="mail-ack-value" id="\${idPrefix}-receivers-count">-</div><div class="mail-ack-sub" id="\${idPrefix}-receivers-names">-</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Next Mail</div><div class="mail-ack-value" id="\${idPrefix}-next-time">-</div><div class="mail-ack-sub" id="\${idPrefix}-next-date">-</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Queued Count</div><div class="mail-ack-value" id="\${idPrefix}-queued-count">-</div></div>
  \`;
}

function ensureUrEscalationBanners(){
  if(document.getElementById('escalation-status-banner')) return;
  const stats=document.querySelector('.stats-row');
  if(!stats) return;

  let row=document.getElementById('escalation-banner-row');
  if(!row){
    row=document.createElement('div');
    row.id='escalation-banner-row';
    stats.insertAdjacentElement('afterend',row);
  }

  const scrapWrap=document.createElement('div');
  scrapWrap.id='escalation-status-banner';
  scrapWrap.className='mail-ack-wrap';
  scrapWrap.style.display=mailAckVisible?'grid':'none';
  scrapWrap.innerHTML=getMailAckWrapStr('scrap', 'Scrap Escalation', '#b45309');
  row.appendChild(scrapWrap);

  const followupWrap=document.createElement('div');
  followupWrap.id='sr-escalation-status-banner';
  followupWrap.className='mail-ack-wrap';
  followupWrap.style.display=mailAckVisible?'grid':'none';
  followupWrap.innerHTML=getMailAckWrapStr('followup', 'Stock Escalation', 'var(--amber)');
  row.appendChild(followupWrap);

  const toWrap=document.createElement('div');
  toWrap.id='to-escalation-status-banner';
  toWrap.className='mail-ack-wrap';
  toWrap.style.display=mailAckVisible?'grid':'none';
  toWrap.innerHTML=getMailAckWrapStr('to', 'In House FRN Replacement', '#7c3aed');
  row.appendChild(toWrap);
}

function bumpUrEscalationQueue(kind,delta=1){
  const el = document.getElementById(kind+'-queued-count');
  if(el) {
    const v = parseInt(el.textContent, 10) || 0;
    el.textContent = Math.max(0, v + delta);
  }
}

function bumpToEscalationQueue(delta=1){
  const el = document.getElementById('to-queued-count');
  if(el) {
    const v = parseInt(el.textContent, 10) || 0;
    el.textContent = Math.max(0, v + delta);
  }
}

async function loadUrEscalationStatus(){
  ensureUrEscalationBanners();
  try{
    const res=await fetch(API+'/api/escalation/status/under-repair',{headers:authHeaders()});
    handleUnauth(res);
    if(!res.ok) throw new Error('Failed');
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    
    // Scrap
    document.getElementById('scrap-receivers-count').textContent = recipients.length;
    document.getElementById('scrap-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('scrap-next-time').textContent = data?.scrap?.queue?.nextRunLabel || '-';
    document.getElementById('scrap-next-date').textContent = "Window date " + (data?.scrap?.queue?.windowDate || '-');
    document.getElementById('scrap-queued-count').textContent = data?.scrap?.queue?.totalCount || 0;

    // Followup
    document.getElementById('followup-receivers-count').textContent = recipients.length;
    document.getElementById('followup-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('followup-next-time').textContent = data?.followup?.queue?.nextRunLabel || '-';
    document.getElementById('followup-next-date').textContent = "Window date " + (data?.followup?.queue?.windowDate || '-');
    document.getElementById('followup-queued-count').textContent = data?.followup?.queue?.totalCount || 0;
  }catch(e){}
}

async function loadToEscalationStatus(){
  ensureUrEscalationBanners();
  try{
    const res=await fetch(API+'/api/escalation/status/to',{headers:authHeaders()});
    handleUnauth(res);
    if(!res.ok) throw new Error('Failed');
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    document.getElementById('to-receivers-count').textContent = recipients.length;
    document.getElementById('to-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('to-next-time').textContent = data?.queue?.nextRunLabel || '-';
    document.getElementById('to-next-date').textContent = "Window date " + (data?.queue?.windowDate || '-');
    document.getElementById('to-queued-count').textContent = data?.queue?.totalCount || 0;
  }catch(e){}
}

`;
  
  content = content.substring(0, startIdx) + newCode + content.substring(endIdx);
  fs.writeFileSync('frontend/public/empunderep.html', content);
  console.log('Fixed empunderep.html');
} else {
  console.log('Could not find start or end index', startIdx, endIdx);
}
