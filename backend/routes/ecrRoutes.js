const express = require('express');
const router  = express.Router();
const Ecr     = require('../models/Ecr');
const EPrfOb  = require('../models/EPrfOb');
const { protect } = require('../middleware/authMiddleware');

// GET /api/ecr
router.get('/', protect, async (req, res) => {
  try {
    const { type, status, division, scEng, eng, warrantyStatus, from, to } = req.query;
    const filter = {};
    if (type)           filter.type           = type;
    if (status)         filter.status         = status;
    if (division)       filter.division       = division;
    if (scEng)          filter.scEng          = scEng;
    if (eng)            filter.eng            = eng;
    if (warrantyStatus) filter.warrantyStatus = warrantyStatus;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }
    const [docs, fallbackClosed] = await Promise.all([
      Ecr.find(filter).sort({ createdAt: -1 }).lean(),
      EPrfOb.find({
        status: { $in: ['Closed', 'Completed'] },
        ...(type ? { type } : {}),
        ...(division ? { division } : {}),
        ...(eng ? { eng } : {}),
        ...(from || to ? {
          entryDate: {
            ...(from ? { $gte: from } : {}),
            ...(to ? { $lte: to } : {})
          }
        } : {})
      }).sort({ updatedAt: -1, createdAt: -1 }).lean()
    ]);

    const existingSourceIds = new Set(
      docs.map(d => String(d.sourceEPrfObId || '')).filter(Boolean)
    );

    const mappedFallback = fallbackClosed
      .filter(d => !existingSourceIds.has(String(d._id)))
      .map(d => ({
        _id: `fallback_${d._id}`,
        sourceEPrfObId: d._id,
        entryDate: d.entryDate,
        type: d.type,
        division: d.division,
        dealer: d.dealer || '',
        refNo: d.refNo,
        raisedDate: d.raisedDate || '',
        receivedDate: d.receivedDate || '',
        executedDate: d.executedDate || '',
        status: d.status || 'Closed',
        warrantyStatus: d.warrantyStatus || '',
        scEng: d.scEng || '',
        eng: d.eng || '',
        region: d.region || '',
        branch: d.branch || '',
        supplier: d.supplier || '',
        crmRefNo: d.crmRefNo || '',
        sparesReceivedAtSvc: d.sparesReceivedAtSvc || '',
        partType: d.partType || '',
        partsDescription: d.partsDescription || '',
        model: d.model || '',
        serialNo: d.serialNo || '',
        partNo: d.partNo || '',
        qty: d.qty || 1,
        unitPrice: d.unitPrice || 0,
        totalAmount: d.totalAmount || 0,
        remarks: d.remarks || '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
      .filter(d =>
        (!status || d.status === status) &&
        (!scEng || d.scEng === scEng) &&
        (!warrantyStatus || d.warrantyStatus === warrantyStatus)
      );

    const merged = [...docs, ...mappedFallback].sort((a, b) => {
      const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    });

    res.json(merged);
  } catch (err) {
    console.error('[GET /api/ecr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/ecr
router.post('/', protect, async (req, res) => {
  try {
    const doc = new Ecr({
      ...req.body,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/ecr]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/ecr/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await Ecr.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ecr/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/ecr/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Ecr.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/ecr/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
