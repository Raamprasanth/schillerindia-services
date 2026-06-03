const fs = require('fs');

const content = fs.readFileSync('frontend/public/dailyw.html', 'utf8');
const startIndex = content.indexOf('<script>\nlet currentDate = new Date();');
const endIndex = content.indexOf('</script>\n<script src="tab-fix.js"></script>');

if (startIndex !== -1 && endIndex !== -1) {
  const pyScript = fs.readFileSync('scratch/update_dailyw.py', 'utf8');
  const jsPart = pyScript.split('"""')[1];
  
  const newContent = content.substring(0, startIndex) + jsPart + content.substring(endIndex);
  fs.writeFileSync('frontend/public/dailyw.html', newContent);
  console.log('Success!');
} else {
  console.log('Indices not found:', startIndex, endIndex);
}
