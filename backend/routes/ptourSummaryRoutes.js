const express = require('express');
const mongoose = require('mongoose');
const PTourSummary = require('../models/PTourSummary');
const ATourSummary = require('../models/ATourSummary');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const RepairTeam = require('../models/Repairteam');
const { protect } = require('../middleware/authMiddleware');
const { buildTourWorkbookBuffer, sendWorkbook } = require('../utils/tourWorkbook');

const router = express.Router();

router.use(protect);

function canUsePtTours(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtTours(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team tour summaries.' });
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

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function visibilityFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};

  const divisionLabel = getDivisionLabel(user);
  const divisionKey = normalizeDivision(divisionLabel);
  
  const mongoose = require('mongoose');
  const userIds = [];
  if (user?._id) {
    try { userIds.push(new mongoose.Types.ObjectId(String(user._id))); }
    catch(e) { userIds.push(user._id); }
  }
  
  const userName = String(user?.name || user?.email || '').trim();
  const nameParts = userName.split(' ').filter(Boolean);
  const firstName = nameParts[0] || userName;

  const userMatch = [];
  if (userIds.length) userMatch.push({ createdById: { $in: userIds } });
  if (firstName) userMatch.push({ createdBy: new RegExp(escapeRegex(firstName), 'i') });

  const ownerClause = userMatch.length ? (userMatch.length === 1 ? userMatch[0] : { $or: userMatch }) : {};

  if (!divisionKey) return ownerClause;

  return {
    $or: [
      ownerClause,
      { createdByDivisionKey: divisionKey },
      { createdByDivision: new RegExp('^' + escapeRegex(divisionLabel) + '$', 'i') }
    ]
  };
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
  const missing = await PTourSummary.find({
    $or: [
      { createdByDivisionKey: { $exists: false } },
      { createdByDivisionKey: '' },
    ],
    createdById: { $ne: null },
  }).select('_id createdById createdByDivision').lean();

  if (!missing.length) return;
  const creators = await loadCreatorsMap(missing.map((doc) => doc.createdById));
  const ops = missing.map((doc) => {
    let divKey = doc.createdByDivision ? normalizeDivision(doc.createdByDivision) : '';
    let divLabel = doc.createdByDivision || '';
    if (!divKey) {
      const resolved = creators.get(String(doc.createdById || ''));
      if (resolved) {
        divKey = resolved.createdByDivisionKey;
        divLabel = resolved.createdByDivision;
      }
    }
    if (!divKey) return null;
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { createdByDivision: divLabel, createdByDivisionKey: divKey } },
      },
    };
  }).filter(Boolean);

  if (ops.length) await PTourSummary.bulkWrite(ops, { ordered: false });
}

router.get('/', async (req, res) => {
  try {
    await backfillMissingTourDivisions();
    const docs = await PTourSummary.find(visibilityFilter(req.user)).sort({ startDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptours]', err);
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

    const doc = await PTourSummary.create({
      tourName: body.tourName || '',
      dayNo: Math.max(1, Number(body.dayNo) || 1),
      startDate: body.startDate,
      customerName: body.customerName,
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
    });

    try {
      await ATourSummary.create({
        ...doc.toObject(),
        _id: new require('mongoose').Types.ObjectId(),
        sourceType: 'Product Team',
        sourceId: doc._id
      });
    } catch (atErr) {
      console.error('[POST /api/ptours] ATourSummary mirror error:', atErr);
    }

    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptours]', err);
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    await backfillMissingTourDivisions();
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id))).map(String)
      : [];
    const filter = { ...visibilityFilter(req.user) };
    if (ids.length) filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };

    const docs = await PTourSummary.find(filter).sort({ startDate: 1, createdAt: 1 }).lean();
    const order = new Map(ids.map((id, index) => [id, index]));
    const ordered = ids.length
      ? docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))
      : docs;

    const buffer = await buildTourWorkbookBuffer(ordered, { sheetName: 'Tour Summary' });
    sendWorkbook(res, buffer, req.body?.fileName || 'PT_Tour_Summary_Export');
  } catch (err) {
    console.error('[POST /api/ptours/export]', err);
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PTourSummary.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Tour summary not found.' });

    try {
      await ATourSummary.deleteMany({ sourceId: req.params.id, sourceType: 'Product Team' });
    } catch (atErr) {
      console.error('[DELETE /api/ptours] ATourSummary mirror error:', atErr);
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptours/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
