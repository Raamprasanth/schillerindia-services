const router = require('express').Router();
const AdminPendingActivity = require('../models/AdminPendingActivity');
const EmpPendingActivity = require('../models/EmpPendingActivity');
const PtPendingActivity = require('../models/PtPendingActivity');
const EmpCompletedActivity = require('../models/EmpCompletedActivity');
const PtClosedActivity = require('../models/PtClosedActivity');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function divisionFilter(value) {
  const name = String(value || '').trim().toUpperCase();
  if (name === 'SAG' || name === 'GANSHORN') return { $in: ['SAG', 'GANSHORN'] };
  return value;
}

function buildFilter(query, dateField, statusField, hasDivision) {
  const { division, from, to } = query;
  const f = { [statusField]: 'Pending' }; // Always only show Pending
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
    status: d.status || 'Pending'
  };
}

// GET all pending activities (Admin, Employee, Product Team)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { division } = req.query;

    const promises = [
      AdminPendingActivity.find(buildFilter(req.query, 'initiatedDate', 'status', true)).sort({ initiatedDate: -1, createdAt: -1 }).lean(),
      EmpPendingActivity.find(buildFilter(req.query, 'initiatedDate', 'status', true)).sort({ initiatedDate: -1, createdAt: -1 }).lean(),
    ];

    // PtPendingActivity doesn't have a division field. If division is filtered, exclude PT.
    if (!division) {
      promises.push(PtPendingActivity.find(buildFilter(req.query, 'initiatedDate', 'status', false)).sort({ initiatedDate: -1, createdAt: -1 }).lean());
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
    console.error('[GET /api/admin/apa]', e);
    res.status(500).json({ message: e.message });
  }
});

// POST a new Admin Pending Activity
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.division || !body.scEngineer || !body.initiatedDate || !body.activity) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await AdminPendingActivity.create({
      ...req.body,
      createdBy: req.user._id,
      status: 'Pending'
    });
    res.status(201).json(normalize(doc.toObject(), 'ADMIN'));
  } catch (e) {
    console.error('[POST /api/admin/apa]', e);
    res.status(400).json({ message: e.message });
  }
});

// PUT /api/admin/apa/:source/:id - Edit an entry's remarks (or full if admin)
router.put('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    const update = { remarks: req.body.remarks || '' };

    if (source === 'ADMIN') {
      doc = await AdminPendingActivity.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    } else if (source === 'EMP') {
      doc = await EmpPendingActivity.findByIdAndUpdate(id, update, { new: true }).lean();
    } else if (source === 'PT') {
      doc = await PtPendingActivity.findByIdAndUpdate(id, update, { new: true }).lean();
    }

    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(normalize(doc, source));
  } catch (e) {
    console.error('[PUT /api/admin/apa/:source/:id]', e);
    res.status(400).json({ message: e.message });
  }
});

// DELETE /api/admin/apa/:source/:id - Delete an entry
router.delete('/:source/:id', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    if (source === 'ADMIN') {
      doc = await AdminPendingActivity.findByIdAndDelete(id);
    } else if (source === 'EMP') {
      doc = await EmpPendingActivity.findByIdAndDelete(id);
    } else if (source === 'PT') {
      doc = await PtPendingActivity.findByIdAndDelete(id);
    }

    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/admin/apa/:source/:id]', e);
    res.status(500).json({ message: e.message });
  }
});

// POST /api/admin/apa/:source/:id/close - Close an activity
router.post('/:source/:id/close', protect, adminOnly, async (req, res) => {
  try {
    const source = String(req.params.source || '').toUpperCase();
    const id = req.params.id;
    let doc = null;

    if (source === 'EMP') {
      const existing = await EmpPendingActivity.findById(id).lean();
      if (!existing) return res.status(404).json({ message: 'Record not found.' });

      doc = await EmpCompletedActivity.create({
        division: existing.division,
        scEngineer: existing.scEngineer,
        initiatedDate: existing.initiatedDate,
        activity: existing.activity,
        description: existing.description || '',
        responsible: existing.responsible || '',
        pendingFrom: existing.pendingFrom || '',
        targetDate: existing.targetDate || '',
        remarks: existing.remarks || '',
        status: 'Completed',
        createdBy: existing.createdBy,
      });
      await EmpPendingActivity.findByIdAndDelete(id);
    } else if (source === 'PT') {
      const existing = await PtPendingActivity.findById(id).lean();
      if (!existing) return res.status(404).json({ message: 'Record not found.' });

      doc = await PtClosedActivity.create({
        scEngineer: existing.scEngineer,
        initiatedDate: existing.initiatedDate,
        activity: existing.activity,
        description: existing.description || '',
        responsible: existing.responsible || '',
        pendingFrom: existing.pendingFrom || '',
        targetDate: existing.targetDate || '',
        remarks: existing.remarks || '',
        status: 'Completed',
        createdBy: existing.createdBy,
      });
      await PtPendingActivity.findByIdAndDelete(id);
    } else if (source === 'ADMIN') {
      doc = await AdminPendingActivity.findByIdAndUpdate(id, { status: 'Completed' }, { new: true }).lean();
    }

    if (!doc) return res.status(404).json({ message: 'Record not found or invalid source.' });
    res.json({ success: true });
  } catch (e) {
    console.error('[POST /api/admin/apa/:source/:id/close]', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
