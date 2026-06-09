const express = require('express');
const PtClosedActivity = require('../models/PtClosedActivity');
const PtPendingActivity = require('../models/PtPendingActivity');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function canUsePtCa(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtCa(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team Closed Activity.' });
  }
  next();
});

function normalizeDivision(value) {
  return String(value || '').trim().toLowerCase();
}

function getUserDivisions(user) {
  const values = [
    user?.activeDivision,
    user?.division,
    ...(Array.isArray(user?.divisions) ? user.divisions : []),
  ];
  return [...new Set(values.map(normalizeDivision).filter(Boolean))];
}

function getWriteDivision(user, body = {}) {
  return String(body.division || user?.activeDivision || user?.division || '').trim();
}

function isAdminUser(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['admin', 'superadmin', 'administrator'].includes(role);
}

async function getAllowedCreatorIds(user) {
  const divisions = getUserDivisions(user);
  if (!divisions.length) return [];
  const docs = await User.find({
    $or: [
      { division: { $in: divisions.map(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } },
      { activeDivision: { $in: divisions.map(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } },
      { divisions: { $elemMatch: { $in: divisions.map(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } } },
    ],
  }).select('_id').lean();
  return docs.map((doc) => doc._id);
}

async function buildDivisionAccessFilter(user) {
  if (isAdminUser(user)) return {};
  const divisions = getUserDivisions(user);
  const creatorIds = await getAllowedCreatorIds(user);
  const orFilters = [];
  if (divisions.length) {
    orFilters.push({ division: { $in: divisions.map(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } });
  }
  if (creatorIds.length) {
    orFilters.push({ createdBy: { $in: creatorIds } });
  }
  if (user?._id) {
    orFilters.push({ createdBy: user._id });
  }
  return orFilters.length ? { $or: orFilters } : { createdBy: user?._id };
}

async function canAccessDoc(user, doc) {
  if (!doc) return false;
  if (isAdminUser(user)) return true;
  const divisions = getUserDivisions(user);
  const docDivision = normalizeDivision(doc.division);
  if (docDivision && divisions.includes(docDivision)) return true;
  if (doc.createdBy && String(doc.createdBy) === String(user?._id || '')) return true;
  if (!doc.createdBy) return false;
  const creator = await User.findById(doc.createdBy).select('division activeDivision divisions').lean();
  if (!creator) return false;
  const creatorDivisions = getUserDivisions(creator);
  return creatorDivisions.some((value) => divisions.includes(value));
}

router.get('/', async (req, res) => {
  try {
    const filter = await buildDivisionAccessFilter(req.user);
    const docs = await PtClosedActivity.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.scEngineer || !body.initiatedDate || !body.activity || !body.status) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtClosedActivity.create({
      division: getWriteDivision(req.user, body),
      scEngineer: body.scEngineer,
      initiatedDate: body.initiatedDate,
      activity: body.activity,
      description: body.description || '',
      responsible: body.responsible || '',
      pendingFrom: body.pendingFrom || '',
      targetDate: body.targetDate || '',
      remarks: body.remarks || '',
      scInchargeRemarks: body.scInchargeRemarks || '',
      status: body.status || 'Closed',
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await PtClosedActivity.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    if (!(await canAccessDoc(req.user, existing))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const doc = await PtClosedActivity.findByIdAndDelete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const status = String(req.body.status || '').toLowerCase();
    const existing = await PtClosedActivity.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    if (!(await canAccessDoc(req.user, existing))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (status === 'pending') {
      const pendingDoc = await PtPendingActivity.create({
        division: existing.division || getWriteDivision(req.user, req.body),
        scEngineer: req.body.scEngineer || existing.scEngineer,
        initiatedDate: req.body.initiatedDate || existing.initiatedDate,
        activity: req.body.activity || existing.activity,
        description: req.body.description || existing.description,
        responsible: req.body.responsible || existing.responsible,
        pendingFrom: req.body.pendingFrom || existing.pendingFrom,
        targetDate: req.body.targetDate || existing.targetDate,
        remarks: req.body.remarks || existing.remarks,
        scInchargeRemarks: req.body.scInchargeRemarks || existing.scInchargeRemarks,
        status: req.body.status || existing.status,
        createdBy: existing.createdBy
      });
      await PtClosedActivity.findByIdAndDelete(req.params.id);
      return res.json(pendingDoc);
    }
    
    const doc = await PtClosedActivity.findByIdAndUpdate(
      req.params.id,
      { ...req.body, division: req.body.division || existing.division || getWriteDivision(req.user, req.body) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
