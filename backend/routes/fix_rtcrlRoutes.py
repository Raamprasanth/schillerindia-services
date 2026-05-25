import os
import re

base_dir = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\backend\routes'
files_to_patch = [
    'rtfrn.js', 'rtobRoutes.js', 'rturRoutes.js',
    'atfrnRoutes.js', 'atobRoutes.js', 'aturRoutes.js'
]

# We want to find "techRemarks:      updated.techRemarks  || ''," inside RTCRL.create
# and insert our new fields just after it.

inject_content = """          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost || '',
          timeTaken:        updated.timeTaken || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components || '',
"""

for fname in files_to_patch:
    fpath = os.path.join(base_dir, fname)
    if not os.path.exists(fpath):
        print(f"{fname} not found.")
        continue
        
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We will just look for "techRemarks:      updated.techRemarks"
    # Actually, let's use regex to find the exact line and append.
    # r"techRemarks:\s*updated\.techRemarks\s*\|\|\s*'',"
    pattern = re.compile(r"(techRemarks:\s*updated\.techRemarks\s*\|\|\s*'',)")
    
    if pattern.search(content):
        # Only inject if not already injected
        if "repairRemarks:" not in content:
            new_content = pattern.sub(r"\1\n" + inject_content, content)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Patched {fname}")
        else:
            print(f"Already patched {fname}")
    else:
        print(f"Pattern not found in {fname}")

