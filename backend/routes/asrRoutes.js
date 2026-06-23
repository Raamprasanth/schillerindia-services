const express = require('express');
const AdminSR = require('../models/AdminSR');
const SR = require('../models/Sr');
const Scsr = require('../models/ScSr');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

const srFields = 'date division partNo description qty girNo fromLocation toLocation remarks createdBy createdAt updatedAt';
const editableFields = ['date', 'division', 'partNo', 'description', 'qty', 'girNo', 'fromLocation', 'toLocation', 'remarks'];
const requiredSrFields = ['date', 'division', 'partNo', 'description', 'girNo'];

function hasRequiredSrFields(sr) {
  return requiredSrFields.every(field => String(sr?.[field] || '').trim());
}

function buildSrPayload(sr, userLabel = '') {
  const payload = {};
  editableFields.forEach((field) => {
    if (sr[field] !== undefined) payload[field] = field === 'qty' ? Number(sr[field]) || 0 : sr[field];
  });
  if (userLabel) payload.updatedBy = userLabel;
  return payload;
}

async function syncMissingSrItems() {
  const existingSrIds = new Set(
    (await AdminSR.distinct('srId', { srId: { $ne: '' } })).map(id => String(id))
  );
  const sourceItems = await SR.find({}, srFields).lean();
  const operations = [];
  let skipped = 0;

  sourceItems.forEach((sr) => {
    const srId = String(sr._id);
    if (existingSrIds.has(srId)) return;
    if (!hasRequiredSrFields(sr)) {
      skipped += 1;
      return;
    }

    operations.push({
      insertOne: {
        document: {
          date: sr.date,
          division: sr.division,
          partNo: sr.partNo,
          description: sr.description,
          qty: Number(sr.qty) || 0,
          girNo: sr.girNo,
          fromLocation: sr.fromLocation,
          toLocation: sr.toLocation,
          remarks: sr.remarks,
          srId,
          createdBy: sr.createdBy || 'System',
          createdAt: sr.createdAt,
          updatedAt: sr.updatedAt
        }
      }
    });
  });

  if (operations.length) {
    await AdminSR.bulkWrite(operations, { ordered: false });
  }
  if (skipped) {
    console.warn(`[GET /api/asr] Skipped ${skipped} SR item(s) with missing required fields during sync.`);
  }
}

async function attachScsrDetails(docs) {
  const srIds = docs.map(d => String(d.srId || '')).filter(id => /^[0-9a-fA-F]{24}$/.test(id));
  if (!srIds.length) return docs;

  const scsrs = await Scsr.find({ srRef: { $in: srIds } }, 'srRef toNo toRaisedDate').lean();
  const scsrMap = scsrs.reduce((acc, scsr) => {
    if (scsr.srRef) acc[String(scsr.srRef)] = scsr;
    return acc;
  }, {});

  return docs.map((doc) => {
    const related = scsrMap[String(doc.srId)];
    if (!related) return doc;
    return {
      ...doc,
      toNo: related.toNo,
      toRaisedDate: related.toRaisedDate
    };
  });
}

router.get('/', adminOnly, async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (division) filter.division = division;

    await syncMissingSrItems();

    const docs = await AdminSR.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(await attachScsrDetails(docs));
  } catch (err) {
    console.error('[GET /api/asr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { date, division, partNo, description, qty, girNo, fromLocation, toLocation, remarks, srId } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await AdminSR.create({
      date,
      division,
      partNo,
      description,
      qty,
      girNo,
      fromLocation,
      toLocation,
      remarks,
      srId: srId || '',
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/asr]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const updates = {};
    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = field === 'qty' ? Number(req.body[field]) || 0 : req.body[field];
    });
    updates.updatedBy = req.user?.name || req.user?.email || '';

    const doc = await AdminSR.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'Admin SR item not found.' });

    if (doc.srId) {
      const linkedUpdates = buildSrPayload(updates, updates.updatedBy);
      await SR.findByIdAndUpdate(doc.srId, linkedUpdates, { runValidators: true }).catch(e => console.error('Failed to update associated SR:', e));
      await Scsr.findOneAndUpdate({ srRef: doc.srId }, linkedUpdates, { runValidators: true }).catch(e => console.error('Failed to update associated SCSR:', e));
    }

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/asr/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const doc = await AdminSR.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Admin SR item not found.' });

    // Synchronize deletion across sr and scsr (SR and Scsr models)
    if (doc.srId) {
      await SR.findByIdAndDelete(doc.srId).catch(e => console.error('Failed to delete associated SR:', e));
      await Scsr.findOneAndDelete({ srRef: doc.srId }).catch(e => console.error('Failed to delete associated SCSR:', e));
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/asr/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
