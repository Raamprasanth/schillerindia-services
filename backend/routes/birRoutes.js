const express  = require('express');
const router   = express.Router();
const Bir      = require('../models/Bir');
const ClosedBir = require('../models/ClosedBir');
const Counter  = require('../models/Counter');
const { protect } = require('../middleware/authMiddleware');

const BIR_REF_COUNTER = 'fbirRef';

function getBirRefSequence(value) {
  const match = String(value || '').trim().match(/^BIR-REF\s+(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function formatBirRef(sequence) {
  return `BIR-REF ${String(sequence).padStart(3, '0')}`;
}

async function ensureBirRefCounterFloor() {
  const [openDocs, closedDocs] = await Promise.all([
    Bir.find({ birRef: /^BIR-REF\s+\d+$/i }).select('birRef -_id').lean(),
    ClosedBir.find({ birRef: /^BIR-REF\s+\d+$/i }).select('birRef -_id').lean(),
  ]);
  const floor = [...openDocs, ...closedDocs].reduce(
    (highest, doc) => Math.max(highest, getBirRefSequence(doc.birRef)),
    0
  );
  return Counter.findOneAndUpdate(
    { _id: BIR_REF_COUNTER },
    { $max: { seq: floor } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function previewNextBirRef() {
  const counter = await ensureBirRefCounterFloor();
  return formatBirRef((counter?.seq || 0) + 1);
}

async function reserveNextBirRef() {
  await ensureBirRefCounterFloor();
  const counter = await Counter.findOneAndUpdate(
    { _id: BIR_REF_COUNTER },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return formatBirRef(counter.seq);
}

function normalizeStatus(status) {
  return status === 'Completed' ? 'Closed' : status;
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

function shouldMoveToClosed(status) {
  return status === 'Closed';
}

async function moveBirToClosed(doc, userId) {
  const closedPayload = {
    ...doc.toObject(),
    status: doc.status === 'Approved' ? 'Approved' : 'Closed',
    approvedDate: doc.approvedDate || new Date().toISOString().split('T')[0],
    createdBy: doc.createdBy || userId,
  };
  delete closedPayload._id;
  delete closedPayload.updatedBy;
  delete closedPayload.__v;
  closedPayload.accChanges = normalizeAccChanges(closedPayload.accChanges);

  const closedDoc = await ClosedBir.findOneAndUpdate(
    { birRef: doc.birRef },
    { $set: closedPayload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await Bir.findByIdAndDelete(doc._id);
  return closedDoc;
}

// ── GET /api/bir  (all BIR records, with optional filters)
router.get('/', protect, async (req, res) => {
  try {
    const { division, status, from, to } = req.query;
    const filter = {};

    if (division) filter.division = division;
    if (status)   filter.status   = status;

    // Date-range filter on unitInwardDate
    if (from || to) {
      filter.unitInwardDate = {};
      if (from) filter.unitInwardDate.$gte = from;
      if (to)   filter.unitInwardDate.$lte = to;
    }

    const docs = await Bir.find(filter).sort({ unitInwardDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/bir]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/bir/:id
router.get('/next-ref', protect, async (req, res) => {
  try {
    res.json({ birRef: await previewNextBirRef() });
  } catch (err) {
    console.error('[GET /api/bir/next-ref]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Bir.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/bir
router.post('/', protect, async (req, res) => {
  try {
    const body = normalizeBirBody(req.body);
    const payload = {
      ...body,
      birRef: await reserveNextBirRef(),
      status: normalizeStatus(body.status || 'TS Pending'),
      finalStatus: body.status || body.finalStatus || 'TS Pending',
    };
    const doc = new Bir({
      ...payload,
      createdBy: req.user._id,
    });
    const saved = await doc.save();

    // Mirror to EBir
    const EBir = require('../models/EBir');
    const eBirPayload = {
      birRefNo: saved.birRef,
      division: saved.division,
      model: saved.model,
      configuration: saved.configuration,
      inwardDate: saved.unitInwardDate,
      fqcInwardDate: saved.fqcInwardDate,
      invoiceDate: saved.invoiceDate,
      approvedDate: saved.approvedDate,
      supplier: saved.supplier,
      invoiceNo: saved.invoiceNo,
      receivedQty: saved.receivedQty,
      serial: saved.serial,
      prevSwVersion: saved.prevSwVersion,
      presSwVersion: saved.presSwVersion,
      swChangeRemarks: saved.swChangeRemarks,
      hwChanges: saved.hwChanges,
      hwChangeRemarks: saved.hwChangeRemarks,
      accChanges: saved.accChanges,
      accessoryDetails: saved.accDetails,
      accChangeRemarks: saved.accChangeRemarks,
      userManualUpdate: saved.userManualUpdate,
      serviceManualUpdate: saved.serviceManualUpdate,
      scEngineer: saved.scEngineer,
      psEngineer: saved.psEngineer,
      fqcRemarks: saved.fqcRemarks,
      techRemarks: saved.techRemarks,
      scInwardDate: saved.scInwardDate,
      scObservation: saved.scObservation,
      requiredParts: saved.requiredParts,
      rootCause: saved.rootCause,
      scActionPlan: saved.scActionPlan,
      tentativeDate: saved.tentativeDate,
      shipDateToFqc: saved.shipDateToFqc,
      defUnitReceivedDate: saved.defUnitReceivedDate,
      replacementShipDate: saved.replacementShipDate,
      fqcObservation: saved.fqcObservation,
      fqcFinalRemarks: saved.fqcFinalRemarks,
      tsVerificationDate: saved.tsVerificationDate,
      psVerificationDate: saved.psVerificationDate,
      productTeamRemarks: saved.productTeamRemarks,
      cnrCirculation: saved.cnrCirculation,
      cnrRefNo: saved.cnrRefNo,
      cnrReleaseDate: saved.cnrReleaseDate,
      finalStatus: 'TS Pending',
      createdBy: req.user._id,
    };
    await EBir.findOneAndUpdate(
      { birRefNo: saved.birRef },
      { $set: eBirPayload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (shouldMoveToClosed(saved.status)) {
      const closedDoc = await moveBirToClosed(saved, req.user._id);
      return res.status(201).json({ movedToClosed: true, data: closedDoc });
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/bir]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/bir/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const body = normalizeBirBody(req.body);
    const payload = {
      ...body,
      status: normalizeStatus(body.status),
      finalStatus: body.status || body.finalStatus || '',
      updatedBy: req.user._id,
    };
    const doc = await Bir.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    // Sync to EBir
    const EBir = require('../models/EBir');
    await EBir.findOneAndUpdate(
      { birRefNo: doc.birRef },
      {
        division: doc.division,
        model: doc.model,
        configuration: doc.configuration,
        inwardDate: doc.unitInwardDate,
        fqcInwardDate: doc.fqcInwardDate,
        invoiceDate: doc.invoiceDate,
        approvedDate: doc.approvedDate,
        supplier: doc.supplier,
        invoiceNo: doc.invoiceNo,
        receivedQty: doc.receivedQty,
        serial: doc.serial,
        prevSwVersion: doc.prevSwVersion,
        presSwVersion: doc.presSwVersion,
        swChangeRemarks: doc.swChangeRemarks,
        hwChanges: doc.hwChanges,
        hwChangeRemarks: doc.hwChangeRemarks,
        accChanges: doc.accChanges,
        accessoryDetails: doc.accDetails,
        accChangeRemarks: doc.accChangeRemarks,
        userManualUpdate: doc.userManualUpdate,
        serviceManualUpdate: doc.serviceManualUpdate,
        scEngineer: doc.scEngineer,
        psEngineer: doc.psEngineer,
        fqcRemarks: doc.fqcRemarks,
        techRemarks: doc.techRemarks,
        scInwardDate: doc.scInwardDate,
        scObservation: doc.scObservation,
        requiredParts: doc.requiredParts,
        rootCause: doc.rootCause,
        scActionPlan: doc.scActionPlan,
        tentativeDate: doc.tentativeDate,
        shipDateToFqc: doc.shipDateToFqc,
        defUnitReceivedDate: doc.defUnitReceivedDate,
        replacementShipDate: doc.replacementShipDate,
        fqcObservation: doc.fqcObservation,
        fqcFinalRemarks: doc.fqcFinalRemarks,
        tsVerificationDate: doc.tsVerificationDate,
        psVerificationDate: doc.psVerificationDate,
        productTeamRemarks: doc.productTeamRemarks,
        cnrCirculation: doc.cnrCirculation,
        cnrRefNo: doc.cnrRefNo,
        cnrReleaseDate: doc.cnrReleaseDate,
        finalStatus: doc.status,
      }
    );

    if (shouldMoveToClosed(doc.status)) {
      const closedDoc = await moveBirToClosed(doc, req.user._id);
      return res.json({ movedToClosed: true, data: closedDoc });
    }

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/bir/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/bir/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Bir.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/bir/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
