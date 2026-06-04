const fs = require('fs');

const path = 'routes/estimationPending.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('const Todr')) {
  code = code.replace(
    "const Division          = require('../models/Division');",
    "const Division          = require('../models/Division');\nconst Todr              = require('../models/Todr');\nconst Dr                = require('../models/Dr');"
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

async function mirrorEstToTodr(doc, action, items = [], queuedBy = '') {
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
        sourceModule: 'estimation_pending',
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
        sourceModule: 'estimation_pending',
        sourceId: String(doc._id),
        queuedBy,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )));
  } catch (err) {
    console.error(\`[TODR/DR mirror] Failed to mirror pending Estimation (action=\${action}):\`, err);
  }
}
`;

if (!code.includes('function mirrorEstToTodr')) {
  // Insert before the first router.get
  code = code.replace(
    '// ─────────────────────────────────────────────────────────────────────────────\n//  GET  /api/emp/estimation',
    mirrorCode + '\n// ─────────────────────────────────────────────────────────────────────────────\n//  GET  /api/emp/estimation'
  );
}

// Update /:id/sr
if (code.includes('await enqueueEscalationSnapshot(') && !code.includes("await mirrorEstToTodr(record, 'DR', [], name || '');")) {
  code = code.replace(
    /await enqueueEscalationSnapshot\(\s*'sr_est',\s*record\._id,\s*name \|\| '',\s*buildEstimationEscalationRow\(record\.toObject\(\)\)\s*\);/g,
    "await enqueueEscalationSnapshot(\n      'sr_est',\n      record._id,\n      name || '',\n      buildEstimationEscalationRow(record.toObject())\n    );\n    await mirrorEstToTodr(record, 'DR', [], name || '');"
  );
}

// Update /:id/to
if (code.includes("await enqueueEscalationSnapshot(") && !code.includes("await mirrorEstToTodr(record, 'TO', cleanItems, name || '');")) {
  code = code.replace(
    /await enqueueEscalationSnapshot\(\s*'to_est',\s*record\._id,\s*name \|\| '',\s*buildToEscalationRow\(record\.toObject\(\),\s*cleanItems\)\s*\);/g,
    "await enqueueEscalationSnapshot(\n      'to_est',\n      record._id,\n      name || '',\n      buildToEscalationRow(record.toObject(), cleanItems)\n    );\n    await mirrorEstToTodr(record, 'TO', cleanItems, name || '');"
  );
}

fs.writeFileSync(path, code);
console.log('estimationPending updated');
