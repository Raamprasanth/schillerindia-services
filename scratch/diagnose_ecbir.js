const fs = require('fs');

const content = fs.readFileSync('frontend/public/ecbir.html', 'utf8');

const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  try {
    const vm = require('vm');
    new vm.Script(scriptContent);
    console.log("No syntax errors found in ecbir JS.");
  } catch (e) {
    console.log("Syntax error in ecbir JS:", e.message);
  }
} else {
  console.log("No script tag found.");
}
