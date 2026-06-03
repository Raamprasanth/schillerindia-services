const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = 'c:\\Users\\Admin\\Desktop\\shcl\\frontend\\public\\admin-re-repair-atrr.html';
const content = fs.readFileSync(filePath, 'utf8');

// Simple regex to extract <script> blocks
const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = regex.exec(content)) !== null) {
  const scriptContent = match[1];
  // Ignore scripts that load files (e.g. src="...")
  const openTag = match[0];
  if (openTag.toLowerCase().includes('src=')) {
    continue;
  }
  
  count++;
  console.log(`Checking script block #${count}...`);
  try {
    new vm.Script(scriptContent);
    console.log(`Script block #${count} is syntax-valid.`);
  } catch (err) {
    console.error(`Syntax error in script block #${count}:`, err.message);
    // Print the lines around the error
    const lines = scriptContent.split('\n');
    console.log('Script snippet:');
    console.log(lines.slice(0, 50).join('\n'));
  }
}
