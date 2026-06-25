// routes/empObPendingRoutes.js
//
// OB Pending routes — reads/writes EmpOBPending collection.
// Auto-backfills from Service collection on first GET if empty.
// Register in server.js: app.use('/api/ob-pending', empObPendingRoutes);

const express      = require('express');
const router       = express.Router();
const mongoose     = require('mongoose');
const EmpOBPending = require('../models/EmpOBPending');
const Service      = require('../models/Service');
const { protect }  = require('../middleware/authMiddleware');

// ── HELPERS ───────────────────────────────────────────────
function calcPendingDays(dateStr) {
  if (!dateStr) return 0;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  return isNaN(diff) ? 0 : Math.max(0, diff);
}

function isOBEligible(svc) {
  return ['OW', 'LAMC'].includes(svc.unitSts) && svc.repType === 'NA';
}

function buildOBDoc(svc, user) {
  return {
    serviceId:    svc._id,
    employeeId:   user._id,
    employeeName: user.name || '',
    role:         user.role === 'admin' ? 'admin' : 'staff',
    entryDate:    svc.entryDate    || '',
    scReNo:       svc.scReNo      || '',
    scEng:        svc.scEng       || '',
    frnNo:        svc.frnNo       || '',
    reg:          svc.reg         || '',
    eng:          svc.eng         || '',
    custName:     svc.custName    || svc.customer || '',
    model:        svc.model       || '',
    unitSl:       svc.unitSl      || '',
    unitSts:      svc.unitSts     || '',
    partNo:       svc.partNo      || '',
    defMod:       svc.defMod      || '',
    defPartSno:   svc.defPartSno  || '',
    defGir:       svc.defGir      || '',
    typeWork:     svc.typeWork    || svc.type || '',
    repType:      svc.repType     || 'NA',
    finalRemarks: svc.finalRemarks || '',
    submittedBy:  svc.submittedBy  || user.name || '',
    obStatus:     'OB Pending',
    pdOb:         calcPendingDays(svc.entryDate),
  };
}

// Employee query — admin sees all, employee sees own by employeeId
function empQuery(user) {
  if (user.role === 'admin') return {};
  return { employeeId: user._id };
}

