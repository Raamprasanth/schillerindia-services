const express = require('express');
const PtDailyWork = require('../models/PtDailyWork');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUsePtDw(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtDw(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team daily work.' });
  }
  next();
});

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { userId: user?._id };
}

router.get('/', async (req, res) => {
  try {
    const docs = await PtDailyWork.find(ownerFilter(req.user)).sort({ date: -1, fromTime: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.date || !body.activity || !body.fromTime || !body.toTime) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtDailyWork.create({
      date: body.date,
      activity: body.activity,
      fromTime: body.fromTime,
      toTime: body.toTime,
      team: body.team,
      dayTotal: body.dayTotal,
      addedBy: req.user?.name || req.user?.email || 'User',
      userId: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtDailyWork.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Daily work record not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptdw/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const body = req.body || {};
    
    if (!body.date || !body.activity || !body.fromTime || !body.toTime) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtDailyWork.findOneAndUpdate(
      filter,
      {
        date: body.date,
        activity: body.activity,
        fromTime: body.fromTime,
        toTime: body.toTime,
        team: body.team,
        dayTotal: body.dayTotal
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: 'Daily work record not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ptdw/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
