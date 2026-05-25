import os
import re

base_dir = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\backend\routes'

# The regex matches blocks like:
# if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
#   const { hasDivisionAccessToService } = require('../utils/visibility');
#   const allowed = await hasDivisionAccessToService(req.user, doc.serviceId);
#   if (!allowed) { return res.status(403).json({ message: 'Access denied' }); }
# }

pattern = re.compile(
    r"(?:const\s+\{\s*role[^}]*\}\s*=\s*req\.user;\s*)?"
    r"(?:if\s*\([^\{]+!==\s*'admin'[\s\S]*?\{)\s*"
    r"const\s+\{\s*hasDivisionAccessToService\s*\}\s*=\s*require\('\.\./utils/visibility'\);\s*"
    r"const\s+allowed\s*=\s*await\s+hasDivisionAccessToService\(req\.user,\s*([a-zA-Z0-9_]+)\.serviceId(?:[^)]*)\);\s*"
    r"if\s*\(!allowed\)\s*(?:\{)?\s*return\s+res\.status\(403\)\.json\([^)]+'Access denied'[^)]*\);\s*(?:\})?\s*"
    r"\}",
    re.MULTILINE
)

def replacer(match):
    var_name = match.group(1)
    
    return f"""
    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {{
      __is_allowed = true;
    }} else {{
      const {{ hasDivisionAccessToService }} = require('../utils/visibility');
      if ({var_name} && {var_name}.serviceId && await hasDivisionAccessToService(req.user, {var_name}.serviceId)) {{
        __is_allowed = true;
      }} else {{
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [
          {var_name}.eng, {var_name}.scEng, {var_name}.estRaEng, {var_name}.obRaEng, {var_name}.submittedBy, {var_name}.createdBy
        ].some(v => String(v || '').trim().toLowerCase() === _uName)) {{
          __is_allowed = true;
        }}
      }}
    }}
    if (!__is_allowed) {{
      return res.status(403).json({{ message: 'Access denied' }});
    }}
    """

for fn in os.listdir(base_dir):
    if not fn.endswith('.js'): continue
    path = os.path.join(base_dir, fn)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Skipping {fn} due to read error: {e}")
        continue
        
    new_content, count = pattern.subn(replacer, content)
    
    if count > 0:
        print(f"Replaced {count} instances in {fn}")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
