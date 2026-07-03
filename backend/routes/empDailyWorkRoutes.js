const express = require('express');
const EmpDailyWork = require('../models/EmpDailyWork');
const ADailyWork = require('../models/ADailyWork');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { resolveDivisions } = require('../utils/visibility');

const router = express.Router();

router.use(protect);

function rawUserDivisionNames(user) {
  const raw = [user?.activeDivision, user?.division, ...(Array.isArray(user?.divisions) ? user.divisions : [])];
  return [...new Set(raw.map(v => String(v || '').trim()).filter(Boolean))];
}

async function currentDivisionNames(user) {
  const divisions = await resolveDivisions(user);
  const resolvedNames = divisions.flatMap(d => [d.name, d.displayName]);
  return [...new Set([...resolvedNames, ...rawUserDivisionNames(user)].map(v => String(v || '').trim()).filter(Boolean))];
}

async function divisionMemberNames(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) {
    const [employees, users] = await Promise.all([
      Employee.find({ isActive: { $ne: false } }).select('name').lean(),
      User.find({ isActive: { $ne: false }, role: { $in: ['employee', 'service_coordinator'] } }).select('name').lean(),
    ]);
    return [...new Set([...employees, ...users].map(u => String(u.name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  const names = await currentDivisionNames(user);
  if (!names.length) return [String(user?.name || '').trim()].filter(Boolean);

  const memberFilter = {
    isActive: { $ne: false },
    $or: [
      { division: { $in: names } },
      { divisions: { $in: names } },
    ],
  };

  const [employees, users] = await Promise.all([
    Employee.find(memberFilter).select('name').lean(),
    User.find({ ...memberFilter, role: { $in: ['employee', 'service_coordinator'] } }).select('name').lean(),
  ]);

  const ownName = String(user?.name || '').trim();
  return [...new Set([ownName, ...employees.map(u => u.name), ...users.map(u => u.name)].map(v => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}
function normalizeDivisionKey(value) {
  return String(value || '').trim().toLowerCase();
}

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { userId: user?._id };
}

async function divisionVisibilityFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};

  const divisions = await resolveDivisions(user);
  const names = [...new Set(divisions.flatMap(d => [d.name, d.displayName]).map(v => String(v || '').trim()).filter(Boolean))];
  const keys = names.map(normalizeDivisionKey).filter(Boolean);
  const own = { userId: user?._id };

  if (!keys.length && !names.length) return own;

  return {
    $or: [
      { divisionKey: { $in: keys } },
      { division: { $in: names } },
      { divisionName: { $in: names } },
      { team: { $in: names } },
      own,
    ],
  };
}

async function currentDivisionMeta(user) {
  const divisions = await resolveDivisions(user);
  const division = divisions[0] || null;
  const divisionName = String(division?.name || division?.displayName || user?.activeDivision || user?.division || '').trim();
  return {
    division: divisionName,
    divisionName,
    divisionKey: normalizeDivisionKey(divisionName),
  };
}

router.get('/members', async (req, res) => {
  try {
    res.json(await divisionMemberNames(req.user));
  } catch (err) {
    console.error('[GET /api/empdw/members]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.get('/', async (req, res) => {
  try {
    const docs = await EmpDailyWork.find(await divisionVisibilityFilter(req.user)).sort({ date: -1, fromTime: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/empdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.date || !body.activity || !body.fromTime || !body.toTime) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const divisionMeta = await currentDivisionMeta(req.user);

    const doc = await EmpDailyWork.create({
      date: body.date,
      activity: body.activity,
      fromTime: body.fromTime,
      toTime: body.toTime,
      team: body.team,
      ...divisionMeta,
      dayTotal: body.dayTotal,
      addedBy: req.user?.name || req.user?.email || 'User',
      userId: req.user?._id,
    });

    // Mirror to ADailyWork
    await ADailyWork.create({
      date: doc.date,
      activity: doc.activity,
      fromTime: doc.fromTime,
      toTime: doc.toTime,
      team: doc.team,
      division: doc.division,
      divisionName: doc.divisionName,
      divisionKey: doc.divisionKey,
      dayTotal: doc.dayTotal,
      addedBy: doc.addedBy,
      userId: doc.userId,
      sourceType: 'Employee',
      sourceId: doc._id
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/empdw]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await EmpDailyWork.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Daily work record not found.' });

    // Remove from ADailyWork
    await ADailyWork.findOneAndDelete({ sourceType: 'Employee', sourceId: doc._id });

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/empdw/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const body = req.body || {};
    
    if (!body.date || !body.activity || !body.fromTime || !body.toTime) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await EmpDailyWork.findOneAndUpdate(
      filter,
      {
        date: body.date,
        activity: body.activity,
        fromTime: body.fromTime,
        toTime: body.toTime,
        team: body.team,
        dayTotal: body.dayTotal
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: 'Daily work record not found.' });

    // Update ADailyWork
    await ADailyWork.findOneAndUpdate(
      { sourceType: 'Employee', sourceId: doc._id },
      {
        date: doc.date,
        activity: doc.activity,
        fromTime: doc.fromTime,
        toTime: doc.toTime,
        team: doc.team,
        division: doc.division,
        divisionName: doc.divisionName,
        divisionKey: doc.divisionKey,
        dayTotal: doc.dayTotal
      }
    );

    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/empdw/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
