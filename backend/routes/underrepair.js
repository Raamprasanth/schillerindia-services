// routes/underRepair.js
const express     = require('express');
const router      = express.Router();
const UnderRepair = require('../models/UnderRepair');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── GET ALL ───────────────────────────────────────────────
// Admin sees all; employee sees only their region's records
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { eng: req.user.name };   // employees filtered by their name
    const records = await UnderRepair.find(filter).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET ONE ───────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const record = await UnderRepair.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    // Prevent duplicate if a record for the same serviceId already exists
    if (req.body.serviceId) {
      const existing = await UnderRepair.findOne({ serviceId: req.body.serviceId });
      if (existing) {
        return res.status(409).json({
          message: 'An Under Repair record already exists for this service.',
        });
      }
    }
    const record = await UnderRepair.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const record = await UnderRepair.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE (admin only) ───────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const record = await UnderRepair.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;