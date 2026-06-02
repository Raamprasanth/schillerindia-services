import re

dashboard_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\employee-dashboard.html"
fcbir_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\fcbir.html"
ecbir_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\ecbir.html"

with open(dashboard_path, "r", encoding="utf-8") as f:
    db = f.read()

with open(fcbir_path, "r", encoding="utf-8") as f:
    fcbir = f.read()

# --- 1. Extract Prefix from employee-dashboard ---
# From <!DOCTYPE html> to <div class="content">
content_start_idx = db.find('<div class="content">') + len('<div class="content">')
prefix = db[:content_start_idx]

# Customize Prefix
prefix = prefix.replace('<title>SchillerIndia - Employee Dashboard</title>', '<title>SchillerIndia - Closed BIR List</title>')
prefix = prefix.replace('class="nav-item active" href="employee-dashboard.html"', 'class="nav-item" href="employee-dashboard.html"')
prefix = prefix.replace('class="nav-item" href="ecbir.html"', 'class="nav-item active" href="ecbir.html"')
prefix = prefix.replace('<div class="topbar-title">My Dashboard</div>', '<div class="topbar-title">Closed BIR List</div>')

# Replace topbar actions in prefix with the one from fcbir (or basic actions)
topbar_actions_html = """
    <div class="topbar-actions">
      <button class="topbar-btn" onclick="exportCSV()">&#128228; Export CSV</button>
    </div>
"""
prefix = re.sub(r'<div class="topbar-actions">.*?</div>\s*</div>', topbar_actions_html + '\n    </div>', prefix, flags=re.DOTALL)


# --- 2. Extract Specific CSS from fcbir ---
fcbir_style = ""
style_match = re.search(r'<style>(.*?)</style>', fcbir, re.DOTALL)
if style_match:
    full_css = style_match.group(1)
    
    # We only want CSS starting from /* -- FILTER STRIP or /* STATS */
    # Basically we want to skip the layout CSS
    css_start = full_css.find('/* STATS */')
    if css_start == -1: css_start = full_css.find('/* -- FILTER STRIP')
    if css_start != -1:
        fcbir_style = full_css[css_start:]
    else:
        # manual extraction if comments are missing
        fcbir_style = full_css

# Inject this fcbir_style into the prefix right before </style>
prefix = prefix.replace('</style>', fcbir_style + '\n  </style>')


# --- 3. Extract Content from fcbir ---
c_start = fcbir.find('<div class="content">') + len('<div class="content">')
c_end = fcbir.find('</div>\n</div>', c_start)
if c_end == -1: c_end = fcbir.rfind('</div>\n</div>')

inner_content = fcbir[c_start:c_end].strip()

# Change IDs to match ECBIR logic if needed (wait, I will use fcbir's JS so IDs can remain)


# --- 4. Extract Script from fcbir ---
s_start = fcbir.find('<script>', c_end)
script_content = fcbir[s_start:]

# Fix the normalize function in the script to handle unitInwardDate etc
normalize_func = """function normalizeClosed(doc){
  if(!doc)return null;
  const out={...doc};
  if(out.status==='Completed')out.status='Closed';
  // Normalize fields for ECBIR table mapping
  if(out.birRefNo && !out.birRef) out.birRef = out.birRefNo;
  if(out.inwardDate && !out.unitInwardDate) out.unitInwardDate = out.inwardDate;
  if(out.finalStatus && !out.status) out.status = out.finalStatus;
  return out;
}"""
script_content = re.sub(r'function normalizeClosed\(doc\)\{.*?return out;\}', normalize_func, script_content, flags=re.DOTALL)


# --- 5. Combine and Write ---
final_html = prefix + "\n" + inner_content + "\n  </div>\n</div>\n" + script_content

with open(ecbir_path, "w", encoding="utf-8") as f:
    f.write(final_html)

print("Updated ecbir.html completely")
