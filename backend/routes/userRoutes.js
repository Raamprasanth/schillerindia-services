// routes/users.js
const router = require('express').Router();
const User   = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function normalizeDivisions(input, fallback = '') {
  const values = Array.isArray(input) ? input : (input ? [input] : []);
  if (fallback) values.push(fallback);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

// ── GET /api/users/me — logged-in user's profile ─────────
router.get('/me', protect, (req, res) => res.json(req.user));

// ── GET /api/users — all users (admin only) ──────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      // ── FIX: removed .populate('division', 'name') ──
      // division is now a plain String — no population needed.
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/users — create new user (admin only) ───────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, phone, division, divisions } = req.body;
    const assignedDivisions = normalizeDivisions(divisions, division);

    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, password are required' });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ message: 'A user with this email already exists' });

    const user = await User.create({
      name,
      email,
      password,
      role:     role     || 'employee',
      phone:    phone    || '',
      division: assignedDivisions[0] || '',
      divisions: assignedDivisions,
    });

    const result = user.toObject();
    delete result.password;
    res.status(201).json(result);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/:id — update user (admin only) ────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, role, isActive, phone, division, divisions, password } = req.body;

    const updateData = {};
    if (name     !== undefined) updateData.name     = name;
    if (email    !== undefined) updateData.email    = email.toLowerCase().trim();
    if (role     !== undefined) updateData.role     = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (phone    !== undefined) updateData.phone    = phone;
    // ── FIX: was "|| null" — now stores the string value directly ──
    if (division !== undefined || divisions !== undefined) {
      const assignedDivisions = normalizeDivisions(divisions, division);
      updateData.division = assignedDivisions[0] || '';
      updateData.divisions = assignedDivisions;
    }

    if (password && password.trim().length >= 6)
      updateData.password = password.trim();

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password');
      // ── FIX: removed .populate('division', 'name') ──

    if (!updated)
      return res.status(404).json({ message: 'User not found' });

    res.json(updated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/users/:id — delete user (admin only) ─────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id))
      return res.status(400).json({ message: 'You cannot delete your own account' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted', deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
