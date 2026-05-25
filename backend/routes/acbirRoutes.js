// routes/acbirRoutes.js - Admin: Combined Closed BIR
const router = require('express').Router();
const AClosedBir = require('../models/AClosedBir');
const ClosedBir = require('../models/ClosedBir');
const EClosedBir = require('../models/EClosedBir');
const PtClosedBir = require('../models/PtClosedBir');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function divisionFilter(value) {
  const name = String(value || '').trim().toUpperCase();
  if (name === 'SAG' || name === 'GANSHORN') return { $in: ['SAG', 'GANSHORN'] };
  return value;
}

function buildFilter(query, dateField, statusField) {
  const { division, status, finalStatus, from, to } = query;
  const f = {};
  if (division) f.division = divisionFilter(division);
  const chosenStatus = status || finalStatus;
  if (chosenStatus) f[statusField] = chosenStatus;
  if (from || to) {
    f[dateField] = {};
    if (from) f[dateField].$gte = from;
    if (to) f[dateField].$lte = to;
  }
  return f;
}

function normalize(doc, source) {
  const d = doc || {};
  return {
    ...d,
    id: String(d._id || ''),
    _source: source,
    sourceLabel:
      source === 'ADMIN' ? 'Admin' :
      source === 'FQC' ? 'FQC' :
      source === 'EMP' ? 'Employee' : 'Product Team',
    birRef: d.birRef || d.birRefNo || '',
    unitInwardDate: d.unitInwardDate || d.inwardDate || '',
    status: d.status || d.finalStatus || 'Closed',
    finalStatus: d.finalStatus || d.status || 'Closed',
    accDetails: d.accDetails || d.accessoryDetails || '',
  };
}

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [adminDocs, fqcDocs, empDocs, ptDocs] = await Promise.all([
      AClosedBir.find(buildFilter(req.query, 'unitInwardDate', 'status')).sort({ approvedDate: -1, unitInwardDate: -1, createdAt: -1 }).lean(),
      ClosedBir.find(buildFilter(req.query, 'unitInwardDate', 'status')).sort({ approvedDate: -1, unitInwardDate: -1, createdAt: -1 }).lean(),
      EClosedBir.find(buildFilter(req.query, 'inwardDate', 'finalStatus')).sort({ approvedDate: -1, inwardDate: -1, createdAt: -1 }).lean(),
      PtClosedBir.find(buildFilter(req.query, 'unitInwardDate', 'status')).sort({ approvedDate: -1, unitInwardDate: -1, createdAt: -1 }).lean(),
    ]);

    const combined = [
      ...adminDocs.map(d => normalize(d, 'ADMIN')),
      ...fqcDocs.map(d => normalize(d, 'FQC')),
      ...empDocs.map(d => normalize(d, 'EMP')),
      ...ptDocs.map(d => normalize(d, 'PT')),
    ].sort((a, b) => {
      const ad = new Date(a.approvedDate || a.unitInwardDate || a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.approvedDate || b.unitInwardDate || b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    });

    res.json(combined);
  } catch (e) {
    console.error('[GET /api/admin/bir/closed]', e);
    res.status(500).json({ message: e.message });
  }
});

router.get('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;
    if (source === 'ADMIN') doc = await AClosedBir.findById(id).lean();
    if (source === 'FQC') doc = await ClosedBir.findById(id).lean();
    if (source === 'EMP') doc = await EClosedBir.findById(id).lean();
    if (source === 'PT') doc = await PtClosedBir.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(normalize(doc, source));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await AClosedBir.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(normalize(doc.toObject(), 'ADMIN'));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;
    const update = { ...req.body, updatedBy: req.user._id };
    if (source === 'ADMIN') doc = await AClosedBir.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    if (source === 'FQC') doc = await ClosedBir.findByIdAndUpdate(id, update, { new: true, runValidators: false }).lean();
    if (source === 'EMP') doc = await EClosedBir.findByIdAndUpdate(id, update, { new: true, runValidators: false }).lean();
    if (source === 'PT') doc = await PtClosedBir.findByIdAndUpdate(id, update, { new: true, runValidators: false }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(normalize(doc, source));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;
    if (source === 'ADMIN') doc = await AClosedBir.findByIdAndDelete(id);
    if (source === 'FQC') doc = await ClosedBir.findByIdAndDelete(id);
    if (source === 'EMP') doc = await EClosedBir.findByIdAndDelete(id);
    if (source === 'PT') doc = await PtClosedBir.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
