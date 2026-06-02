const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();
const EBir    = require('../models/EBir');
const Bir     = require('../models/Bir');
const PtBir   = require('../models/PtBir');
const { protect } = require('../middleware/authMiddleware');

const SERVICE_UPDATE_FIELDS = [
  'scInwardDate', 'scObservation', 'requiredParts', 'rootCause',
  'scActionPlan', 'tentativeDate', 'shipDateToFqc',
  'hwChanges', 'hwChangeRemarks', 'accChangeRemarks', 'swChangeRemarks',
  'fqcFinalRemarks', 'defUnitReceivedDate', 'replacementShipDate',
  'fqcObservation', 'scEngineer', 'serviceManualUpdate', 'techRemarks',
];

function divisionFilter(value) {
  return String(value || '').trim();
}

function getUserDivisions(user) {
  const values = user?.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user?.divisions) && user.divisions.length ? [...user.divisions] : [user?.division]);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function divisionFilterForValues(values) {
  const filtered = [];
  values.forEach(value => {
    const normalized = divisionFilter(value);
    if (normalized && Array.isArray(normalized.$in)) filtered.push(...normalized.$in);
    else if (normalized) filtered.push(normalized);
  });
  return [...new Set(filtered)];
}

function canAccessDivision(user, division) {
  const divisions = divisionFilterForValues(getUserDivisions(user)).map(value => String(value || '').trim().toUpperCase());
  if (!divisions.length) return false;
  return divisions.includes(String(division || '').trim().toUpperCase());
}

function hasMeaningfulServiceUpdate(update) {
  return SERVICE_UPDATE_FIELDS.some(field => String(update[field] || '').trim());
}

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable. Please try again shortly.' });
  }
  next();
}

function buildMirrorUpdate(doc) {
  return {
    birRef: doc.birRefNo || '',
    division: doc.division || '',
    model: doc.model || '',
    configuration: doc.configuration || '',
    unitInwardDate: doc.inwardDate || '',
    fqcInwardDate: doc.fqcInwardDate || '',
    invoiceDate: doc.invoiceDate || '',
    approvedDate: doc.approvedDate || '',
    supplier: doc.supplier || '',
    invoiceNo: doc.invoiceNo || '',
    receivedQty: doc.receivedQty || '',
    serial: doc.serial || '',
    prevSwVersion: doc.prevSwVersion || '',
    presSwVersion: doc.presSwVersion || '',
    swChangeRemarks: doc.swChangeRemarks || '',
    hwChanges: doc.hwChanges || '',
    hwChangeRemarks: doc.hwChangeRemarks || '',
    accChanges: doc.accChanges || '',
    accDetails: doc.accessoryDetails || '',
    accChangeRemarks: doc.accChangeRemarks || '',
    userManualUpdate: doc.userManualUpdate || '',
    serviceManualUpdate: doc.serviceManualUpdate || '',
    scEngineer: doc.scEngineer || '',
    psEngineer: doc.psEngineer || '',
    fqcRemarks: doc.fqcRemarks || '',
    techRemarks: doc.techRemarks || '',
    scInwardDate: doc.scInwardDate || '',
    scObservation: doc.scObservation || '',
    requiredParts: doc.requiredParts || '',
    rootCause: doc.rootCause || '',
    scActionPlan: doc.scActionPlan || '',
    tentativeDate: doc.tentativeDate || '',
    shipDateToFqc: doc.shipDateToFqc || '',
    defUnitReceivedDate: doc.defUnitReceivedDate || '',
    replacementShipDate: doc.replacementShipDate || '',
    fqcObservation: doc.fqcObservation || '',
    fqcFinalRemarks: doc.fqcFinalRemarks || '',
    tsVerificationDate: doc.tsVerificationDate || '',
    psVerificationDate: doc.psVerificationDate || '',
    productTeamRemarks: doc.productTeamRemarks || '',
    cnrCirculation: doc.cnrCirculation || '',
    cnrRefNo: doc.cnrRefNo || '',
    cnrReleaseDate: doc.cnrReleaseDate || '',
    status: doc.finalStatus || 'Pending',
    finalStatus: doc.finalStatus || '',
    updatedBy: doc.updatedBy,
  };
}

