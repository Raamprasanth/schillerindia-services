const fs = require('fs');

const auxFiles = [
  { file: 'cer.html', defaultTitle: 'External Repair Daily' },
  { file: 'csw.html', defaultTitle: 'Supplier Warranty Tue/Fri' },
  { file: 'Emp-scrap-list.html', defaultTitle: 'Supplier Warranty Tue/Fri' },
  { file: 'external-repair-list.html', defaultTitle: 'External Repair Daily' },
  { file: 'sc-completed-frn.html', defaultTitle: 'SC Completed FRN' },
  { file: 'scprfob.html', defaultTitle: 'PRF/OB Daily' }
];

auxFiles.forEach(({file, defaultTitle}) => {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');

  // 1. Add Mail Button
  if (!content.includes('id="mail-ack-btn"')) {
    content = content.replace(/(<button[^>]*onclick="exportCSV\(\)"[^>]*>.*?<\/button>)/, '$1\n      <button class="btn btn-outline btn-sm" id="mail-ack-btn" onclick="toggleMailAck()">&#9993; Mail</button>');
    if (!content.includes('id="mail-ack-btn"')) {
      content = content.replace(/(<button[^>]*onclick="loadData\(\)"[^>]*>.*?<\/button>)/, '$1\n      <button class="btn btn-outline btn-sm" id="mail-ack-btn" onclick="toggleMailAck()">&#9993; Mail</button>');
    }
  }

  // 2. Hide by default in CSS
  content = content.replace(/\.mail-ack-wrap\s*\{\s*display:\s*grid;/g, '.mail-ack-wrap{display:none;');

  // 3. Add JS logic
  if (!content.includes('function toggleMailAck()')) {
    const jsLogic = `
let mailAckVisible = localStorage.getItem('mail_ack_visible') === '1';
function toggleMailAck() {
  mailAckVisible = !mailAckVisible;
  localStorage.setItem('mail_ack_visible', mailAckVisible ? '1' : '0');
  syncMailAck();
}
function syncMailAck() {
  const wrap = document.getElementById('mail-ack-wrap');
  if(wrap) wrap.style.display = mailAckVisible ? 'grid' : 'none';
}
document.addEventListener('DOMContentLoaded', () => { setTimeout(syncMailAck, 100); });
`;
    content = content.replace(/(function loadData\(\)\s*\{)/, jsLogic + '\n$1');
  }

  // 4. Fix innerHTML
  const innerHtmlRegex = /if\(wrap\)\{\s*wrap\.style\.display='grid';\s*wrap\.innerHTML=`[\s\S]*?`;\s*\}/g;
  const oldRegex = /if\(wrap\)\s*wrap\.innerHTML=`[\s\S]*?`;/g;
  
  const newHtml = `if(wrap){ 
    wrap.innerHTML=\`
      <div class="mail-ack-card"><div class="mail-ack-label">Escalation Name</div><div class="mail-ack-value">\${q.slotLabel || '${defaultTitle}'}</div></div>
      <div class="mail-ack-card"><div class="mail-ack-label">Receivers</div><div class="mail-ack-value">\${recipients.length}</div><div class="mail-ack-sub">\${recipients.join(', ') || '-'}</div></div>
      <div class="mail-ack-card"><div class="mail-ack-label">Next Mail</div><div class="mail-ack-value">\${q.nextRunLabel || '-'}</div><div class="mail-ack-sub">Window date \${q.windowDate || '-'}</div></div>
      <div class="mail-ack-card"><div class="mail-ack-label">Queued Count</div><div class="mail-ack-value">\${q.totalCount || 0}</div></div>
    \`;
    syncMailAck();
  }`;

  if (content.match(innerHtmlRegex)) {
    content = content.replace(innerHtmlRegex, newHtml);
  } else if (content.match(oldRegex)) {
    content = content.replace(oldRegex, newHtml);
  }

  fs.writeFileSync('frontend/public/' + file, content);
  console.log('Fixed aux file ' + file);
});
