// routes/frnRoutes.js
const router  = require('express').Router();
const FRN     = require('../models/FRN');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Recompute pdays helper
function computePdays(doc) {
  return Math.floor((Date.now() - new Date(doc.createdAt).getTime()) / 86400000);
}

// GET all pending FRNs — sorted by pdays desc (most overdue first)
router.get('/', protect, async (req, res) => {
  try {
    const docs = await FRN.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .lean();
    // Attach live pdays (not stored stale value)
    const result = docs.map(d => ({
      ...d,
      pdays: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST create FRN (called automatically from service-list when OW/LAMC saved)
router.post('/', protect, async (req, res) => {
  try {
    const {
      serviceId, entryDate, scRno, scEng, frnNo,
      region, eng, customer, model, unitStatus,
      defMod, defGir, remarks, typeWork,
    } = req.body;

    if (!serviceId || !scRno || !frnNo || !unitStatus) {
      return res.status(400).json({ message: 'serviceId, scRno, frnNo and unitStatus are required.' });
    }

    if (!['OW', 'LAMC', 'CAMC', 'EW', 'STOCK'].includes(unitStatus)) {
      return res.status(400).json({ message: `Invalid unitStatus: ${unitStatus}` });
    }

    // Prevent duplicate FRN for same service record
    const exists = await FRN.findOne({ serviceId });
    if (exists) {
      return res.status(409).json({ message: 'FRN already exists for this service record.', frn: exists });
    }

    const frn = await FRN.create({
      serviceId, entryDate, scRno, scEng, frnNo,
      region, eng, customer, model, unitStatus,
      defMod: defMod || '', defGir: defGir || '',
      remarks: remarks || '', typeWork: typeWork || 'UNDER REPAIR',
      pdays: 0,
    });

    res.status(201).json(frn);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT approve FRN
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const frn = await FRN.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!frn) return res.status(404).json({ message: 'FRN not found.' });
    res.json(frn);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT escalate FRN
router.put('/:id/escalate', protect, adminOnly, async (req, res) => {
  try {
    const frn = await FRN.findByIdAndUpdate(
      req.params.id,
      { status: 'escalated' },
      { new: true }
    );
    if (!frn) return res.status(404).json({ message: 'FRN not found.' });
    res.json(frn);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE FRN (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const frn = await FRN.findByIdAndDelete(req.params.id);
    if (!frn) return res.status(404).json({ message: 'FRN not found.' });
    res.json({ message: 'FRN deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;