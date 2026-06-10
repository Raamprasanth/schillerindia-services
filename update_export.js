const fs = require('fs');
const file = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/Reports.html';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `  const contentClone = originalNode.cloneNode(true);
  contentClone.style.display = 'block';
  contentClone.style.height = 'auto';
  contentClone.style.overflow = 'visible';
  contentClone.removeAttribute('id');
  contentClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));`;

const replacementStr = `  const tableContainer = originalNode.querySelector('.perf-review-table-container');
  const contentClone = tableContainer ? tableContainer.cloneNode(true) : originalNode.cloneNode(true);
  contentClone.style.display = 'block';
  contentClone.style.height = 'auto';
  contentClone.style.overflow = 'visible';
  contentClone.removeAttribute('id');
  contentClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Replaced target content.");
} else {
  // If target isn't exactly matching because of CRLF, try a regex
  const regex = /  const contentClone = originalNode\.cloneNode\(true\);\s+contentClone\.style\.display = 'block';\s+contentClone\.style\.height = 'auto';\s+contentClone\.style\.overflow = 'visible';\s+contentClone\.removeAttribute\('id'\);\s+contentClone\.querySelectorAll\('\[id\]'\)\.forEach\(el => el\.removeAttribute\('id'\)\);/g;
  if (regex.test(content)) {
     content = content.replace(regex, replacementStr);
     fs.writeFileSync(file, content, 'utf8');
     console.log("Replaced via regex.");
  } else {
     console.log("Could not find TargetContent in exportPDF.");
  }
}
