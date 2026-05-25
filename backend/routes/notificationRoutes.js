const router = require('express').Router();
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /  — list all notifications (newest first)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { type, priority, targetRole, active } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (targetRole) filter.targetRole = targetRole;
    if (active !== undefined) filter.isActive = active === 'true';
    const docs = await Notification.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /:id  — single notification
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Notification.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /  — create notification
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Notification.create({
      ...req.body,
      createdBy: req.user._id,
      createdByName: req.user.name || 'Admin',
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT /:id  — update notification
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Notification.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE /:id  — delete notification
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Notification.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /:id/read  — mark as read by current user
router.post('/:id/read', protect, async (req, res) => {
  try {
    const doc = await Notification.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
