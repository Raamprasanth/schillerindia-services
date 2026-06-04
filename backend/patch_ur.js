const fs = require('fs');

const path = 'routes/EmpUnderRepairroutes.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('const Todr')) {
  code = code.replace(
    "const Service = require('../models/Service');",
    "const Service = require('../models/Service');\nconst Todr = require('../models/Todr');\nconst Dr = require('../models/Dr');"
  );
}

const mirrorCode = `
function toDateValue(value) {
  if (!value) return new Date();
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildTodrModel(doc) {
  return String(doc.model || '').trim();
}

function buildTodrDescription(doc, item = {}) {
  return String(item.description || doc.defMod || doc.defBrdModName || '').trim() || 'TO/DR entry';
}

async function mirrorUrToTodr(doc, action, items = [], queuedBy = '') {
  try {
    const rows = action === 'TO'
      ? items.map(item => ({
          partNo: String(item.partNo || '').trim(),
          model: buildTodrModel(doc),
          description: buildTodrDescription(doc, item),
        })).filter(item => item.partNo)
      : [{
          partNo: String(doc.partNo || doc.defMod || doc.defGir || 'DR').trim(),
          model: buildTodrModel(doc),
          description: buildTodrDescription(doc),
        }];

    const TargetModel = action === 'DR' ? Dr : Todr;

    await Promise.all(rows.map(row => TargetModel.findOneAndUpdate(
      {
        sourceModule: 'under_repair',
        sourceId: String(doc._id),
        action,
        partNo: row.partNo,
      },
      {
        entryDate: action === 'TO'
          ? toDateValue(doc.toEscalationQueuedAt || new Date())
          : toDateValue(doc.entryDate || doc.rcvdDate || doc.createdAt),
        frnNo: doc.frnNo || doc.scReNo || String(doc._id),
        partNo: row.partNo,
        model: row.model,
        description: row.description,
        action,
        sourceModule: 'under_repair',
        sourceId: String(doc._id),
        queuedBy,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )));
  } catch (err) {
    console.error(\`[TODR/DR mirror] Failed to mirror pending Under Repair (action=\${action}):\`, err);
  }
}
`;

if (!code.includes('function mirrorUrToTodr')) {
  // Insert before router.get
  code = code.replace(
    '// ─────────────────────────────────────────────────────────────────────────────\n//  GET /api/under-repair',
    mirrorCode + '\n// ─────────────────────────────────────────────────────────────────────────────\n//  GET /api/under-repair'
  );
}

// Update /:id/sr
if (code.includes('await enqueueEscalationSnapshot(') && !code.includes("await mirrorUrToTodr(service, 'DR', [], req.user?.name || '');")) {
  code = code.replace(
    /await enqueueEscalationSnapshot\(\s*'sr_ur',\s*service\._id,\s*req\.user\?\.name \|\| '',\s*buildUrEscalationRow\(service\.toObject\(\)\)\s*\);/g,
    "await enqueueEscalationSnapshot(\n      'sr_ur',\n      service._id,\n      req.user?.name || '',\n      buildUrEscalationRow(service.toObject())\n    );\n    await mirrorUrToTodr(service, 'DR', [], req.user?.name || '');"
  );
}

// Update /:id/to
if (code.includes("await enqueueEscalationSnapshot(") && !code.includes("await mirrorUrToTodr(service, 'TO', cleanItems, req.user?.name || '');")) {
  code = code.replace(
    /await enqueueEscalationSnapshot\(\s*'to_ur',\s*service\._id,\s*req\.user\?\.name \|\| '',\s*buildToEscalationRow\(service\.toObject\(\),\s*cleanItems\)\s*\);/g,
    "await enqueueEscalationSnapshot(\n      'to_ur',\n      service._id,\n      req.user?.name || '',\n      buildToEscalationRow(service.toObject(), cleanItems)\n    );\n    await mirrorUrToTodr(service, 'TO', cleanItems, req.user?.name || '');"
  );
}

fs.writeFileSync(path, code);
console.log('EmpUnderRepairroutes updated');
