import os
import re

base_dir = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\backend\routes'
files_to_patch = [
    'rturRoutes.js',
    'atfrnRoutes.js', 'atobRoutes.js', 'aturRoutes.js'
]

for fname in files_to_patch:
    fpath = os.path.join(base_dir, fname)
    if not os.path.exists(fpath):
        continue
        
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(fpath, 'r', encoding='windows-1252') as f:
            content = f.read()
    
    # regex to match "techRemarks: <something>.techRemarks || '',"
    pattern = re.compile(r"(techRemarks:\s*([a-zA-Z0-9_]+)\.techRemarks\s*\|\|\s*'',)")
    
    match = pattern.search(content)
    if match:
        var_name = match.group(2)
        inject_content = f"""          repairRemarks:    {var_name}.repairRemarks || '',
          cost:             {var_name}.cost || '',
          timeTaken:        {var_name}.timeTaken || '',
          repairStatus:     {var_name}.repairStatus || '',
          doi:              {var_name}.doi || '',
          repairedDate:     {var_name}.repairedDate || '',
          components:       {var_name}.components || {var_name}.compUsedToRepair || '',
"""
        if "repairRemarks:" not in content:
            new_content = pattern.sub(r"\1\n" + inject_content, content)
            try:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            except:
                with open(fpath, 'w', encoding='windows-1252') as f:
                    f.write(new_content)
            print(f"Patched {fname}")
        else:
            print(f"Already patched {fname}")
    else:
        print(f"Pattern not found in {fname}")
