import re

with open('backend/routes/rtfrn.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements
content = content.replace('RTFRN.JS', 'Rtrr.js')
content = content.replace('RTFRN', 'Rtrr')
content = content.replace('RT FRN', 'Re-repair List')
content = content.replace('/api/rtfrn', '/api/rtrr')
content = content.replace('rtfrnSent', 'rtrrSent')
content = content.replace('rtfrnCompleted', 'rtrrCompleted')
content = content.replace('rtfrnSentAt', 'rtrrSentAt')
content = content.replace('rtfrnCompletedAt', 'rtrrCompletedAt')

# Fix the import
content = content.replace("require('../models/Rtrr.js')", "require('../models/Rtrr')")

# Fix the collection name in comments if any
content = content.replace('rtfrns', 'rtrrs')

# Special for model: sourceCollection in RTCRL should say 'rtrr'
content = content.replace("sourceCollection: 'rtfrn'", "sourceCollection: 'rtrr'")

with open('backend/routes/rtrrRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Created backend/routes/rtrrRoutes.js")
