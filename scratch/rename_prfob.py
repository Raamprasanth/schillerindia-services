import os
import glob
import re

directory = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public'

replacements = {
    'PRF/OB': 'TO/SO',
    'PRF / OB': 'TO / SO',
    'PRF No': 'TO/SO No',
    'Total PRF': 'Total TO/SO',
    'Open PRF': 'Open TO/SO',
    'Closed PRF': 'Closed TO/SO',
    'Overdue PRF': 'Overdue TO/SO',
    'PRF Closed': 'TO/SO Closed',
    'Recent PRF': 'Recent TO/SO'
}

for file_path in glob.glob(os.path.join(directory, '*.html')):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if content != new_content:
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Updated {os.path.basename(file_path)}")

print("Done replacing.")
