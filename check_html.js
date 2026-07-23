const fs = require('fs');
const d = 'c:/Users/raamp/OneDrive/Desktop/shcl/frontend/public/';
fs.readdirSync(d).filter(f => f.endsWith('.html')).forEach(f => {
  const txt = fs.readFileSync(d + f, 'utf8');
  if (txt.includes('\\`') || txt.includes('\\${')) {
    console.log(f);
  }
});
