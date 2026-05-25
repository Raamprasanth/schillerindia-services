const express = require('express');
const PtClosedActivity = require('../models/PtClosedActivity');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function canUsePtCa(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtCa(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team Closed Activity.' });
  }
  next();
});

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { createdBy: user?._id };
}

router.get('/', async (req, res) => {
  try {
    const docs = await PtClosedActivity.find(ownerFilter(req.user)).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.scEngineer || !body.initiatedDate || !body.activity || !body.status) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtClosedActivity.create({
      scEngineer: body.scEngineer,
      initiatedDate: body.initiatedDate,
      activity: body.activity,
      description: body.description || '',
      responsible: body.responsible || '',
      pendingFrom: body.pendingFrom || '',
      targetDate: body.targetDate || '',
      remarks: body.remarks || '',
      scInchargeRemarks: body.scInchargeRemarks || '',
      status: body.status || 'Closed',
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtClosedActivity.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtClosedActivity.findOneAndUpdate(filter, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
