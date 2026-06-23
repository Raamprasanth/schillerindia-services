// routes/acloseRoutes.js  –  Admin: Closed Calls
const router = require('express').Router();
const AClose = require('../models/AClose');
const Eclose = require('../models/Eclose');
const PtClose = require('../models/PtClose');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division, region, status, from, to } = req.query;
    const f = {};
    if (division) f.division = division;
    if (region)   f.region   = region;
    if (status)   f.status   = status;
    if (from || to) { f.entryDate = {}; if (from) f.entryDate.$gte = from; if (to) f.entryDate.$lte = to; }

    // Fetch from all 3 collections
    const [aDocs, eDocs, pDocs] = await Promise.all([
      AClose.find(f).sort({ createdAt: -1 }).lean(),
      Eclose.find(f).sort({ createdAt: -1 }).lean(),
      PtClose.find(f).sort({ createdAt: -1 }).lean()
    ]);

    // Tag them so frontend knows source (optional but helpful)
    const combined = [
      ...aDocs.map(d => ({ ...d, source: 'Admin' })),
      ...eDocs.map(d => ({ ...d, source: 'Employee' })),
      ...pDocs.map(d => ({ ...d, source: 'Puducherry' }))
    ];

    // Final sort by entryDate or createdAt
    combined.sort((a, b) => (b.createdAt || '').toString().localeCompare((a.createdAt || '').toString()));

    res.json(combined);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Try AClose first, then Eclose, then PtClose
    let doc = await AClose.findById(req.params.id).lean();
    if (!doc) doc = await Eclose.findById(req.params.id).lean();
    if (!doc) doc = await PtClose.findById(req.params.id).lean();

    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await AClose.create({
      ...req.body,
      entryDate: req.body.callDate || req.body.entryDate || '',
      createdBy: req.user._id
    });
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await AClose.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found. (Note: Admin can only edit Admin-created closed calls here)' });
    res.json(doc);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    let Model;
    const s = req.params.source.toLowerCase();
    if (s === 'admin') Model = AClose;
    else if (s === 'employee') Model = Eclose;
    else if (s === 'puducherry' || s === 'pt') Model = PtClose;
    else return res.status(400).json({ message: 'Invalid call source.' });

    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
