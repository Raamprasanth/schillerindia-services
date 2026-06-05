// routes/empServiceRoutes.js
const router              = require('express').Router();
const mongoose            = require('mongoose');
const Service             = require('../models/Service');
const Division            = require('../models/Division');
const { protect }         = require('../middleware/authMiddleware');
const { tryCreateFRNPending, tryCreateUnderRepair, cleanupLinkedRecords } = require('../services/queueSyncService');
const { buildUrEscalationRow, enqueueEscalationSnapshot, UR_DAILY_TYPES } = require('../services/escalationService');

// ── CONSTANTS ─────────────────────────────────────────────────────
const FRN_UNIT_STATUSES = ['IW', 'EW', 'CAMC', 'STOCK', 'Demo', 'Repeat', 'Buy Back'];
const EST_UNIT_STATUSES = ['OW', 'LAMC'];

// ── HELPERS ───────────────────────────────────────────────────────
function normalizeUnitStatus(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = {
    IW: 'IW',
    EW: 'EW',
    CAMC: 'CAMC',
    STOCK: 'STOCK',
    DEMO: 'Demo',
    REPEAT: 'Repeat',
    'BUY BACK': 'Buy Back',
    BUYBACK: 'Buy Back',
    OW: 'OW',
    LAMC: 'LAMC',
  };
  return map[upper] || raw;
}

function normalizeRepType(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = { NA: 'NA', 'TO/ADV SO': 'TO/ADV SO', 'BS/SO': 'BS/SO' };
  return map[upper] || raw;
}

function calcPendingDays(dateStr) {
  if (!dateStr) return 0;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  return isNaN(diff) ? 0 : Math.max(0, diff);
}

async function assertCanModifyService(req, svc) {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return;
  const name   = req.user.name || '';
  const userId = String(req.user._id || '');
  const isOwner =
    svc.scEng       === name ||
    svc.eng         === name ||
    svc.submittedBy === name ||
    String(svc.engineer || '') === userId;
  if (isOwner) return;

  const { hasDivisionAccessToRecord } = require('../utils/visibility');
  const hasDivisionAccess = await hasDivisionAccessToRecord(req.user, svc.division);
  if (hasDivisionAccess) return;

  const err = new Error('You can only modify records in your assigned division.');
  err.status = 403;
  throw err;
}

function normalizeDivisionName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.name) return value.name;
  return '';
}

