const express = require('express');
const router = express.Router();
const EmpCompletedActivity = require('../models/EmpCompletedActivity');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

function normalizeDivision(value) {
  const v = String(value || '').trim();
  const key = v.toLowerCase();
  const map = {
    'schiller ag': 'SAG',
    'sag': 'SAG',
    'patient monitors': 'PATIENT MONITORS',
    'patient monitor': 'PATIENT MONITORS',
    'monitors': 'PATIENT MONITORS',
    'anaesthesia': 'ANAESTHESIA',
    'anesthesia': 'ANAESTHESIA',
  };
  return map[key] || v;
}

function getUserDivisions(user) {
  const values = [
    user?.activeDivision,
    user?.division,
    ...(Array.isArray(user?.divisions) ? user.divisions : []),
  ];
  return [...new Set(values.map(normalizeDivision).filter(Boolean))];
}

function isAdminUser(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin' || String(user?._collection || '') === 'Admin';
}

function getWriteDivision(req) {
  if (isAdminUser(req.user)) return normalizeDivision(req.body.division || req.user.division);
  return normalizeDivision(req.user?.activeDivision || req.user?.division || req.body.division);
}

function canAccessDivision(user, division) {
  if (isAdminUser(user)) return true;
  const divisions = getUserDivisions(user);
  if (!divisions.length) return false;
  const target = normalizeDivision(division);
  return divisions.includes(target);
}

// ── GET /api/ecpa
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (!isAdminUser(req.user)) {
      const divisions = getUserDivisions(req.user);
      if (divisions.length) {
        filter.division = { $in: divisions };
      }
    }
    const docs = await EmpCompletedActivity.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ecpa]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/ecpa
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.initiatedDate || !body.activity || !body.status) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const division = getWriteDivision(req);
    const scEngineer = isAdminUser(req.user) 
      ? (body.scEngineer || req.user.name)
      : (req.user.name || 'Employee');

    const doc = await EmpCompletedActivity.create({
      division,
      scEngineer,
      initiatedDate: body.initiatedDate,
      activity: body.activity,
      description: body.description || '',
      responsible: body.responsible || '',
      pendingFrom: body.pendingFrom || '',
      targetDate: body.targetDate || '',
      remarks: body.remarks || '',
      scInchargeRemarks: body.scInchargeRemarks || '',
      status: body.status || 'Completed',
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ecpa]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/ecpa/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await EmpCompletedActivity.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    if (!canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const division = getWriteDivision(req);
    const updated = await EmpCompletedActivity.findByIdAndUpdate(
      req.params.id,
      { ...req.body, division },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/ecpa/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/ecpa/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await EmpCompletedActivity.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    if (!canAccessDivision(req.user, existing.division)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await EmpCompletedActivity.findByIdAndDelete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ecpa/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
