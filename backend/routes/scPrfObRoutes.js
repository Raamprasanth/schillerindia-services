const express  = require('express');
const router   = express.Router();
const ScPrfOb  = require('../models/ScPrfOb');
const EPrfOb   = require('../models/EPrfOb');
const { protect } = require('../middleware/authMiddleware');
const { buildPrfObEscalationRow, enqueueLatestEscalationSnapshot, removeEscalationSnapshot } = require('../services/escalationService');

function buildEmployeePrfObPayload(body, userId, sourceId) {
  return {
    entryDate: body.entryDate || '',
    type: body.type || 'TO',
    division: body.division || 'OTHER',
    dealer: body.dealer || '',
    refNo: body.refNo || '',
    raisedDate: body.raisedDate || body.entryDate || '',
    receivedDate: body.receivedDate || '',
    executedDate: body.executedDate || '',
    status: body.status || 'Pending',
    warrantyStatus: body.warrantyStatus || '',
    eng: body.eng || '',
    scEng: body.scEng || '',
    region: body.region || '',
    branch: body.branch || '',
    supplier: body.supplier || '',
    crmRefNo: body.crmRefNo || '',
    sparesReceivedAtSvc: body.sparesReceivedAtSvc || '',
    partType: body.partType || '',
    partsDescription: body.partsDescription || '',
    model: body.model || '',
    serialNo: body.serialNo || '',
    partNo: body.partNo || '',
    qty: Number(body.qty) || 1,
    unitPrice: Number(body.unitPrice) || 0,
    totalAmount: Number(body.totalAmount) || 0,
    remarks: body.remarks || '',
    createdBy: userId,
    sourceScPrfObId: sourceId,
  };
}

// GET /api/emp/prfob
router.get('/', protect, async (req, res) => {
  try {
    const { type, status, division, from, to } = req.query;
    const filter = {};
    if (type)     filter.type     = type;
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $nin: ['Closed', 'Rejected', 'Completed'] };
    }
    if (division) filter.division = division;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }
    const docs = await ScPrfOb.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp/prfob]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/emp/prfob
router.post('/', protect, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.status === 'Completed') {
      payload.status = 'Closed';
    }
    
    const doc = new ScPrfOb({
      ...payload,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    if (String(saved.status).toLowerCase() === 'pending') {
      const employeePayload = buildEmployeePrfObPayload(saved.toObject(), req.user._id, saved._id);
      await EPrfOb.findOneAndUpdate(
        { sourceScPrfObId: saved._id },
        employeePayload,
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      await enqueueLatestEscalationSnapshot(
        'prf_ob',
        saved._id,
        req.user.name || '',
        buildPrfObEscalationRow(saved.toObject())
      );
    }
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/emp/prfob]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/emp/prfob/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    
    // Map 'Completed' to 'Closed' to satisfy schema enum and handle cached frontend
    if (updateData.status === 'Completed') {
      updateData.status = 'Closed';
    }

    if (updateData.status === 'Closed') {
      updateData.executedDate = updateData.executedDate || new Date().toISOString().split('T')[0];
    }
    
    const doc = await ScPrfOb.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    if (String(doc.status).toLowerCase() === 'pending') {
      const employeePayload = buildEmployeePrfObPayload(doc.toObject(), req.user._id, doc._id);
      await EPrfOb.findOneAndUpdate(
        { sourceScPrfObId: doc._id },
        employeePayload,
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      await enqueueLatestEscalationSnapshot(
        'prf_ob',
        doc._id,
        req.user.name || '',
        buildPrfObEscalationRow(doc.toObject())
      );
    } else {
      await EPrfOb.deleteOne({ sourceScPrfObId: doc._id });
      await removeEscalationSnapshot('prf_ob', doc._id);
    }
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/emp/prfob/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/emp/prfob/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await ScPrfOb.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    await removeEscalationSnapshot('prf_ob', doc._id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/emp/prfob/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
