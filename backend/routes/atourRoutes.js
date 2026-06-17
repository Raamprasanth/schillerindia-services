const express = require('express');
const mongoose = require('mongoose');
const ATourSummary = require('../models/ATourSummary');
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

// GET /api/atours
router.get('/', async (req, res) => {
  try {
    const docs = await ATourSummary.find({}).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/atours]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/atours/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await ATourSummary.findOneAndDelete({ _id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Admin tour summary not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/atours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/atours/export
router.post('/export', async (req, res) => {
  try {
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
    await ATourSummary.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error('[POST /api/atours/bulk-delete]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
