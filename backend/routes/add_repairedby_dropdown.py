import os
import re

# 1. Update userRoutes.js
user_route_path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\backend\routes\userRoutes.js'
with open(user_route_path, 'r', encoding='utf-8') as f:
    user_content = f.read()

repair_route = """// ── GET /api/users/repair-team — get repair team members ──────
router.get('/repair-team', protect, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['repair', 'repair_team', 'admin'] } })
      .select('name role')
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

"""

if '/repair-team' not in user_content:
    # insert after router.get('/me', ...)
    user_content = user_content.replace(
        "router.get('/me', protect, (req, res) => res.json(req.user));",
        "router.get('/me', protect, (req, res) => res.json(req.user));\n\n" + repair_route
    )
    with open(user_route_path, 'w', encoding='utf-8') as f:
        f.write(user_content)
    print("Updated userRoutes.js")

# 2. Update Rtoa.html
html_path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\Rtoa.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace the input with select
html_content = re.sub(
    r'<input type="text" id="f-repairedBy".*?/>',
    r'<select id="f-repairedBy"><option value="">Select Repair Engineer</option></select>',
    html_content
)

js_func = """async function loadRepairEngineers() {
  try {
    const res = await fetch(`${API}/api/users/repair-team`, { headers: authHeaders() });
    if (!res.ok) return;
    const users = await res.json();
    const sel = document.getElementById('f-repairedBy');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Repair Engineer</option>';
    (Array.isArray(users) ? users : []).forEach(u => {
      const o = document.createElement('option');
      o.value = u.name; o.textContent = u.name;
      sel.appendChild(o);
    });
  } catch (_) {}
}"""

if 'loadRepairEngineers()' not in html_content:
    # Add function definition
    html_content = html_content.replace(
        "async function loadDivisionOptions()",
        js_func + "\n\nasync function loadDivisionOptions()"
    )
    # Add call in init()
    html_content = html_content.replace(
        "loadDivisionOptions();",
        "loadDivisionOptions();\n  loadRepairEngineers();"
    )
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("Updated Rtoa.html")
