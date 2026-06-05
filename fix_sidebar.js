const fs = require('fs');

let content = fs.readFileSync('frontend/public/empestpend.html', 'utf8');

const targetStr = `<aside class="sidebar">\r\n  <img class="brand-logo-img" src="logo.png" alt="SCHILLER">`;
const targetStr2 = `<aside class="sidebar">\n  <img class="brand-logo-img" src="logo.png" alt="SCHILLER">`;

const replacement = `<aside class="sidebar">
  <div class="sidebar-header">
    <div class="logo-wrap">
      <img class="brand-logo-img" src="logo.png" alt="SCHILLER">
    </div>
  </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync('frontend/public/empestpend.html', content);
  console.log("Fixed sidebar header (CRLF).");
} else if (content.includes(targetStr2)) {
  content = content.replace(targetStr2, replacement);
  fs.writeFileSync('frontend/public/empestpend.html', content);
  console.log("Fixed sidebar header (LF).");
} else {
  console.log("Could not find the target string.");
}
