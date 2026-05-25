const router = require('express').Router();
const ACall = require('../models/ACall');
const Ecall = require('../models/Ecall');
const PtCallRegister = require('../models/PtCallRegister');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function normalize(doc, source) {
  const id = String(doc._id || doc.id || '');
  return {
    ...doc,
    _id: id,
    id,
    source,
    sourceLabel: source === 'pt' ? 'Product Team' : source === 'employee' ? 'Employee' : 'Admin',
    region: doc.region || doc.branch || '',
    branch: doc.branch || doc.region || '',
    callType: doc.callType || doc.type || doc.typeWork || '',
    status: doc.status || 'Open',
    customer: doc.customer || '',
    sortDate: doc.callDate || doc.entryDate || doc.createdAt || '',
  };
}

function matchQuery(row, query) {
  const { source, division, region, status, callType, commType, scEng, engineer, from, to } = query;
  if (source && row.source !== source) return false;
  if (division && row.division !== division) return false;
  if (region && row.region !== region && row.branch !== region) return false;
  if (status && row.status !== status) return false;
  if (callType && row.callType !== callType) return false;
  if (commType && row.commType !== commType) return false;
  if (scEng && row.scEng !== scEng) return false;
  if (engineer && row.engineer !== engineer) return false;
  const d = String(row.callDate || '').slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function sourceModel(source) {
  if (source === 'employee') return Ecall;
  if (source === 'pt') return PtCallRegister;
  if (source === 'admin') return ACall;
  return null;
}

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [employeeCalls, ptCalls, adminCalls] = await Promise.all([
      Ecall.find({}).sort({ createdAt: -1 }).lean(),
      PtCallRegister.find({}).sort({ createdAt: -1 }).lean(),
      ACall.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const rows = [
      ...employeeCalls.map(doc => normalize(doc, 'employee')),
      ...ptCalls.map(doc => normalize(doc, 'pt')),
      ...adminCalls.map(doc => normalize(doc, 'admin')),
    ]
      .filter(row => matchQuery(row, req.query))
      .sort((a, b) => new Date(b.sortDate || b.createdAt || 0) - new Date(a.sortDate || a.createdAt || 0));

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = sourceModel(req.params.source);
    if (!Model) return res.status(400).json({ message: 'Invalid call source.' });
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(normalize(doc, req.params.source));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await ACall.create({
      ...req.body,
      createdBy: req.user._id,
      submittedBy: req.body.submittedBy || req.user.name || 'Admin',
    });
    res.status(201).json(normalize(doc.toObject(), 'admin'));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = sourceModel(req.params.source);
    if (!Model) return res.status(400).json({ message: 'Invalid call source.' });
    const doc = await Model.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(normalize(doc, req.params.source));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const Model = sourceModel(req.params.source);
    if (!Model) return res.status(400).json({ message: 'Invalid call source.' });
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
