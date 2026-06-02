import os

files = [
    'Repair-dashboard.html',
    'Rtfrn.html',
    'Rtob.html',
    'Rtur.html',
    'Rtcrl.html',
    'Rtrr.html',
    'Rtoa.html',
    'Rtcoa.html',
    'Rtcomr.html',
    'Rtccr.html'
]

target = '<a class="nav-item" href="Rtcrl.html"><span class="ico">&#9989;</span> Closed Repair List</a>'
replacement = target + '\n    <a class="nav-item" href="Rtrr.html"><span class="ico">&#128260;</span> Re-repair List</a>'

base_path = 'frontend/public/'
for f in files:
    path = os.path.join(base_path, f)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as fp:
            content = fp.read()
        
        if target in content and 'href="Rtrr.html"' not in content:
            content = content.replace(target, replacement)
            with open(path, 'w', encoding='utf-8') as fp:
                fp.write(content)
            print(f"Patched sidebar in {f}")
        elif 'href="Rtrr.html"' in content:
            print(f"Sidebar already patched in {f}")
        else:
            print(f"Target not found in {f}")
    else:
        print(f"File not found: {f}")
