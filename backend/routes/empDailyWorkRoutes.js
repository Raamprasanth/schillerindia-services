const express = require('express');
const EmpDailyWork = require('../models/EmpDailyWork');
const ADailyWork = require('../models/ADailyWork');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { userId: user?._id };
}

router.get('/', async (req, res) => {
  try {
    const docs = await EmpDailyWork.find(ownerFilter(req.user)).sort({ date: -1, fromTime: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/empdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.date || !body.activity || !body.fromTime || !body.toTime) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await EmpDailyWork.create({
      date: body.date,
      activity: body.activity,
      fromTime: body.fromTime,
      toTime: body.toTime,
      team: body.team,
      dayTotal: body.dayTotal,
      addedBy: req.user?.name || req.user?.email || 'User',
      userId: req.user?._id,
    });

    // Mirror to ADailyWork
    await ADailyWork.create({
      date: doc.date,
      activity: doc.activity,
      fromTime: doc.fromTime,
      toTime: doc.toTime,
      team: doc.team,
      dayTotal: doc.dayTotal,
      addedBy: doc.addedBy,
      userId: doc.userId,
      sourceType: 'Employee',
      sourceId: doc._id
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/empdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await EmpDailyWork.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Daily work record not found.' });

    // Remove from ADailyWork
    await ADailyWork.findOneAndDelete({ sourceType: 'Employee', sourceId: doc._id });

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/empdw/:id]', err);
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

    const doc = await EmpDailyWork.findOneAndUpdate(
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

    // Update ADailyWork
    await ADailyWork.findOneAndUpdate(
      { sourceType: 'Employee', sourceId: doc._id },
      {
        date: doc.date,
        activity: doc.activity,
        fromTime: doc.fromTime,
        toTime: doc.toTime,
        team: doc.team,
        dayTotal: doc.dayTotal
      }
    );

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/empdw/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
