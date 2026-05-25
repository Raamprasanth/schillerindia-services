const fs = require('fs');
let todr = fs.readFileSync('frontend/public/todr.html', 'utf8');

// Replace titles
todr = todr.replace('<title>SchillerIndia - TO/DR Register</title>', '<title>SchillerIndia - Closed TO/DR</title>');
todr = todr.replace('TO/DR Register', 'Closed TO/DR Register');
todr = todr.replace('Add TO/DR', 'Add Closed TO/DR');
todr = todr.replace('Edit TO/DR', 'Edit Closed TO/DR');
todr = todr.replace('No TO/DR entries found.', 'No Closed TO/DR entries found.');

// Replace API endpoints
todr = todr.replace(/api\/todr/g, 'api/ctodr');

// Replace todr-modal with ctodr-modal to avoid any conflicts (though not strictly necessary as it's a separate page)
todr = todr.replace(/todr-modal/g, 'ctodr-modal');

// Update sidebar active states
todr = todr.replace('<a class="nav-item active" href="todr.html">', '<a class="nav-item" href="todr.html">');
const ctodrLink = '<a class="nav-item active" href="ctodr.html"><span class="ico">&#128274;</span> Closed TO/DR</a>';
todr = todr.replace(
  /<a class="nav-item" href="todr.html"><span class="ico">&#128196;<\/span> TO\/DR<\/a>/,
  '<a class="nav-item" href="todr.html"><span class="ico">&#128196;</span> TO/DR</a>\n    ' + ctodrLink
);

fs.writeFileSync('frontend/public/ctodr.html', todr, 'utf8');
console.log('Created ctodr.html');
