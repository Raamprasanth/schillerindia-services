const express = require('express');
const router = express.Router();
const Ctodr = require('../models/Ctodr');
const { protect } = require('../middleware/authMiddleware');

const EmpFRN = require('../models/EmpFRN');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');

function splitLegacyDescription(record) {
  if (record.model || !record.description || !record.description.includes('|')) return;
  const [model, ...descParts] = String(record.description).split('|');
  const description = descParts.join('|').trim();
  if (model.trim() && description) {
    record.model = model.trim();
    record.description = description;
  }
}

// GET all CTODR entries
router.get('/', protect, async (req, res) => {
  try {
    const records = await Ctodr.find().sort({ entryDate: -1, createdAt: -1 }).lean();
    
    for (let r of records) {
      splitLegacyDescription(r);
      if (r.sourceId) {
        let doc = null;
        try {
           doc = await EmpFRN.findById(r.sourceId).lean();
           if (!doc) doc = await Service.findById(r.sourceId).lean();
           if (!doc) doc = await EstimationPending.findById(r.sourceId).lean();
        } catch(e) {}
        
        if (doc) {
          const mName = doc.model || '';
          const bName = doc.defMod || doc.defBrdModName || r.description || '';
          if (mName) r.model = mName;
          if (bName) r.description = bName;
          r.unitStatus = doc.unitSts || doc.unitStatus || '';
          r.quantity = doc.qty || doc.quantity || '';
        }
      }
    }
    
    res.json(records);
  } catch (error) {
    console.error('Error fetching CTODR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new CTODR entry
router.post('/', protect, async (req, res) => {
  try {
    const newRecord = new Ctodr({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (error) {
    console.error('Error creating CTODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a CTODR entry
router.put('/:id', protect, async (req, res) => {
  try {
    const record = await Ctodr.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (error) {
    console.error('Error updating CTODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a CTODR entry
router.delete('/:id', protect, async (req, res) => {
  try {
    const record = await Ctodr.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting CTODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
