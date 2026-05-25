const router = require('express').Router();
const Ans = require('../models/Ans');
const EmpNonSaleable = require('../models/EmpNonSaleable');
const FqcNonsaleable = require('../models/FqcNonSaleable');
const { protect, adminOnly } = require('../middleware/authMiddleware');

/**
 * GET /api/admin/nonsaleable
 * Unified endpoint for Admin Non-Saleable dashboard.
 * Aggregates records from Ans, EmpNonSaleable, and FqcNonsaleable.
 */
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division, status, search, from, to } = req.query;

    const query = {};
    if (division) query.division = division;
    if (status) query.status = status;
    if (from || to) {
      query.fqcInDate = {};
      if (from) query.fqcInDate.$gte = from;
      if (to) query.fqcInDate.$lte = to;
    }

    // Search logic (optional, can be done client-side too)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { model: searchRegex },
        { modelSn: searchRegex },
        { customer: searchRegex },
        { engineer: searchRegex }
      ];
    }

    // Fetch from all collections
    const [ansDocs, empDocs, fqcDocs] = await Promise.all([
      Ans.find(query).sort({ createdAt: -1 }).lean(),
      EmpNonSaleable.find(query).sort({ createdAt: -1 }).lean(),
      FqcNonsaleable.find(query).sort({ createdAt: -1 }).lean()
    ]);

    // Tag records with source
    const combined = [
      ...ansDocs.map(d => ({ ...d, source: 'Admin', canDelete: true })),
      ...empDocs.map(d => ({ ...d, source: 'Employee', canDelete: false })),
      ...fqcDocs.map(d => ({ ...d, source: 'FQC', canDelete: false }))
    ];

    // Sort combined list by fqcInDate (desc) or createdAt (desc)
    combined.sort((a, b) => new Date(b.fqcInDate || b.createdAt) - new Date(a.fqcInDate || a.createdAt));

    res.json(combined);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/admin/nonsaleable
 * Create a new record directly in the Admin collection.
 */
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Ans.create({
      ...req.body,
      createdBy: req.user._id
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

/**
 * PUT /api/admin/nonsaleable/:id
 * Update a record in the Admin collection.
 */
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Ans.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found or not an Admin record.' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

/**
 * DELETE /api/admin/nonsaleable/:id
 * Delete a record (only if it belongs to the Admin collection).
 */
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Ans.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found or is an immutable imported record.' });
    res.json({ success: true, message: 'Admin record deleted successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
