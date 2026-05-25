// routes/aprofRoutes.js  –  Admin: PRF/OB List
const router = require('express').Router();
const EPrfOb = require('../models/EPrfOb');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division, region, type, status, from, to } = req.query;
    const f = {};
    if (division) f.division = division;
    if (region)   f.region   = region;
    if (type)     f.type     = type;
    if (status)   f.status   = status;
    if (from || to) { f.entryDate = {}; if (from) f.entryDate.$gte = from; if (to) f.entryDate.$lte = to; }
    const docs = await EPrfOb.find(f).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await EPrfOb.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await EPrfOb.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await EPrfOb.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await EPrfOb.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
