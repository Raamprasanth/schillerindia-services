import re

with open('frontend/public/Rtfrn.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace API endpoints and variables
content = content.replace('/api/rtfrn/employee', '/api/rtrr/employee')
content = content.replace('/api/rtfrn', '/api/rtrr')
content = content.replace('fetch("/api/rtfrn', 'fetch("/api/rtrr')
content = content.replace('fetch(`/api/rtfrn', 'fetch(`/api/rtrr')
content = content.replace('PFRN (FRN)', 'Re-repair List')

# Page Title
content = content.replace('<title>RT FRN</title>', '<title>Re-repair List</title>')
content = content.replace('<h2><i class="fas fa-tools"></i> PFRN (FRN)</h2>', '<h2><i class="fas fa-tools"></i> Re-repair List</h2>')

# Add "Reverted Date" column
th_entry = '<th data-sort="entryDate">Entry Date<i class="fas fa-sort sort-icon"></i></th>'
th_revert = '<th>Reverted Date</th>\n            ' + th_entry
content = content.replace(th_entry, th_revert)

# Add "Reverted Date" in row rendering
td_entry = '<td>${row.entryDate || \'-\'}</td>'
td_revert = '<td>${row.revertedDate ? new Date(row.revertedDate).toLocaleDateString() : \'-\'}</td>\n          ' + td_entry
content = content.replace(td_entry, td_revert)

# Fix row processing to use revertedDate for aging (if applicable)
aging_regex = re.compile(r'const entry = new Date\(row\.entryDate\);')
content = aging_regex.sub('const entry = new Date(row.revertedDate || row.entryDate);', content)

# Write out the file
with open('frontend/public/Rtrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Created frontend/public/Rtrr.html")
