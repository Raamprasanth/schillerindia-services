import re

with open('backend/models/rtcrlModel.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace schema and model names
content = content.replace('rtcrlSchema', 'rtcrrSchema')
content = content.replace("mongoose.model('RTCRL'", "mongoose.model('Rtcrr'")
content = content.replace("collection: 'rtcrls'", "collection: 'rtcrrs'")

# Add revertedDate
reverted_date_field = """
    revertedDate: {
      type: Date,
      index: true,
    },
"""
content = content.replace('entryDate: {', reverted_date_field + '    entryDate: {')

with open('backend/models/Rtcrr.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Created backend/models/Rtcrr.js")
