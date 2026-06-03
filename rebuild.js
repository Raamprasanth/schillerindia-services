const fs = require('fs');

const extOld = fs.readFileSync('frontend/public/ext_temp.txt', 'utf8');
const extNew = fs.readFileSync('frontend/public/external-repair-list.html', 'utf8');

// 1. Extract Admin auth script
const authRegex = /<script>\(function\(\)\{[\s\S]*?\}\)\(\);<\/script>/;
const adminAuth = extOld.match(authRegex)[0];
let updated = extNew.replace(authRegex, adminAuth);

// 2. Extract Admin CSS includes
// Replace employee-theme with admin-sidebar, etc.
// In this case, we can just grab everything between </style> and </head>
const headRegex = /<\/style>([\s\S]*?)<\/head>/;
const adminHead = extOld.match(headRegex)[1];
updated = updated.replace(headRegex, '</style>' + adminHead + '</head>');

// 3. Extract Admin Sidebar + Topbar
const sidebarRegex = /<!-- === SIDEBAR === -->([\s\S]*?)<div class="content"/;
const adminSidebar = extOld.match(sidebarRegex)[1];
updated = updated.replace(/<!-- === SIDEBAR === -->([\s\S]*?)<div class="content"/, '<!-- === SIDEBAR === -->\n' + adminSidebar + '<div class="content"');

// 4. Update the Data Fetch URL
updated = updated.replace('/api/emp/sc-completed-frn/all', '/api/emp/sc-completed-frn/admin/all');

// 5. Fix the init() function to use admin info
const initRegex = /\(function init\(\)\{[\s\S]*?\}\)\(\);/;
const adminInit = extOld.match(initRegex)[0];
updated = updated.replace(initRegex, adminInit);

fs.writeFileSync('frontend/public/external-repair-list.html', updated, 'utf8');
console.log('Successfully updated external-repair-list.html');
