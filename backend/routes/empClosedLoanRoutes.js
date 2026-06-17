const express = require('express');
const EmpClosedLoan = require('../models/EmpClosedLoan');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function isPrivileged(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['service_coordinator', 'admin', 'superadmin', 'administrator'].includes(role);
}

function getUserDivisions(user) {
  const values = user?.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user?.divisions) && user.divisions.length ? [...user.divisions] : [user?.division]);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

router.get('/', async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (division) filter.division = division;

    const activeDivision = String(req.user?.activeDivision || '').trim();
    if (activeDivision) {
      if (division && activeDivision.toLowerCase() !== String(division).trim().toLowerCase()) {
        return res.json([]);
      }
      filter.division = division || activeDivision;
    } else if (!isPrivileged(req.user)) {
      const userDivisions = getUserDivisions(req.user);
      if (!userDivisions.length) return res.json([]);
      if (division && !userDivisions.some(d => d.toLowerCase() === String(division).trim().toLowerCase())) {
        return res.json([]);
      }
      if (!division) filter.division = { $in: userDivisions };
    }

    const docs = await EmpClosedLoan.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/emp-closed-loans]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await EmpClosedLoan.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Item not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/emp-closed-loans/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
