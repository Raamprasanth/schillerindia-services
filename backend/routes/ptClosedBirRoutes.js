const express = require('express');
const router = express.Router();
const PtClosedBir = require('../models/PtClosedBir');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const { division, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;

    if (from || to) {
      filter.unitInwardDate = {};
      if (from) filter.unitInwardDate.$gte = from;
      if (to) filter.unitInwardDate.$lte = to;
    }

    const docs = await PtClosedBir.find(filter)
      .sort({ approvedDate: -1, unitInwardDate: -1 })
      .lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/bir/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClosedBir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const doc = new PtClosedBir({
      ...req.body,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/pt/bir/closed]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClosedBir.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/pt/bir/closed/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClosedBir.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    const ref = doc.birRef || doc.birRefNo;
    if (ref) {
      const filter = { $or: [{ birRef: ref }, { birRefNo: ref }] };
      await Promise.allSettled([
        require('../models/Bir').deleteMany(filter),
        require('../models/ClosedBir').deleteMany(filter),
        require('../models/EBir').deleteMany(filter),
        require('../models/EClosedBir').deleteMany(filter),
        require('../models/PtBir').deleteMany(filter),
        require('../models/ABir').deleteMany(filter),
        require('../models/AClosedBir').deleteMany(filter),
      ]);
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