function getRequestedEmployeeDivision(user) {
  return String(user?.activeDivision || user?.division || '').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getCurrentEmployeeDivisionFilter(user) {
  if (!user || user.role === 'admin' || user.role === 'superadmin') return {};

  const currentDivision = getRequestedEmployeeDivision(user);
  if (!currentDivision) return { _id: null };

  if (mongoose.Types.ObjectId.isValid(currentDivision)) {
    return { division: new mongoose.Types.ObjectId(currentDivision) };
  }

  const pattern = new RegExp('^' + escapeRegex(currentDivision) + '$', 'i');
  const divDoc = await Division.findOne({ $or: [{ name: pattern }, { displayName: pattern }] }).lean();
  return divDoc ? { division: divDoc._id } : { _id: null };
}

function pickUrEscalationModule(typeWork) {
  if (!typeWork) return '';
  if (typeWork === 'Scrap') return 'ur_scrap';
  if (UR_DAILY_TYPES.includes(typeWork)) return 'ur_followup';
  return '';
}

// Logic moved to queueSyncService.js

// ════════════════════════════════════════════════════════════════
//  GET /api/emp/services/stats/summary
// ════════════════════════════════════════════════════════════════
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const { getDivisionFilter } = require('../utils/visibility');
    const visibilityFilter = await getDivisionFilter(req.user);
    const [total, pending, completed, escalated, inProgress] = await Promise.all([
      Service.countDocuments(visibilityFilter),
      Service.countDocuments({ ...visibilityFilter, status: 'pending' }),
      Service.countDocuments({ ...visibilityFilter, status: 'completed' }),
      Service.countDocuments({ ...visibilityFilter, status: 'escalated' }),
      Service.countDocuments({ ...visibilityFilter, status: 'in_progress' }),
    ]);
    res.json({ total, pending, completed, escalated, inProgress });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/emp/services/ob-pending
//  ✅ SERVER-SIDE OB PENDING FILTER
//  Returns only OW/LAMC records that have NOT been moved to Estimation
// ════════════════════════════════════════════════════════════════
router.get('/ob-pending', protect, async (req, res) => {
  try {
    const { getDivisionFilter } = require('../utils/visibility');
    const visibilityFilter = await getDivisionFilter(req.user, [
      { eng: req.user.name },
      { scEng: req.user.name },
      { submittedBy: req.user.name }
    ]);

    const filter = {
      unitSts:          { $in: EST_UNIT_STATUSES },
      repType:          'NA',
      movedToEstimation: { $ne: true },   // ✅ KEY FILTER — excludes saved estimations
      ...visibilityFilter
    };

    const records = await Service.find(filter).sort({ createdAt: -1 });

    const now = Date.now();
    res.json(records.map(r => {
      const obj = r.toObject();
      obj.pdOb  = Math.floor((now - new Date(obj.rcvdDate || obj.entryDate || obj.createdAt).getTime()) / 86400000);
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/emp/services  — ALL records (shared view)
// ════════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    const visibilityFilter = await getCurrentEmployeeDivisionFilter(req.user);

    const records = await Service.find(visibilityFilter)
      .populate('division', 'name')
      .populate('engineer', 'name email')
      .sort({ createdAt: -1 });

    const name   = req.user.name || '';
    const userId = String(req.user._id || '');
    const annotated = records.map(r => {
      const obj = r.toObject ? r.toObject() : r;
      obj.isOwner =
        obj.scEng       === name ||
        obj.eng         === name ||
        obj.submittedBy === name ||
        String(obj.engineer || '') === userId ||
        req.user.role   === 'admin';
      return obj;
    });

    res.json(annotated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/emp/services/:id
// ════════════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const svc = await Service.findById(req.params.id)
      .populate('division', 'name')
      .populate('engineer', 'name email');
    if (!svc) return res.status(404).json({ message: 'Service record not found.' });

    const { hasDivisionAccessToRecord } = require('../utils/visibility');
    const allowed = await hasDivisionAccessToRecord(req.user, svc.division);
    if (!allowed) return res.status(403).json({ message: 'Access denied.' });

    const obj    = svc.toObject ? svc.toObject() : svc;
    const name   = req.user.name || '';
    const userId = String(req.user._id || '');
    obj.isOwner  =
      obj.scEng       === name ||
      obj.eng         === name ||
      obj.submittedBy === name ||
      String(obj.engineer || '') === userId ||
      req.user.role   === 'admin';

    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/emp/services
// ════════════════════════════════════════════════════════════════
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    body.bscon = String(body.bscon || '').trim();
    if (!body.bscon) return res.status(400).json({ message: 'BSCON is required.' });

    body.scEng       = req.user.name || body.scEng || '';
    body.submittedBy = req.user.name || '';
    body.submittedAt = new Date().toISOString();
    if (!body.status) body.status = 'pending';
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);

    // Resolve division: use valid ObjectId if already provided, otherwise resolve by name
    // from body.divisionName, body.division (string), or the employee's own division.
    const forcedEmployeeDivision = getRequestedEmployeeDivision(req.user);
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      delete body.division;
      delete body.divisionName;
    }

    if (!body.division || !mongoose.Types.ObjectId.isValid(body.division)) {
      const divName = (!mongoose.Types.ObjectId.isValid(body.division) && body.division)
        || body.divisionName
        || forcedEmployeeDivision
        || req.user.division
        || '';
      delete body.division;
      delete body.divisionName;
      if (divName) {
        const escaped = escapeRegex(divName);
        const divDoc  = await Division.findOne({ $or: [{ name: new RegExp('^' + escaped + '$', 'i') }, { displayName: new RegExp('^' + escaped + '$', 'i') }] });
        if (divDoc) body.division = divDoc._id;
      }
    } else {
      delete body.divisionName;
    }
    if (body.division) {
      const { hasDivisionAccessToRecord } = require('../utils/visibility');
      const allowedDivision = await hasDivisionAccessToRecord(req.user, body.division);
      if (!allowedDivision) return res.status(403).json({ message: 'Selected division is not assigned to this user.' });
    }
    if (body.engineer && !mongoose.Types.ObjectId.isValid(body.engineer)) {
      if (!body.eng) body.eng = body.engineer;
      delete body.engineer;
    }

    body.serviceId = 'SVC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

    let svc;
    try {
      svc = await new Service(body).save({ validateBeforeSave: false });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        body.serviceId = 'SVC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        svc = await new Service(body).save({ validateBeforeSave: false });
      } else {
        throw dupErr;
      }
    }
    const svcObj = svc.toObject ? svc.toObject() : svc;

    await Promise.allSettled([
      tryCreateFRNPending(svcObj, req.user),
      tryCreateUnderRepair(svcObj, req.user),
    ]);

    svcObj.isOwner = true;
    res.status(201).json(svcObj);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  PUT /api/emp/services/:id
//  ✅ When movedToEstimation=true is sent, sets the flag on Service
//     so the ob-pending endpoint excludes it permanently
// ════════════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const svc = await Service.findById(req.params.id);
    if (!svc) return res.status(404).json({ message: 'Service record not found.' });

    try { await assertCanModifyService(req, svc); } catch (e) {
      return res.status(e.status || 403).json({ message: e.message });
    }

    const body = { ...req.body };
    body.bscon = String(body.bscon ?? svc.bscon ?? '').trim();
    if (!body.bscon) return res.status(400).json({ message: 'BSCON is required.' });
    body.scEng       = req.user.name || body.scEng || svc.scEng;
    body.submittedBy = svc.submittedBy || req.user.name || '';
    body.updatedAt   = new Date().toISOString();
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);

    // Division is locked to the original record — do not allow changes.
    delete body.division;
    delete body.divisionName;
    if (body.engineer && !mongoose.Types.ObjectId.isValid(body.engineer)) {
      if (!body.eng) body.eng = body.engineer;
      delete body.engineer;
    }

    // ✅ movedToEstimation flag is saved as-is from the frontend payload
    // (the OB Pending page sends movedToEstimation: true when estimation is saved)

    const updated = await Service.findByIdAndUpdate(
      req.params.id, body, { new: true, runValidators: false }
    ).populate('division', 'name');

    const updObj = updated.toObject ? updated.toObject() : updated;
    updObj.divisionName = normalizeDivisionName(updObj.division);

    await Promise.allSettled([
      tryCreateFRNPending(updObj, req.user),
      tryCreateUnderRepair(updObj, req.user),
    ]);

    const selectedUrType = String(body.urTypeWork || body.typeWork || '').trim();
    const urEscalationModule = pickUrEscalationModule(selectedUrType);
    if (urEscalationModule) {
      await enqueueEscalationSnapshot(
        urEscalationModule,
        updated._id,
        req.user.name || '',
        buildUrEscalationRow({
          ...updObj,
          urTypeWork: selectedUrType,
          typeWork: selectedUrType,
        })
      );
    }

    updObj.isOwner = true;
    res.json(updObj);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  DELETE /api/emp/services/:id
// ════════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const svc = await Service.findById(req.params.id);
    if (!svc) return res.status(404).json({ message: 'Service record not found.' });

    try { await assertCanModifyService(req, svc); } catch (e) {
      return res.status(e.status || 403).json({ message: e.message });
    }

    await Service.findByIdAndDelete(req.params.id);
    await cleanupLinkedRecords(req.params.id);

    res.json({ message: 'Record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
