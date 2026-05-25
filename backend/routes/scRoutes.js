// routes/scRoutes.js
// Service Coordinator — PRF/OB and Spares endpoints
//
//  Mount in server.js:
//    const scRoutes = require('./routes/scRoutes');
//    app.use('/api/sc', scRoutes);
//
//  Endpoints:
//    GET    /api/sc/prf            → All PRF/OB records
//    GET    /api/sc/prf/stats      → PRF stats
//    POST   /api/sc/prf            → Create PRF record
//    PUT    /api/sc/prf/:id        → Update PRF record
//    DELETE /api/sc/prf/:id        → Delete PRF record
//
//    GET    /api/sc/spares         → All spares requests
//    GET    /api/sc/spares/stats   → Spares stats
//    POST   /api/sc/spares         → Create spares request
//    PUT    /api/sc/spares/:id     → Update spares request
//    DELETE /api/sc/spares/:id     → Delete spares request

const router   = require('express').Router();
const mongoose = require('mongoose');
const SCPrf    = require('../models/SCPrfModel');
const SCSpares = require('../models/SCSparesModel');
const { protect } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function calcDays(dateStr) {
  if (!dateStr) return 0;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return isNaN(diff) ? 0 : Math.max(0, diff);
}

function hydratePrf(docs) {
  return docs.map(d => {
    const obj = d.toObject ? d.toObject() : { ...d };
    obj.pendingDays = calcDays(obj.entryDate || obj.createdAt);
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/prf/stats  (before /:id so "stats" isn't treated as an id)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/prf/stats', protect, async (req, res) => {
  try {
    const [total, open, pending, closed] = await Promise.all([
      SCPrf.countDocuments(),
      SCPrf.countDocuments({ status: 'open' }),
      SCPrf.countDocuments({ status: 'pending' }),
      SCPrf.countDocuments({ status: 'closed' }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const overdue = await SCPrf.countDocuments({
      status: { $in: ['open', 'pending'] },
      entryDate: { $lte: thirtyDaysAgo },
    });

    const today = new Date().toISOString().split('T')[0];
    const closedToday = await SCPrf.countDocuments({ status: 'closed', closedDate: today });

    res.json({ total, open, pending, closed, overdue, closedToday });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/prf
// ─────────────────────────────────────────────────────────────────────────────
router.get('/prf', protect, async (req, res) => {
  try {
    const match = {};
    if (req.query.status)   match.status   = req.query.status;
    if (req.query.division) match.division = req.query.division;
    if (req.query.from || req.query.to) {
      match.entryDate = {};
      if (req.query.from) match.entryDate.$gte = req.query.from;
      if (req.query.to)   match.entryDate.$lte = req.query.to;
    }

    const records = await SCPrf.find(match).sort({ createdAt: -1 });
    res.json(hydratePrf(records));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/prf/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/prf/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });
    const record = await SCPrf.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'PRF record not found.' });
    res.json(hydratePrf([record])[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sc/prf
// ─────────────────────────────────────────────────────────────────────────────
router.post('/prf', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    body.submittedBy = req.user.name || body.submittedBy || '';
    body.submittedAt = body.submittedAt || new Date().toISOString();

    const record = await SCPrf.create(body);
    res.status(201).json(hydratePrf([record])[0]);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/sc/prf/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/prf/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });

    const body = { ...req.body };
    body.updatedBy = req.user.name || '';
    body.updatedAt = new Date().toISOString();
    delete body.submittedBy;
    delete body.submittedAt;

    // Auto-set closedDate when status → closed
    if (body.status === 'closed' && !body.closedDate) {
      body.closedDate = new Date().toISOString().split('T')[0];
    }

    const updated = await SCPrf.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: false });
    if (!updated) return res.status(404).json({ message: 'PRF record not found.' });
    res.json(hydratePrf([updated])[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/sc/prf/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/prf/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });
    const deleted = await SCPrf.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'PRF record not found.' });
    res.json({ message: 'PRF record deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SPARES
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/spares/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/spares/stats', protect, async (req, res) => {
  try {
    const [total, pending, open, completed, closed] = await Promise.all([
      SCSpares.countDocuments(),
      SCSpares.countDocuments({ status: 'pending' }),
      SCSpares.countDocuments({ status: 'open' }),
      SCSpares.countDocuments({ status: 'completed' }),
      SCSpares.countDocuments({ status: 'closed' }),
    ]);
    res.json({ total, pending, open, completed, closed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/spares
// ─────────────────────────────────────────────────────────────────────────────
router.get('/spares', protect, async (req, res) => {
  try {
    const match = {};
    if (req.query.status)   match.status   = req.query.status;
    if (req.query.division) match.division = req.query.division;

    const records = await SCSpares.find(match).sort({ createdAt: -1 });
    res.json(records.map(d => d.toObject ? d.toObject() : { ...d }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sc/spares/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/spares/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });
    const record = await SCSpares.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Spares record not found.' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sc/spares
// ─────────────────────────────────────────────────────────────────────────────
router.post('/spares', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    body.submittedBy = req.user.name || body.submittedBy || '';
    body.submittedAt = body.submittedAt || new Date().toISOString();
    if (!body.requestedDate) body.requestedDate = new Date().toISOString().split('T')[0];

    const record = await SCSpares.create(body);
    res.status(201).json(record);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/sc/spares/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/spares/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });

    const body = { ...req.body };
    body.updatedBy = req.user.name || '';
    body.updatedAt = new Date().toISOString();
    delete body.submittedBy;
    delete body.submittedAt;

    // Auto-set completedDate when status → completed/closed
    if ((body.status === 'completed' || body.status === 'closed') && !body.completedDate) {
      body.completedDate = new Date().toISOString().split('T')[0];
    }

    const updated = await SCSpares.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: false });
    if (!updated) return res.status(404).json({ message: 'Spares record not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/sc/spares/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/spares/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid ID.' });
    const deleted = await SCSpares.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Spares record not found.' });
    res.json({ message: 'Spares record deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
