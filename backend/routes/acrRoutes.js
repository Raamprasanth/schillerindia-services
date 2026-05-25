// routes/acrRoutes.js - Admin: Combined Closed PRF/OB
const router = require('express').Router();
const ACr = require('../models/ACr');
const Ecr = require('../models/Ecr');
const EPrfOb = require('../models/EPrfOb');
const ScPrfOb = require('../models/ScPrfOb');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const CLOSED_STATUSES = ['Closed', 'Completed', 'Rejected'];

function buildFilter(query, includeDefaultStatus = true) {
  const { division, region, type, status, warrantyStatus, from, to } = query;
  const f = {};
  if (division) f.division = division;
  if (region) f.region = region;
  if (type) f.type = type;
  if (warrantyStatus) f.warrantyStatus = warrantyStatus;
  if (status) f.status = status;
  else if (includeDefaultStatus) f.status = { $in: CLOSED_STATUSES };
  if (from || to) {
    f.entryDate = {};
    if (from) f.entryDate.$gte = from;
    if (to) f.entryDate.$lte = to;
  }
  return f;
}

function normalize(doc, source) {
  const d = doc || {};
  return {
    ...d,
    id: String(d._id || ''),
    _source: source,
    sourceLabel: source === 'ADMIN' ? 'Admin' : source === 'SC' ? 'Service Coordinator' : 'Employee',
    scEng: d.scEng || d.scEngg || '',
    eng: d.eng || d.engineer || '',
    region: d.region || '',
    branch: d.branch || '',
    status: d.status || 'Closed',
    qty: d.qty || 1,
    unitPrice: d.unitPrice || 0,
    totalAmount: d.totalAmount || 0,
  };
}

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const baseFilter = buildFilter(req.query);
    const ecrFilter = buildFilter(req.query);
    const eprfobFilter = buildFilter(req.query);
    const scFilter = buildFilter(req.query);

    const [adminDocs, empClosedDocs, empPrfobClosedDocs, scDocs] = await Promise.all([
      ACr.find(baseFilter).sort({ createdAt: -1 }).lean(),
      Ecr.find(ecrFilter).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      EPrfOb.find(eprfobFilter).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      ScPrfOb.find(scFilter).sort({ executedDate: -1, createdAt: -1 }).lean(),
    ]);

    const existingEmployeeSourceIds = new Set(
      empClosedDocs.map(d => String(d.sourceEPrfObId || '')).filter(Boolean)
    );

    const employeeFallback = empPrfobClosedDocs
      .filter(d => !existingEmployeeSourceIds.has(String(d._id)))
      .map(d => ({
        ...d,
        _id: `fallback_${d._id}`,
        id: `fallback_${d._id}`,
        sourceEPrfObId: d._id,
      }));

    const combined = [
      ...adminDocs.map(d => normalize(d, 'ADMIN')),
      ...empClosedDocs.map(d => normalize(d, 'EMP')),
      ...employeeFallback.map(d => normalize(d, 'EMP')),
      ...scDocs.map(d => normalize(d, 'SC')),
    ].sort((a, b) => {
      const ad = new Date(a.executedDate || a.updatedAt || a.createdAt || a.entryDate || 0).getTime();
      const bd = new Date(b.executedDate || b.updatedAt || b.createdAt || b.entryDate || 0).getTime();
      return bd - ad;
    });

    res.json(combined);
  } catch (e) {
    console.error('[GET /api/admin/prfob/closed]', e);
    res.status(500).json({ message: e.message });
  }
});

router.get('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    if (source === 'ADMIN') doc = await ACr.findById(id).lean();
    if (source === 'SC') doc = await ScPrfOb.findById(id).lean();
    if (source === 'EMP') {
      const cleanId = id.startsWith('fallback_') ? id.replace('fallback_', '') : id;
      doc = id.startsWith('fallback_') ? await EPrfOb.findById(cleanId).lean() : await Ecr.findById(cleanId).lean();
    }

    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(normalize(doc, source));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const doc = await ACr.create({ ...req.body, createdBy: req.user._id });
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

    if (source === 'ADMIN') doc = await ACr.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    if (source === 'EMP' && !id.startsWith('fallback_')) doc = await Ecr.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    if (source === 'EMP' && id.startsWith('fallback_')) doc = await EPrfOb.findByIdAndUpdate(id.replace('fallback_', ''), req.body, { new: true, runValidators: true }).lean();
    if (source === 'SC') doc = await ScPrfOb.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();

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

    if (source === 'ADMIN') doc = await ACr.findByIdAndDelete(id);
    if (source === 'EMP' && !id.startsWith('fallback_')) doc = await Ecr.findByIdAndDelete(id);
    if (source === 'EMP' && id.startsWith('fallback_')) doc = await EPrfOb.findByIdAndDelete(id.replace('fallback_', ''));
    if (source === 'SC') doc = await ScPrfOb.findByIdAndDelete(id);

    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
