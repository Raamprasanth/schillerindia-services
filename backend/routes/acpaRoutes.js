const router = require('express').Router();
const AdminCompletedActivity = require('../models/AdminCompletedActivity');
const EmpCompletedActivity = require('../models/EmpCompletedActivity');
const PtClosedActivity = require('../models/PtClosedActivity');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function divisionFilter(value) {
  const name = String(value || '').trim().toUpperCase();
  if (name === 'SAG' || name === 'GANSHORN') return { $in: ['SAG', 'GANSHORN'] };
  return value;
}

function buildFilter(query, dateField, hasDivision) {
  const { division, from, to } = query;
  const f = {};
  if (hasDivision && division) {
    f.division = divisionFilter(division);
  }
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
      source === 'EMP' ? 'Employee' : 'Product Team',
    division: d.division || '-',
    scEngineer: d.scEngineer || '',
    initiatedDate: d.initiatedDate || '',
    activity: d.activity || '',
    description: d.description || '',
    responsible: d.responsible || '',
    pendingFrom: d.pendingFrom || '',
    targetDate: d.targetDate || '',
    remarks: d.remarks || '',
    status: d.status || 'Completed'
  };
}

// GET all closed activities (Admin, Employee, Product Team)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division } = req.query;

    const promises = [
      AdminCompletedActivity.find(buildFilter(req.query, 'initiatedDate', true)).sort({ initiatedDate: -1, createdAt: -1 }).lean(),
      EmpCompletedActivity.find(buildFilter(req.query, 'initiatedDate', true)).sort({ initiatedDate: -1, createdAt: -1 }).lean(),
    ];

    // PtClosedActivity doesn't have a division field. If division is filtered, exclude PT.
    if (!division) {
      promises.push(PtClosedActivity.find(buildFilter(req.query, 'initiatedDate', false)).sort({ initiatedDate: -1, createdAt: -1 }).lean());
    } else {
      promises.push(Promise.resolve([]));
    }

    const [adminDocs, empDocs, ptDocs] = await Promise.all(promises);

    const combined = [
      ...adminDocs.map(d => normalize(d, 'ADMIN')),
      ...empDocs.map(d => normalize(d, 'EMP')),
      ...ptDocs.map(d => normalize(d, 'PT'))
    ].sort((a, b) => {
      const ad = new Date(a.initiatedDate || a.createdAt || 0).getTime();
      const bd = new Date(b.initiatedDate || b.createdAt || 0).getTime();
      return bd - ad;
    });

    res.json(combined);
  } catch (e) {
    console.error('[GET /api/admin/acpa]', e);
    res.status(500).json({ message: e.message });
  }
});

// POST a new Admin Closed Activity (optional, allows creating closed entries directly)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.division || !body.scEngineer || !body.initiatedDate || !body.activity) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await AdminCompletedActivity.create({
      ...req.body,
      createdBy: req.user._id,
      status: 'Completed'
    });
    res.status(201).json(normalize(doc.toObject(), 'ADMIN'));
  } catch (e) {
    console.error('[POST /api/admin/acpa]', e);
    res.status(400).json({ message: e.message });
  }
});

// PUT /api/admin/acpa/:source/:id - Edit a closed entry's remarks (or full if admin)
router.put('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    const update = { remarks: req.body.remarks || '' };

    if (source === 'ADMIN') {
      doc = await AdminCompletedActivity.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    } else if (source === 'EMP') {
      doc = await EmpCompletedActivity.findByIdAndUpdate(id, update, { new: true }).lean();
    } else if (source === 'PT') {
      doc = await PtClosedActivity.findByIdAndUpdate(id, update, { new: true }).lean();
    }

    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(normalize(doc, source));
  } catch (e) {
    console.error('[PUT /api/admin/acpa/:source/:id]', e);
    res.status(400).json({ message: e.message });
  }
});

// DELETE /api/admin/acpa/:source/:id - Delete a closed entry
router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    if (source === 'ADMIN') {
      doc = await AdminCompletedActivity.findByIdAndDelete(id);
    } else if (source === 'EMP') {
      doc = await EmpCompletedActivity.findByIdAndDelete(id);
    } else if (source === 'PT') {
      doc = await PtClosedActivity.findByIdAndDelete(id);
    }

    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/admin/acpa/:source/:id]', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
