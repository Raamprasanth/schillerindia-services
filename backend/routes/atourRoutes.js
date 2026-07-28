const express = require('express');
const mongoose = require('mongoose');
const ATourSummary = require('../models/ATourSummary');
const TourSummary = require('../models/TourSummary');
const PTourSummary = require('../models/PTourSummary');
const { protect } = require('../middleware/authMiddleware');
const { buildTourWorkbookBuffer, sendWorkbook } = require('../utils/tourWorkbook');

const router = express.Router();

router.use(protect);

function canUseAdminTours(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUseAdminTours(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access admin tour summaries.' });
  }
  next();
});

async function syncAllToursToAdmin() {
  try {
    const [empTours, ptTours, existingAdminTours] = await Promise.all([
      TourSummary.find({}).lean(),
      PTourSummary.find({}).lean(),
      ATourSummary.find({}).lean(),
    ]);

    const adminSourceMap = new Map();
    const adminUniqueKeyMap = new Map();

    existingAdminTours.forEach(doc => {
      if (doc.sourceId) {
        adminSourceMap.set(String(doc.sourceId), doc);
      }
      const key = `${String(doc.createdBy || doc.createdById || '').trim().toLowerCase()}_${String(doc.tourName || '').trim().toLowerCase()}_${doc.dayNo || 1}_${String(doc.startDate || '').trim()}`;
      adminUniqueKeyMap.set(key, doc);
    });

    const newDocs = [];

    // Sync Employee Tours
    for (const doc of empTours) {
      const srcId = String(doc._id);
      const key = `${String(doc.createdBy || doc.createdById || '').trim().toLowerCase()}_${String(doc.tourName || '').trim().toLowerCase()}_${doc.dayNo || 1}_${String(doc.startDate || '').trim()}`;
      if (!adminSourceMap.has(srcId) && !adminUniqueKeyMap.has(key)) {
        const copy = { ...doc };
        delete copy._id;
        newDocs.push({
          ...copy,
          sourceType: 'Employee',
          sourceId: doc._id,
        });
      }
    }

    // Sync Product Team Tours
    for (const doc of ptTours) {
      const srcId = String(doc._id);
      const key = `${String(doc.createdBy || doc.createdById || '').trim().toLowerCase()}_${String(doc.tourName || '').trim().toLowerCase()}_${doc.dayNo || 1}_${String(doc.startDate || '').trim()}`;
      if (!adminSourceMap.has(srcId) && !adminUniqueKeyMap.has(key)) {
        const copy = { ...doc };
        delete copy._id;
        newDocs.push({
          ...copy,
          sourceType: 'Product Team',
          sourceId: doc._id,
        });
      }
    }

    if (newDocs.length) {
      await ATourSummary.insertMany(newDocs, { ordered: false });
    }
  } catch (err) {
    console.error('[syncAllToursToAdmin error]', err);
  }
}

// GET /api/atours
router.get('/', async (req, res) => {
  try {
    await syncAllToursToAdmin();
    const docs = await ATourSummary.find({}).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/atours]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/atours/:id
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;

    const doc = await ATourSummary.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: false });
    if (!doc) return res.status(404).json({ message: 'Admin tour summary not found.' });

    if (doc.sourceId) {
      if (doc.sourceType === 'Employee') {
        await TourSummary.findByIdAndUpdate(doc.sourceId, updateData, { new: true, runValidators: false });
      } else if (doc.sourceType === 'Product Team') {
        await PTourSummary.findByIdAndUpdate(doc.sourceId, updateData, { new: true, runValidators: false });
      }
    }

    res.json({ success: true, doc });
  } catch (err) {
    console.error('[PUT /api/atours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/atours/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await ATourSummary.findOneAndDelete({ _id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Admin tour summary not found.' });
    if (doc.sourceId) {
      if (doc.sourceType === 'Employee') {
        await TourSummary.deleteOne({ _id: doc.sourceId });
      } else if (doc.sourceType === 'Product Team') {
        await PTourSummary.deleteOne({ _id: doc.sourceId });
      }
    }
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/atours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/atours/export
router.post('/export', async (req, res) => {
  try {
    await syncAllToursToAdmin();
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id))).map(String)
      : [];
    const filter = {};
    if (ids.length) filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };

    const docs = await ATourSummary.find(filter).sort({ startDate: 1, createdAt: 1 }).lean();
    const order = new Map(ids.map((id, index) => [id, index]));
    const ordered = ids.length
      ? docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))
      : docs;

    const buffer = await buildTourWorkbookBuffer(ordered, { sheetName: 'Tour Summary', includeSource: true });
    sendWorkbook(res, buffer, req.body?.fileName || 'Admin_Tour_Summary_Export');
  } catch (err) {
    console.error('[POST /api/atours/export]', err);
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

// POST /api/atours/bulk-delete
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'No IDs provided for deletion.' });
    }
    const docs = await ATourSummary.find({ _id: { $in: ids } }).lean();
    await ATourSummary.deleteMany({ _id: { $in: ids } });

    for (const doc of docs) {
      if (doc.sourceId) {
        if (doc.sourceType === 'Employee') {
          await TourSummary.deleteOne({ _id: doc.sourceId });
        } else if (doc.sourceType === 'Product Team') {
          await PTourSummary.deleteOne({ _id: doc.sourceId });
        }
      }
    }
    res.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error('[POST /api/atours/bulk-delete]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
