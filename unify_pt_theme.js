const fs = require('fs');

const ptDash = fs.readFileSync('frontend/public/pt-dashboard.html', 'utf8');

const styleMatch = ptDash.match(/<style>([\s\S]*?)<\/style>/);
let baseStyle = styleMatch[1];
baseStyle = baseStyle.replace(/\/\* A'A,AAAA\?sAA,A\?AAA,A,AA'A,AAAA\?sAA,A\?AAA,A,A QUICK LINKS[\s\S]*/, ''); 

const tableStyle = `
.main{flex:1;display:flex;flex-direction:column;min-width:0;}
.topbar{padding:14px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface);position:sticky;top:0;z-index:20;box-shadow:var(--shadow);}
.topbar-left{min-width:0;}
.breadcrumb{display:flex;align-items:center;gap:5px;font-size:10.5px;margin-bottom:2px;color:var(--muted);flex-wrap:wrap;}
.breadcrumb a{color:var(--muted);text-decoration:none;}
.breadcrumb a:hover{color:var(--accent);}
.breadcrumb .sep{color:#b8cad8;}
.page-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--text);line-height:1.2;}
.topbar-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
.table-responsive{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:12.5px;}
th{background:var(--surface2);padding:12px 16px;text-align:left;font-weight:700;color:var(--soft);text-transform:uppercase;font-size:10px;letter-spacing:.05em;border-bottom:2px solid var(--border);white-space:nowrap;}
td{padding:12px 16px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:top;}
tr:hover td{background:var(--surface3);}
.empty-state{padding:40px;text-align:center;color:var(--muted);font-size:13px;}
.modal-overlay{position:fixed;inset:0;background:rgba(5,18,38,0.6);backdrop-filter:blur(5px);z-index:2000;display:none;align-items:center;justify-content:center;}
.modal-overlay.open{display:flex;}
.add-modal-box{background:var(--surface);width:90%;max-width:700px;max-height:90vh;border-radius:16px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;overflow:hidden;animation:fadeUp 0.2s ease;}
.modal-head{padding:18px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface);flex-shrink:0}
.modal-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:800}
.modal-sub{font-size:11.5px;color:var(--muted);margin-top:3px}
.modal-close{width:34px;height:34px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);cursor:pointer;color:var(--muted);font-size:15px}
.modal-body{padding:22px 28px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;flex:1}
.section-title{padding-bottom:8px;border-bottom:1px solid var(--border);font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.req{color:var(--red)}
.field input,.field textarea,.field select{border:1.5px solid var(--border);border-radius:10px;padding:9px 13px;font-size:13px;color:var(--text);background:var(--surface);font-family:'Plus Jakarta Sans',sans-serif;outline:none;width:100%}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(5,150,105,.1)}
.modal-foot{padding:16px 28px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;background:var(--surface3);flex-shrink:0}
.msg{font-size:12px;font-weight:700;color:var(--red);display:none;padding:8px 12px;background:rgba(185,28,28,.06);border-radius:8px;border:1px solid rgba(185,28,28,.15);margin-right:auto}
.content{padding:20px 24px;overflow:auto;flex:1;}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;}
.card-head{padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface3);display:flex;align-items:center;justify-content:space-between;}
.card-title{font-weight:700;font-size:14px;color:var(--text);}
.btn{border:none;border-radius:8px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;display:inline-flex;align-items:center;gap:6px}.btn-primary{background:var(--green);color:#fff}.btn-primary:hover{background:var(--green2)}.btn-outline{background:transparent;border:1.5px solid var(--border);color:var(--soft)}.btn-outline:hover{border-color:var(--accent);color:var(--accent)}
.btn-sm{padding:4px 10px;font-size:11px;border-radius:6px;}
.btn-danger{background:var(--red);color:#fff}.btn-danger:hover{background:#991b1b;}
`;

const combinedStyle = `<style>\n${baseStyle}\n${tableStyle}\n</style>`;

const sidebarMatch = ptDash.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/);
const baseSidebar = sidebarMatch[0];

const files = ['ptdw.html', 'ptpa.html', 'ptca.html'];
for (const file of files) {
  let content = fs.readFileSync(`frontend/public/${file}`, 'utf8');
  content = content.replace(/<style>[\s\S]*?<\/style>/, combinedStyle);
  
  let newSidebar = baseSidebar.replace(/<a class="nav-item active"/, '<a class="nav-item"');
  newSidebar = newSidebar.replace(new RegExp(`href="${file}"`), `class="nav-item active" href="${file}"`);
  
  content = content.replace(/<aside class="sidebar">([\s\S]*?)<\/aside>/, newSidebar);
  
  if (file === 'ptca.html') {
    content = content.replace(/<button class="btn btn-primary" onclick="openModal\(\)">&#43; Add Activity<\/button>/, '');
  }
  
  fs.writeFileSync(`frontend/public/${file}`, content, 'utf8');
}
console.log('done');
