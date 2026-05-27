const express = require('express');
const TourSummary = require('../models/TourSummary');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const RepairTeam = require('../models/Repairteam');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

function canUseTours(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['employee', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUseTours(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access tour summaries.' });
  }
  next();
});

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { createdById: user?._id };
}

function normalizeDivision(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function getDivisionLabel(user) {
  return String(user?.activeDivision || user?.division || (Array.isArray(user?.divisions) ? user.divisions[0] : '') || '').trim();
}

function visibilityFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  const divisionKey = normalizeDivision(getDivisionLabel(user));
  if (!divisionKey) return { createdById: user?._id };
  return { createdByDivisionKey: divisionKey };
}

async function loadCreatorsMap(ids = []) {
  const uniqueIds = [...new Set(ids.map((id) => String(id || '')).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const [admins, employees, repairs] = await Promise.all([
    Admin.find({ _id: { $in: uniqueIds } }).select('division divisions').lean(),
    Employee.find({ _id: { $in: uniqueIds } }).select('division divisions').lean(),
    RepairTeam.find({ _id: { $in: uniqueIds } }).select('division divisions').lean(),
  ]);

  let users = [];
  try {
    const User = require('../models/User');
    users = await User.find({ _id: { $in: uniqueIds } }).select('division divisions').lean();
  } catch (_) {}

  const map = new Map();
  [...admins, ...employees, ...repairs, ...users].forEach((doc) => {
    if (!doc?._id) return;
    const division = String(doc.division || (Array.isArray(doc.divisions) ? doc.divisions[0] : '') || '').trim();
    if (!division) return;
    map.set(String(doc._id), {
      createdByDivision: division,
      createdByDivisionKey: normalizeDivision(division),
    });
  });
  return map;
}

async function backfillMissingTourDivisions() {
  const missing = await TourSummary.find({
    $or: [
      { createdByDivisionKey: { $exists: false } },
      { createdByDivisionKey: '' },
    ],
    createdById: { $ne: null },
  }).select('_id createdById').lean();

  if (!missing.length) return;
  const creators = await loadCreatorsMap(missing.map((doc) => doc.createdById));
  const ops = missing.map((doc) => {
    const resolved = creators.get(String(doc.createdById || ''));
    if (!resolved) return null;
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: resolved },
      },
    };
  }).filter(Boolean);

  if (ops.length) await TourSummary.bulkWrite(ops, { ordered: false });
}

router.get('/', async (req, res) => {
  try {
    await backfillMissingTourDivisions();
    const docs = await TourSummary.find(visibilityFilter(req.user)).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/tours]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.startDate || !body.customerName) {
      return res.status(400).json({ message: 'Required: start date and customer name.' });
    }
    const images = Array.isArray(body.images) ? body.images.filter(Boolean).slice(0, 5) : [];
    const tooLarge = images.some((img) => Buffer.byteLength(String(img), 'utf8') > 4.2 * 1024 * 1024);
    if (tooLarge) return res.status(400).json({ message: 'Each image must be 3 MB or smaller.' });

    const doc = await TourSummary.create({
      tourName: body.tourName || '',
      dayNo: Math.max(1, Number(body.dayNo) || 1),
      startDate: body.startDate,
      customerName: body.customerName,
      region: body.region || '',
      branch: body.branch || '',
      model: body.model || '',
      unitStatus: body.unitStatus || '',
      unitSlNo: body.unitSlNo || '',
      problemReported: body.problemReported || '',
      problemObserved: body.problemObserved || '',
      actionTaken: body.actionTaken || '',
      images,
      createdBy: req.user?.name || req.user?.email || '',
      createdById: req.user?._id,
      createdByDivision: getDivisionLabel(req.user),
      createdByDivisionKey: normalizeDivision(getDivisionLabel(req.user)),
      updatedBy: req.user?.name || req.user?.email || '',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/tours]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await TourSummary.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Tour summary not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/tours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
