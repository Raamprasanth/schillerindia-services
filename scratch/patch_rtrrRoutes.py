import re

with open('backend/routes/rtrrRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace model require
content = content.replace("const RTCRL    = require('../models/rtcrlModel');", "const Rtcrr    = require('../models/Rtcrr');")

# Replace creation logic
content = content.replace("await RTCRL.create({", "await Rtcrr.create({\n          revertedDate:     updated.revertedDate || null,")

# Replace console log
content = content.replace("console.error('Rtrr → RTCRL copy failed:', crlErr.message);", "console.error('Rtrr → Rtcrr copy failed:', crlErr.message);")
content = content.replace("console.error('Rtrr \\u2192 RTCRL copy failed:', crlErr.message);", "console.error('Rtrr → Rtcrr copy failed:', crlErr.message);")
# Sometimes it is outputted differently
content = re.sub(r"console\.error\('Rtrr.*RTCRL copy failed:', crlErr\.message\);", "console.error('Rtrr → Rtcrr copy failed:', crlErr.message);", content)


# Replace final message
content = content.replace("message: 'Repair completed and moved to RTCRL.'", "message: 'Re-repair completed and moved to Closed Re-repair List.'")

with open('backend/routes/rtrrRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched backend/routes/rtrrRoutes.js")
