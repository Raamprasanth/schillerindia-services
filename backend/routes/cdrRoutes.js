const express = require('express');
const router = express.Router();
const Cdr = require('../models/Cdr');
const { protect } = require('../middleware/authMiddleware');

// GET all CDR entries
router.get('/', protect, async (req, res) => {
  try {
    const records = await Cdr.find().sort({ entryDate: -1, createdAt: -1 });
    res.json(records);
  } catch (error) {
    console.error('Error fetching CDR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new CDR entry
router.post('/', protect, async (req, res) => {
  try {
    const newRecord = new Cdr({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (error) {
    console.error('Error creating CDR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a CDR entry
router.put('/:id', protect, async (req, res) => {
  try {
    const record = await Cdr.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (error) {
    console.error('Error updating CDR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a CDR entry
router.delete('/:id', protect, async (req, res) => {
  try {
    const record = await Cdr.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting CDR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
