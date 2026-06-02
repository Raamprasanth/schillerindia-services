import re

with open('frontend/public/Rtrr.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<a class="nav-item active" href="Rtfrn.html">', '<a class="nav-item" href="Rtfrn.html">')
content = content.replace('<a class="nav-item" href="Rtrr.html">', '<a class="nav-item active" href="Rtrr.html">')

with open('frontend/public/Rtrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched active state in Rtrr.html")
