const fs = require('fs');
const path = require('path');

const files = ['fns.html', 'fs.html', 'fbir.html', 'fcbir.html', 'fqc-dashboard.html'];

for (const file of files) {
  const p = path.join(__dirname, file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');

    // Sidebar Icons
    content = content.replace(/<span class="icon">(?:\?\?|🚫|&#128683;)<\/span>\s*Non Saleable/g, '<span class="icon">&#128683;</span> Non Saleable');
    content = content.replace(/<span class="icon">(?:\?\?|🛒|&#128722;)<\/span>\s*Saleables/g, '<span class="icon">&#128722;</span> Saleables');
    content = content.replace(/<span class="icon">(?:\?\?|📄|&#128196;)<\/span>\s*BIR LIST/g, '<span class="icon">&#128196;</span> BIR LIST');
    content = content.replace(/<span class="icon">(?:\?\?|📁|&#128193;)<\/span>\s*Closed BIR LIST/g, '<span class="icon">&#128193;</span> Closed BIR LIST');
    content = content.replace(/<span class="icon">(?:\?\?|&#128200;)<\/span>\s*Dashboard/g, '<span class="icon">&#128200;</span> Dashboard');
    content = content.replace(/<span class="icon">(?:\?|&#9203;)<\/span>\s*Pending Activity/g, '<span class="icon">&#9203;</span> Pending Activity');
    content = content.replace(/<span class="icon">(?:\?|&#9989;)<\/span>\s*Closed Activity/g, '<span class="icon">&#9989;</span> Closed Activity');

    // Theme btn
    content = content.replace(/id="theme-btn" title="Toggle Theme">\?\?/g, 'id="theme-btn" title="Toggle Theme">&#127769;');
    content = content.replace(/'dark' \? '\?\?' : '\?\?'/g, "'dark' ? '&#9728;&#65039;' : '&#127769;'");

    // Modals / Confirm
    content = content.replace(/<h3>\?\? Confirm Delete<\/h3>/g, '<h3>&#9888;&#65039; Confirm Delete</h3>');
    content = content.replace(/\?\? Add New/g, '&#128196; Add New');
    content = content.replace(/\?\? Update/g, '&#9998; Update');
    content = content.replace(/\?\? Save/g, '&#128190; Save');
    content = content.replace(/title="Close \(Esc\)">\?/g, 'title="Close (Esc)">&#10005;');

    // Stat icons (the replacement handles cases where it might be ? or ??)
    content = content.replace(/<div class="stat-icon">\?\?<\/div>/g, '<div class="stat-icon">&#128202;</div>');
    content = content.replace(/<div class="stat-icon">\?<\/div>/g, '<div class="stat-icon">&#9989;</div>');

    // Topbar / Search
    content = content.replace(/>\? Refresh/g, '>&#128259; Refresh');
    content = content.replace(/>\?\? Export/g, '>&#128228; Export');
    content = content.replace(/<span class="srch-ico">\?\?<\/span>/g, '<span class="srch-ico">&#128269;</span>');

    // Empty State
    content = content.replace(/<div class="ei">\?\?<\/div>/g, '<div class="ei">&#128196;</div>');
    
    // Table headers
    content = content.replace(/<span class="si">\?<\/span>/g, '<span class="si">&#8693;</span>');
    content = content.replace(/\?\? (.*?) Details/g, '&#128196; $1 Details');

    // Table Actions
    content = content.replace(/onclick="([^"]*?confirmDelete[^"]*?)"\s*>\?\?<\/button>/g, 'onclick="$1">&#128465;</button>');
    content = content.replace(/onclick="([^"]*?openViewModal[^"]*?)"\s*>\?\?<\/button>/g, 'onclick="$1">&#128065;</button>');
    content = content.replace(/onclick="([^"]*?openUpdateModal[^"]*?)"\s*>\?\?<\/button>/g, 'onclick="$1">&#9998;</button>');

    // Misc
    content = content.replace(/SchillerIndia /g, 'SchillerIndia |');

    // Replace actual emojis (mainly for fqc-dashboard.html)
    content = content.replace(/🚫/g, '&#128683;');
    content = content.replace(/🛒/g, '&#128722;');
    content = content.replace(/📄/g, '&#128196;');
    content = content.replace(/📁/g, '&#128193;');
    
    // FQC Dashboard specific ? that might be missed
    content = content.replace(/<span class="icon">\?<\/span>\s*Pending Activity/g, '<span class="icon">&#9203;</span> Pending Activity');

    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed', file);
  }
}
