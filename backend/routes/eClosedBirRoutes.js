const express = require('express');
const router = express.Router();
const EClosedBir = require('../models/EClosedBir');
const Bir = require('../models/Bir');
const PtBir = require('../models/PtBir');
const PtClosedBir = require('../models/PtClosedBir');
const { protect } = require('../middleware/authMiddleware');

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
    status: doc.finalStatus || 'Closed',
    finalStatus: doc.finalStatus || 'Closed',
    updatedBy: doc.updatedBy,
  };
}

function fillMissingEmployeeClosedFields(doc, source) {
  if (!source) return doc;
  const mappings = {
    birRefNo: 'birRef',
    division: 'division',
    model: 'model',
    configuration: 'configuration',
    inwardDate: 'unitInwardDate',
    fqcInwardDate: 'fqcInwardDate',
    invoiceDate: 'invoiceDate',
    approvedDate: 'approvedDate',
    supplier: 'supplier',
    invoiceNo: 'invoiceNo',
    receivedQty: 'receivedQty',
    serial: 'serial',
    prevSwVersion: 'prevSwVersion',
    presSwVersion: 'presSwVersion',
    swChangeRemarks: 'swChangeRemarks',
    hwChanges: 'hwChanges',
    hwChangeRemarks: 'hwChangeRemarks',
    accChanges: 'accChanges',
    accessoryDetails: 'accDetails',
    accChangeRemarks: 'accChangeRemarks',
    userManualUpdate: 'userManualUpdate',
    serviceManualUpdate: 'serviceManualUpdate',
    scEngineer: 'scEngineer',
    psEngineer: 'psEngineer',
    fqcRemarks: 'fqcRemarks',
    techRemarks: 'techRemarks',
    scInwardDate: 'scInwardDate',
    scObservation: 'scObservation',
    requiredParts: 'requiredParts',
    rootCause: 'rootCause',
    scActionPlan: 'scActionPlan',
    tentativeDate: 'tentativeDate',
    shipDateToFqc: 'shipDateToFqc',
    defUnitReceivedDate: 'defUnitReceivedDate',
    replacementShipDate: 'replacementShipDate',
    fqcObservation: 'fqcObservation',
    fqcFinalRemarks: 'fqcFinalRemarks',
    tsVerificationDate: 'tsVerificationDate',
    psVerificationDate: 'psVerificationDate',
    productTeamRemarks: 'productTeamRemarks',
    cnrCirculation: 'cnrCirculation',
    cnrRefNo: 'cnrRefNo',
    cnrReleaseDate: 'cnrReleaseDate',
  };
  const filled = { ...doc };
  Object.entries(mappings).forEach(([target, sourceField]) => {
    if (!String(filled[target] || '').trim() && String(source[sourceField] || '').trim()) filled[target] = source[sourceField];
  });
  return filled;
}

function buildPtMirrorUpdate(doc) {
  return {
    ...buildMirrorUpdate(doc),
    status: 'Pending',
    finalStatus: 'Pending',
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

async function syncMirrorsFromClosed(doc) {
  if (!doc?.birRefNo) return;
  const mirror = buildMirrorUpdate(doc);
  await Promise.all([
    Bir.findOneAndUpdate({ birRef: doc.birRefNo }, { $set: mirror }, { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }),
    upsertSinglePtMirror(doc.birRefNo, buildPtMirrorUpdate(doc)),
  ]);
}

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

function applyEmployeeDivision(req, filter, division) {
  const userDivisions = getUserDivisions(req.user);
  if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin' && userDivisions.length) {
    filter.division = { $in: divisionFilterForValues(userDivisions) };
  } else if (division) {
    filter.division = divisionFilter(division);
  }
}

router.get('/', protect, async (req, res) => {
  try {
    const { division, status, hw, from, to } = req.query;
    const filter = {};

    applyEmployeeDivision(req, filter, division);
    if (status) filter.finalStatus = status;
    if (hw) filter.hwChanges = hw;

    if (from || to) {
      filter.inwardDate = {};
      if (from) filter.inwardDate.$gte = from;
      if (to) filter.inwardDate.$lte = to;
    }

    const docs = await EClosedBir.find(filter).sort({ inwardDate: -1 }).lean();
    const refs = docs.map(doc => doc.birRefNo).filter(Boolean);
    const sources = refs.length ? await PtClosedBir.find({ birRef: { $in: refs } }).lean() : [];
    const byRef = new Map(sources.map(doc => [doc.birRef, doc]));
    res.json(docs.map(doc => fillMissingEmployeeClosedFields(doc, byRef.get(doc.birRefNo))));
  } catch (err) {
    console.error('[GET /api/emp/bir/closed]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await EClosedBir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, doc.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/emp/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const division =
      (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin')
        ? String(req.user.activeDivision || req.user.division || req.body.division || '').trim()
        : (req.body.division || '');
    const doc = new EClosedBir({
      ...req.body,
      division,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const saved = await doc.save();
    await syncMirrorsFromClosed(saved);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/bir/closed]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await EClosedBir.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const doc = await EClosedBir.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...req.body,
          division:
            (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin')
              ? String(req.user.activeDivision || req.user.division || existing.division || '').trim()
              : (req.body.division || existing.division || ''),
          updatedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    );
    await syncMirrorsFromClosed(doc);
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/bir/closed/:id]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await EClosedBir.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const doc = await EClosedBir.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/bir/closed/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
