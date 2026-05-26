const express  = require('express');
const router   = express.Router();
const Eclose   = require('../models/Eclose');
const { protect } = require('../middleware/authMiddleware');

function normalizeDivision(value) {
  const v = String(value || '').trim();
  const key = v.toLowerCase();
  const map = {
    'schiller ag': 'SAG',
    'sag': 'SAG',
    'patient monitors': 'PATIENT MONITORS',
    'patient monitor': 'PATIENT MONITORS',
    'monitors': 'PATIENT MONITORS',
    'anaesthesia': 'ANAESTHESIA',
    'anesthesia': 'ANAESTHESIA',
  };
  return map[key] || v;
}

function getUserDivisions(user) {
  const values = user?.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user?.divisions) && user.divisions.length ? [...user.divisions] : [user?.division]);
  return [...new Set(values.map(normalizeDivision).filter(Boolean))];
}

function canAccessDivision(user, division) {
  const allowed = getUserDivisions(user);
  if (!allowed.length) return false;
  return allowed.some(value => value.toLowerCase() === normalizeDivision(division).toLowerCase());
}

// ── GET /api/emp/calls/closed  (admin: all closed-call records)
router.get('/', protect, async (req, res) => {
  try {
    const { division, typeCall, status, scEngg, engineer, customer, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;
    if (typeCall)  filter.typeCall  = typeCall;
    if (status)    filter.status    = status;
    if (scEngg)    filter.scEngg    = scEngg;
    if (engineer)  filter.engineer  = engineer;
    if (customer)  filter.customer  = customer;

    // Date range filter on callDate
    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to)   filter.callDate.$lte = to;
    }

    const docs = await Eclose.find(filter).sort({ closeDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/calls/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/emp/calls/closed/employee  (employee: own division + scEngg records)
router.get('/employee', protect, async (req, res) => {
  try {
    const filter = {};
    const divisions = getUserDivisions(req.user);
    if (divisions.length) filter.division = { $in: divisions };
    else return res.json([]);

    const docs = await Eclose.find(filter).sort({ closeDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/calls/closed/employee]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/emp/calls/closed/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Eclose.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, doc.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/emp/calls/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/emp/calls/closed
router.post('/', protect, async (req, res) => {
  try {
    const division =
      (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin')
        ? String(req.user.activeDivision || req.user.division || req.body.division || '').trim()
        : (req.body.division || '');
    const doc = new Eclose({
      ...req.body,
      entryDate: req.body.callDate || req.body.entryDate || '',
      division,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/calls/closed]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/emp/calls/closed/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await Eclose.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const division =
      (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin')
        ? String(req.user.activeDivision || req.user.division || existing.division || '').trim()
        : (req.body.division || existing.division || '');
    const doc = await Eclose.findByIdAndUpdate(
      req.params.id,
      { ...req.body, division },
      { new: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/calls/closed/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/emp/calls/closed/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Eclose.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/calls/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
