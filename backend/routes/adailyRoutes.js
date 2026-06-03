const express = require('express');
const ADailyWork = require('../models/ADailyWork');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canAccessAdminDailyWork(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['admin', 'superadmin', 'administrator'].includes(role);
}

// GET all daily work for admin
router.get('/', async (req, res) => {
  if (!canAccessAdminDailyWork(req.user)) {
    return res.status(403).json({ message: 'Not authorized to view admin daily work.' });
  }
  try {
    const records = await ADailyWork.find().sort({ date: -1, fromTime: -1 }).lean();
    res.json(records);
  } catch (err) {
    console.error('[GET /api/adaily]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE single entry
router.delete('/:id', async (req, res) => {
  if (!canAccessAdminDailyWork(req.user)) {
    return res.status(403).json({ message: 'Not authorized to delete daily work.' });
  }
  try {
    const doc = await ADailyWork.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });

    // Also try deleting from source if we wanted to... 
    // Wait, let's keep it simple: admin delete deletes from ADailyWork, but maybe not from source to keep source intact?
    // Let's delete from source too.
    if (doc.sourceType === 'Employee') {
      const EmpDailyWork = require('../models/EmpDailyWork');
      await EmpDailyWork.findByIdAndDelete(doc.sourceId);
    } else if (doc.sourceType === 'Product Team') {
      const PtDailyWork = require('../models/PtDailyWork');
      await PtDailyWork.findByIdAndDelete(doc.sourceId);
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/adaily/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST bulk delete
router.post('/bulk-delete', async (req, res) => {
  if (!canAccessAdminDailyWork(req.user)) {
    return res.status(403).json({ message: 'Not authorized to delete daily work.' });
  }
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No IDs provided.' });
    }

    const docs = await ADailyWork.find({ _id: { $in: ids } });
    
    // Delete from sources
    const EmpDailyWork = require('../models/EmpDailyWork');
    const PtDailyWork = require('../models/PtDailyWork');

    for (const doc of docs) {
      if (doc.sourceType === 'Employee') {
        await EmpDailyWork.findByIdAndDelete(doc.sourceId);
      } else if (doc.sourceType === 'Product Team') {
        await PtDailyWork.findByIdAndDelete(doc.sourceId);
      }
    }

    await ADailyWork.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deletedCount: docs.length });
  } catch (err) {
    console.error('[POST /api/adaily/bulk-delete]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
