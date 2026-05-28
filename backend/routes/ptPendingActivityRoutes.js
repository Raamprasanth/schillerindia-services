const express = require('express');
const PtPendingActivity = require('../models/PtPendingActivity');
const PtClosedActivity = require('../models/PtClosedActivity');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function canUsePtPa(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtPa(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team Pending Activity.' });
  }
  next();
});

function ownerFilter(user) {
  return {};
}

function normalizePendingStatus(value) {
  return String(value || '').toLowerCase() === 'completed' ? 'Completed' : 'Pending';
}

router.get('/', async (req, res) => {
  try {
    const docs = await PtPendingActivity.find(ownerFilter(req.user)).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptpa]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.scEngineer || !body.initiatedDate || !body.activity || !body.status) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtPendingActivity.create({
      scEngineer: body.scEngineer,
      initiatedDate: body.initiatedDate,
      activity: body.activity,
      description: body.description || '',
      responsible: body.responsible || '',
      pendingFrom: body.pendingFrom || '',
      targetDate: body.targetDate || '',
      remarks: body.remarks || '',
      scInchargeRemarks: body.scInchargeRemarks || '',
      status: normalizePendingStatus(body.status),
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptpa]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtPendingActivity.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptpa/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const status = String(req.body.status || '').toLowerCase();
    
    if (status === 'completed') {
      const existing = await PtPendingActivity.findOne(filter).lean();
      if (!existing) return res.status(404).json({ message: 'Record not found.' });

      const closedDoc = await PtClosedActivity.create({
        scEngineer: req.body.scEngineer || existing.scEngineer,
        initiatedDate: req.body.initiatedDate || existing.initiatedDate,
        activity: req.body.activity || existing.activity,
        description: req.body.description || existing.description,
        responsible: req.body.responsible || existing.responsible,
        pendingFrom: req.body.pendingFrom || existing.pendingFrom,
        targetDate: req.body.targetDate || existing.targetDate,
        remarks: req.body.remarks || existing.remarks,
        scInchargeRemarks: req.body.scInchargeRemarks || existing.scInchargeRemarks,
        status: req.body.status || existing.status,
        createdBy: existing.createdBy
      });
      await PtPendingActivity.findOneAndDelete(filter);
      return res.json(closedDoc);
    }
    
    const doc = await PtPendingActivity.findOneAndUpdate(filter, {
      ...req.body,
      status: normalizePendingStatus(req.body.status),
    }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ptpa/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
