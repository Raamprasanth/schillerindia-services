const express = require('express');
const LoanItem = require('../models/LoanItem');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUseLoanItems(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['service_coordinator', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUseLoanItems(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access loan items.' });
  }
  next();
});

router.get('/', async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (division) filter.division = division;

    const docs = await LoanItem.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/loan-items]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, division, partNo, description, girNo } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await LoanItem.create({
      date,
      division,
      partNo,
      description,
      girNo,
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/loan-items]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['date', 'division', 'partNo', 'description', 'girNo'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedBy = req.user?.name || req.user?.email || '';

    const doc = await LoanItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'Loan item not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/loan-items/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await LoanItem.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Loan item not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/loan-items/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
