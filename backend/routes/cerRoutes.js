const express = require('express');
const router = express.Router();
const Cer = require('../models/Cer');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const resolveDivision = async (user) => {
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return null;
  const Division = require('../models/Division');
  return await Division.findOne({
    $or: [{ name: user.division }, { displayName: user.division }]
  }).lean();
};

router.get('/', protect, async (req, res) => {
  try {
    const query = {};
    const role = String(req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin') {
      const divDoc = await resolveDivision(req.user);
      const empName = String(req.user.name || '').trim();
      const orConditions = [];
      if (divDoc) orConditions.push({ division: divDoc.name });
      if (empName) {
        orConditions.push({ scEng: empName });
        orConditions.push({ eng: empName });
        orConditions.push({ raEng: empName });
      }
      if (orConditions.length > 0) {
        query.$or = orConditions;
      } else {
        return res.json([]);
      }
    }
    const docs = await Cer.find(query).sort({ entryDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/move/:id', protect, async (req, res) => {
  try {
    const srcDoc = await SCCompletedFRN.findById(req.params.id).lean();
    if (!srcDoc) return res.status(404).json({ message: 'Record not found in External Repair list.' });
    
    delete srcDoc._id;
    delete srcDoc.__v;
    srcDoc.updatedBy = req.user.name || srcDoc.updatedBy;
    srcDoc.status = 'closed';

    const newDoc = await Cer.create(srcDoc);
    await SCCompletedFRN.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, doc: newDoc });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
