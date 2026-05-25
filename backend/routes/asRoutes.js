// routes/asRoutes.js  –  Admin: Combined Saleables (EmpSaleable + FqcNonSaleableFs)
const router           = require('express').Router();
const EmpSaleable      = require('../models/EmpSaleable');
const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/admin/saleables – merged view of both collections
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division, status, unitDetails, from, to } = req.query;
    const f = {};
    if (division)    f.division    = division;
    if (unitDetails) f.unitDetails = unitDetails;
    if (from || to) {
      f.entryDate = {};
      if (from) f.entryDate.$gte = from;
      if (to)   f.entryDate.$lte = to;
    }

    // EmpSaleable uses 'status' field; FqcNonSaleableFs uses 'finalStatus'
    const empFilter   = { ...f };
    const fqcFilter   = { ...f };
    if (status) {
      empFilter.status      = status;
      fqcFilter.finalStatus = status;
    }

    const [empDocs, fqcDocs] = await Promise.all([
      EmpSaleable.find(empFilter).sort({ createdAt: -1 }).lean(),
      FqcNonSaleableFs.find(fqcFilter).sort({ createdAt: -1 }).lean(),
    ]);

    const merged = [
      ...empDocs.map(d => ({ ...d, _source: 'EMP', _status: d.status })),
      ...fqcDocs.map(d => ({ ...d, _source: 'FQC', _status: d.finalStatus })),
    ].sort((a, b) => (b.entryDate || b.createdAt || '') > (a.entryDate || a.createdAt || '') ? 1 : -1);

    res.json(merged);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/admin/saleables/:source/:id
router.get('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = req.params.source === 'FQC' ? FqcNonSaleableFs : EmpSaleable;
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ ...doc, _source: req.params.source, _status: doc.status || doc.finalStatus });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/saleables/:source/:id
router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = req.params.source === 'FQC' ? FqcNonSaleableFs : EmpSaleable;
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
