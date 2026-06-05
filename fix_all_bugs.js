const fs = require('fs');
const files = [
  'empestpend.html', 'emppendingfrn.html', 'empunderep.html',
  'cer.html', 'csw.html', 'Emp-scrap-list.html', 
  'external-repair-list.html', 'sc-completed-frn.html', 'scprfob.html'
];

files.forEach(file => {
  let content = fs.readFileSync('frontend/public/' + file, 'utf8');

  // 1. Fix the broken `async \n let mailAckVisible` -> `let mailAckVisible` and `async function loadData`
  // We need to look for `async` followed by whitespace and `let mailAckVisible`
  const brokenRegex = /async\s+let mailAckVisible = localStorage\.getItem\('mail_ack_visible'\) === '1';[\s\S]*?function syncMailAck\(\) \{[\s\S]*?setTimeout\(syncMailAck, 100\); \}\);\s*function loadData\(\)\{/g;
  
  if (content.match(brokenRegex)) {
    content = content.replace(brokenRegex, (match) => {
      // Remove the stray 'async', and add 'async' before 'function loadData(){'
      let fixed = match.replace(/^async\s+/, '');
      fixed = fixed.replace(/function loadData\(\)\{$/, 'async function loadData(){');
      return fixed;
    });
  } else {
    // Sometimes there might be a space after loadData()
    const brokenRegex2 = /async\s+let mailAckVisible = localStorage\.getItem\('mail_ack_visible'\) === '1';[\s\S]*?function syncMailAck\(\) \{[\s\S]*?setTimeout\(syncMailAck, 100\); \}\);\s*function loadData\(\)\s*\{/g;
    if (content.match(brokenRegex2)) {
      content = content.replace(brokenRegex2, (match) => {
        let fixed = match.replace(/^async\s+/, '');
        fixed = fixed.replace(/function loadData\(\)\s*\{$/, 'async function loadData(){');
        return fixed;
      });
    }
  }

  // Also check if there is an old `mailAcknowledgementsVisible` causing TDZ or conflicts
  // Remove the old logic if it's there.
  const oldAckLogic = /const MAIL_ACK_KEY.*?\}[\s]*\}/s;
  if (content.match(/function toggleMailAcknowledgements\(\)/)) {
    // We can just wipe out toggleMailAcknowledgements and syncMailAcknowledgementsVisibility
    content = content.replace(/const MAIL_ACK_KEY\s*=\s*['"].*?['"];\s*let mailAcknowledgementsVisible\s*=\s*localStorage\.getItem\(MAIL_ACK_KEY\)==='1';\s*function syncMailAcknowledgementsVisibility\(\)[\s\S]*?function toggleMailAcknowledgements\(\)[\s\S]*?\n\}/g, '');
  }

  fs.writeFileSync('frontend/public/' + file, content);
  console.log('Fixed ' + file);
});
