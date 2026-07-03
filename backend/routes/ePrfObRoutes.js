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

function buildScPrfObMatchFromEmployee(doc = {}) {
  const matches = [];
  if (doc.sourceScPrfObId) matches.push({ _id: doc.sourceScPrfObId });
  if (doc.refNo) {
    matches.push({
      division: doc.division || 'OTHER',
      type: doc.type || 'TO',
      refNo: doc.refNo || '',
      branch: doc.branch || '',
      model: doc.model || '',
    });
  }
  return matches.length ? { $or: matches } : null;
}
async function hydrateSparesReceivedFromSc(rows = []) {
  return Promise.all(rows.map(async (row) => {
    if (row.sparesReceivedAtSvc) return row;
    const sourceQuery = row.sourceScPrfObId ? { _id: row.sourceScPrfObId } : null;
    const naturalQuery = row.refNo ? {
      division: row.division || 'OTHER',
      type: row.type || 'TO',
      refNo: row.refNo || '',
      branch: row.branch || '',
      model: row.model || '',
    } : null;
    const query = sourceQuery && naturalQuery ? { $or: [sourceQuery, naturalQuery] } : (sourceQuery || naturalQuery);
    if (!query) return row;
    const source = await ScPrfOb.findOne(query).select('_id sparesReceivedAtSvc').lean();
    if (!source?.sparesReceivedAtSvc) return row;
    row.sparesReceivedAtSvc = source.sparesReceivedAtSvc;
    if (!row.sourceScPrfObId && source._id) row.sourceScPrfObId = source._id;
    await EPrfOb.updateOne(
      { _id: row._id },
      { $set: { sparesReceivedAtSvc: row.sparesReceivedAtSvc, sourceScPrfObId: row.sourceScPrfObId, updatedAt: new Date() } },
      { runValidators: false }
    );
    return row;
  }));
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
    res.json(await hydrateSparesReceivedFromSc(docs));
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
      updatedAt: new Date()
    };

    const doc = await EPrfOb.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/eprfob/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/emp/eprfob/:id/moveToEcr
router.post('/:id/moveToEcr', protect, async (req, res) => {
  try {
    const existing = await EPrfOb.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (!isAdminUser(req.user) && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!existing.sparesReceivedAtSvc) {
      return res.status(400).json({ message: 'Spares Received Date is required before moving to ECR' });
    }

    const update = {
      status: 'Closed',
      executedDate: existing.executedDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date()
    };

    const doc = await EPrfOb.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    const scMatch = buildScPrfObMatchFromEmployee(doc);
    if (scMatch) {
      await ScPrfOb.updateMany(
        scMatch,
        {
          status: 'Closed',
          executedDate: doc.executedDate || '',
          sparesReceivedAtSvc: doc.sparesReceivedAtSvc || '',
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
    console.error('[POST /api/emp/eprfob/:id/moveToEcr]', err);
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
