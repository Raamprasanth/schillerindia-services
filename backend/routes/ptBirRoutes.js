const express = require('express');
const router = express.Router();
const PtBir = require('../models/PtBir');
const PtClosedBir = require('../models/PtClosedBir');
const Bir = require('../models/Bir');
const EBir = require('../models/EBir');
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
    accChanges: doc.accChanges || '',
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
    cnrCirculation: doc.cnrCirculation || '',
    cnrRefNo: doc.cnrRefNo || '',
    cnrReleaseDate: doc.cnrReleaseDate || '',
    finalStatus: doc.finalStatus || doc.status || 'Pending',
    updatedBy: doc.updatedBy,
  };
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

  const closed = await PtClosedBir.findOneAndUpdate(
    { birRef: doc.birRef },
    { $set: closedPayload, $setOnInsert: { createdBy: doc.createdBy || userId } },
    { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
  );
  await PtBir.findByIdAndDelete(doc._id);
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

    const docs = await PtBir.find(filter).sort({ unitInwardDate: -1 }).lean();
    res.json(dedupeByBirRef(docs));
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
    const doc = new PtBir({
      ...req.body,
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
    const doc = await PtBir.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
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
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
