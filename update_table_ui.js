const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

// Commercial Table Replacements
html = html.replace(
  /\$\{val\['< 1 day'\]\} <br><span style="color:#64748b;font-size:11px;">\(\$\{p1\}%\)<\/span>/g,
  "${p1}% <br><span style=\"color:#64748b;font-size:11px;\">(${val['< 1 day']})</span>"
);

html = html.replace(
  /\$\{val\['1 to 2 days'\]\} <br><span style="color:#64748b;font-size:11px;">\(\$\{p2\}%\)<\/span>/g,
  "${p2}% <br><span style=\"color:#64748b;font-size:11px;\">(${val['1 to 2 days']})</span>"
);

html = html.replace(
  /\$\{val\['> 2 days'\]\} <br><span style="color:#64748b;font-size:11px;">\(\$\{p3\}%\)<\/span>/g,
  "${p3}% <br><span style=\"color:#64748b;font-size:11px;\">(${val['> 2 days']})</span>"
);

// Repair Team Table Replacements
html = html.replace(
  /\$\{val\['1 to 3 days'\]\} <br><span style="color:#64748b;font-size:11px;">\(\$\{p2\}%\)<\/span>/g,
  "${p2}% <br><span style=\"color:#64748b;font-size:11px;\">(${val['1 to 3 days']})</span>"
);

html = html.replace(
  /\$\{val\['> 3 days'\]\} <br><span style="color:#64748b;font-size:11px;">\(\$\{p3\}%\)<\/span>/g,
  "${p3}% <br><span style=\"color:#64748b;font-size:11px;\">(${val['> 3 days']})</span>"
);

html = html.replace(
  /\$\{val\.RP \|\| 0\} <br><span style="color:#64748b;font-size:11px;font-weight:normal;">\(\$\{prp\}%\)<\/span>/g,
  "${prp}% <br><span style=\"color:#64748b;font-size:11px;font-weight:normal;\">(${val.RP || 0})</span>"
);

fs.writeFileSync(file, html);
console.log('Swapped percentage and count in tables.');
