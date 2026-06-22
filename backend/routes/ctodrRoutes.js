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
    
    const sourceIds = [...new Set(records.map(r => r.sourceId).filter(Boolean))];
    
    const [empFrnDocs, serviceDocs, estPendDocs] = await Promise.all([
      EmpFRN.find({ _id: { $in: sourceIds } }).populate('division', 'name').lean(),
      Service.find({ _id: { $in: sourceIds } }).populate('division', 'name').lean(),
      EstimationPending.find({ _id: { $in: sourceIds } }).lean()
    ]);
    
    const docMap = {};
    empFrnDocs.forEach(d => docMap[d._id.toString()] = d);
    serviceDocs.forEach(d => docMap[d._id.toString()] = d);
    estPendDocs.forEach(d => docMap[d._id.toString()] = d);
    
    for (let r of records) {
      splitLegacyDescription(r);
      if (r.sourceId) {
        const doc = docMap[r.sourceId.toString()];
        if (doc) {
          const mName = doc.model || '';
          const bName = (r.description && r.description !== 'TO/DR entry') ? r.description : (doc.defMod || doc.defBrdModName || r.description || '');
          if (mName) r.model = mName;
          if (bName) r.description = bName;
          r.unitStatus = doc.unitSts || doc.unitStatus || '';
          r.quantity = doc.qty || doc.quantity || '';
          r.division = (doc.division && doc.division.name) ? doc.division.name : (doc.divisionName || '');
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
