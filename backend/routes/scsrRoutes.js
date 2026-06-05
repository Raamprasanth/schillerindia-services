const express = require('express');
const ScSr = require('../models/ScSr');
const ScCsr = require('../models/ScCsr');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUseSr(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['employee', 'field_engineer', 'service_coordinator', 'admin', 'superadmin', 'administrator'].includes(role);
}

function isPrivileged(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['service_coordinator', 'admin', 'superadmin', 'administrator'].includes(role);
}

function getUserDivisions(user) {
  const values = user?.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user?.divisions) && user.divisions.length ? [...user.divisions] : [user?.division]);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

router.use((req, res, next) => {
  if (!canUseSr(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access SR items.' });
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

    if (!isPrivileged(req.user)) {
      const userDivisions = getUserDivisions(req.user);
      if (!userDivisions.length) return res.json([]);
      if (division && !userDivisions.some(d => d.toLowerCase() === String(division).trim().toLowerCase())) {
        return res.json([]);
      }
      if (!division) filter.division = { $in: userDivisions };
    }

    const docs = await ScSr.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/scsr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, division, partNo, description, qty, girNo, fromLocation, toLocation, remarks, toNo, toRaisedDate, sparesReceivedDate } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await ScSr.create({
      date,
      division,
      partNo,
      description,
      qty: Number(qty) || 0,
      girNo,
      fromLocation,
      toLocation,
      toNo,
      toRaisedDate,
      sparesReceivedDate,
      remarks,
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/scsr]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['date', 'division', 'partNo', 'description', 'qty', 'girNo', 'fromLocation', 'toLocation', 'remarks', 'toNo', 'toRaisedDate', 'sparesReceivedDate'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedBy = req.user?.name || req.user?.email || '';

    const doc = await ScSr.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/scsr/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await ScSr.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/scsr/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const doc = await ScSr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });
    
    // Create CSR
    const csrDoc = await ScCsr.create({
      date: doc.date,
      closeDate: new Date().toISOString().split('T')[0],
      division: doc.division,
      partNo: doc.partNo,
      description: doc.description,
      qty: doc.qty,
      girNo: doc.girNo,
      fromLocation: doc.fromLocation,
      toLocation: doc.toLocation,
      remarks: doc.remarks,
      toNo: doc.toNo,
      toRaisedDate: doc.toRaisedDate,
      sparesReceivedDate: doc.sparesReceivedDate,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      closedBy: req.user?.name || req.user?.email || '',
    });
    
    // Delete from Sr
    await ScSr.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, csrItem: csrDoc });
  } catch (err) {
    console.error('[POST /api/scsr/:id/close]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
