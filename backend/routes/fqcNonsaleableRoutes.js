const express        = require('express');
const router         = express.Router();
const FqcNonsaleable = require('../models/FqcNonsaleable');
const { protect }    = require('../middleware/authMiddleware');

// ── GET /api/fqc/nonsaleable
router.get('/', protect, async (req, res) => {
  try {
    const { division, status, unitDetails, engineer, from, to } = req.query;
    const filter = {};

    const role = String(req.user.role || '').toLowerCase();
    const isPrivileged = ['admin', 'superadmin', 'fqc', 'repair_team'].includes(role);

    const userDivs = [
      req.user.activeDivision,
      req.user.division,
      ...(Array.isArray(req.user.divisions) ? req.user.divisions : []),
      ...(Array.isArray(req.user.assignedDivisions) ? req.user.assignedDivisions : [])
    ].map(v => String(v || '').trim()).filter(Boolean);

    if (!isPrivileged && userDivs.length > 0) {
      const regexes = [...new Set(userDivs)].map(d => new RegExp('^' + d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'));
      filter.division = { $in: regexes };
    } else if (division) {
      filter.division = { $regex: new RegExp('^' + division.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    }
    if (status)      filter.status      = status;
    if (unitDetails) filter.unitDetails = unitDetails;
    if (engineer)    filter.engineer    = engineer;

    // Date-range filter on fqcInDate
    if (from || to) {
      filter.fqcInDate = {};
      if (from) filter.fqcInDate.$gte = from;
      if (to)   filter.fqcInDate.$lte = to;
    }

    const docs = await FqcNonsaleable.find(filter).sort({ fqcInDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/fqc/nonsaleable]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/fqc/nonsaleable/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await FqcNonsaleable.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/fqc/nonsaleable/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/fqc/nonsaleable
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.status === 'Completed') {
      body.status = 'Closed';
    }
    const doc = new FqcNonsaleable({
      ...body,
      entryDate: body.entryDate || new Date().toISOString().split('T')[0],
      createdBy: req.user._id,
    });
    const saved = await doc.save();

    // If marked as Closed/Completed during creation, move to fs page (FqcNonSaleableFs)
    if (saved.status === 'Closed') {
      const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
      
      const newFsDoc = new FqcNonSaleableFs({
        division: saved.division,
        unitDetails: saved.unitDetails,
        model: saved.model,
        modelSn: saved.modelSn,
        unitConfig: saved.unitConfig || '',
        replacedSn: saved.replacedSn || '',
        
        entryDate: saved.entryDate || '',
        fqcInwardDate: saved.fqcInDate || '',
        scInwardDate: saved.scInDate || '',
        defRecvDate: saved.defRecvDate || '',
        tentativeDate: saved.tentDate || '',
        repShipDate: saved.repShipDate || '',
        shipDateFqc: saved.shipFqcDate || '',

        region: saved.region || '',
        branch: saved.branch || '',
        engineer: saved.engineer || '',
        scEngineer: saved.scEngineer || '',
        dealer: saved.dealer || '',
        supplier: saved.supplier || '',
        customer: saved.customer || '',

        reportedProblem: saved.reportedProblem || '',
        fqcRemarks: saved.fqcObservation || 'Moved from FNS',
        scObservation: saved.scObservation || '',
        rootCause: saved.rootCause || '',
        reqParts: saved.reqParts || '',
        actionPlan: saved.actionPlan || '',
        finalRemarks: saved.finalRemarks || '',

        finalStatus: 'pending',
        createdBy: req.user._id
      });
      
      await newFsDoc.save();
      await FqcNonsaleable.findByIdAndDelete(saved._id);
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/fqc/nonsaleable]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/fqc/nonsaleable/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.status === 'Completed') {
      updateData.status = 'Closed';
    }

    const doc = await FqcNonsaleable.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    // If marked as Closed/Completed, move to fs page (FqcNonSaleableFs)
    if (doc.status === 'Closed') {
      const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
      
      const newFsDoc = new FqcNonSaleableFs({
        division: doc.division,
        unitDetails: doc.unitDetails,
        model: doc.model,
        modelSn: doc.modelSn,
        unitConfig: doc.unitConfig || '',
        replacedSn: doc.replacedSn || '',
        
        entryDate: doc.entryDate || '',
        fqcInwardDate: doc.fqcInDate || '',
        scInwardDate: doc.scInDate || '',
        defRecvDate: doc.defRecvDate || '',
        tentativeDate: doc.tentDate || '',
        repShipDate: doc.repShipDate || '',
        shipDateFqc: doc.shipFqcDate || '',

        region: doc.region || '',
        branch: doc.branch || '',
        engineer: doc.engineer || '',
        scEngineer: doc.scEngineer || '',
        dealer: doc.dealer || '',
        supplier: doc.supplier || '',
        customer: doc.customer || '',

        reportedProblem: doc.reportedProblem || '',
        fqcRemarks: doc.fqcObservation || 'Moved from FNS',
        scObservation: doc.scObservation || '',
        rootCause: doc.rootCause || '',
        reqParts: doc.reqParts || '',
        actionPlan: doc.actionPlan || '',
        finalRemarks: doc.finalRemarks || '',

        finalStatus: 'pending',
        createdBy: req.user._id
      });
      
      await newFsDoc.save();
      await FqcNonsaleable.findByIdAndDelete(doc._id);
    }

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/fqc/nonsaleable/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/fqc/nonsaleable/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await FqcNonsaleable.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/fqc/nonsaleable/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
