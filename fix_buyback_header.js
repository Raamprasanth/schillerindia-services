const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// The exact string to search for (using Regex to ignore whitespace differences)
const regex = /<td colspan="3" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1\.4; vertical-align:middle;">\s*Purchase indent request to commercial<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA<\/span>\s*<div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">\s*\$\{checkSub\('PIRequest', d05\)\}\s*<\/div>\s*<\/td>/g;

const replacement = `<td colspan="\${isBuyBackMonth ? '1' : '3'}" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; vertical-align:middle;">
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

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(FILE_PATH, content);
    console.log('Successfully replaced Buy Back header logic!');
} else {
    console.log('Regex did not match.');
}
