const express = require('express');
const router = express.Router();
const Dr = require('../models/Dr');
const { protect } = require('../middleware/authMiddleware');

// GET all DR entries
router.get('/', protect, async (req, res) => {
  try {
    const records = await Dr.find().sort({ entryDate: -1, createdAt: -1 });
    res.json(records);
  } catch (error) {
    console.error('Error fetching DR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new DR entry
router.post('/', protect, async (req, res) => {
  try {
    const newRecord = new Dr({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (error) {
    console.error('Error creating DR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a DR entry
router.put('/:id', protect, async (req, res) => {
  try {
    const record = await Dr.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (error) {
    console.error('Error updating DR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a DR entry
router.delete('/:id', protect, async (req, res) => {
  try {
    const record = await Dr.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting DR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
