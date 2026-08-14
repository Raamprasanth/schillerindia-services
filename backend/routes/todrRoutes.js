const express = require('express');
const router = express.Router();
const Todr = require('../models/Todr');
const Ctodr = require('../models/Ctodr');
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
  if (Object.prototype.hasOwnProperty.call(body, 'toRaisedDate') && body.toRaisedDate) {
    const value = dateIso(body.toRaisedDate);
    if (value !== today) return 'TO Raised Date can be only today.';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sparesReceivedDate') && body.sparesReceivedDate) {
    const value = dateIso(body.sparesReceivedDate);
    if (!value || value > today) return 'Spares Rcd Date cannot be a future date.';
  }
  return '';
}

// GET all TODR entries
router.get('/', protect, async (req, res) => {
  try {
    let records = await Todr.find().sort({ entryDate: -1, createdAt: -1 }).lean();
    
    const sourceIds = [...new Set(
      records
        .map(r => r.sourceId)
        .filter(id => id && /^[0-9a-fA-F]{24}$/.test(String(id)))
    )];
    
    const docMap = new Map();
    if (sourceIds.length > 0) {
      const empFrns = await EmpFRN.find({ _id: { $in: sourceIds } }).populate('division', 'name').lean();
      empFrns.forEach(d => docMap.set(String(d._id), d));
      
      const missingIds1 = sourceIds.filter(id => !docMap.has(id));
      if (missingIds1.length > 0) {
        const services = await Service.find({ _id: { $in: missingIds1 } }).populate('division', 'name').lean();
        services.forEach(d => docMap.set(String(d._id), d));
      }
      
      const missingIds2 = sourceIds.filter(id => !docMap.has(id));
      if (missingIds2.length > 0) {
        const estPendings = await EstimationPending.find({ _id: { $in: missingIds2 } }).lean();
        estPendings.forEach(d => docMap.set(String(d._id), d));
      }
    }
    
    // Dynamically fetch 'mod brd name' for descriptions
    for (let r of records) {
      splitLegacyDescription(r);
      if (r.sourceId && docMap.has(String(r.sourceId))) {
        const doc = docMap.get(String(r.sourceId));
        const mName = doc.model || '';
        const bName = (r.description && r.description !== 'TO/DR entry') ? r.description : (doc.defMod || doc.defBrdModName || r.description || '');
        if (mName) r.model = mName;
        if (bName) r.description = bName;
        r.defGirNo = doc.defGir || doc.defGirNo || doc.defUnitGir || '';
        r.unitStatus = doc.unitSts || doc.unitStatus || '';
        r.quantity = r.quantity || doc.qty || doc.quantity || '';
        r.division = (doc.division && doc.division.name) ? doc.division.name : (doc.divisionName || '');
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

// POST bulk fulfill TODR entries (must be before /:id/fulfill)
router.post('/bulk-fulfill', protect, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const fulfilledDate = todayIso();
    const results = [];
    for (const id of ids) {
      const record = await Todr.findById(id).lean();
      if (record) {
        const closedRecord = await Ctodr.create({
          entryDate: record.entryDate,
          frnNo: record.frnNo,
          partNo: record.partNo,
          model: record.model || '',
          description: record.description,
          action: record.action,
          toNo: record.toNo || '',
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
        await Todr.findByIdAndDelete(id);
        results.push(closedRecord);
      }
    }
    res.json({ success: true, fulfilledCount: results.length });
  } catch (error) {
    console.error('Error bulk fulfilling TODR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT bulk update TODR entries (must be before /:id)
router.put('/bulk-update', protect, async (req, res) => {
  try {
    const { ids, toNo, toRaisedDate, sparesReceivedDate } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const dateError = validateDatePayload({ toRaisedDate, sparesReceivedDate });
    if (dateError) return res.status(400).json({ message: dateError });

    const updateData = { updatedAt: new Date() };
    if (toRaisedDate !== undefined) updateData.toRaisedDate = toRaisedDate;
    if (sparesReceivedDate !== undefined) updateData.sparesReceivedDate = sparesReceivedDate;
    if (toNo !== undefined) updateData.toNo = toNo;

    const results = [];
    for (const id of ids) {
      const record = await Todr.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      if (record) results.push(record);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating TODR records:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST fulfill single TODR entry
router.post('/:id/fulfill', protect, async (req, res) => {
  try {
    const record = await Todr.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const fulfilledDate = todayIso();
    const closedRecord = await Ctodr.create({
      entryDate: record.entryDate,
      frnNo: record.frnNo,
      partNo: record.partNo,
      model: record.model || '',
      description: record.description,
      action: record.action,
      toNo: record.toNo || '',
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
    const dateError = validateDatePayload(req.body);
    if (dateError) return res.status(400).json({ message: dateError });

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
