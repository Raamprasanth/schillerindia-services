const express = require('express');
const router = express.Router();
const PtBir = require('../models/PtBir');
const PtClosedBir = require('../models/PtClosedBir');
const Bir = require('../models/Bir');
const ClosedBir = require('../models/ClosedBir');
const EBir = require('../models/EBir');
const EClosedBir = require('../models/EClosedBir');
const { protect } = require('../middleware/authMiddleware');

const CLOSED_STATUSES = new Set(['Approved', 'Closed']);
const SERVICE_FIELDS = [
  'scEngineer', 'scInwardDate', 'scObservation', 'requiredParts', 'rootCause',
  'scActionPlan', 'tentativeDate', 'shipDateToFqc', 'defUnitReceivedDate',
  'replacementShipDate', 'fqcObservation', 'fqcFinalRemarks',
  'serviceManualUpdate', 'techRemarks',
];

function divisionFilter(value) {
  const name = String(value || '').trim().toUpperCase();
  if (name === 'SAG' || name === 'GANSHORN') return { $in: ['SAG', 'GANSHORN'] };
  return value;
}

function normalizeAccChanges(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const allowed = ['No Change', 'Added', 'Removed', 'Replaced'];
  const match = allowed.find(option => option.toLowerCase() === text.toLowerCase());
  if (match) return match;

  const compact = text.toLowerCase().replace(/[\s_-]+/g, '');
  if (['no', 'none', 'nil', 'na', 'n/a', 'nochange', 'unchanged'].includes(compact)) return 'No Change';
  if (['yes', 'y', 'change', 'changed', 'changes', 'accessorychange', 'accessorychanges'].includes(compact)) return 'Added';
  return '';
}

function normalizeBirBody(body = {}) {
  const next = { ...body };
  if (Object.prototype.hasOwnProperty.call(next, 'accChanges')) {
    next.accChanges = normalizeAccChanges(next.accChanges);
  }
  return next;
}

function serviceFieldCount(doc) {
  return SERVICE_FIELDS.filter(field => String(doc?.[field] || '').trim()).length;
}

function dedupeByBirRef(docs) {
  const byRef = new Map();
  docs.forEach(doc => {
    const key = doc.birRef || String(doc._id);
    const current = byRef.get(key);
    if (!current) {
      byRef.set(key, doc);
      return;
    }
    const docScore = serviceFieldCount(doc);
    const currentScore = serviceFieldCount(current);
    const docTime = new Date(doc.updatedAt || doc.createdAt || 0).getTime();
    const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();
    if (docScore > currentScore || (docScore === currentScore && docTime > currentTime)) {
      byRef.set(key, doc);
    }
  });
  return [...byRef.values()];
}

function buildBirMirror(doc) {
  return {
    birRef: doc.birRef || '',
    division: doc.division || '',
    model: doc.model || '',
    configuration: doc.configuration || '',
    unitInwardDate: doc.unitInwardDate || '',
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
    accChanges: normalizeAccChanges(doc.accChanges),
    accDetails: doc.accDetails || '',
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
    status: doc.status || doc.finalStatus || 'Pending',
    finalStatus: doc.finalStatus || doc.status || '',
    updatedBy: doc.updatedBy,
  };
}

function buildEBirMirror(doc) {
  return {
    birRefNo: doc.birRef || '',
    division: doc.division || '',
    model: doc.model || '',
    configuration: doc.configuration || '',
    inwardDate: doc.unitInwardDate || '',
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
    accChanges: normalizeAccChanges(doc.accChanges),
    accessoryDetails: doc.accDetails || '',
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
    finalStatus: doc.finalStatus || doc.status || 'Pending',
    updatedBy: doc.updatedBy,
  };
}

function fillMissingPtFqcFields(doc, source) {
  if (!source) return doc;
  const fields = [
    'division', 'model', 'configuration', 'unitInwardDate', 'fqcInwardDate',
    'invoiceDate', 'supplier', 'invoiceNo', 'receivedQty', 'serial',
    'prevSwVersion', 'presSwVersion', 'accChanges', 'accDetails',
    'userManualUpdate', 'fqcRemarks',
  ];
  const filled = { ...doc };
  fields.forEach(field => {
    if (!String(filled[field] || '').trim() && String(source[field] || '').trim()) {
      filled[field] = source[field];
    }
  });
  return filled;
}

async function syncMirrorsFromPtBir(doc) {
  if (!doc?.birRef) return;
  await Promise.all([
    Bir.findOneAndUpdate({ birRef: doc.birRef }, { $set: buildBirMirror(doc) }, { new: true, runValidators: false }),
    EBir.findOneAndUpdate({ birRefNo: doc.birRef }, { $set: buildEBirMirror(doc) }, { new: true, runValidators: false }),
  ]);
}

