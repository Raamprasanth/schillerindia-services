// routes/dealerRoutes.js
const router = require('express').Router();
const Dealer = require('../models/Dealer');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET all dealers — return only fields the frontend uses
router.get('/', protect, async (req, res) => {
  try {
    const dealers = await Dealer.find()
      .select('name region createdAt')
      .sort({ createdAt: -1 });
    res.json(dealers);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST create dealer — only accept name + region
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, region } = req.body;

    if (!name || !name.trim())   return res.status(400).json({ message: 'Dealer name is required.' });
    if (!region || !region.trim()) return res.status(400).json({ message: 'Region is required.' });

    const VALID_REGIONS = [
      'North','East','West 1','West 2',
      'South 1 TN','South 1 KL','South 2 KA','South 2 AP/TL',
      'Puducherry','CG'
    ];
    if (!VALID_REGIONS.includes(region.trim())) {
      return res.status(400).json({ message: 'Invalid region value.' });
    }

    // Prevent duplicate dealer names within the same region
    const exists = await Dealer.findOne({
      name:   { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      region: region.trim()
    });
    if (exists) {
      return res.status(409).json({ message: `"${name.trim()}" already exists in ${region}.` });
    }

    const dealer = await Dealer.create({ name: name.trim(), region: region.trim() });
    // Return only the fields the frontend renders
    res.status(201).json({
      _id:       dealer._id,
      name:      dealer.name,
      region:    dealer.region,
      createdAt: dealer.createdAt
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT update dealer — only name + region editable
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, region } = req.body;

    if (!name || !name.trim())     return res.status(400).json({ message: 'Dealer name is required.' });
    if (!region || !region.trim()) return res.status(400).json({ message: 'Region is required.' });

    const VALID_REGIONS = [
      'North','East','West 1','West 2',
      'South 1 TN','South 1 KL','South 2 KA','South 2 AP/TL',
      'Puducherry','CG'
    ];
    if (!VALID_REGIONS.includes(region.trim())) {
      return res.status(400).json({ message: 'Invalid region value.' });
    }

    // Prevent duplicate on update (exclude the current document)
    const exists = await Dealer.findOne({
      _id:    { $ne: req.params.id },
      name:   { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      region: region.trim()
    });
    if (exists) {
      return res.status(409).json({ message: `"${name.trim()}" already exists in ${region}.` });
    }

    const dealer = await Dealer.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), region: region.trim() },
      { new: true, runValidators: true }
    ).select('_id name region createdAt');

    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' });

    res.json(dealer);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE dealer
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const dealer = await Dealer.findByIdAndDelete(req.params.id);
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' });
    res.json({ message: 'Dealer deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;