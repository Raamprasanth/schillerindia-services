const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex1 = /compData\.push\(\['Purchase Indent', comp\.purchaseIndent != null \? comp\.purchaseIndent \+ '%' : '-'\]\);/g;
const repl1 = `compData.push(['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-']);
      if (isBuyBackMonth) {
        compData.push(['Buy Back', comp.buyBack != null ? comp.buyBack + '%' : '-']);
      }`;

const regex2 = /\['Purchase Indent', comp\.purchaseIndent != null \? comp\.purchaseIndent \+ '%' : '-'\]/g;
const repl2 = `['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-']
      ];
      if (isBuyBackMonth) {
        compData.push(['Buy Back', comp.buyBack != null ? comp.buyBack + '%' : '-']);
      }`;

if (regex1.test(content)) {
    content = content.replace(regex1, repl1);
    // Replace regex2 manually since we broke the array closure
    content = content.replace(/,\n\s*\['Purchase Indent', comp\.purchaseIndent != null \? comp\.purchaseIndent \+ '%' : '-'\]\n\s*\];/g, 
        `,\n        ['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-']\n      ];\n      if (isBuyBackMonth) {\n        compData.push(['Buy Back', comp.buyBack != null ? comp.buyBack + '%' : '-']);\n      }`);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Successfully updated PDF generation logic!');
} else {
    console.log('Regex 1 did not match.');
}
