import re

fcbir_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\fcbir.html"
ecbir_path = r"c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\ecbir.html"

with open(fcbir_path, "r", encoding="utf-8") as f:
    fcbir = f.read()

with open(ecbir_path, "r", encoding="utf-8") as f:
    ecbir = f.read()

# Extract parts from fcbir
style_start = fcbir.find("<style>")
style_end = fcbir.find("</style>") + 8
fcbir_style = fcbir[style_start:style_end]

main_start = fcbir.find("<!-- MAIN -->")
main_end = fcbir.find("<script>", main_start)
fcbir_main = fcbir[main_start:main_end]

# Extract ECBIR specific things from its JS
ecbir_js_start = ecbir.find("<script>\n// -- STATE")
ecbir_js_end = ecbir.find("</script>\n<script src=\"tab-fix.js\">")
if ecbir_js_end == -1:
    ecbir_js_end = ecbir.rfind("</script>")
ecbir_js = ecbir[ecbir_js_start:ecbir_js_end]

# For ECBIR JS, we need to adapt the renderTable HTML string to match FCBIR's ns-table, 
# but we can also just use FCBIR's JS structure, since it's "exactly like fcbir".
# Wait, let's extract FCBIR's JS and just replace the fetch endpoints and sidebar!
fcbir_js_start = fcbir.find("<script>\n// -- STATE")
fcbir_js_end = fcbir.find("</script>\n<script src=\"tab-fix.js\">")
if fcbir_js_end == -1:
    fcbir_js_end = fcbir.rfind("</script>")
fcbir_js = fcbir[fcbir_js_start:fcbir_js_end]

# Replace API endpoints in fcbir_js
fcbir_js = fcbir_js.replace("fetch('/api/bir/closed'", "fetch('/api/emp/bir/closed'")
fcbir_js = fcbir_js.replace("fetch('/api/bir'", "fetch('/api/emp/bir'")
fcbir_js = fcbir_js.replace("si_closed_bir_data", "si_emp_closed_bir_data")
fcbir_js = fcbir_js.replace("si_bir_data", "si_emp_bir_data")

# Construct new ECBIR
# We keep ECBIR's header, sidebar, etc. up to <!-- MAIN -->
ecbir_main_start = ecbir.find("<!-- MAIN -->")
# We also want to replace the <style> block in ECBIR with FCBIR's <style>
# Wait, ECBIR has multiple <style> blocks or one huge one?
# ECBIR has <style>...</style> and then <link rel="stylesheet"...
# Let's just find the first <style>...</style> in ECBIR and replace it.
ecbir_style_start = ecbir.find("<style>")
ecbir_style_end = ecbir.find("</style>") + 8

ecbir_head = ecbir[:ecbir_style_start] + fcbir_style + ecbir[ecbir_style_end:ecbir_main_start]

# We should make sure we keep ECBIR's sidebar.
# The sidebar in ecbir is between <!-- === SIDEBAR === --> (or <!-- SIDEBAR -->) and <!-- MAIN -->
ecbir_sidebar_start = ecbir.find("<!-- === SIDEBAR === -->")
if ecbir_sidebar_start == -1:
    ecbir_sidebar_start = ecbir.find("<!-- SIDEBAR -->")

# Actually, the replacement of style might wipe out the sidebar styles for ECBIR if they are different.
# But user said "make ecbir page table and structure exaclty likr the fcbir pages".
# Let's just swap out the <!-- MAIN --> to end of script, and inject the fcbir styles while keeping ecbir styles?
# Let's just copy fcbir entirely and then replace the sidebar with ecbir's sidebar, and the endpoints.

fcbir_sidebar_start = fcbir.find("<!-- SIDEBAR -->")
fcbir_sidebar_end = fcbir.find("<!-- MAIN -->")
ecbir_sidebar = ecbir[ecbir_sidebar_start:ecbir_main_start]

# Also fix page title in FCBIR head?
fcbir_head_replaced = fcbir[:fcbir_sidebar_start].replace("FQC", "Employee").replace("admin-name", "emp-name").replace("admin-avatar", "emp-avatar").replace("fqc", "emp")
# Replace the auth check role to allow employee
fcbir_head_replaced = re.sub(
    r"if \(!token \|\| !\[.*?\].includes\(role\)\)",
    "if (!token || !['employee','emp','field','service','admin','superadmin'].includes(role))",
    fcbir_head_replaced
)

new_ecbir = fcbir_head_replaced + ecbir_sidebar + fcbir_main + fcbir_js + "</script>\n"

# In the JS, replace user setting:
new_ecbir = new_ecbir.replace("'admin-name'", "'emp-name'").replace("'admin-avatar'", "'emp-avatar'")
new_ecbir = new_ecbir.replace("'admin-date'", "'admin-date'") # Wait, ecbir doesn't have admin-date? fcbir has it. We kept fcbir_main which has id="admin-date".

# Let's write the new ecbir
with open(ecbir_path, "w", encoding="utf-8") as f:
    f.write(new_ecbir)
print("Updated ecbir.html successfully")
