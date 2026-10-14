// routes/serviceRoutes.js
const router   = require('express').Router();
const Service  = require('../models/Service');
const User     = require('../models/User');
const Division = require('../models/Division');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const { syncLinkedRecords, cleanupLinkedRecords } = require('../services/queueSyncService');

function normalizeUnitStatus(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = { IW: 'IW', EW: 'EW', CAMC: 'CAMC', STOCK: 'STOCK', DEMO: 'Demo', REPEAT: 'Repeat', 'BUY BACK': 'Buy Back', BUYBACK: 'Buy Back', OW: 'OW', LAMC: 'LAMC' };
  return map[upper] || raw;
}

function normalizeRepType(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = { NA: 'NA', 'TO/ADV SO': 'TO/ADV SO', 'BS/SO': 'BS/SO' };
  return map[upper] || raw;
}

async function resolveDivisionInput(body) {
  const mongoose = require('mongoose');
  if (body.divisionName || (body.division && !mongoose.Types.ObjectId.isValid(body.division))) {
    const Division = require('../models/Division');
    const divName = body.divisionName || body.division;
    const divDoc = await Division.findOne({ name: new RegExp('^' + String(divName).trim() + '$', 'i') });
    if (divDoc) body.division = divDoc._id;
    delete body.divisionName;
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/services — admin sees all, employee sees own (supports pagination & filtering)
router.get('/', protect, async (req, res) => {
  try {
    let queryFilter = req.user.role === 'admin' ? {} : { engineer: req.user._id };

    // ── Pagination params ─────────────────────────────────────
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = hasPagination ? Math.min(200, Math.max(1, parseInt(req.query.limit) || 50)) : 0;
    const skip  = hasPagination ? (page - 1) * limit : 0;

    // ── Server-side search filter ─────────────────────────────
    const searchTerm = String(req.query.search || '').trim();
    if (searchTerm) {
      const re = new RegExp(escapeRegex(searchTerm), 'i');
      const searchOr = [
        { scReNo: re }, { custName: re }, { customer: re }, { eng: re },
        { scEng: re },  { frnNo: re },   { model: re },    { defGir: re },
        { raEng: re },  { branch: re },  { partNo: re },
      ];
      queryFilter = queryFilter.$or
        ? { $and: [queryFilter, { $or: searchOr }] }
        : { ...queryFilter, $or: searchOr };
    }

    // ── Status filter ─────────────────────────────────────────
    const statusParam = String(req.query.status || '').trim();
    if (statusParam && ['pending','in_progress','completed','escalated'].includes(statusParam)) {
      queryFilter.status = statusParam;
    }

    // ── Division filter ───────────────────────────────────────
    const divParam = String(req.query.div || req.query.division || '').trim();
    if (divParam) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(divParam)) {
        queryFilter.division = new mongoose.Types.ObjectId(divParam);
      } else {
        const divPat = new RegExp('^' + escapeRegex(divParam) + '$', 'i');
        const dDoc = await Division.findOne({ $or: [{ name: divPat }, { displayName: divPat }] }).lean().catch(() => null);
        if (dDoc) {
          queryFilter.division = dDoc._id;
        } else {
          queryFilter.division = null;
        }
      }
    }

    // ── Engineer filter ───────────────────────────────────────
    const engParam = String(req.query.eng || '').trim();
    if (engParam) {
      const engRe = new RegExp('^' + escapeRegex(engParam) + '$', 'i');
      const engOr = [{ eng: engRe }, { scEng: engRe }];
      if (queryFilter.$and) {
        queryFilter.$and.push({ $or: engOr });
      } else if (queryFilter.$or) {
        queryFilter = { $and: [queryFilter, { $or: engOr }] };
      } else {
        queryFilter = { ...queryFilter, $or: engOr };
      }
    }

    // ── Date range filter ─────────────────────────────────────
    const fromParam = String(req.query.from || '').trim();
    const toParam   = String(req.query.to   || '').trim();
    if (fromParam || toParam) {
      const dateFilter = {};
      if (fromParam) dateFilter.$gte = fromParam;
      if (toParam)   dateFilter.$lte = toParam;
      queryFilter.entryDate = dateFilter;
    }

    // ── Mine only filter ──────────────────────────────────────
    const mineParam = String(req.query.mine || '').trim();
    if (mineParam === '1' || mineParam === 'true') {
      const myName = req.user.name || '';
      const mongoose = require('mongoose');
      const mineOr = [{ scEng: myName }, { eng: myName }, { submittedBy: myName }];
      if (mongoose.Types.ObjectId.isValid(String(req.user._id || ''))) {
        mineOr.push({ engineer: new mongoose.Types.ObjectId(req.user._id) });
      }
      if (queryFilter.$and) {
        queryFilter.$and.push({ $or: mineOr });
      } else if (queryFilter.$or) {
        queryFilter = { $and: [queryFilter, { $or: mineOr }] };
      } else {
        queryFilter = { ...queryFilter, $or: mineOr };
      }
    }

    // ── Count & fetch query ───────────────────────────────────
    let findQuery = Service.find(queryFilter)
      .populate('engineer', 'name email')
      .populate('division', 'name displayName')
      .sort({ createdAt: -1 });

    if (limit > 0) {
      findQuery = findQuery.skip(skip).limit(limit);
    }

    const [total, list] = await Promise.all([
      Service.countDocuments(queryFilter),
      findQuery.lean(),
    ]);

    if (hasPagination) {
      const pages = Math.max(1, Math.ceil(total / (limit || 50)));
      return res.json({ data: list, total, page, pages });
    }

    res.json(list);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// GET /api/services/:id — single service
router.get('/:id', protect, async (req, res) => {
  try {
    const svc = await Service.findById(req.params.id)
      .populate('engineer', 'name email')
      .populate('division', 'name')
      .lean();

    if (!svc) return res.status(404).json({ message: 'Service not found' });

    res.json(svc);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// POST /api/services — create service
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);
    await resolveDivisionInput(body);

    const svc = await Service.create({
      ...body,
      engineer: req.user._id,
      submittedBy: req.user.name || '',
      submittedAt: new Date().toISOString()
    });

    const svcObj = svc.toObject();
    await syncLinkedRecords(svcObj, req.user);

    res.status(201).json(svc);
  } catch (err) { 
    res.status(400).json({ message: err.message }); 
  }
});

// PUT /api/services/:id — update service
router.put('/:id', protect, async (req, res) => {
  try {
    const body = { ...req.body, updatedAt: new Date().toISOString() };
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);
    await resolveDivisionInput(body);

    const svc = await Service.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: false }
    );

    if (!svc) return res.status(404).json({ message: 'Service not found' });

    const svcObj = svc.toObject();
    await syncLinkedRecords(svcObj, req.user);

    res.json(svc);
  } catch (err) { 
    res.status(400).json({ message: err.message }); 
  }
});

// DELETE /api/services/:id — delete (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    await cleanupLinkedRecords(req.params.id);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
