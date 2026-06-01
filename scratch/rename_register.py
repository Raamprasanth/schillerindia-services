import os
import glob

directory = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public'

for file_path in glob.glob(os.path.join(directory, '*.html')):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if 'PRF/OB Register' in content:
        new_content = content.replace('PRF/OB Register', 'TO/SO Register')
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f"Updated {os.path.basename(file_path)}")

print("Done replacing.")
