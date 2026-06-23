const express = require('express');
const AdminLoanItem = require('../models/AdminLoanItem');
const LoanItem = require('../models/LoanItem');
const EltItem = require('../models/EltItem');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', adminOnly, async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (division) filter.division = division;

    // Sync existing items from LoanItem that might not be in AdminLoanItem
    const existingLoanItems = await LoanItem.find().lean();
    for (const lt of existingLoanItems) {
      try {
        const exists = await AdminLoanItem.exists({ loanItemId: lt._id });
        if (!exists) {
          await AdminLoanItem.create({
            date: lt.date || new Date().toISOString().split('T')[0],
            division: lt.division || 'Unknown',
            partNo: lt.partNo || 'Unknown',
            description: lt.description || 'Unknown',
            revalue: lt.revalue || 0,
            girNo: lt.girNo || 'Unknown',
            opt: lt.opt || '',
            remarks: lt.remarks || '',
            loanItemId: String(lt._id),
            createdBy: lt.createdBy || 'System',
          });
        }
      } catch (err) {
        console.error(`[GET /api/ali-items] Sync error for LoanItem ${lt._id}:`, err.message);
      }
    }

    const docs = await AdminLoanItem.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ali-items]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { date, division, partNo, description, revalue, girNo, opt, remarks, loanItemId } = req.body || {};
    if (!date || !division || !partNo || !description || !girNo) {
      return res.status(400).json({ message: 'Required: date, division, part no, description and GIR no.' });
    }

    const doc = await AdminLoanItem.create({
      date,
      division,
      partNo,
      description,
      revalue,
      girNo,
      opt,
      remarks,
      loanItemId: loanItemId || '',
      createdBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ali-items]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const doc = await AdminLoanItem.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Admin Loan item not found.' });

    // Synchronize deletion across lt and elt (LoanItem and EltItem)
    if (doc.loanItemId) {
      await LoanItem.findByIdAndDelete(doc.loanItemId).catch(e => console.error('Failed to delete associated LoanItem:', e));
      await EltItem.findOneAndDelete({ loanItemId: doc.loanItemId }).catch(e => console.error('Failed to delete associated EltItem:', e));
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ali-items/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
