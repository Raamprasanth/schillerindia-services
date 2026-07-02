const express = require('express');
const Sr = require('../models/Sr');
const Csr = require('../models/Csr');
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

    const docs = await Sr.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    const srIds = docs.map(d => d._id);
    
    const [scsrs, scCsrs] = await Promise.all([
      ScSr.find({ srRef: { $in: srIds } }, 'srRef toNo toRaisedDate').lean(),
      ScCsr.find({ srRef: { $in: srIds } }, 'srRef toNo toRaisedDate').lean()
    ]);
    
    const combined = [...scsrs, ...scCsrs];
    const scsrMap = combined.reduce((acc, scsr) => {
      acc[scsr.srRef.toString()] = scsr;
      return acc;
    }, {});
    const finalDocs = docs.map(d => {
      const related = scsrMap[d._id.toString()];
      if (related) {
        d.toNo = related.toNo;
        d.toRaisedDate = related.toRaisedDate;
      }
      return d;
    });
    res.json(finalDocs);
  } catch (err) {
    console.error('[GET /api/sr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, division, partNo, description, qty, girNo, fromLocation, toLocation, remarks } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await Sr.create({
      date,
      division,
      partNo,
      description,
      qty: Number(qty) || 0,
      girNo,
      fromLocation,
      toLocation,
      remarks,
      createdBy: req.user?.name || req.user?.email || '',
    });

    // Also create ScSr immediately as requested
    await ScSr.create({
      srRef: doc._id,
      date,
      division,
      partNo,
      description,
      qty: Number(qty) || 0,
      girNo,
      fromLocation,
      toLocation,
      remarks,
      createdBy: req.user?.name || req.user?.email || '',
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/sr]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['date', 'division', 'partNo', 'description', 'qty', 'girNo', 'fromLocation', 'toLocation', 'remarks'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedBy = req.user?.name || req.user?.email || '';

    const doc = await Sr.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });

    // Sync updates to ScSr
    await ScSr.findOneAndUpdate({ srRef: req.params.id }, updates);

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/sr/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Sr.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });

    // Remove from ScSr as well
    await ScSr.findOneAndDelete({ srRef: req.params.id });

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/sr/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const doc = await Sr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'SR item not found.' });
    
    // Find related ScSr or ScCsr to get toNo and toRaisedDate
    let related = await ScCsr.findOne({ srRef: doc._id }).lean();
    if (!related) {
      related = await ScSr.findOne({ srRef: doc._id }).lean();
    }

    // Create CSR
    const csrDoc = await Csr.create({
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
      toNo: related?.toNo || '',
      toRaisedDate: related?.toRaisedDate || null,
      sparesReceivedDate: related?.sparesReceivedDate || null,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      closedBy: req.user?.name || req.user?.email || '',
    });
    
    // Delete from Sr
    await Sr.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, csrItem: csrDoc });
  } catch (err) {
    console.error('[POST /api/sr/:id/close]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
