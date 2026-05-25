import os
import re

base_dir = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public'
files_to_fix = ['employee-ob-pending.html', 'emppendingfrn.html', 'empestpend.html', 'estimation-pending.html']

# The buggy syntax usually looks like:
# doc.text('S',21.5,24.7,{align:'center'});
# );
# }

# or just missing the `}` completely.
# Let's search for the doc.text line, and optionally the `);` and optionally the `}`, and replace it with just the closing `}` properly.

pattern = re.compile(
    r"doc\.text\('S',21\.5,24\.7,\{align:'center'\}\);(?:\s*\);\s*)?(?:\s*\})?"
)

clean_replacement = "doc.text('S',21.5,24.7,{align:'center'});\n    }"

for fn in files_to_fix:
    path = os.path.join(base_dir, fn)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content, count = pattern.subn(clean_replacement, content)
    if count > 0:
        print(f"Fixed {count} instances in {fn}")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
