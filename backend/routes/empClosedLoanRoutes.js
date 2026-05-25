const express = require('express');
const EmpClosedLoan = require('../models/EmpClosedLoan');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const docs = await EmpClosedLoan.find({}).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp-closed-loans]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await EmpClosedLoan.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Item not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/emp-closed-loans/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
