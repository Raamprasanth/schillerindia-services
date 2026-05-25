const express     = require('express');
const router      = express.Router();
const PtActivity  = require('../models/PtActivity');
const { protect } = require('../middleware/authMiddleware');

const PENDING_STATUSES = ['Pending', 'Open'];
const CLOSED_STATUSES  = ['Closed', 'Completed', 'Cancelled'];

// ── GET /api/pt/activity/pending  (must be BEFORE /:id)
router.get('/pending', protect, async (req, res) => {
  try {
    const { division, from, to } = req.query;
    const filter = { status: { $in: PENDING_STATUSES } };

    if (division) filter.division = division;

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const docs = await PtActivity.find(filter).sort({ entryDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/activity/pending]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/activity/closed  (must be BEFORE /:id)
router.get('/closed', protect, async (req, res) => {
  try {
    const { division, from, to } = req.query;
    const filter = { status: { $in: CLOSED_STATUSES } };

    if (division) filter.division = division;

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const docs = await PtActivity.find(filter).sort({ entryDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/activity/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/activity  (all records)
router.get('/', protect, async (req, res) => {
  try {
    const { division, status, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;
    if (status)   filter.status   = status;

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const docs = await PtActivity.find(filter).sort({ entryDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/activity]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/activity/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtActivity.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/activity/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/pt/activity
router.post('/', protect, async (req, res) => {
  try {
    const doc = new PtActivity({ ...req.body, createdBy: req.user._id });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/pt/activity]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/pt/activity/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await PtActivity.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/pt/activity/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/pt/activity/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtActivity.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/activity/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