function buildPtMirrorUpdate(doc) {
  return {
    ...buildMirrorUpdate(doc),
    status: 'PT Pending',
    finalStatus: 'PT Pending',
  };
}

async function upsertSinglePtMirror(birRef, mirror) {
  const existing = await PtBir.find({ birRef }).sort({ updatedAt: -1, createdAt: -1 });
  if (existing.length) {
    const keeper = existing[0];
    await PtBir.findByIdAndUpdate(keeper._id, { $set: mirror }, { new: true, runValidators: false });
    const duplicates = existing.slice(1).map(doc => doc._id);
    if (duplicates.length) await PtBir.deleteMany({ _id: { $in: duplicates } });
    return;
  }
  await PtBir.findOneAndUpdate(
    { birRef },
    { $set: mirror },
    { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
  );
}

async function syncMirrorsFromEBir(doc) {
  if (!doc?.birRefNo) return;
  const mirror = buildMirrorUpdate(doc);
  await Promise.all([
    Bir.findOneAndUpdate({ birRef: doc.birRefNo }, { $set: mirror }, { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }),
    upsertSinglePtMirror(doc.birRefNo, buildPtMirrorUpdate(doc)),
  ]);
}

// ── GET /api/emp/bir  (all records with optional filters)
router.get('/', requireDatabase, protect, async (req, res) => {
  try {
    const { division, status, hw, from, to } = req.query;
    const filter = {};

    // Enforce division based on logged-in user if they are an employee
    const userDivisions = getUserDivisions(req.user);
    if (req.user && req.user.role !== 'admin' && userDivisions.length) {
      filter.division = { $in: divisionFilterForValues(userDivisions) };
    } else if (division) {
      filter.division = divisionFilter(division);
    }

    if (status)   filter.finalStatus = status;
    if (hw)       filter.hwChanges  = hw;

    if (from || to) {
      filter.inwardDate = {};
      if (from) filter.inwardDate.$gte = from;
      if (to)   filter.inwardDate.$lte = to;
    }

    const docs = await EBir.find(filter).sort({ inwardDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/bir]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/emp/bir/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await EBir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, doc.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/emp/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/emp/bir
router.post('/', protect, async (req, res) => {
  try {
    const division =
      (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin')
        ? String(req.user.activeDivision || req.user.division || req.body.division || '').trim()
        : (req.body.division || '');
    const doc = new EBir({
      ...req.body,
      division,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/bir]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/emp/bir/:id  (employee updates SC/FQC fields)
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await EBir.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const canUpdate = ['Pending', 'TS Pending', 'In Progress', ''].includes(String(existing.finalStatus || '').trim());
    if (!canUpdate) {
      return res.status(409).json({ message: 'This BIR record has already been sent to Product Team and is view-only.' });
    }

    const allowed = [
      // SC / FQC fields
      'scInwardDate', 'scObservation', 'requiredParts', 'rootCause',
      'scActionPlan', 'tentativeDate', 'shipDateToFqc', 'cnrCirculation',
      'fqcFinalRemarks', 'finalStatus', 'defUnitReceivedDate',
      'replacementShipDate', 'fqcObservation',
      'scEngineer', 'serviceManualUpdate', 'techRemarks',
      'fqcInwardDate', 'userManualUpdate', 'fqcRemarks',
      'hwChanges', 'hwChangeRemarks', 'accChangeRemarks', 'cnrRefNo', 'cnrReleaseDate', 'swChangeRemarks',
      // Product Team fields
      'tsVerificationDate', 'psEngineer', 'psVerificationDate', 'productTeamRemarks', 'approvedDate',
    ];
    const update = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    if (hasMeaningfulServiceUpdate(update)) {
      update.finalStatus = 'PT Pending';
    }
    update.updatedBy = req.user._id;

    const doc = await EBir.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    await syncMirrorsFromEBir(doc);
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/bir/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/emp/bir/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await EBir.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const doc = await EBir.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
