import os
import re

html_path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\Rtoa.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# 1. Remove all placeholder="..."
html_content = re.sub(r'\s+placeholder="[^"]*"', '', html_content)

# 2. Hardcode the repairedBy dropdown options
new_select = """<select id="f-repairedBy">
              <option value="">Select Repair Engineer</option>
              <option value="Gajenthiran">Gajenthiran</option>
              <option value="Vaasougi">Vaasougi</option>
              <option value="Pradap">Pradap</option>
              <option value="Thilipan">Thilipan</option>
            </select>"""

html_content = re.sub(
    r'<select id="f-repairedBy"><option value="">Select Repair Engineer</option></select>',
    new_select,
    html_content
)

# 3. Remove loadRepairEngineers from init()
html_content = html_content.replace('loadRepairEngineers();', '')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)
print('Done updating Rtoa.html')
