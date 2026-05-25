const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const p = path.join(dir, file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    const orig = content;

    // FQC and RT Specific Replacements
    content = content.replace(/\?\?\? Closed BIR/g, '&#128193; Closed BIR');
    content = content.replace(/\?\? Division Breakdown/g, '&#128202; Division Breakdown');
    content = content.replace(/\?\? View/g, '&#128065; View');
    content = content.replace(/\?\? Confirm Action/g, '&#9888;&#65039; Confirm Action');
    content = content.replace(/\?\? New Batch/g, '&#128196; New Batch');
    content = content.replace(/\?\? Unit &amp; Division/g, '&#128230; Unit &amp; Division');
    content = content.replace(/\?\? Software &amp; Hardware/g, '&#128187; Software &amp; Hardware');
    content = content.replace(/\?\? Engineering &amp; Quality/g, '&#128295; Engineering &amp; Quality');
    content = content.replace(/\?\? BIR/g, '&#128196; BIR');
    content = content.replace(/\?\? Edit Record/g, '&#9998; Edit Record');
    content = content.replace(/\?\? Dispatch/g, '&#128666; Dispatch');
    
    // Stats Hero Badges
    content = content.replace(/\?\? <span id="h-total">/g, '&#128202; <span id="h-total">');
    content = content.replace(/\? <span id="h-pending">/g, '&#9203; <span id="h-pending">');
    content = content.replace(/\?\? <span id="h-shipped">/g, '&#128666; <span id="h-shipped">');
    
    // Updates and UI
    content = content.replace(/>\? Update/g, '>&#9998; Update');
    content = content.replace(/\?\? Update RT/g, '&#9998; Update RT');
    content = content.replace(/\?\? Details/g, '&#128196; Details');
    content = content.replace(/\?\? Remarks/g, '&#128172; Remarks');
    content = content.replace(/\?\? Save/g, '&#128190; Save');
    content = content.replace(/\?\? Repair/g, '&#128295; Repair');
    content = content.replace(/>\? Refresh/g, '>&#128259; Refresh');
    content = content.replace(/\?\? Export/g, '&#128228; Export');
    content = content.replace(/\?\? Under Repair/g, '&#128736; Under Repair');
    content = content.replace(/>\? Add New/g, '>&#10133; Add New');
    content = content.replace(/>\? Try Again/g, '>&#128259; Try Again');
    content = content.replace(/\?\? OB/g, '&#128230; OB');
    
    // Dashboard Activities
    content = content.replace(/>\? Completed/g, '>&#9989; Completed');
    content = content.replace(/>\? Upcoming/g, '>&#9203; Upcoming');
    
    if (content !== orig) {
      fs.writeFileSync(p, content, 'utf8');
      console.log('Fixed generic ? icons in', file);
    }
  }
}
