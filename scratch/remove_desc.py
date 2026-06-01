import re
import os

def remove_description(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove table header
    content = re.sub(r'<th onclick="sortBy\(\'description\'\)">Description &#8597;</th>\n\s*', '', content)
    content = re.sub(r'<th>Description</th>\n\s*', '', content)
    
    # 2. Remove table cell
    content = re.sub(r'<td class="compact-cell">\$\{compactText\(t\.description,\s*rid\+\'-description\'\)\}</td>\n\s*', '', content)
    content = re.sub(r'<td>\$\{esc\(t\.description\)\}</td>\n\s*', '', content)
    
    # 3. Fix colspan
    content = re.sub(r'colspan="11"', 'colspan="10"', content)
    
    # 4. Remove input field
    content = re.sub(r'<div class="field"><label>Description</label><textarea id="f-description" rows="\d" placeholder="Details\.\.\."></textarea></div>\n\s*', '', content)
    
    # 5. Remove array element
    content = re.sub(r"'f-description',\s*", "", content)
    
    # 6. Remove assignment
    content = re.sub(r"document\.getElementById\('f-description'\)\.value = doc\.description \|\| '';\n\s*", "", content)
    
    # 7. Remove object property
    content = re.sub(r"description: val\('f-description'\),\n\s*", "", content)
    
    # 8. Update CSV Headers
    content = re.sub(r"'Description',\s*", "", content)
    content = re.sub(r"'description',\s*", "", content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

base_path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public'
remove_description(os.path.join(base_path, 'ptpa.html'))
remove_description(os.path.join(base_path, 'ptca.html'))

print("Completed.")
