const fs = require('fs');
const file = 'frontend/public/Reports.html';
let html = fs.readFileSync(file, 'utf8');

const fallbackRegex = /const fallbackReports = \[\n\s*\{ type: 'CRM',[\s\S]*?\{ type: 'PIRequest', label: 'PI Request', schedule: '5th' \}\n\s*\];/g;
const fallbackReplacement = `const fallbackReports = [
          { type: 'CRM', label: 'CRM Reports', schedule: 'Every Tuesday' },
          { type: 'PendingActivity', label: 'Pending Activity', schedule: 'Every Monday' },
          { type: 'NonSaleable', label: 'Non Saleable', schedule: '2nd & 16th' },
          { type: 'SupplierWarranty', label: 'Supplier Warranty', schedule: '3rd & 16th' },
          { type: 'CriticalPendingReport', label: 'Critical Pending Report', schedule: '2nd' },
          { type: 'PIRequest', label: 'PI Request', schedule: '5th' }
        ];
        if (monthStr.endsWith('-04') || monthStr.endsWith('-08') || monthStr.endsWith('-12')) {
          fallbackReports.push({ type: 'BuyBack', label: 'Buy Back', schedule: '15th' });
        }`;
html = html.replace(fallbackRegex, fallbackReplacement);

const cPIRegex = /const cPI = data\.compliance\?\.purchaseIndent \?\? 0;/g;
const cPIReplacement = `const cPI = data.compliance?.purchaseIndent ?? 0;
    const cBuyBack = data.compliance?.buyBack ?? 0;
    const isBuyBackMonth = params.month && (params.month.endsWith('-04') || params.month.endsWith('-08') || params.month.endsWith('-12'));
    const d15 = data.submissions?.includes('15') || false;`;
html = html.replace(cPIRegex, cPIReplacement);

// There are TWO instances of bottomTable construction in `generatePerfAnalysisHtml`, one for employee (special) and one for division. Both have PIRequest cell block.
const purchaseRowRegex = /<td colspan="3" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1\.4; vertical-align:middle;">\n\s*Purchase indent request to commercial<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA<\/span>\n\s*<div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">\n\s*\$\{checkSub\('PIRequest', d05\)\}\n\s*<\/div>\n\s*<\/td>/g;
const purchaseRowReplacement = `<td colspan="\${isBuyBackMonth ? '1' : '3'}" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; vertical-align:middle;">
              Purchase indent request to commercial<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span>
              <div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">
                \${checkSub('PIRequest', d05)}
              </div>
            </td>
            \${isBuyBackMonth ? \`<td colspan="2" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; vertical-align:middle;">
              Buy Back<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span>
              <div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">
                \${checkSub('BuyBack', d15)}
              </div>
            </td>\` : ''}`;
html = html.replace(purchaseRowRegex, purchaseRowReplacement);


const percentageRowRegex = /<td colspan="3" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; background-color:#e0e7ff; color:#3730a3; font-size:18px; text-align:center;">\$\{cPI\}%<\/td>/g;
const percentageRowReplacement = `<td colspan="\${isBuyBackMonth ? '1' : '3'}" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; background-color:#e0e7ff; color:#3730a3; font-size:18px; text-align:center;">\${cPI}%</td>
            \${isBuyBackMonth ? \`<td colspan="2" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; background-color:#e0e7ff; color:#3730a3; font-size:18px; text-align:center;">\${cBuyBack}%</td>\` : ''}`;
html = html.replace(percentageRowRegex, percentageRowReplacement);


// For drawPerfPdfPage
const compDataRegex = /compData\.push\(\['Purchase Indent', comp\.purchaseIndent != null \? comp\.purchaseIndent \+ '%' : '-']\);\n\s*\} else \{\n\s*compData = \[\n\s*\['Weekly CRM Reports', comp\.weeklyCrm != null \? comp\.weeklyCrm \+ '%' : '-'\],\n\s*\['Pending Activity \(Monday\)', comp\.pendingActivity != null \? comp\.pendingActivity \+ '%' : '-'\],\n\s*\['Non-Saleable Tracker', comp\.nonSaleable != null \? comp\.nonSaleable \+ '%' : '-'\],\n\s*\['Supplier Warranty', comp\.supplierWarranty != null \? comp\.supplierWarranty \+ '%' : '-'\],\n\s*\['Critical Pending Report', comp\.criticalPending != null \? comp\.criticalPending \+ '%' : '-'\],\n\s*\['Purchase Indent', comp\.purchaseIndent != null \? comp\.purchaseIndent \+ '%' : '-']\n\s*\];\n\s*\}/g;
const compDataReplacement = `compData.push(['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-']);
        if (monthLabel.endsWith('-04') || monthLabel.endsWith('-08') || monthLabel.endsWith('-12')) {
          compData.push(['Buy Back', comp.buyBack != null ? comp.buyBack + '%' : '-']);
        }
      } else {
        compData = [
          ['Weekly CRM Reports', comp.weeklyCrm != null ? comp.weeklyCrm + '%' : '-'],
          ['Pending Activity (Monday)', comp.pendingActivity != null ? comp.pendingActivity + '%' : '-'],
          ['Non-Saleable Tracker', comp.nonSaleable != null ? comp.nonSaleable + '%' : '-'],
          ['Supplier Warranty', comp.supplierWarranty != null ? comp.supplierWarranty + '%' : '-'],
          ['Critical Pending Report', comp.criticalPending != null ? comp.criticalPending + '%' : '-'],
          ['Purchase Indent', comp.purchaseIndent != null ? comp.purchaseIndent + '%' : '-']
        ];
        if (monthLabel.endsWith('-04') || monthLabel.endsWith('-08') || monthLabel.endsWith('-12')) {
          compData.push(['Buy Back', comp.buyBack != null ? comp.buyBack + '%' : '-']);
        }
      }`;
html = html.replace(compDataRegex, compDataReplacement);


fs.writeFileSync(file, html);
console.log('Added BuyBack to UI and PDF exports');
