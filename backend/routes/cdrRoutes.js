const express = require('express');
const router = express.Router();
const Cdr = require('../models/Cdr');
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

// GET all CDR entries
router.get('/', protect, async (req, res) => {
  try {
    const records = await Cdr.find().sort({ entryDate: -1, createdAt: -1 }).lean();
    
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
          const bName = doc.defMod || doc.defBrdModName || r.description || '';
          if (mName) r.model = mName;
          if (bName) r.description = bName;
          r.defGirNo = doc.defGir || doc.defGirNo || doc.defUnitGir || '';
          r.unitStatus = doc.unitSts || doc.unitStatus || '';
          r.quantity = doc.qty || doc.quantity || '';
          r.division = (doc.division && doc.division.name) ? doc.division.name : (doc.divisionName || '');
        }
      }
    }

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
