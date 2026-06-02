import re

with open('frontend/public/Rtcrl.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace API endpoints and variables
content = content.replace('/api/rtcrl', '/api/rtcrr')
content = content.replace('fetch("/api/rtcrl', 'fetch("/api/rtcrr')
content = content.replace('fetch(`/api/rtcrl', 'fetch(`/api/rtcrr')
content = content.replace('Closed Repair List', 'Closed Re-repair List')

# Page Title
content = content.replace('<title>RT CRL</title>', '<title>Closed Re-repair List</title>')
content = content.replace('<h2><i class="fas fa-check-circle"></i> Closed Repair List</h2>', '<h2><i class="fas fa-check-circle"></i> Closed Re-repair List</h2>')

# Add "Reverted Date" column
th_entry = '<th onclick="sortBy(\'entryDate\')" class="sorted">Entry Date <span class="si">&#8693;</span></th>'
th_revert = '<th onclick="sortBy(\'revertedDate\')">Reverted Date <span class="si">&#8693;</span></th>\n              ' + th_entry
if th_entry in content and th_revert not in content:
    content = content.replace(th_entry, th_revert)

# Add "Reverted Date" in row rendering
td_entry = '<td style="font-size:11px;color:var(--soft);">${fmtDate(d.entryDate)}</td>'
td_revert = '<td style="font-size:11px;color:var(--soft);">${fmtDate(d.revertedDate)}</td>\n        ' + td_entry
if td_entry in content and td_revert not in content:
    content = content.replace(td_entry, td_revert)

# Export headers
content = content.replace("'Entry Date', 'Closed Date'", "'Reverted Date', 'Entry Date', 'Closed Date'")
# Export rows
content = content.replace("`\\t${fmtDate(d.entryDate)}`, `\\t${fmtDate(d.closedDate)}`,", "`\\t${fmtDate(d.revertedDate)}`, `\\t${fmtDate(d.entryDate)}`, `\\t${fmtDate(d.closedDate)}`,")

# Fix row processing to use revertedDate for aging (if applicable)
aging_regex = re.compile(r'const entry = new Date\(row\.entryDate\);')
content = aging_regex.sub('const entry = new Date(row.revertedDate || row.entryDate);', content)

calcDays_orig = 'const ref = createdAt || entryDate;'
calcDays_new = 'const ref = d.revertedDate || createdAt || entryDate;'
if calcDays_orig in content:
    content = content.replace('function calcDays(createdAt, entryDate) {', 'function calcDays(createdAt, entryDate, d) {')
    content = content.replace('const ref = createdAt || entryDate;', calcDays_new)
    content = content.replace('calcDays(d.createdAt, d.entryDate)', 'calcDays(d.createdAt, d.entryDate, d)')
    content = content.replace('calcDays(saved.createdAt, saved.entryDate)', 'calcDays(saved.createdAt, saved.entryDate, saved)')


with open('frontend/public/Rtcrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Created frontend/public/Rtcrr.html")
