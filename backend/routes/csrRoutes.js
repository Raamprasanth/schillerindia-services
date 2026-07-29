const express = require('express');
const Csr = require('../models/Csr');
const ScCsr = require('../models/ScCsr');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUseSr(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['employee', 'field_engineer', 'service_team', 'repair_team', 'service_coordinator', 'admin', 'superadmin', 'administrator', 'user'].includes(role);
}

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

router.use((req, res, next) => {
  if (!canUseSr(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access CSR items.' });
  }
  next();
});

router.get('/', async (req, res) => {
  try {
    const { from, to, division } = req.query;
    const filter = {};
    if (from || to) {
      filter.closeDate = {};
      if (from) filter.closeDate.$gte = from;
      if (to) filter.closeDate.$lte = to;
    }
    if (division) filter.division = division;

    if (!isPrivileged(req.user)) {
      const userDivisions = getUserDivisions(req.user);
      if (!userDivisions.length) return res.json([]);
      if (division && !userDivisions.some(d => d.toLowerCase() === String(division).trim().toLowerCase())) {
        return res.json([]);
      }
      if (!division) filter.division = { $in: userDivisions };
    }

    const docs = await Csr.find(filter).sort({ closeDate: -1, createdAt: -1 }).lean();
    
    // Fetch related ScCsr to fill in missing toNo and toRaisedDate for older entries
    const girNos = docs.filter(d => !d.toNo).map(d => d.girNo).filter(Boolean);
    if (girNos.length > 0) {
      const scCsrs = await ScCsr.find({ girNo: { $in: girNos } }, 'girNo partNo toNo toRaisedDate').lean();
      const scsrMap = scCsrs.reduce((acc, scsr) => {
        if (scsr.girNo && scsr.partNo) acc[scsr.girNo + '_' + scsr.partNo] = scsr;
        return acc;
      }, {});
      
      for (const d of docs) {
        if (!d.toNo && d.girNo && d.partNo) {
          const related = scsrMap[d.girNo + '_' + d.partNo];
          if (related) {
            d.toNo = related.toNo || '';
            d.toRaisedDate = related.toRaisedDate || null;
          }
        }
      }
    }
    
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/csr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
