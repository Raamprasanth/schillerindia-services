const express      = require('express');
const router       = express.Router();
const EmpSaleable  = require('../models/EmpSaleable');
const { protect }  = require('../middleware/authMiddleware');

// ── GET /api/emp/saleables
router.get('/', protect, async (req, res) => {
  try {
    const { division, status, unitDetails, engineer, from, to } = req.query;
    const filter = {};

    const role = String(req.user.role || '').toLowerCase();
    const userDivs = [
      req.user.activeDivision,
      req.user.division,
      ...(Array.isArray(req.user.divisions) ? req.user.divisions : []),
      ...(Array.isArray(req.user.assignedDivisions) ? req.user.assignedDivisions : [])
    ].map(v => String(v || '').trim()).filter(Boolean);

    if (role !== 'superadmin' && userDivs.length > 0) {
      const regexes = [...new Set(userDivs)].map(d => new RegExp('^' + d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'));
      filter.division = { $in: regexes };
    } else if (division) {
      filter.division = { $regex: new RegExp('^' + division.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    }

    if (status)      filter.status      = status;
    if (unitDetails) filter.unitDetails = unitDetails;
    if (engineer)    filter.engineer    = engineer;

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const docs = await EmpSaleable.find(filter).sort({ entryDate: -1, fqcInDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/saleables]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/emp/saleables/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await EmpSaleable.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/emp/saleables/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/emp/saleables
router.post('/', protect, async (req, res) => {
  try {
    const doc = new EmpSaleable({
      ...req.body,
      entryDate: req.body.entryDate || new Date().toISOString().split('T')[0],
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/saleables]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/emp/saleables/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await EmpSaleable.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/saleables/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/emp/saleables/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await EmpSaleable.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/saleables/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
