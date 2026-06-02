import re

with open('backend/routes/revertRepairRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove RTCRL.findByIdAndDelete
content = re.sub(r'// 1\. Delete corresponding RTCRL record\s*await RTCRL\.findByIdAndDelete\(crlId\);', '// 1. Keep RTCRL record\n    // await RTCRL.findByIdAndDelete(crlId);', content)

content = re.sub(r'// Delete from original tables\s*if \(!isFromCrl\) \{[\s\S]*?\} else \{\s*await RTCRL\.findByIdAndDelete\(crlDoc\._id\);\s*\}', 'if (!isFromCrl) {\n      if (originalCollection === \'RTFRN\') await RTFRN.findOneAndDelete({ scRefNo });\n      if (originalCollection === \'RTOB\')  await RTOB.findOneAndDelete({ scRefNo });\n      if (originalCollection === \'RTUR\')  await RTUR.findOneAndDelete({ scRefNo });\n    } else {\n      // Keep the RTCRL record\n    }', content)


# 2. Fix entryDate mapping (for both direct revert and CRL revert)

# In the direct revert (from originalCollection):
# Note: we need to handle both routes if they both construct newDocPayload
# But wait, looking at revertRepairRoutes.js, let's see how newDocPayload is created.
# I will use a regex to replace entryDate: new Date() with the correct one.

# Let's inspect the file first so we don't mess up.
