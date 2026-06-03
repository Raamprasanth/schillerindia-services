const express = require('express');
const router = express.Router();
const Csw = require('../models/Csw');
const Scrap = require('../models/Scrap');
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
        orConditions.push({ engineer: empName });
        orConditions.push({ addedBy: empName });
      }
      if (orConditions.length > 0) {
        query.$or = orConditions;
      } else {
        return res.json([]);
      }
    }
    const docs = await Csw.find(query).sort({ entryDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/move/:id', protect, async (req, res) => {
  try {
    const scrapDoc = await Scrap.findById(req.params.id).lean();
    if (!scrapDoc) return res.status(404).json({ message: 'Record not found in Scrap list.' });
    
    delete scrapDoc._id;
    delete scrapDoc.__v;
    scrapDoc.addedBy = req.user.name || scrapDoc.addedBy;

    const cswDoc = await Csw.create(scrapDoc);
    await Scrap.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, doc: cswDoc });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
