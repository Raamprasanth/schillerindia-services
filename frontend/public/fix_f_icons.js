const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public';
const files = fs.readdirSync(dir).filter(f => f.startsWith('f') && f.endsWith('.html'));

for (const file of files) {
  const p = path.join(dir, file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');

    const orig = content;
    
    // Fix specific ? marks that are broken icons
    content = content.replace(/onclick="logout\(\)">\?<\/button>/g, 'onclick="logout()">&#8617;</button>');
    content = content.replace(/>\?\s*Clear<\/button>/gi, '>&#10005; Clear</button>');
    content = content.replace(/>\?\s*\$\{esc/g, '>&#9888; ${esc');
    content = content.replace(/'\?\s*Saving-/g, "'&#8987; Saving-");
    content = content.replace(/'\?\s*Record updated/gi, "'&#9989; Record updated");
    content = content.replace(/'\?\s*Entry added/gi, "'&#9989; Entry added");

    // Also bring back colorful emojis in fqc-dashboard specifically if the user wanted them
    // Actually, HTML entities for emojis like &#128683; DO render as colorful emojis.
    // The user might be referring to other missing icons like ?? we missed.
    // Let's also check for "?? Update" or similar just in case.
    content = content.replace(/\?\? Add New/g, '&#128196; Add New');
    content = content.replace(/\?\? Update/g, '&#9998; Update');
    content = content.replace(/\?\? Save/g, '&#128190; Save');
    
    if (content !== orig) {
      fs.writeFileSync(p, content, 'utf8');
      console.log('Fixed additional ? icons in', file);
    }
  }
}
