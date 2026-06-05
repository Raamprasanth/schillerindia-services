const fs = require('fs');

const files = ['empestpend.html', 'emppendingfrn.html', 'empunderep.html'];

const mainCss = `
.mail-ack-wrap { display: none; margin-bottom: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.mail-ack-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 11px 12px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
.mail-ack-card::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, var(--accent), #0ea5e9); }
.mail-ack-label { font-size: 9.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.mail-ack-value { font-size: 16px; font-weight: 800; color: var(--text); }
.mail-ack-sub { font-size: 11px; color: var(--muted); margin-top: 3px; word-break: break-word; }
@media(max-width:900px){.mail-ack-wrap{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:560px){.mail-ack-wrap{grid-template-columns:1fr;}}
`;

files.forEach(file => {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');

  // 1. Add Mail Button
  if (!content.includes('id="mail-ack-btn"')) {
    content = content.replace(/(<button[^>]*onclick="exportCSV\(\)"[^>]*>.*?<\/button>)/, '$1\n      <button class="btn btn-outline btn-sm" id="mail-ack-btn" onclick="toggleMailAck()">&#9993; Mail</button>');
    if (!content.includes('id="mail-ack-btn"')) {
      content = content.replace(/(<button[^>]*onclick="loadData\(\)"[^>]*>.*?<\/button>)/, '$1\n      <button class="btn btn-outline btn-sm" id="mail-ack-btn" onclick="toggleMailAck()">&#9993; Mail</button>');
    }
  }

  // 2. Add MailAckLogic
  if (!content.includes('function toggleMailAck()')) {
    const jsLogic = `
let mailAckVisible = localStorage.getItem('mail_ack_visible') === '1';
function toggleMailAck() {
  mailAckVisible = !mailAckVisible;
  localStorage.setItem('mail_ack_visible', mailAckVisible ? '1' : '0');
  syncMailAck();
}
function syncMailAck() {
  const w1 = document.getElementById('escalation-status-banner');
  const w2 = document.getElementById('sr-escalation-status-banner');
  const w3 = document.getElementById('to-escalation-status-banner');
  if(w1) w1.style.display = mailAckVisible ? 'grid' : 'none';
  if(w2) w2.style.display = mailAckVisible ? 'grid' : 'none';
  if(w3) w3.style.display = mailAckVisible ? 'grid' : 'none';
}
document.addEventListener('DOMContentLoaded', () => { setTimeout(syncMailAck, 100); });
`;
    content = content.replace(/(function loadData\(\)\s*\{)/, jsLogic + '\n$1');
  }

  // 3. Inject CSS
  if (!content.includes('.mail-ack-wrap')) {
    content = content.replace(/<\/style>/, mainCss + '\n</style>');
  }

  // 4. Replace ensure/bump/load functions
  // Replace everything from `function ensureEscalationBanner` to the end of `loadToEscalationStatus`
  const regex = /function ensureEscalationBanner[\s\S]*?async function loadToEscalationStatus[\s\S]*?\}catch\(e\)[\s\S]*?\}\s*\}/;
  
  const replacement = `
function getMailAckWrapStr(idPrefix, title, themeColor) {
  return \`
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Escalation Name</div><div class="mail-ack-value">\${title}</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Receivers</div><div class="mail-ack-value" id="\${idPrefix}-receivers-count">-</div><div class="mail-ack-sub" id="\${idPrefix}-receivers-names">-</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Next Mail</div><div class="mail-ack-value" id="\${idPrefix}-next-time">-</div><div class="mail-ack-sub" id="\${idPrefix}-next-date">-</div></div>
  <div class="mail-ack-card" style="--accent: \${themeColor}"><div class="mail-ack-label">Queued Count</div><div class="mail-ack-value" id="\${idPrefix}-queued-count">-</div></div>
  \`;
}

function ensureEscalationBanner(moduleKey){
  if(document.getElementById('escalation-status-banner')) return;
  const stats=document.querySelector('.stats-row');
  if(!stats) return;
  let row=document.getElementById('escalation-banner-row');
  if(!row){
    row=document.createElement('div');
    row.id='escalation-banner-row';
    stats.insertAdjacentElement('afterend',row);
  }
  const wrap=document.createElement('div');
  wrap.id='escalation-status-banner';
  wrap.className='mail-ack-wrap';
  wrap.style.display=mailAckVisible?'grid':'none';
  wrap.innerHTML=getMailAckWrapStr('main', 'Dispatch Escalation', 'var(--accent)');
  row.appendChild(wrap);
}

function ensureSrEscalationBanner(moduleKey){
  if(document.getElementById('sr-escalation-status-banner')) return;
  const stats=document.querySelector('.stats-row');
  if(!stats) return;
  let row=document.getElementById('escalation-banner-row');
  if(!row){
    row=document.createElement('div');
    row.id='escalation-banner-row';
    stats.insertAdjacentElement('afterend',row);
  }
  const wrap=document.createElement('div');
  wrap.id='sr-escalation-status-banner';
  wrap.className='mail-ack-wrap';
  wrap.style.display=mailAckVisible?'grid':'none';
  wrap.innerHTML=getMailAckWrapStr('sr', 'FRN Replacement Escalation', 'var(--amber)');
  row.appendChild(wrap);
}

function ensureToEscalationBanner(moduleKey){
  if(document.getElementById('to-escalation-status-banner')) return;
  const stats=document.querySelector('.stats-row');
  if(!stats) return;
  let row=document.getElementById('escalation-banner-row');
  if(!row){
    row=document.createElement('div');
    row.id='escalation-banner-row';
    stats.insertAdjacentElement('afterend',row);
  }
  const wrap=document.createElement('div');
  wrap.id='to-escalation-status-banner';
  wrap.className='mail-ack-wrap';
  wrap.style.display=mailAckVisible?'grid':'none';
  wrap.innerHTML=getMailAckWrapStr('to', 'In House FRN Replacement', '#7c3aed');
  row.appendChild(wrap);
}

function bumpEscalationQueue(moduleKey,delta=1){
  const el = document.getElementById('main-queued-count');
  if(el) {
    const v = parseInt(el.textContent, 10) || 0;
    el.textContent = Math.max(0, v + delta);
  }
}
function bumpSrEscalationQueue(delta=1){
  const el = document.getElementById('sr-queued-count');
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

async function loadEscalationStatus(moduleKey){
  ensureEscalationBanner(moduleKey);
  try{
    const res=await fetch(API_BASE+'/api/escalation/status',{headers:authHeaders()});
    if(!res.ok) return;
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    const totalCount=data?.queue?.totalCount||0;
    document.getElementById('main-receivers-count').textContent = recipients.length;
    document.getElementById('main-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('main-next-time').textContent = data?.queue?.nextRunLabel || '-';
    document.getElementById('main-next-date').textContent = "Window date " + (data?.queue?.windowDate || '-');
    document.getElementById('main-queued-count').textContent = totalCount;
  }catch(e){}
}

async function loadSrEscalationStatus(moduleKey){
  ensureSrEscalationBanner(moduleKey);
  try{
    const res=await fetch(API_BASE+'/api/escalation/status/sr',{headers:authHeaders()});
    if(!res.ok) return;
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    const totalCount=data?.queue?.totalCount||0;
    document.getElementById('sr-receivers-count').textContent = recipients.length;
    document.getElementById('sr-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('sr-next-time').textContent = data?.queue?.nextRunLabel || '-';
    document.getElementById('sr-next-date').textContent = "Window date " + (data?.queue?.windowDate || '-');
    document.getElementById('sr-queued-count').textContent = totalCount;
  }catch(e){}
}

async function loadToEscalationStatus(moduleKey){
  ensureToEscalationBanner(moduleKey);
  try{
    const res=await fetch(API_BASE+'/api/escalation/status/to',{headers:authHeaders()});
    if(!res.ok) return;
    const data=await res.json();
    const recipients=Array.isArray(data&&data.recipients)?data.recipients:[];
    const totalCount=data?.queue?.totalCount||0;
    document.getElementById('to-receivers-count').textContent = recipients.length;
    document.getElementById('to-receivers-names').textContent = recipients.join(', ') || '-';
    document.getElementById('to-next-time').textContent = data?.queue?.nextRunLabel || '-';
    document.getElementById('to-next-date').textContent = "Window date " + (data?.queue?.windowDate || '-');
    document.getElementById('to-queued-count').textContent = totalCount;
  }catch(e){}
}
`;

  content = content.replace(regex, replacement);

  fs.writeFileSync('frontend/public/' + file, content);
  console.log('Fixed main file ' + file);
});
