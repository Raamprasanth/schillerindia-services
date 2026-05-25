const express   = require('express');
const router    = express.Router();
const Ecall     = require('../models/Ecall');
const Eclose    = require('../models/Eclose');
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

function isAdminUser(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin' || String(user?._collection || '') === 'Admin';
}

function getWriteDivision(req) {
  if (isAdminUser(req.user)) return normalizeDivision(req.body.division || req.user.division);
  return normalizeDivision(req.user?.activeDivision || req.user?.division || req.body.division);
}

function canAccessDivision(user, division) {
  const divisions = getUserDivisions(user);
  if (!divisions.length) return false;
  const target = normalizeDivision(division);
  return divisions.includes(target);
}

// ── GET /api/calls  (admin: all records)
router.get('/', protect, async (req, res) => {
  try {
    const { division, callType, status, commType, scEng, engineer, from, to } = req.query;
    const filter = {};

    if (division)  filter.division  = normalizeDivision(division);
    if (callType)  filter.callType  = callType;
    if (status)    filter.status    = status;
    if (commType)  filter.commType  = commType;
    if (scEng)     filter.scEng     = scEng;
    if (engineer)  filter.engineer  = engineer;

    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to)   filter.callDate.$lte = to;
    }

    const docs = await Ecall.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/calls]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/calls/employee  (employee: own division records)
router.get('/employee', protect, async (req, res) => {
  try {
    const filter = {};

    const divisions = getUserDivisions(req.user);
    if (divisions.length) {
      filter.division = { $in: divisions };
    }

    const docs = await Ecall.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/calls/employee]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/calls/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Ecall.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, doc.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/calls
router.post('/', protect, async (req, res) => {
  try {
    const doc = new Ecall({
      ...req.body,
      division: getWriteDivision(req),
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/calls]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/calls/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await Ecall.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const doc = await Ecall.findByIdAndUpdate(
      req.params.id,
      { ...req.body, division: getWriteDivision(req) },
      { new: true, runValidators: true }
    );

    if (String(req.body.status || '').trim() === 'Closed') {
      const today = new Date().toISOString().split('T')[0];
      await Eclose.create({
        callDate:  doc.callDate  || today,
        closeDate: today,
        division:  doc.division  || '',
        typeCall:  '',
        branch:    doc.branch    || '',
        region:    doc.region    || '',
        scEngg:    doc.scEng     || '',
        engineer:  doc.engineer  || '',
        customer:  doc.customer  || '',
        model:     doc.model     || '',
        girSno:    doc.girSno    || '',
        status:    'Closed',
        remarks:   doc.remarks   || '',
        createdBy: req.user._id,
      });
      await Ecall.findByIdAndDelete(req.params.id);
      return res.json({ ...doc.toObject(), closed: true });
    }

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/calls/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/calls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await Ecall.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const doc = await Ecall.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/calls/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
