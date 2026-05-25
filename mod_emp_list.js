const fs = require('fs');
const file = 'frontend/public/employee-service-list.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix strip-rcvddate to strip-entrydate and f-entrydate
content = content.replace(
  /<div class=\"autofill-val\" id=\"strip-rcvddate\">—<\/div>\s*<input type=\"hidden\" id=\"f-rcvddate\"\/>/g,
  '<div class=\"autofill-val\" id=\"strip-entrydate\">—</div>\\n          <input type=\"hidden\" id=\"f-entrydate\"/>'
);

// 2. Remove stripRcvdDate references in JS
content = content.replace(/const stripRcvdDate = document\.getElementById\('strip-rcvddate'\);/g, '');
content = content.replace(/if \(stripRcvdDate\) stripRcvdDate\.textContent = todayLocal;/g, '');

content = content.replace(/const stripRcvdDate=document\.getElementById\('strip-rcvddate'\);/g, '');
content = content.replace(/if\(stripRcvdDate\) stripRcvdDate\.textContent=s\.rcvdDate;/g, '');
content = content.replace(/document\.getElementById\('f-rcvddate'\)\.value\s*=\s*todayISO;/g, '');
content = content.replace(/document\.getElementById\('f-rcvddate'\)\.value=s\.rcvdDate;/g, '');

// 3. Fix the array of dates to use f-entrydate instead of f-rcvddate
content = content.replace(/'f-rcvddate'/g, "'f-entrydate'");

// 4. In editService, do NOT call autoFillFromLogin, just resetForm() and set manually
content = content.replace(
  /resetForm\(\);\s*autoFillFromLogin\(\);/g,
  `resetForm();
  document.getElementById('strip-sceng').textContent = s.scEng || s.eng || '—';
  document.getElementById('f-sceng').value = s.scEng || s.eng || '';
  const divName = (s.division && s.division.name) || s.division || '—';
  document.getElementById('strip-division').textContent = divName;
  document.getElementById('f-division').value = divName !== '—' ? divName : '';
  if(s.entryDate){
    document.getElementById('f-entrydate').value = s.entryDate.slice(0, 10);
    document.getElementById('strip-entrydate').textContent = s.entryDate.slice(0, 10);
  }`
);

// 5. In showForm, call autoFillFromLogin
content = content.replace(
  /function showForm\(\) \{/g,
  "function showForm() {\\n  autoFillFromLogin();"
);

// 6. Fix submission payload (remove f-rcvddate reliance if any)
content = content.replace(
  /const rcvdDateVal\s*=\s*document\.getElementById\('f-rcvddate'\)\.value\|\|new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];/g,
  "const rcvdDateVal = document.getElementById('f-entrydate').value || new Date().toISOString().split('T')[0];"
);
content = content.replace(/rcvdDate:\s*rcvdDateVal/g, "rcvdDate: rcvdDateVal, entryDate: rcvdDateVal");


fs.writeFileSync(file, content);
console.log('Modifications complete.');
