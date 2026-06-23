const express = require('express');
const AdminSR = require('../models/AdminSR');
const SR = require('../models/Sr');
const Scsr = require('../models/ScSr');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', adminOnly, async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (division) filter.division = division;

    // Synchronize missing items from SR to AdminSR
    const existingSRs = await SR.find().lean();
    for (const sr of existingSRs) {
      const exists = await AdminSR.exists({ srId: sr._id });
      if (!exists) {
        await AdminSR.create({
          date: sr.date,
          division: sr.division,
          partNo: sr.partNo,
          description: sr.description,
          qty: sr.qty,
          girNo: sr.girNo,
          fromLocation: sr.fromLocation,
          toLocation: sr.toLocation,
          remarks: sr.remarks,
          srId: sr._id,
          createdBy: sr.createdBy || 'System',
          createdAt: sr.createdAt,
          updatedAt: sr.updatedAt
        });
      }
    }

    const docs = await AdminSR.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/asr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { date, division, partNo, description, qty, girNo, fromLocation, toLocation, remarks, srId } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await AdminSR.create({
      date,
      division,
      partNo,
      description,
      qty,
      girNo,
      fromLocation,
      toLocation,
      remarks,
      srId: srId || '',
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/asr]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const doc = await AdminSR.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Admin SR item not found.' });

    // Synchronize deletion across sr and scsr (SR and Scsr models)
    if (doc.srId) {
      await SR.findByIdAndDelete(doc.srId).catch(e => console.error('Failed to delete associated SR:', e));
      await Scsr.findOneAndDelete({ srRef: doc.srId }).catch(e => console.error('Failed to delete associated SCSR:', e));
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/asr/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
