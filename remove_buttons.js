const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'public');

function processFiles(dir) {
  const files = fs.readdirSync(dir);
  let changedCount = 0;

  for (const file of files) {
    if (file.endsWith('.html')) {
      const filePath = path.join(dir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      const origContent = content;

      // Remove theme toggles
      // e.g., <button class="theme-toggle"...>...</button>
      // e.g., <button class="topbar-btn emp-theme-toggle"...>...</button>
      content = content.replace(/<button[^>]*class="[^"]*theme-toggle[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '');
      content = content.replace(/<button[^>]*data-emp-theme-toggle[^>]*>[\s\S]*?<\/button>/gi, '');
      
      // Remove notification buttons
      // e.g. <button class="topbar-btn" onclick="openNotif()">... Notif...</button>
      // e.g. <button class="notif-btn"...>...</button>
      content = content.replace(/<button[^>]*class="[^"]*notif-btn[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '');
      content = content.replace(/<button[^>]*onclick="[^"]*openNotif[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '');
      content = content.replace(/<button[^>]*onclick="openNotif\(\)"[^>]*>[\s\S]*?<\/button>/gi, '');
      content = content.replace(/<button[^>]*class="topbar-btn"[^>]*>[\s\S]*?Notif[\s\S]*?<\/button>/gi, '');

      if (content !== origContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        changedCount++;
        console.log(`Updated ${file}`);
      }
    }
  }
  console.log(`Processed ${changedCount} files.`);
}

processFiles(dir);
