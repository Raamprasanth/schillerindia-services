const express = require('express');
const PTourSummary = require('../models/PTourSummary');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUsePtTours(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtTours(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team tour summaries.' });
  }
  next();
});

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { createdById: user?._id };
}

router.get('/', async (req, res) => {
  try {
    const docs = await PTourSummary.find(ownerFilter(req.user)).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptours]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.startDate || !body.customerName) {
      return res.status(400).json({ message: 'Required: start date and customer name.' });
    }
    const images = Array.isArray(body.images) ? body.images.filter(Boolean).slice(0, 3) : [];
    const tooLarge = images.some((img) => Buffer.byteLength(String(img), 'utf8') > 4.2 * 1024 * 1024);
    if (tooLarge) return res.status(400).json({ message: 'Each image must be 3 MB or smaller.' });

    const doc = await PTourSummary.create({
      tourName: body.tourName || '',
      dayNo: Math.max(1, Number(body.dayNo) || 1),
      startDate: body.startDate,
      customerName: body.customerName,
      branch: body.branch || '',
      model: body.model || '',
      unitStatus: body.unitStatus || '',
      unitSlNo: body.unitSlNo || '',
      problemReported: body.problemReported || '',
      problemObserved: body.problemObserved || '',
      actionTaken: body.actionTaken || '',
      images,
      createdBy: req.user?.name || req.user?.email || '',
      createdById: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptours]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PTourSummary.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Tour summary not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
