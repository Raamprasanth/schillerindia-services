// routes/aprfobRoutes.js  –  Admin: Combined PRF/OB (ScPrfOb + EPrfOb)
const router  = require('express').Router();
const ScPrfOb = require('../models/ScPrfOb');
const EPrfOb  = require('../models/EPrfOb');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/admin/aprfob – merged view of both collections
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { type, status, division, from, to } = req.query;
    const f = {};
    if (type)     f.type     = type;
    if (status)   f.status   = status;
    if (division) f.division = division;
    if (from || to) {
      f.entryDate = {};
      if (from) f.entryDate.$gte = from;
      if (to)   f.entryDate.$lte = to;
    }

    const [scDocs, empDocs] = await Promise.all([
      ScPrfOb.find(f).sort({ createdAt: -1 }).lean(),
      EPrfOb.find(f).sort({ createdAt: -1 }).lean(),
    ]);

    const merged = [
      ...scDocs.map(d => ({ ...d, _source: 'SC' })),
      ...empDocs.map(d => ({ ...d, _source: 'EMP' })),
    ].sort((a, b) => (b.entryDate || b.createdAt || '') > (a.entryDate || a.createdAt || '') ? 1 : -1);

    res.json(merged);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/admin/aprfob/:source/:id – single record
router.get('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = req.params.source === 'SC' ? ScPrfOb : EPrfOb;
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ ...doc, _source: req.params.source });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/aprfob/:source/:id
router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = req.params.source === 'SC' ? ScPrfOb : EPrfOb;
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
