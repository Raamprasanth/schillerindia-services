const express = require('express');
const router = express.Router();
const Todr = require('../models/Todr');
const auth = require('../middleware/auth'); // assuming an auth middleware exists

// GET all TODR entries
router.get('/', auth, async (req, res) => {
  try {
    const records = await Todr.find().sort({ entryDate: -1, createdAt: -1 });
    res.json(records);
  } catch (error) {
    console.error('Error fetching TODR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new TODR entry
router.post('/', auth, async (req, res) => {
  try {
    const newRecord = new Todr({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (error) {
    console.error('Error creating TODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a TODR entry
router.put('/:id', auth, async (req, res) => {
  try {
    const record = await Todr.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (error) {
    console.error('Error updating TODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a TODR entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const record = await Todr.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting TODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
