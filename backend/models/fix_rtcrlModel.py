import os
import re

path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\backend\models\rtcrlModel.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    // "Repaired By" — fl-repairedby filter in rtcrl.html
    repairedBy: {
      type: String,
      trim: true,
      default: '',
    },'''

replace = '''    // "Repaired By" — fl-repairedby filter in rtcrl.html
    repairedBy: {
      type: String,
      trim: true,
      default: '',
    },
    
    repairRemarks: { type: String, trim: true, default: '' },
    cost: { type: String, trim: true, default: '' },
    timeTaken: { type: String, trim: true, default: '' },
    repairStatus: { type: String, trim: true, default: '' },
    doi: { type: String, trim: true, default: '' },
    repairedDate: { type: String, trim: true, default: '' },
    components: { type: String, trim: true, default: '' },'''

if target in content:
    content = content.replace(target, replace)
    print("Replaced Model fields")
else:
    print("Model fields target not found")
    content = content.replace(target.replace(chr(10), chr(13)+chr(10)), replace)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
