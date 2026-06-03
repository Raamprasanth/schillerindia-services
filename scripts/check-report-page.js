const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const reportHtmlPath = path.join(root, 'frontend', 'public', 'Reports.html');
const reportRoutesPath = path.join(root, 'backend', 'routes', 'reports.js');

let failed = false;

function fail(message) {
  failed = true;
  console.error(message);
}

const html = fs.readFileSync(reportHtmlPath, 'utf8');
let scriptIndex = 0;

for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  scriptIndex += 1;
  const code = match[1];
  if (!code.trim()) continue;

  try {
    new vm.Script(code, { filename: `Reports.html:script${scriptIndex}` });
  } catch (error) {
    fail(`Reports.html script ${scriptIndex}: ${error.message}`);
  }
}

const routes = fs.readFileSync(reportRoutesPath, 'utf8');
if (!routes.includes("router.get('/:id([0-9a-fA-F]{24})'")) {
  fail('reports.js GET /:id must be constrained to ObjectId so named routes are not shadowed.');
}
if (!routes.includes("router.delete('/:id([0-9a-fA-F]{24})'")) {
  fail('reports.js DELETE /:id must be constrained to ObjectId so named routes are not shadowed.');
}

if (failed) process.exit(1);
console.log('Reports page checks passed.');
