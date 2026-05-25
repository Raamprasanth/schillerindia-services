const express          = require('express');
const router           = express.Router();
const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
const { protect }      = require('../middleware/authMiddleware');

function normalizeFinalStatus(value) {
  const v = String(value || '').trim();
  const map = {
    Pending: 'pending',
    Hold: 'hold',
    'On Hold': 'hold',
    Review: 'review',
    'Under Review': 'review',
    Shipped: 'shipped',
    'Shipped to FQC': 'shipped',
  };
  return map[v] || v.toLowerCase();
}

// ── GET /api/fqc/non-saleable
router.get('/', protect, async (req, res) => {
  try {
    const { division, finalStatus, from, to } = req.query;
    const filter = {};

    if (division)    filter.division    = division;
    if (finalStatus) filter.finalStatus = normalizeFinalStatus(finalStatus);

    // Date-range filter on entryDate
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const docs = await FqcNonSaleableFs.find(filter).sort({ entryDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/fqc/non-saleable]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/fqc/non-saleable/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await FqcNonSaleableFs.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/fqc/non-saleable/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/fqc/non-saleable
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.finalStatus) body.finalStatus = normalizeFinalStatus(body.finalStatus);
    const doc = new FqcNonSaleableFs({
      ...body,
      entryDate: body.entryDate || new Date().toISOString().split('T')[0],
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/fqc/non-saleable]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/fqc/non-saleable/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.finalStatus) body.finalStatus = normalizeFinalStatus(body.finalStatus);
    const doc = await FqcNonSaleableFs.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/fqc/non-saleable/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/fqc/non-saleable/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await FqcNonSaleableFs.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/fqc/non-saleable/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
