import os

files = [
    'Repair-dashboard.html',
    'Rtfrn.html',
    'Rtob.html',
    'Rtur.html',
    'Rtcrl.html',
    'Rtrr.html',
    'Rtcrr.html',
    'Rtoa.html',
    'Rtcoa.html',
    'Rtcomr.html',
    'Rtccr.html'
]

target = '<a class="nav-item" href="Rtrr.html"><span class="ico">&#128260;</span> Re-repair List</a>'
replacement = target + '\n    <a class="nav-item" href="Rtcrr.html"><span class="ico">&#9989;</span> Closed Re-repair List</a>'

# Special case for Rtrr.html which might have active state
target_rtrr = '<a class="nav-item active" href="Rtrr.html"><span class="ico">&#128260;</span> Re-repair List</a>'
replacement_rtrr = target_rtrr + '\n    <a class="nav-item" href="Rtcrr.html"><span class="ico">&#9989;</span> Closed Re-repair List</a>'

base_path = 'frontend/public/'
for f in files:
    path = os.path.join(base_path, f)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as fp:
            content = fp.read()
        
        if 'href="Rtcrr.html"' not in content:
            if target in content:
                content = content.replace(target, replacement)
            elif target_rtrr in content:
                content = content.replace(target_rtrr, replacement_rtrr)
            else:
                print(f"Target not found in {f}")
                continue
            
            with open(path, 'w', encoding='utf-8') as fp:
                fp.write(content)
            print(f"Patched sidebar in {f}")
        else:
            print(f"Sidebar already patched in {f}")
    else:
        print(f"File not found: {f}")

