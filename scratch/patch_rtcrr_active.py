import re

with open('frontend/public/Rtcrr.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<a class="nav-item active" href="Rtcrl.html">', '<a class="nav-item" href="Rtcrl.html">')
content = content.replace('<a class="nav-item" href="Rtcrr.html">', '<a class="nav-item active" href="Rtcrr.html">')

with open('frontend/public/Rtcrr.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched active state in Rtcrr.html")
