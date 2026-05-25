import os

files = ['Rtfrn.html', 'Rtob.html', 'Rtur.html', 'Rtcrl.html']
base = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public'

for f in files:
    path = os.path.join(base, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # replace literal newline inside join string with the characters \ and n
    # The literal text looks like: .join('
    # ');
    # We want it to be: .join('\\n');
    
    if "\n');" in content and ".join('" in content:
        content = content.replace(".join('\n');", ".join('\\n');")
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Fixed JS string in {f}")
    else:
        print(f"Not found in {f}")
