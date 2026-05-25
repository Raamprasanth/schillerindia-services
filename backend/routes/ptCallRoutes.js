const express  = require('express');
const router   = express.Router();
const PtCall   = require('../models/PtCall');
const { protect } = require('../middleware/authMiddleware');

const OPEN_STATUSES   = ['Open', 'Active', 'Pending', 'Escalated'];
const CLOSED_STATUSES = ['Closed', 'Completed'];

// ── GET /api/pt/calls  (open / active records)
router.get('/', protect, async (req, res) => {
  try {
    const { division, status, from, to } = req.query;
    const filter = { status: { $in: OPEN_STATUSES } };

    if (division) filter.division = division;
    if (status && OPEN_STATUSES.includes(status)) filter.status = status;

    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to)   filter.callDate.$lte = to;
    }

    const docs = await PtCall.find(filter).sort({ callDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/calls]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/calls/closed  (must be BEFORE /:id)
router.get('/closed', protect, async (req, res) => {
  try {
    const { division, from, to } = req.query;
    const filter = { status: { $in: CLOSED_STATUSES } };

    if (division) filter.division = division;

    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to)   filter.callDate.$lte = to;
    }

    const docs = await PtCall.find(filter).sort({ callDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/calls/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/calls/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtCall.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/pt/calls
router.post('/', protect, async (req, res) => {
  try {
    const doc = new PtCall({ ...req.body, createdBy: req.user._id });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/pt/calls]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/pt/calls/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await PtCall.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/pt/calls/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/pt/calls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtCall.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
