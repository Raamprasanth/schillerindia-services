const express = require('express');
const router = express.Router();
const Dr = require('../models/Dr');
const { protect } = require('../middleware/authMiddleware');

const EmpFRN = require('../models/EmpFRN');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');

function todayIso() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateIso(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function splitLegacyDescription(record) {
  if (record.model || !record.description || !record.description.includes('|')) return;
  const [model, ...descParts] = String(record.description).split('|');
  const description = descParts.join('|').trim();
  if (model.trim() && description) {
    record.model = model.trim();
    record.description = description;
  }
}

function validateDatePayload(body) {
  const today = todayIso();
  if (Object.prototype.hasOwnProperty.call(body, 'sparesReceivedDate') && body.sparesReceivedDate) {
    const value = dateIso(body.sparesReceivedDate);
    if (!value || value > today) return 'Spares Rcd Date cannot be a future date.';
  }
  return '';
}

// GET all DR entries
router.get('/', protect, async (req, res) => {
  try {
    const records = await Dr.find().sort({ entryDate: -1, createdAt: -1 }).lean();
    
    // Dynamically fetch 'mod brd name' for descriptions
    for (let r of records) {
      splitLegacyDescription(r);
      if (r.sourceId) {
        let doc = null;
        try {
           doc = await EmpFRN.findById(r.sourceId).populate('division', 'name').lean();
           if (!doc) doc = await Service.findById(r.sourceId).populate('division', 'name').lean();
           if (!doc) doc = await EstimationPending.findById(r.sourceId).lean();
        } catch(e) {}
        
        if (doc) {
          const mName = doc.model || '';
          const bName = doc.defMod || doc.defBrdModName || r.description || '';
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
    const dateError = validateDatePayload(req.body);
    if (dateError) return res.status(400).json({ message: dateError });

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
