const express = require('express');
const router = express.Router();
const Todr = require('../models/Todr');
const Ctodr = require('../models/Ctodr');
const { protect } = require('../middleware/authMiddleware');

const EmpFRN = require('../models/EmpFRN');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');

// GET all TODR entries
router.get('/', protect, async (req, res) => {
  try {
    let records = await Todr.find().sort({ entryDate: -1, createdAt: -1 }).lean();
    
    // Dynamically fetch 'mod brd name' for descriptions
    for (let r of records) {
      if (r.sourceId) {
        let doc = null;
        try {
           doc = await EmpFRN.findById(r.sourceId).lean();
           if (!doc) doc = await Service.findById(r.sourceId).lean();
           if (!doc) doc = await EstimationPending.findById(r.sourceId).lean();
        } catch(e) {}
        
        if (doc) {
          const mName = doc.model || '';
          const bName = doc.defMod || doc.defBrdModName || '';
          const newDesc = [mName, bName].filter(Boolean).join(' | ');
          if (newDesc) {
            r.description = newDesc;
          }
        }
      }
    }
    
    res.json(records);
  } catch (error) {
    console.error('Error fetching TODR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new TODR entry
router.post('/', protect, async (req, res) => {
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
router.post('/:id/fulfill', protect, async (req, res) => {
  try {
    const record = await Todr.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const fulfilledDate = req.body.fulfilledDate || new Date();
    const closedRecord = await Ctodr.create({
      entryDate: record.entryDate,
      frnNo: record.frnNo,
      partNo: record.partNo,
      description: record.description,
      action: record.action,
      toRaisedDate: record.toRaisedDate || null,
      sparesReceivedDate: record.sparesReceivedDate || null,
      fulfilledDate,
      fulfilledBy: req.user?.name || '',
      sourceId: record.sourceId || '',
      sourceModule: record.sourceModule || '',
      queuedBy: record.queuedBy || '',
      createdAt: record.createdAt || new Date(),
      updatedAt: new Date()
    });

    await Todr.findByIdAndDelete(req.params.id);
    res.json(closedRecord);
  } catch (error) {
    console.error('Error fulfilling TODR record:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a TODR entry
router.put('/:id', protect, async (req, res) => {
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
router.delete('/:id', protect, async (req, res) => {
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
