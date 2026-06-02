import re

with open('frontend/public/Rtrr.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix export headers
content = content.replace("'Entry Date', 'Division'", "'Reverted Date', 'Entry Date', 'Division'")

# Fix export rows
content = content.replace("`\\t${fmtDate(d.entryDate)}`, d.division || '-',", "`\\t${fmtDate(d.revertedDate)}`, `\\t${fmtDate(d.entryDate)}`, d.division || '-',")

with open('frontend/public/Rtrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched export in Rtrr.html")
