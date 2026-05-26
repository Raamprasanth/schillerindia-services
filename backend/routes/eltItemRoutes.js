const express = require('express');
const EltItem = require('../models/EltItem');
const ClosedLoan = require('../models/ClosedLoan');
const LoanItem = require('../models/LoanItem');
const EmpClosedLoan = require('../models/EmpClosedLoan');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUseEltItems(user) {
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
  if (!canUseEltItems(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access ELT items.' });
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

    const docs = await EltItem.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/elt-items]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, division, partNo, description, revalue, girNo, opt, remarks } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await EltItem.create({
      date,
      division,
      partNo,
      description,
      revalue,
      girNo,
      opt,
      remarks,
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/elt-items]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['date', 'division', 'partNo', 'description', 'revalue', 'girNo', 'opt', 'remarks'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedBy = req.user?.name || req.user?.email || '';

    const doc = await EltItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'ELT item not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/elt-items/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await EltItem.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'ELT item not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/elt-items/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/to-scod', async (req, res) => {
  try {
    const doc = await EltItem.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'ELT item not found.' });
    
    // Create new ClosedLoan
    const loanDoc = await LoanItem.create({
      date: doc.date,
      division: doc.division,
      partNo: doc.partNo,
      description: doc.description,
      girNo: doc.girNo,
      opt: req.body.opt || doc.opt,
      remarks: req.body.remarks || doc.remarks,
      revalue: req.body.revalue || doc.revalue,
      createdBy: doc.createdBy,
      updatedBy: req.user?.name || req.user?.email || '',
    });
    
    await EmpClosedLoan.create({
      date: doc.date,
      division: doc.division,
      partNo: doc.partNo,
      description: doc.description,
      girNo: doc.girNo,
      opt: req.body.opt || doc.opt,
      remarks: req.body.remarks || doc.remarks,
      revalue: req.body.revalue || doc.revalue,
      createdBy: doc.createdBy,
      updatedBy: req.user?.name || req.user?.email || '',
    });
    
    // Delete from EltItem
    await EltItem.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, loanItem: loanDoc });
  } catch (err) {
    console.error('[POST /api/elt-items/:id/to-scod]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
