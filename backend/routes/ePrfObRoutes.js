const express  = require('express');
const router   = express.Router();
const EPrfOb   = require('../models/EPrfOb');
const ScPrfOb  = require('../models/ScPrfOb');
const Ecr      = require('../models/Ecr');
const { protect } = require('../middleware/authMiddleware');

function isAdminUser(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}

function getUserDivisions(user) {
  const values = user?.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user?.divisions) && user.divisions.length ? [...user.divisions] : [user?.division]);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function getWriteDivision(req) {
  return String(req.user?.activeDivision || req.user?.division || req.body.division || '').trim();
}

function canAccessDivision(user, division) {
  const target = String(division || '').trim().toLowerCase();
  return Boolean(target) && getUserDivisions(user).some(value => value.toLowerCase() === target);
}

// GET /api/emp/eprfob
router.get('/', protect, async (req, res) => {
  try {
    const { type, status, division, eng, from, to } = req.query;
    const filter = {};
    if (type)     filter.type     = type;
    if (status)   filter.status   = status;
    if (isAdminUser(req.user)) {
      if (division) filter.division = division;
    } else {
      const divisions = getUserDivisions(req.user);
      if (!divisions.length) return res.json([]);
      filter.division = { $in: divisions };
    }
    if (eng)      filter.eng      = eng;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }
    const docs = await EPrfOb.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/eprfob]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/emp/eprfob
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (!isAdminUser(req.user)) body.division = getWriteDivision(req);
    const doc = new EPrfOb({
      ...body,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/eprfob]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/emp/eprfob/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await EPrfOb.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const body = { ...req.body };
    if (!isAdminUser(req.user)) delete body.division;

    const update = {
      ...body,
      updatedAt: new Date(),
      status: 'Closed',
      executedDate: body.executedDate || existing.executedDate || new Date().toISOString().slice(0, 10),
    };

    const doc = await EPrfOb.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    if (doc.sourceScPrfObId) {
      await ScPrfOb.findByIdAndUpdate(
        doc.sourceScPrfObId,
        {
          scEng: doc.scEng || '',
          crmRefNo: doc.crmRefNo || '',
          remarks: doc.remarks || '',
          status: 'Closed',
          executedDate: doc.executedDate || '',
          updatedAt: new Date(),
        },
        { runValidators: false }
      );
    }

    await Ecr.findOneAndUpdate(
      { sourceEPrfObId: doc._id },
      {
        entryDate: doc.entryDate,
        type: doc.type,
        division: doc.division,
        dealer: doc.dealer || '',
        refNo: doc.refNo,
        raisedDate: doc.raisedDate || '',
        receivedDate: doc.receivedDate || '',
        executedDate: doc.executedDate || '',
        status: 'Closed',
        warrantyStatus: doc.warrantyStatus || '',
        scEng: doc.scEng || '',
        eng: doc.eng || '',
        region: doc.region || '',
        branch: doc.branch,
        supplier: doc.supplier || '',
        crmRefNo: doc.crmRefNo || '',
        sparesReceivedAtSvc: doc.sparesReceivedAtSvc || '',
        partType: doc.partType || '',
        partsDescription: doc.partsDescription || '',
        model: doc.model,
        serialNo: doc.serialNo || '',
        partNo: doc.partNo || '',
        qty: doc.qty || 1,
        unitPrice: doc.unitPrice || 0,
        totalAmount: doc.totalAmount || 0,
        remarks: doc.remarks || '',
        sourceEPrfObId: doc._id,
        createdBy: doc.createdBy || req.user._id,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/eprfob/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/emp/eprfob/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await EPrfOb.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await EPrfOb.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/eprfob/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
