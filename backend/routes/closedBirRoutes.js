const express   = require('express');
const router    = express.Router();
const ClosedBir = require('../models/ClosedBir');
const { protect } = require('../middleware/authMiddleware');

// ── GET /api/bir/closed  (all closed/approved BIR records)
router.get('/', protect, async (req, res) => {
  try {
    const { division, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;

    // Date-range filter on unitInwardDate
    if (from || to) {
      filter.unitInwardDate = {};
      if (from) filter.unitInwardDate.$gte = from;
      if (to)   filter.unitInwardDate.$lte = to;
    }

    const docs = await ClosedBir.find(filter)
      .sort({ approvedDate: -1, unitInwardDate: -1 })
      .lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/bir/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/bir/closed/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await ClosedBir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/bir/closed
router.post('/', protect, async (req, res) => {
  try {
    const doc = new ClosedBir({
      ...req.body,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/bir/closed]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/bir/closed/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await ClosedBir.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/bir/closed/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/bir/closed/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await ClosedBir.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
