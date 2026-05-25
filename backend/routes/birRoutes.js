const express  = require('express');
const router   = express.Router();
const Bir      = require('../models/Bir');
const ClosedBir = require('../models/ClosedBir');
const { protect } = require('../middleware/authMiddleware');

function normalizeStatus(status) {
  return status === 'Completed' ? 'Closed' : status;
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
    const payload = {
      ...req.body,
      status: normalizeStatus(req.body.status || 'Pending'),
      finalStatus: req.body.status || req.body.finalStatus || '',
    };
    const doc = new Bir({
      ...payload,
      createdBy: req.user._id,
    });
    const saved = await doc.save();

    // Mirror to EBir
    const EBir = require('../models/EBir');
    const eBirDoc = new EBir({
      birRefNo: saved.birRef,
      division: saved.division,
      model: saved.model,
      configuration: saved.configuration,
      inwardDate: saved.unitInwardDate,
      invoiceDate: saved.invoiceDate,
      supplier: saved.supplier,
      invoiceNo: saved.invoiceNo,
      receivedQty: saved.receivedQty,
      serial: saved.serial,
      prevSwVersion: saved.prevSwVersion,
      presSwVersion: saved.presSwVersion,
      swChangeRemarks: saved.swChangeRemarks,
      hwChanges: saved.hwChanges,
      hwChangeRemarks: saved.hwChangeRemarks,
      accessoryDetails: saved.accDetails,
      accChangeRemarks: saved.accChangeRemarks,
      cnrCirculation: saved.cnrCirculation,
      cnrRefNo: saved.cnrRefNo,
      cnrReleaseDate: saved.cnrReleaseDate,
      finalStatus: saved.status,
      createdBy: req.user._id,
    });
    await eBirDoc.save();

    // Mirror to PtBir
    const PtBir = require('../models/PtBir');
    const ptBirDoc = new PtBir({
      ...payload,
      birRef: saved.birRef,
      createdBy: req.user._id,
    });
    await ptBirDoc.save();

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
    const payload = {
      ...req.body,
      status: normalizeStatus(req.body.status),
      finalStatus: req.body.status || req.body.finalStatus || '',
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
        invoiceDate: doc.invoiceDate,
        supplier: doc.supplier,
        invoiceNo: doc.invoiceNo,
        receivedQty: doc.receivedQty,
        serial: doc.serial,
        prevSwVersion: doc.prevSwVersion,
        presSwVersion: doc.presSwVersion,
        swChangeRemarks: doc.swChangeRemarks,
        hwChanges: doc.hwChanges,
        hwChangeRemarks: doc.hwChangeRemarks,
        accessoryDetails: doc.accDetails,
        accChangeRemarks: doc.accChangeRemarks,
        cnrCirculation: doc.cnrCirculation,
        cnrRefNo: doc.cnrRefNo,
        cnrReleaseDate: doc.cnrReleaseDate,
        finalStatus: doc.status,
      }
    );

    // Sync to PtBir
    const PtBir = require('../models/PtBir');
    await PtBir.findOneAndUpdate(
      { birRef: doc.birRef },
      payload
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
