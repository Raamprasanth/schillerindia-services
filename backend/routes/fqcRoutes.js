const express = require('express');
const router  = express.Router();
const Fqc     = require('../models/Fqc');
const { protect } = require('../middleware/authMiddleware');

// GET /api/fqc
router.get('/', protect, async (req, res) => {
  try {
    const { result, division, engineer, type } = req.query;
    const filter = {};
    if (result)   filter.result   = result;
    if (division) filter.division = division;
    if (engineer) filter.engineer = engineer;
    if (type)     filter.type     = type;
    const docs = await Fqc.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/fqc]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/fqc
router.post('/', protect, async (req, res) => {
  try {
    const count = await Fqc.countDocuments();
    const fqcNo = 'FQC-' + String(count + 1).padStart(3, '0');
    const doc = new Fqc({
      ...req.body,
      fqcNo,
      date: req.body.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/fqc]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/fqc/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await Fqc.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/fqc/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/fqc/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Fqc.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/fqc/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
