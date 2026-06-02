import re

dashboard_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\employee-dashboard.html"
ecbir_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\ecbir.html"

with open(dashboard_path, "r", encoding="utf-8") as f:
    db = f.read()

with open(ecbir_path, "r", encoding="utf-8") as f:
    ecbir = f.read()

# 1. Extract head up to </head> from dashboard
db_head_end = db.find("</head>")
db_head = db[:db_head_end]

# 2. Add ecbir's specific styles to the head
ecbir_style_start = ecbir.find("<style>")
ecbir_style_end = ecbir.find("</style>") + 8
ecbir_style = ecbir[ecbir_style_start:ecbir_style_end]

def remove_css_block(css, selector):
    return re.sub(rf"{selector}\s*{{[^}}]+}}", "", css)

ecbir_style_clean = ecbir_style
for sel in [r"\.sidebar", r"\.sidebar-header", r"\.main", r"\.topbar", r"\.content", r"body"]:
    ecbir_style_clean = remove_css_block(ecbir_style_clean, sel)

# 3. Extract the body prefix from dashboard (from <body> up to <div class="content">)
db_body_start = db.find("<body>")
db_content_start = db.find('<div class="content">') + len('<div class="content">')
db_prefix = db[db_body_start:db_content_start]

# 4. Extract ecbir content
ecbir_content_start = ecbir.find('<div class="content">')
if ecbir_content_start != -1:
    ecbir_content_start += len('<div class="content">')
else:
    ecbir_content_start = ecbir.find('<div class="main">') + len('<div class="main">')

ecbir_content_end = ecbir.find('</div>\n</div>\n\n<script>')
if ecbir_content_end == -1:
    ecbir_content_end = ecbir.find('</div>\n</div>\n<script>')
if ecbir_content_end == -1:
    ecbir_content_end = ecbir.find('</div>\n\n<script>')
if ecbir_content_end == -1:
    ecbir_content_end = ecbir.find('</div>\n</div>\n\n\n<script>')
if ecbir_content_end == -1:
    ecbir_content_end = ecbir.find('</div>\n</div>\n\n\n\n<script>')
if ecbir_content_end == -1:
    ecbir_content_end = ecbir.rfind('</div>\n</div>')

ecbir_inner_content = ecbir[ecbir_content_start:ecbir_content_end]

# 5. Extract ecbir scripts
ecbir_script_start = ecbir.find("<script>", ecbir_content_end)
ecbir_script = ecbir[ecbir_script_start:]

# 6. Customize db_prefix for ecbir
db_prefix = db_prefix.replace('class="nav-item active" href="employee-dashboard.html"', 'class="nav-item" href="employee-dashboard.html"')
db_prefix = db_prefix.replace('class="nav-item" href="ecbir.html"', 'class="nav-item active" href="ecbir.html"')
db_prefix = db_prefix.replace('<div class="topbar-title">My Dashboard</div>', '<div class="topbar-title">Closed BIR List</div>')
db_prefix = db_prefix.replace('id="emp-date"', 'id="admin-date"')

# Also remove the specific topbar actions from db_prefix, we want ecbir's actions if there were any, but wait
# the user wants the structure of employee-dashboard. But employee-dashboard has a "Submit Report" button.
# Let's replace the topbar actions entirely with ECBIR's topbar actions if possible.
ecbir_topbar_actions_start = ecbir.find('<div style="display:flex;align-items:center;gap:10px;">')
if ecbir_topbar_actions_start == -1:
    ecbir_topbar_actions_start = ecbir.find('<div class="topbar-actions">')
if ecbir_topbar_actions_start != -1:
    ecbir_topbar_actions_end = ecbir.find('</div>', ecbir_topbar_actions_start) + 6
    ecbir_actions = ecbir[ecbir_topbar_actions_start:ecbir_topbar_actions_end]
    
    db_actions_start = db_prefix.find('<div class="topbar-actions">')
    db_actions_end = db_prefix.find('</div>', db_actions_start) # this is tricky because of nested divs...
    # let's just use regex to replace topbar-actions
    db_prefix = re.sub(r'<div class="topbar-actions">.*?</div>\s*</div>', f'<div class="topbar-actions">{ecbir_actions}</div></div>', db_prefix, flags=re.DOTALL)

# Combine
new_ecbir = db_head + "\n" + ecbir_style_clean + "\n</head>\n" + db_prefix + "\n" + ecbir_inner_content + "\n  </div>\n</div>\n" + ecbir_script

with open(ecbir_path, "w", encoding="utf-8") as f:
    f.write(new_ecbir)
print("Updated ecbir.html successfully")