async function moveToClosedIfComplete(doc, userId) {
  if (!doc || !CLOSED_STATUSES.has(doc.status)) return { moved: false, doc };

  const closedPayload = {
    ...doc.toObject(),
    status: doc.status === 'Closed' ? 'Closed' : 'Approved',
    updatedBy: userId,
  };
  delete closedPayload._id;
  delete closedPayload.__v;
  delete closedPayload.createdAt;
  delete closedPayload.updatedAt;
  closedPayload.accChanges = normalizeAccChanges(closedPayload.accChanges);

  const finalStatus = doc.status === 'Closed' ? 'Closed' : 'Approved';
  const fqcClosedPayload = {
    ...buildBirMirror(doc),
    status: finalStatus,
    approvedDate: doc.approvedDate || new Date().toISOString().split('T')[0],
    createdBy: doc.createdBy || userId,
  };
  delete fqcClosedPayload.finalStatus;
  const employeeClosedPayload = {
    ...buildEBirMirror(doc),
    finalStatus,
    approvedDate: doc.approvedDate || new Date().toISOString().split('T')[0],
    createdBy: doc.createdBy || userId,
    updatedBy: userId,
  };

  const [closed] = await Promise.all([
    PtClosedBir.findOneAndUpdate(
      { birRef: doc.birRef },
      { $set: closedPayload, $setOnInsert: { createdBy: doc.createdBy || userId } },
      { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
    ),
    ClosedBir.findOneAndUpdate(
      { birRef: doc.birRef },
      { $set: fqcClosedPayload },
      { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
    ),
    EClosedBir.findOneAndUpdate(
      { birRefNo: doc.birRef },
      { $set: employeeClosedPayload },
      { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
    ),
  ]);
  await Promise.all([
    PtBir.deleteMany({ birRef: doc.birRef }),
    Bir.deleteMany({ birRef: doc.birRef }),
    EBir.deleteMany({ birRefNo: doc.birRef }),
  ]);
  return { moved: true, doc: closed };
}

router.get('/', protect, async (req, res) => {
  try {
    const { division, status, from, to } = req.query;
    const filter = {};

    if (division) filter.division = divisionFilter(division);
    if (status) filter.status = status;

    if (from || to) {
      filter.unitInwardDate = {};
      if (from) filter.unitInwardDate.$gte = from;
      if (to) filter.unitInwardDate.$lte = to;
    }

    const docs = dedupeByBirRef(await PtBir.find(filter).sort({ unitInwardDate: -1 }).lean());
    const refs = docs.map(doc => doc.birRef).filter(Boolean);
    const sources = refs.length
      ? await Bir.find({ birRef: { $in: refs } }).lean()
      : [];
    const byRef = new Map(sources.map(doc => [doc.birRef, doc]));
    res.json(docs.map(doc => fillMissingPtFqcFields(doc, byRef.get(doc.birRef))));
  } catch (err) {
    console.error('[GET /api/pt/bir]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtBir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const body = normalizeBirBody(req.body);
    const doc = new PtBir({
      ...body,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    await syncMirrorsFromPtBir(saved);
    const result = await moveToClosedIfComplete(saved, req.user._id);
    res.status(201).json({ movedToClosed: result.moved, data: result.doc });
  } catch (err) {
    console.error('[POST /api/pt/bir]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const body = normalizeBirBody(req.body);
    const doc = await PtBir.findByIdAndUpdate(
      req.params.id,
      { ...body, updatedBy: req.user._id },
      { new: true, runValidators: false }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    try { await syncMirrorsFromPtBir(doc); } catch (syncErr) {
      console.error('[PUT /api/pt/bir/:id] sync error (non-fatal):', syncErr.message);
    }

    let moved = false;
    let resultDoc = doc;
    try {
      const result = await moveToClosedIfComplete(doc, req.user._id);
      moved = result.moved;
      resultDoc = result.doc;
    } catch (closeErr) {
      console.error('[PUT /api/pt/bir/:id] close error (non-fatal):', closeErr.message);
    }

    res.json({ movedToClosed: moved, data: resultDoc });
  } catch (err) {
    console.error('[PUT /api/pt/bir/:id]', err);
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtBir.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    const ref = doc.birRef || doc.birRefNo;
    if (ref) {
      const filter = { $or: [{ birRef: ref }, { birRefNo: ref }] };
      await Promise.allSettled([
        require('../models/Bir').deleteMany(filter),
        require('../models/ClosedBir').deleteMany(filter),
        require('../models/EBir').deleteMany(filter),
        require('../models/EClosedBir').deleteMany(filter),
        require('../models/PtClosedBir').deleteMany(filter),
        require('../models/ABir').deleteMany(filter),
        require('../models/AClosedBir').deleteMany(filter),
      ]);
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