// ════════════════════════════════════════════════════════
//  GET /api/ob-pending
//  Returns OB Pending records.
//  Auto-backfills from Service collection if empty.
// ════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    const { getServiceIdsFilter } = require('../utils/visibility');
    const query = await getServiceIdsFilter(req.user);
    const svcQuery = { unitSts: { $in: ['OW', 'LAMC'] }, repType: 'NA' };

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      if (query.serviceId && query.serviceId.$in) {
        svcQuery._id = { $in: query.serviceId.$in };
      } else {
        svcQuery._id = null;
      }
    }

    const eligible = await Service.find(svcQuery).lean();
    const existing = eligible.length
      ? await EmpOBPending.find({ serviceId: { $in: eligible.map(s => s._id) } }, 'serviceId').lean()
      : [];
    const existingIds = new Set(existing.map(r => String(r.serviceId)));

    for (const svc of eligible) {
      if (existingIds.has(String(svc._id))) continue;
      try {
        await EmpOBPending.create(buildOBDoc(svc, req.user));
      } catch (e) {
        if (e.code !== 11000) console.warn('backfill skip:', e.message);
      }
    }

    const serviceMap = new Map(eligible.map(svc => [String(svc._id), svc]));
    const records = await EmpOBPending.find(query).sort({ entryDate: -1 }).lean();
    res.json(records.map(r => {
      const svc = serviceMap.get(String(r.serviceId)) || {};
      return {
        ...r,
        unitSl: r.unitSl || svc.unitSl || '',
        partNo: r.partNo || svc.partNo || '',
        defPartSno: r.defPartSno || svc.defPartSno || '',
        pdOb: calcPendingDays(r.entryDate),
      };
    }));
  } catch (err) {
    console.error('GET /api/ob-pending:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID.' });

    const record = await EmpOBPending.findById(req.params.id).lean();
    if (!record)
      return res.status(404).json({ success: false, message: 'Record not found.' });

    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      __is_allowed = true;
    } else {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      if (record && record.serviceId && await hasDivisionAccessToService(req.user, record.serviceId)) {
        __is_allowed = true;
      } else {
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [record.eng, record.scEng, record.estRaEng, record.obRaEng, record.submittedBy, record.createdBy].some(v => String(v || '').trim().toLowerCase() === _uName)) {
          __is_allowed = true;
        }
      }
    }
    if (!__is_allowed) return res.status(403).json({ success: false, message: 'Access denied.' });

    res.json({ ...record, pdOb: calcPendingDays(record.entryDate) });
  } catch (err) {
    console.error('GET /api/ob-pending/:id:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  POST /api/ob-pending   Body: { serviceId }
// ════════════════════════════════════════════════════════
router.post('/', protect, async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId))
      return res.status(400).json({ success: false, message: 'Valid serviceId required.' });

    const existing = await EmpOBPending.findOne({ serviceId });
    if (existing)
      return res.status(409).json({ success: false, message: 'Already exists.', record: existing });

    const svc = await Service.findById(serviceId).lean();
    if (!svc)
      return res.status(404).json({ success: false, message: 'Service not found.' });

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToRecord } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToRecord(req.user, svc.division);
      if (!allowed)
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!isOBEligible(svc))
      return res.status(400).json({
        success: false,
        message: `Not eligible — needs unitSts=OW/LAMC & repType=NA. Got: ${svc.unitSts}, ${svc.repType}`,
      });

    const newRecord = await EmpOBPending.create(buildOBDoc(svc, req.user));
    res.status(201).json(newRecord);
  } catch (err) {
    console.error('POST /api/ob-pending:', err.message);
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'Already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  PUT /api/ob-pending/:id   Update OB fields + mirror to Service
// ════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID.' });

    const record = await EmpOBPending.findById(req.params.id);
    if (!record)
      return res.status(404).json({ success: false, message: 'Record not found.' });

    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      __is_allowed = true;
    } else {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      if (record && record.serviceId && await hasDivisionAccessToService(req.user, record.serviceId)) {
        __is_allowed = true;
      } else {
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [record.eng, record.scEng, record.estRaEng, record.obRaEng, record.submittedBy, record.createdBy].some(v => String(v || '').trim().toLowerCase() === _uName)) {
          __is_allowed = true;
        }
      }
    }
    if (!__is_allowed) return res.status(403).json({ success: false, message: 'Access denied.' });

    // Only allow OB-specific fields to be updated
    const allowed = [
      'obStatus', 'obRaEng', 'obDefUnitGir', 'obTechRemarks',
      'obFinalRemarks', 'obComponents', 'obRepGirNo', 'obTypeReport',
      'obRepBrd', 'obShipSc', 'obShipComm', 'obDcNo', 'obDestination',
    ];
    allowed.forEach(f => { if (req.body[f] !== undefined) record[f] = req.body[f]; });

    record.obUpdatedBy        = req.user.name || '';
    record.obUpdatedAt        = new Date();
    record.lastModifiedByRole = req.user.role === 'admin' ? 'admin' : 'staff';
    record.pdOb               = calcPendingDays(record.entryDate);

    const updated = await record.save();

    // Mirror back to Service so admin list stays in sync
    try {
      await Service.findByIdAndUpdate(record.serviceId, {
        obStatus:     updated.obStatus,
        obRaEng:      updated.obRaEng,
        typeWork:     updated.obStatus,
        finalRemarks: updated.obFinalRemarks || updated.obTechRemarks || '',
        repGirNo:     updated.obRepGirNo,
        typeReport:   updated.obTypeReport,
        repBrd:       updated.obRepBrd,
        shipSc:       updated.obShipSc,
        shipComm:     updated.obShipComm,
        dcNo:         updated.obDcNo,
        destination:  updated.obDestination,
        obUpdatedBy:  updated.obUpdatedBy,
        obUpdatedAt:  updated.obUpdatedAt,
      });
    } catch (e) {
      console.warn('Mirror to Service failed (non-fatal):', e.message);
    }

    res.json({ ...updated.toObject(), pdOb: calcPendingDays(updated.entryDate) });
  } catch (err) {
    console.error('PUT /api/ob-pending/:id:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  DELETE /api/ob-pending/:id  — Admin only
// ════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID.' });

    const record = await EmpOBPending.findByIdAndDelete(req.params.id);
    if (!record)
      return res.status(404).json({ success: false, message: 'Record not found.' });

    res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    console.error('DELETE /api/ob-pending/:id:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  POST /api/ob-pending/sync  — Admin: backfill all eligible services
// ════════════════════════════════════════════════════════
router.post('/sync', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Admin access required.' });

    const eligible = await Service.find({
      unitSts: { $in: ['OW', 'LAMC'] },
      repType: 'NA',
    }).lean();

    let created = 0, skipped = 0, errors = 0;
    for (const svc of eligible) {
      try {
        const exists = await EmpOBPending.findOne({ serviceId: svc._id });
        if (exists) { skipped++; continue; }
        await EmpOBPending.create(buildOBDoc(svc, req.user));
        created++;
      } catch (e) {
        if (e.code === 11000) skipped++;
        else { errors++; console.warn('sync item error:', e.message); }
      }
    }

    res.json({
      success: true,
      message: `Sync done — Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`,
      created, skipped, errors,
    });
  } catch (err) {
    console.error('POST /api/ob-pending/sync:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────── GET Repair Components ──────────────────────────────
router.get('/components/:scReNo', protect, async (req, res) => {
  try {
    const scReNoParam = req.params.scReNo;
    if (!scReNoParam) return res.json({ components: null });

    const scReNo = scReNoParam.trim();
    const escapedScReNo = scReNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexMatch = new RegExp(`^${escapedScReNo}$`, 'i');

    const EstimationPending = require('../models/EstimationPending');
    const Service = require('../models/Service');
    const RTOB = require('../models/RTOB');
    const RTFRN = require('../models/RTFRN');
    const SCCompletedFRN = require('../models/SCCompletedFRN');
    const RTCRL = require('../models/rtcrlModel');
    const RTUR = require('../models/rturModel');

    if (req.query.sourceId) {
      const svc = await Service.findById(req.query.sourceId).lean();
      if (svc && (svc.components || svc.obComponents || svc.compUsedToRepair || svc.partsUsed)) {
        return res.json({ components: svc.components || svc.obComponents || svc.compUsedToRepair || svc.partsUsed });
      }
    }
    const svcBySc = await Service.findOne({ scReNo: regexMatch }).lean();
    if (svcBySc && (svcBySc.components || svcBySc.obComponents || svcBySc.compUsedToRepair || svcBySc.partsUsed)) {
      return res.json({ components: svcBySc.components || svcBySc.obComponents || svcBySc.compUsedToRepair || svcBySc.partsUsed });
    }

    const est = await EstimationPending.findOne({ scReNo: regexMatch }).lean();
    if (est && (est.components || est.obComponents || est.compUsedToRepair || est.partsUsed)) {
      return res.json({ components: est.components || est.obComponents || est.compUsedToRepair || est.partsUsed });
    }

    const rtob = await RTOB.findOne({ scRefNo: regexMatch }).lean();
    if (rtob && (rtob.components || rtob.obComponents || rtob.compUsedToRepair || rtob.componentsUsed || rtob.partsUsed)) {
      return res.json({ components: rtob.components || rtob.obComponents || rtob.compUsedToRepair || rtob.componentsUsed || rtob.partsUsed });
    }

    const rtcrl = await RTCRL.findOne({ scRefNo: regexMatch }).lean();
    if (rtcrl && (rtcrl.components || rtcrl.compUsedToRepair || rtcrl.partsUsed)) {
      return res.json({ components: rtcrl.components || rtcrl.compUsedToRepair || rtcrl.partsUsed });
    }

    const rtfrn = await RTFRN.findOne({ scRefNo: regexMatch }).lean();
    if (rtfrn && (rtfrn.components || rtfrn.componentsUsed || rtfrn.compUsedToRepair || rtfrn.partsUsed)) {
      return res.json({ components: rtfrn.components || rtfrn.componentsUsed || rtfrn.compUsedToRepair || rtfrn.partsUsed });
    }

    // 6. Fallback: check sourceId in RTOB
    if (req.query.sourceId) {
      const rtobBySource = await RTOB.findOne({ sourceId: req.query.sourceId }).lean();
      if (rtobBySource && (rtobBySource.components || rtobBySource.obComponents || rtobBySource.compUsedToRepair || rtobBySource.componentsUsed)) {
        return res.json({ components: rtobBySource.components || rtobBySource.obComponents || rtobBySource.compUsedToRepair || rtobBySource.componentsUsed });
      }
    }

    // 7. SCCompletedFRN
    const scComp = await SCCompletedFRN.findOne({ scRno: regexMatch }).lean();
    if (scComp && (scComp.components || scComp.compUsedToRepair || scComp.partsUsed)) {
      return res.json({ source: 'SCCompletedFRN', components: scComp.components || scComp.compUsedToRepair || scComp.partsUsed });
    }

    // 8. Service model fallback
    const svc = await Service.findOne({ scRno: regexMatch }).lean();
    if (svc && (svc.components || svc.compUsedToRepair || svc.obComponents)) {
      return res.json({ source: 'Service', components: svc.components || svc.compUsedToRepair || svc.obComponents });
    }

    res.json({ components: null, message: "Not found in any model" });
  } catch (err) {
    console.error('Components fetch error:', err);
    res.json({ components: null, error: err.message });
  }
});

module.exports = router;
