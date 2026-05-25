const router = require('express').Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// Fetch active notifications for current user
router.get('/my', protect, async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    
    const filter = { 
      isActive: true,
      $or: [
        { targetRole: 'all' },
        { targetRole: role }
      ]
    };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Attach unread status
    const data = notifications.map(n => ({
      ...n,
      isUnread: !(n.readBy || []).some(id => id.toString() === req.user._id.toString())
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Mark as read
router.post('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
