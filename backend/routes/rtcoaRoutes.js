const express = require('express');
const router = express.Router();
const RtCOA = require('../models/RtClosedOtherActivity');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const records = await RtCOA.find().sort({ closedDate: -1, entryDate: -1 }).lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch records', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await RtCOA.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    return res.json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch record', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await RtCOA.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Record not found' });
    return res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete record', error: err.message });
  }
});

module.exports = router;
