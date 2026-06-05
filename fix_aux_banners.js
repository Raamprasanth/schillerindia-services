const fs = require('fs');

const files = ['Emp-scrap-list.html', 'cer.html', 'csw.html', 'external-repair-list.html'];

files.forEach(file => {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');

  // Remove the button
  content = content.replace(/<button[^>]*id="mail-ack-btn"[^>]*>[\s\S]*?<\/button>\s*/g, '');

  // Remove the wrapper hide default
  content = content.replace(/\.mail-ack-wrap\{display:none;/g, '.mail-ack-wrap{display:grid;');

  // Remove JS logic
  content = content.replace(/const MAIL_ACK_KEY\s*=\s*'[^']+';\s*/g, '');
  content = content.replace(/let mailAckVisible\s*=\s*localStorage\.getItem\([^)]+\)\s*===\s*'1';\s*/g, '');
  
  const syncFuncRegex = /function syncMailAck\(\)\{[\s\S]*?\}\s*(?=(function|let|const|\$|document))/;
  content = content.replace(syncFuncRegex, '');

  const toggleFuncRegex = /function toggleMailAck\(\)\{[\s\S]*?\}\s*(?=(function|let|const|\$|document))/;
  content = content.replace(toggleFuncRegex, '');

  // Inside the loader, remove btn sync and wrap display code
  content = content.replace(/const btn = document\.getElementById\('mail-ack-btn'\);\s*/g, '');
  content = content.replace(/if\s*\(btn\)\s*btn\.style\.display\s*=\s*'none';\s*/g, '');
  content = content.replace(/if\s*\(btn\)\s*btn\.style\.display\s*=\s*'inline-flex';\s*/g, '');
  content = content.replace(/syncMailAck\(\);\s*/g, '');

  // Ensure wrap display is set properly inside the load function
  content = content.replace(/if\s*\(wrap\)\s*wrap\.innerHTML\s*=\s*`/, "if(wrap){ wrap.style.display='grid'; wrap.innerHTML=`");

  fs.writeFileSync('frontend/public/' + file, content);
  console.log('Fixed mail ack in ' + file);
});
