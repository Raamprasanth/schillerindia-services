const fs = require('fs');
const cp = require('child_process');
const html = fs.readFileSync('frontend/public/Reports.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((s, i) => {
  const code = s[1].trim();
  if (!code) return;
  fs.writeFileSync('script_' + i + '.js', code);
  try {
    cp.execSync('node --check script_' + i + '.js', { stdio: 'pipe' });
    console.log('Script ' + i + ' is syntax OK');
  } catch (e) {
    console.error('Syntax error in script ' + i + ':');
    console.error(e.stderr.toString());
  }
});
