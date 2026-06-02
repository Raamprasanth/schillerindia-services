import re

with open('frontend/public/Rtrr.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Table Header
th_div = '<th onclick="sortBy(\'division\')">Division <span class="si">&#8693;</span></th>'
th_cat = '<th onclick="sortBy(\'category\')">Category <span class="si">&#8693;</span></th>'
if th_div in content and th_cat not in content:
    content = content.replace(th_div, th_div + '\n              ' + th_cat)

# 2. Table Row
td_div = '<td><span class="div-tag">${esc(d.division||\'-\')}</span></td>'
td_cat = '<td><span class="badge badge-outline" style="background:#f3f4f6;color:#374151;border-color:#d1d5db">${esc(d.category||\'-\')}</span></td>'
if td_div in content and 'd.category' not in content:
    content = content.replace(td_div, td_div + '\n          ' + td_cat)

# 3. Export Header
exp_head = "'Reverted Date', 'Entry Date', 'Division', 'SC Ref No'"
exp_head_new = "'Reverted Date', 'Entry Date', 'Division', 'Category', 'SC Ref No'"
if exp_head in content:
    content = content.replace(exp_head, exp_head_new)

# 4. Export Row
exp_row = "d.division || '-', d.scRefNo || '-'"
exp_row_new = "d.division || '-', d.category || '-', d.scRefNo || '-'"
if exp_row in content:
    content = content.replace(exp_row, exp_row_new)

with open('frontend/public/Rtrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched Category into Rtrr.html")
