import re

with open('backend/routes/rtcrlRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("require('../models/rtcrlModel')", "require('../models/Rtcrr')")
content = content.replace("RTCRL", "Rtcrr")
content = content.replace("/api/rtcrl", "/api/rtcrr")

with open('backend/routes/rtcrrRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Created backend/routes/rtcrrRoutes.js")
