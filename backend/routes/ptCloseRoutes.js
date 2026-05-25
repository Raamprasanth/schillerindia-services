const express = require('express');
const router = express.Router();
const PtClose = require('../models/PtClose');
const { protect } = require('../middleware/authMiddleware');

function getUserDivisions(user) {
  const values = Array.isArray(user?.divisions) ? [...user.divisions] : [];
  if (user?.division) values.push(user.division);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

router.get('/', protect, async (req, res) => {
  try {
    const { division, typeCall, status, scEngg, engineer, customer, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;
    if (typeCall) filter.typeCall = typeCall;
    if (status) filter.status = status;
    if (scEngg) filter.scEngg = scEngg;
    if (engineer) filter.engineer = engineer;
    if (customer) filter.customer = customer;

    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to) filter.callDate.$lte = to;
    }

    const docs = await PtClose.find(filter).sort({ closeDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/closed-calls]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/employee', protect, async (req, res) => {
  try {
    const filter = {};

    const divisions = getUserDivisions(req.user);
    if (divisions.length) filter.division = { $in: divisions };

    const docs = await PtClose.find(filter).sort({ closeDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/closed-calls/employee]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClose.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/closed-calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const doc = new PtClose({
      ...req.body,
      entryDate: req.body.callDate || req.body.entryDate || '',
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/pt/closed-calls]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClose.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/pt/closed-calls/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtClose.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/closed-calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
