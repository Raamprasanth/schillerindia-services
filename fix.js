const fs = require('fs');

const files = ['empestpend.html', 'emppendingfrn.html', 'empunderep.html'];

files.forEach(file => {
  let text = fs.readFileSync('frontend/public/' + file, 'utf8');
  text = text.replace(/<button class="btn btn-outline btn-sm" id="mail-toggle-btn" onclick="toggleMailAcknowledgements\(\)">&#128231; Mail<\/button>/g, '');
  text = text.replace(/ensureEscalationBanner\(['"a-z_]+\);/g, '');
  text = text.replace(/ensureSrEscalationBanner\(['"a-z_]+\);/g, '');
  text = text.replace(/ensureToEscalationBanner\(['"a-z_]+\);/g, '');
  text = text.replace(/ensureUrEscalationBanner\(['"a-z_]+\);/g, '');
  text = text.replace(/syncMailAcknowledgementsVisibility\(\);/g, '');
  text = text.replace(/loadEscalationStatus\(['"a-z_]+\);/g, '');
  text = text.replace(/loadSrEscalationStatus\(['"a-z_]+\);/g, '');
  text = text.replace(/loadToEscalationStatus\(['"a-z_]+\);/g, '');
  text = text.replace(/loadUrEscalationStatus\(['"a-z_]+\);/g, '');
  fs.writeFileSync('frontend/public/' + file, text);
  console.log('Updated ' + file);
});
