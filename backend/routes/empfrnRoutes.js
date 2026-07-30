// routes/empfrnRoutes.js
const express      = require('express');
const router       = express.Router();
const Empfrn       = require('../models/EmpFRN');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Service      = require('../models/Service');
const Todr         = require('../models/Todr');
const Dr           = require('../models/Dr');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  buildFrnEscalationRow,
  buildToEscalationRow,
  buildExternalRepairEscalationRow,
  buildSupplierWarrantyEscalationRow,
  enqueueEscalationSnapshot,
  enqueueLatestEscalationSnapshot,
} = require('../services/escalationService');
const Division = require('../models/Division');
const { tryCreateFRNPending, tryCreateUnderRepair } = require('../services/queueSyncService');

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
  return String(value || '').trim().toUpperCase();
}

function toDateValue(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildTodrModel(doc) {
  return String(doc.model || '').trim();
}

function buildTodrDescription(doc, item = {}) {
  return String(item.description || doc.defMod || doc.defBrdModName || '').trim() || 'TO/DR entry';
}

async function findLinkedServiceForFrn(doc) {
  if (!doc) return null;
  if (doc.serviceId) {
    const byId = await Service.findById(doc.serviceId);
    if (byId) return byId;
  }

  const scReNo = String(doc.scRno || doc.scReNo || '').trim();
  const frnNo = String(doc.frnNo || '').trim();
  const unitSl = String(doc.unitSl || '').trim();
  const filters = [];
  if (scReNo && frnNo) filters.push({ scReNo, frnNo });
  if (scReNo && unitSl) filters.push({ scReNo, unitSl });
  if (frnNo && unitSl) filters.push({ frnNo, unitSl });
  if (scReNo) filters.push({ scReNo });
  if (!filters.length) return null;

  return Service.findOne({ $or: filters }).sort({ createdAt: -1 });
}

async function updateLinkedServiceForFrn(doc, setFields) {
  const service = await findLinkedServiceForFrn(doc);
  if (!service) return null;

  await Service.findByIdAndUpdate(
    service._id,
    { $set: setFields },
    { runValidators: false }
  );

  if (!doc.serviceId) {
    await Empfrn.findByIdAndUpdate(doc._id, { $set: { serviceId: service._id } }, { runValidators: false });
  }

  return service;
}

async function mirrorFrnToTodr(doc, action, items = [], queuedBy = '') {
  try {
    const rows = action === 'TO'
      ? items.map(item => ({
          partNo: String(item.partNo || '').trim(),
          model: buildTodrModel(doc),
          quantity: item.qty || 1,
          description: buildTodrDescription(doc, item),
        })).filter(item => item.partNo)
      : [{
          partNo: String(doc.partNo || doc.defMod || doc.defGir || 'DR').trim(),
          model: buildTodrModel(doc),
          quantity: doc.qty || 1,
          description: buildTodrDescription(doc),
        }];

    const TargetModel = action === 'DR' ? Dr : Todr;

    await Promise.all(rows.map(row => TargetModel.findOneAndUpdate(
      {
        sourceModule: 'emp_pending_frn',
        sourceId: String(doc._id),
        action,
        partNo: row.partNo,
      },
      {
        entryDate: action === 'TO'
          ? toDateValue(doc.toEscalationQueuedAt || new Date())
          : toDateValue(doc.entryDate || doc.rcvdDate || doc.createdAt),
        frnNo: doc.frnNo || doc.scRno || String(doc._id),
        partNo: row.partNo,
        model: row.model,
        description: row.description,
        action,
        sourceModule: 'emp_pending_frn',
        sourceId: String(doc._id),
        queuedBy,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )));
  } catch (err) {
    console.error(`[TODR/DR mirror] Failed to mirror pending FRN (action=${action}):`, err);
  }
}

async function syncMissingPendingFrn(user) {
  const eligibleStatuses = ['IW', 'EW', 'CAMC', 'STOCK', 'Demo', 'Repeat', 'Buy Back'];
  const existing = await Empfrn.find({ serviceId: { $ne: null } }).select('serviceId').lean();
  const existingIds = new Set(existing.map(d => String(d.serviceId)));

  const query = {};
  const role = String(user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    const { getDivisionFilter } = require('../utils/visibility');
    Object.assign(query, await getDivisionFilter(user));
  }

  const services = await Service.find(query).lean();
  const missing = services.filter(s => {
    const id = String(s._id || '');
    if (!id || existingIds.has(id)) return false;
    return eligibleStatuses.includes(normalizeUnitStatus(s.unitSts || s.unitStatus)) && normalizeRepType(s.repType) === 'NA';
  });

  for (const svc of missing) {
    await tryCreateFRNPending({ ...svc, unitSts: normalizeUnitStatus(svc.unitSts || svc.unitStatus), repType: normalizeRepType(svc.repType) }, user);
  }
}

async function hasQueueAccess(user, doc) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superadmin') return true;

  const { hasDivisionAccessToRecord, hasDivisionAccessToService } = require('../utils/visibility');
  if (doc.serviceId) {
    const allowed = await hasDivisionAccessToService(user, doc.serviceId);
    if (allowed) return true;
  }

  if (doc.division && await hasDivisionAccessToRecord(user, doc.division)) return true;

  const userDivisions = [
    user.activeDivision,
    user.division,
    user.divisionName,
    ...(Array.isArray(user.divisions) ? user.divisions : []),
  ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
  const docDivision = String(doc.divisionName || '').trim().toLowerCase();
  if (docDivision && userDivisions.includes(docDivision)) return true;

  const userNames = [
    user.name,
    user.employeeName,
    user.fullName,
    user.email,
    user.employeeId,
  ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);

  const recordNames = [
    doc.eng,
    doc.scEng,
    doc.raEng,
    doc.submittedBy,
    doc.estRaEng,
  ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);

  return recordNames.some(value => userNames.includes(value));
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

async function attachBsconFallback(docs) {
  if (!Array.isArray(docs) || !docs.length) return docs;

  const missingBsconDocs = docs.filter(doc => {
    const current = String(doc?.bscon || doc?.serviceId?.bscon || '').trim();
    return !current;
  });
  if (!missingBsconDocs.length) return docs;

  const scRnos = [...new Set(
    missingBsconDocs
      .map(doc => String(doc?.scRno || '').trim())
      .filter(Boolean)
  )];
  const frnNos = [...new Set(
    missingBsconDocs
      .map(doc => String(doc?.frnNo || '').trim())
      .filter(Boolean)
  )];

  const orFilters = [];
  if (scRnos.length) orFilters.push({ scReNo: { $in: scRnos } });
  if (frnNos.length) orFilters.push({ frnNo: { $in: frnNos } });
  if (!orFilters.length) return docs;

  const services = await Service.find({ $or: orFilters })
    .select('scReNo frnNo bscon')
    .lean();

  const bsconByScRno = new Map();
  const bsconByFrnNo = new Map();
  services.forEach(service => {
    const bscon = String(service?.bscon || '').trim();
    if (!bscon) return;
    const scKey = normalizeLookupValue(service.scReNo);
    const frnKey = normalizeLookupValue(service.frnNo);
    if (scKey && !bsconByScRno.has(scKey)) bsconByScRno.set(scKey, bscon);
    if (frnKey && !bsconByFrnNo.has(frnKey)) bsconByFrnNo.set(frnKey, bscon);
  });

  return docs.map(doc => {
    const current = String(doc?.bscon || doc?.serviceId?.bscon || '').trim();
    if (current) return doc;

    const fallback =
      bsconByScRno.get(normalizeLookupValue(doc?.scRno)) ||
      bsconByFrnNo.get(normalizeLookupValue(doc?.frnNo)) ||
      '';

    return fallback ? { ...doc, bscon: fallback } : doc;
  });
}

// ─────────────────────────────────────────────────────────
// GET  /api/emp/frn
// Admin: all pending EmpFRN records with filters
// ─────────────────────────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    syncMissingPendingFrn(req.user).catch(err => console.error('[EmpFRN sync]', err.message));
    const { region, unitStatus, eng, from, to } = req.query;
    const filter = { status: 'pending' };
    if (region)     filter.region     = region;
    if (unitStatus) filter.unitStatus = unitStatus;
    if (eng)        filter.$or = [{ eng }, { scEng: eng }];
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }
    const docs = await Empfrn.find(filter)
      .populate({
        path: 'serviceId',
        select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm',
        populate: { path: 'division', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();
    const docsWithBscon = await attachBsconFallback(docs);

    const now = Date.now();
    const result = docsWithBscon.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : ''),
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      scReNo: d.scReNo || d.scRno || (d.serviceId ? d.serviceId.scReNo : '') || '',
      serComm: d.serComm || (d.serviceId ? d.serviceId.serComm : '') || '',
      rcvdDate: d.rcvdDate || (d.serviceId ? d.serviceId.rcvdDate : '') || '',
      stkCust: d.stkCust || (d.serviceId ? d.serviceId.stkCust : '') || '',
      reg: d.reg || d.region || (d.serviceId ? d.serviceId.reg : '') || '',
      eng: d.eng || (d.serviceId ? d.serviceId.eng : '') || '',
      custName: d.custName || d.customer || (d.serviceId ? (d.serviceId.custName || d.serviceId.customer) : '') || '',
      customer: d.customer || d.custName || (d.serviceId ? (d.serviceId.customer || d.serviceId.custName) : '') || '',
      supplier: d.supplier || (d.serviceId ? d.serviceId.supplier : '') || '',
      model: d.model || (d.serviceId ? d.serviceId.model : '') || '',
      unitSts: d.unitSts || d.unitStatus || (d.serviceId ? d.serviceId.unitSts : '') || '',
      unitStatus: d.unitStatus || d.unitSts || (d.serviceId ? d.serviceId.unitSts : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      defMod: d.defMod || (d.serviceId ? d.serviceId.defMod : '') || '',
      defType: d.defType || (d.serviceId ? d.serviceId.defType : '') || '',
      typeAcc: d.typeAcc || (d.serviceId ? d.serviceId.typeAcc : '') || '',
      defGir: d.defGir || (d.serviceId ? d.serviceId.defGir : '') || '',
      defPartSno: d.defPartSno || (d.serviceId ? d.serviceId.defPartSno : '') || '',
      repType: d.repType || (d.serviceId ? d.serviceId.repType : '') || '',
      repGirNo: d.repGirNo || (d.serviceId ? d.serviceId.repGirNo : '') || '',
      fieldRemarks: d.fieldRemarks || (d.serviceId ? d.serviceId.fieldRemarks : '') || '',
      commWarrDetails: d.commWarrDetails || (d.serviceId ? d.serviceId.commWarrDetails : '') || '',
      bscon: d.bscon || (d.serviceId ? d.serviceId.bscon : '') || '',
      frnDate: d.frnDate || (d.serviceId ? d.serviceId.frnDate : '') || d.entryDate || d.rcvdDate || '',
      doi: d.doi || (d.serviceId ? d.serviceId.doi : '') || '',
      unitSl: d.unitSl || (d.serviceId ? d.serviceId.unitSl : '') || '',
      division: d.division || (d.serviceId && d.serviceId.division ? d.serviceId.division._id : null),
      divisionName: d.divisionName || (d.serviceId && d.serviceId.division ? d.serviceId.division.name : '') || (d.serviceId ? d.serviceId.divisionName : ''),
      srEscalationQueuedAt: d.srEscalationQueuedAt || null,
      toEscalationQueuedAt: d.toEscalationQueuedAt || null,
      pdays: Math.floor((now - new Date(d.rcvdDate || d.entryDate || d.createdAt).getTime()) / 86400000),
    }));
    res.json(result);
  } catch (err) {
    console.error('[GET /api/emp/frn]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/emp/frn/:id/approve
// Admin only: approves the record
// ─────────────────────────────────────────────────────────
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Empfrn.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/emp/frn/:id/escalate
// Admin only: escalates the record
// ─────────────────────────────────────────────────────────
router.put('/:id/escalate', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Empfrn.findByIdAndUpdate(req.params.id, { status: 'escalated' }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET  /api/emp/frn/employee
// Employee: only their own pending records
// ─────────────────────────────────────────────────────────
router.get('/test-to', async (req, res) => { const docs = await Empfrn.find({ toEscalationQueuedAt: { $ne: null } }).lean(); res.json(docs); });
router.get('/employee', protect, async (req, res) => {
  try {
    const { resolveDivisions } = require('../utils/visibility');
    const names = [
      req.user.name,
      req.user.employeeName,
      req.user.fullName,
      req.user.email,
      req.user.employeeId,
    ].map(v => String(v || '').trim()).filter(Boolean);

    const divisions = await resolveDivisions(req.user);
    const divisionIds = divisions.map(d => d._id);
    const divisionNames = divisions
      .flatMap(d => [d.name, d.displayName])
      .map(v => String(v || '').trim())
      .filter(Boolean);
    const serviceIds = divisionIds.length
      ? (await Service.find({ division: { $in: divisionIds } }).select('_id').lean()).map(s => s._id)
      : [];

    const divisionAccessOr = [
      ...(serviceIds.length ? [{ serviceId: { $in: serviceIds } }] : []),
      ...divisionNames.map(name => ({ divisionName: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') })),
      ...(divisionIds.length ? [{ division: { $in: divisionIds } }] : []),
    ];
    const nameAccessOr = names.flatMap(name => [
      { eng: name },
      { scEng: name },
      { raEng: name },
      { submittedBy: name },
      { estRaEng: name },
    ]);
    const accessOr = divisionAccessOr.length ? divisionAccessOr : nameAccessOr;

    const filter = {
      status: 'pending',
      ...(accessOr.length ? { $or: accessOr } : { _id: null }),
    };
    const docs = await Empfrn.find(filter)
      .populate({
        path: 'serviceId',
        select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm',
        populate: { path: 'division', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();
    const docsWithBscon = await attachBsconFallback(docs);

    const now = Date.now();
    const result = docsWithBscon.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : ''),
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      scReNo: d.scReNo || d.scRno || (d.serviceId ? d.serviceId.scReNo : '') || '',
      serComm: d.serComm || (d.serviceId ? d.serviceId.serComm : '') || '',
      rcvdDate: d.rcvdDate || (d.serviceId ? d.serviceId.rcvdDate : '') || '',
      stkCust: d.stkCust || (d.serviceId ? d.serviceId.stkCust : '') || '',
      reg: d.reg || d.region || (d.serviceId ? d.serviceId.reg : '') || '',
      eng: d.eng || (d.serviceId ? d.serviceId.eng : '') || '',
      custName: d.custName || d.customer || (d.serviceId ? (d.serviceId.custName || d.serviceId.customer) : '') || '',
      customer: d.customer || d.custName || (d.serviceId ? (d.serviceId.customer || d.serviceId.custName) : '') || '',
      supplier: d.supplier || (d.serviceId ? d.serviceId.supplier : '') || '',
      model: d.model || (d.serviceId ? d.serviceId.model : '') || '',
      unitSts: d.unitSts || d.unitStatus || (d.serviceId ? d.serviceId.unitSts : '') || '',
      unitStatus: d.unitStatus || d.unitSts || (d.serviceId ? d.serviceId.unitSts : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      defMod: d.defMod || (d.serviceId ? d.serviceId.defMod : '') || '',
      defType: d.defType || (d.serviceId ? d.serviceId.defType : '') || '',
      typeAcc: d.typeAcc || (d.serviceId ? d.serviceId.typeAcc : '') || '',
      defGir: d.defGir || (d.serviceId ? d.serviceId.defGir : '') || '',
      defPartSno: d.defPartSno || (d.serviceId ? d.serviceId.defPartSno : '') || '',
      repType: d.repType || (d.serviceId ? d.serviceId.repType : '') || '',
      repGirNo: d.repGirNo || (d.serviceId ? d.serviceId.repGirNo : '') || '',
      fieldRemarks: d.fieldRemarks || (d.serviceId ? d.serviceId.fieldRemarks : '') || '',
      commWarrDetails: d.commWarrDetails || (d.serviceId ? d.serviceId.commWarrDetails : '') || '',
      bscon: d.bscon || (d.serviceId ? d.serviceId.bscon : '') || '',
      frnDate: d.frnDate || (d.serviceId ? d.serviceId.frnDate : '') || d.entryDate || d.rcvdDate || '',
      doi: d.doi || (d.serviceId ? d.serviceId.doi : '') || '',
      unitSl: d.unitSl || (d.serviceId ? d.serviceId.unitSl : '') || '',
      division: d.division || (d.serviceId && d.serviceId.division ? d.serviceId.division._id : null),
      divisionName: d.divisionName || (d.serviceId && d.serviceId.division ? d.serviceId.division.name : '') || (d.serviceId ? d.serviceId.divisionName : ''),
      srEscalationQueuedAt: d.srEscalationQueuedAt || null,
      toEscalationQueuedAt: d.toEscalationQueuedAt || null,
      pdays: Math.floor((now - new Date(d.rcvdDate || d.entryDate || d.createdAt).getTime()) / 86400000),
    }));
    res.json(result);
  } catch (err) {
    console.error('[GET /api/emp/frn/employee]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET  /api/emp/frn/estimation
// Admin: all estimation-pending records
// Employee: only their own estimation-pending records
// NOTE: must be defined BEFORE /:id to avoid route collision
// ─────────────────────────────────────────────────────────
router.get('/estimation', protect, async (req, res) => {
  try {
    let filter = { status: 'estimation' };
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { getServiceIdsFilter } = require('../utils/visibility');
      const visibilityFilter = await getServiceIdsFilter(req.user, [
        { eng: req.user.name },
        { scEng: req.user.name }
      ]);
      filter = { ...filter, ...visibilityFilter };
    }
    const docs = await Empfrn.find(filter).populate('serviceId', 'branch dealer partNo').sort({ createdAt: -1 }).lean();
    const now  = Date.now();
    const result = docs.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : ''),
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      frnDate: d.frnDate || d.entryDate || d.rcvdDate || '',
      pdays: Math.floor((now - new Date(d.rcvdDate || d.entryDate || d.createdAt).getTime()) / 86400000),
    }));
    res.json(result);
  } catch (err) {
    console.error('[GET /api/emp/frn/estimation]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET  /api/emp/frn/:id
// Single record — admin or the assigned engineer
// ─────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Empfrn.findById(req.params.id).populate('serviceId', 'branch dealer').lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      __is_allowed = true;
    } else {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      if (doc && doc.serviceId && await hasDivisionAccessToService(req.user, doc.serviceId && (doc.serviceId._id || doc.serviceId))) {
        __is_allowed = true;
      } else {
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [doc.eng, doc.scEng, doc.estRaEng, doc.obRaEng, doc.submittedBy, doc.createdBy].some(v => String(v || '').trim().toLowerCase() === _uName)) {
          __is_allowed = true;
        }
      }
    }
    if (!__is_allowed) return res.status(403).json({ message: 'Access denied' });
    const pdays = Math.floor((Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000);
    res.json({ ...doc, branch: doc.branch || (doc.serviceId ? doc.serviceId.branch : ''), dealer: doc.dealer || (doc.serviceId ? doc.serviceId.dealer : '') || '', pdays });
  } catch (err) {
    console.error('[GET /api/emp/frn/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/emp/frn
// Create a new EmpFRN record
// ─────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const doc = await Empfrn.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/emp/frn]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', details: err.errors });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT  /api/emp/frn/:id/update
// Employee (or admin) updates whitelisted fields.
//
// Status transition logic:
//   • req.body.status === 'completed'    → Completed FRN  (Update tab, Same GIR = Yes)
//   • req.body.status === 'under_repair' → Under Repair    (Update tab, Same GIR = No)  ✅ FIXED
//   • req.body.status === 'estimation'   → Estimation tab
//   • typeWork is 'completed' / 'unit returned' / 'no fault' / 'upgrade' → completed
//   • typeWork is 'scrapped' → scrapped
//
// On completed/scrapped → creates a CompletedFRN record
// ─────────────────────────────────────────────────────────
router.put('/:id/update', protect, async (req, res) => {
  try {
    const doc = await Empfrn.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      __is_allowed = true;
    } else {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      if (doc && doc.serviceId && await hasDivisionAccessToService(req.user, doc.serviceId)) {
        __is_allowed = true;
      } else {
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [doc.eng, doc.scEng, doc.estRaEng, doc.obRaEng, doc.submittedBy, doc.createdBy].some(v => String(v || '').trim().toLowerCase() === _uName)) {
          __is_allowed = true;
        }
      }
    }
    if (!__is_allowed) return res.status(403).json({ message: 'Access denied' });

    // ── Whitelisted fields ────────────────────────────────
    const allowed = [
      'defPartSno', 'raEng', 'defUnitGir', 'repBrd',
      'finalRemarks', 'techRemarks', 'components', 'revalue',
      'typeWork', 'shipSc', 'shipComm',
      'repGirNo', 'typeReport', 'dcNo', 'destination',
      // Estimation fields
      'estNo', 'estDate', 'estAmount', 'estStatus',
      'estRaEng', 'estRemark', 'approvalDate',
      'partNo', 'qty', 'pricePerUnit',
      // Direct status override from frontend
      'status',
      'rtfrnSent', 'rtfrnSentAt',
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) doc[field] = req.body[field];
    });

    doc.updatedAt = new Date();
    const bodyStatus = String(req.body.status || '').toLowerCase();
    const typeWorkValue = String(doc.typeWork || '').trim().toLowerCase();
    const shouldQueueDispatchEscalation = req.body.dispatchQueue === true && bodyStatus !== 'estimation';
    if (shouldQueueDispatchEscalation) {
      doc.escalationQueuedAt = new Date();
      doc.escalationQueuedBy = req.user?.name || '';
    }

    // ── Status transition ─────────────────────────────────
    const tw         = typeWorkValue;

    if (tw === 'external repair') {
      doc.status = 'external_repair';
    } else if (tw === 'supplier warranty' || tw === 'supplier warrenty') {
      doc.status = 'supplier_warranty';
    } else if (tw === 'scrapped') {
      doc.status = 'scrapped';
    } else if (bodyStatus === 'under_repair') {
      // ✅ FIXED: Prioritize 'under_repair' from Same GIR = No above 'completed'
      doc.status = 'under_repair';
    } else if (
      ['completed', 'unit returned', 'no fault', 'upgrade', 'rep not required'].includes(tw) ||
      bodyStatus === 'completed'
    ) {
      doc.status = 'completed';
    } else if (bodyStatus === 'estimation') {
      doc.status = 'estimation';
    }
    // else: leave as 'pending'

    await doc.save();

    if (shouldQueueDispatchEscalation) {
      await enqueueEscalationSnapshot(
        'frn',
        doc._id,
        req.user?.name || '',
        buildFrnEscalationRow(doc.toObject())
      );
    }

    if (doc.status === 'under_repair' && doc.serviceId) {
      try {
        const underRepairService = await Service.findByIdAndUpdate(
          doc.serviceId,
          {
            $set: {
              type:         'Under Repair',
              typeWork:     'UNDER REPAIR',
              status:       'under_repair',
              repType:      'NA',
              raEng:        doc.raEng || '',
              repGirNo:     doc.repGirNo || '',
              typeReport:   doc.typeReport || '',
              shipSc:       doc.shipSc || '',
              destination:  doc.destination || '',
              techRemarks:  doc.techRemarks || '',
              components:   doc.components || '',
              revalue:      Number(doc.revalue || 0),
              finalRemarks: doc.finalRemarks || '',
              rtfrnSent:    !!doc.rtfrnSent,
              rtfrnSentAt:  doc.rtfrnSentAt || null,
              rtfrnCompleted: !!doc.rtfrnCompleted,
              rtfrnCompletedAt: doc.rtfrnCompletedAt || null,
              updatedAt:    new Date().toISOString(),
            },
            $unset: { completedAt: "" }
          },
          { new: true, runValidators: false }
        ).lean();
        if (underRepairService) {
          await tryCreateUnderRepair(underRepairService, req.user);
        }
      } catch (underRepairSyncErr) {
        console.error('[EmpFRN -> Service under_repair sync] FAILED:', underRepairSyncErr.message);
      }
    }

    if (doc.status === 'external_repair') {
      try {
        const already = await SCCompletedFRN.findOne({ frnId: doc._id });
        if (!already) {
          const pdays = Math.floor((Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000);
          let externalDivisionName = '';
          if (doc.serviceId) {
            try {
              const svc = await Service.findById(doc.serviceId).populate('division').lean();
              if (svc && svc.division) {
                externalDivisionName = typeof svc.division === 'object' ? svc.division.name : '';
              }
            } catch (_) {}
          }
          const externalDoc = await SCCompletedFRN.create({
            frnId: doc._id,
            serviceId: doc.serviceId ? String(doc.serviceId) : '',
            entryDate: doc.entryDate || '',
            scRno: doc.scRno || '',
            scEng: doc.scEng || '',
            frnNo: doc.frnNo || '',
            region: doc.region || '',
            eng: doc.eng || '',
            customer: doc.customer || '',
            model: doc.model || '',
            unitStatus: doc.unitStatus || '',
            defMod: doc.defMod || '',
            defGir: doc.defGir || '',
            raEng: doc.raEng || '',
            repBrdDate: doc.repBrd || '',
            dcNo: doc.dcNo || '',
            defUnitGir: doc.defUnitGir || 'NA',
            repGirSno: doc.repGirNo || '',
            finalRemarks: doc.finalRemarks || '',
            techRemarks: doc.techRemarks || '',
            components: doc.components || '',
            typeWork: 'EXTERNAL REPAIR',
            reportType: doc.typeReport || '',
            destination: doc.destination || '',
            shipDateSC: doc.shipSc || '',
            shipDateComm: doc.shipComm || '',
            pdays,
            division: externalDivisionName,
            updatedBy: req.user?.name || '',
            status: 'pending_update',
          });
          await enqueueLatestEscalationSnapshot(
            'external_repair',
            externalDoc._id,
            req.user?.name || '',
            buildExternalRepairEscalationRow(externalDoc.toObject ? externalDoc.toObject() : externalDoc)
          );
        }
        if (doc.serviceId) {
          await Service.findByIdAndUpdate(
            doc.serviceId,
            {
              $set: {
                type: 'External Repair',
                typeWork: 'External Repair',
                status: 'completed',
                updatedAt: new Date().toISOString(),
              },
            },
            { runValidators: false }
          );
        }
      } catch (externalErr) {
        return res.status(500).json({ message: `Failed to move to SC Completed FRN: ${externalErr.message}` });
      }
    }

    if (doc.status === 'supplier_warranty') {
      try {
        // Resolve serviceId to a valid MongoDB ObjectId
        const mongoose = require('mongoose');
        let validServiceId = null;
        if (doc.serviceId) {
          if (mongoose.Types.ObjectId.isValid(doc.serviceId) && String(doc.serviceId).length === 24) {
            validServiceId = doc.serviceId;
          } else {
            // It's a custom string like "SVC-...", look up the actual _id
            const svcByCustomId = await Service.findOne({ serviceId: String(doc.serviceId) }).lean();
            if (svcByCustomId) validServiceId = svcByCustomId._id;
          }
        }

        let alreadyScrap = false;
        if (doc.frnNo) alreadyScrap = await Scrap.findOne({ frnNo: doc.frnNo });
        if (!alreadyScrap && validServiceId) alreadyScrap = await Scrap.findOne({ serviceId: validServiceId });

        if (!alreadyScrap) {
          let divisionName = doc.division || doc.divisionName || '';
          if (!divisionName && validServiceId) {
            const svc = await Service.findById(validServiceId).populate('division').lean();
            if (svc) {
              if (svc.division) {
                divisionName = typeof svc.division === 'object' ? (svc.division.name || svc.division.displayName) : svc.division;
              }
              if (!divisionName) divisionName = svc.divisionName || '';
            }
          }
          if (!divisionName && req.user) {
            const divDoc = await resolveDivision(req.user);
            divisionName = divDoc ? divDoc.name : (req.user?.division || '');
          }

          const scrapDoc = await Scrap.create({
            serviceId: validServiceId || null,
            entryDate: doc.entryDate || '',
            scRno: doc.scRno || '',
            scEng: doc.scEng || '',
            frnNo: doc.frnNo || '',
            region: doc.region || '',
            engineer: doc.eng || '',
            customer: doc.customer || '',
            model: doc.model || '',
            unitStatus: doc.unitStatus || '',
            defMod: doc.defMod || '',
            defGir: doc.defGir || '',
            typeWork: 'Supplier Warranty',
            rcvdDate: doc.entryDate || '',
            pdPfrn: Math.floor((Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000),
            pdObp: 0,
            pdUrp: 0,
            pdScc: 0,
            division: divisionName,
            addedBy: req.user?.name || '',
          });
          await enqueueLatestEscalationSnapshot(
            'supplier_warranty',
            scrapDoc._id,
            req.user?.name || '',
            buildSupplierWarrantyEscalationRow(scrapDoc.toObject ? scrapDoc.toObject() : scrapDoc)
          );
        }
        if (validServiceId) {
          await Service.findByIdAndUpdate(
            validServiceId,
            {
              $set: {
                type: 'Supplier Warranty',
                typeWork: 'Supplier Warranty',
                status: 'completed',
                updatedAt: new Date().toISOString(),
              },
            },
            { runValidators: false }
          );
        }
      } catch (scrapErr) {
        return res.status(500).json({ message: `Failed to move to Supplier Warranty list: ${scrapErr.message}` });
      }
    }

    // ── If completed or scrapped → write to CompletedFRN ──
    if (doc.status === 'completed' || doc.status === 'scrapped') {
      try {
        if (doc.status === 'completed') {
          await updateLinkedServiceForFrn(doc, {
            type: doc.typeWork || 'Completed',
            typeWork: doc.typeWork || 'Completed',
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date().toISOString(),
          });
        }
        const already = await CompletedFRN.findOne({ frnId: doc._id });
        if (!already) {
          const pdays = Math.floor(
            (Date.now() - new Date(doc.createdAt).getTime()) / 86400000
          );
          let engName = doc.eng || doc.engineer || doc.engineerName || doc.fieldEngineer || '';
          let custName = doc.customer || doc.custName || doc.customerName || '';
          let partNoVal = doc.partNo || doc.partNumber || doc.part_no || '';

          if ((!engName || !partNoVal || !custName) && doc.serviceId) {
            const linkedSvc = await Service.findById(doc.serviceId).lean().catch(() => null);
            if (linkedSvc) {
              if (!engName) engName = linkedSvc.eng || linkedSvc.engineer || linkedSvc.engineerName || linkedSvc.fieldEngineer || '';
              if (!custName) custName = linkedSvc.customer || linkedSvc.customerName || linkedSvc.custName || '';
              if (!partNoVal) partNoVal = linkedSvc.partNo || linkedSvc.partNumber || linkedSvc.part_no || '';
            }
          }

          await CompletedFRN.create({
            frnId:        doc._id,
            serviceId:    doc.serviceId    || null,
            entryDate:    doc.entryDate    || '',
            scRno:        doc.scRno        || '',
            scEng:        doc.scEng        || '',
            frnNo:        doc.frnNo        || '',
            region:       doc.region       || '',
            eng:          engName,
            customer:     custName,
            model:        doc.model        || '',
            unitStatus:   doc.unitStatus   || '',
            partNo:       partNoVal,
            defMod:       doc.defMod       || '',
            defGir:       doc.defGir       || '',
            raEng:        doc.raEng        || '',
            defUnitGir:   doc.defUnitGir   || 'NA',
            repGirSno:    doc.repGirNo     || '',
            repBrdDate:   doc.repBrd       || '',
            finalRemarks: doc.finalRemarks || '',
            techRemarks:  doc.techRemarks  || '',
            components:   doc.components   || '',
            revalue:      Number(doc.revalue || 0),
            typeWork:     doc.typeWork     || '',
            destination:  doc.destination  || '',
            shipDateSC:   doc.shipSc       || '',
            pdays,
            closedBy:     req.user?.name   || '',
            closedAt:     new Date(),
          });
          console.log(`[CompletedFRN] ✅ Created — frnId=${doc._id} scRno=${doc.scRno}`);
        } else {
          console.log(`[CompletedFRN] ℹ️  Already exists for frnId=${doc._id}, skipping.`);
        }
      } catch (completedErr) {
        console.error('[CompletedFRN.create] ❌ FAILED:', completedErr.message);
        console.error('[CompletedFRN.create] Full error:', completedErr);
        const pdays = Math.floor((Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000);
        // HTTP 207 = EmpFRN saved OK but CompletedFRN copy failed
        return res.status(207).json({
          ...doc.toObject(),
          pdays,
          warning: `Record saved but failed to copy to Completed FRN: ${completedErr.message}`,
        });
      }
    }

    const pdays = Math.floor((Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000);
    res.json({
      ...doc.toObject(),
      pdays,
      externalRepair: doc.status === 'external_repair',
      supplierWarranty: doc.status === 'supplier_warranty',
      redirect:
        doc.status === 'external_repair'
          ? 'sc-completed-frn.html'
          : doc.status === 'supplier_warranty'
            ? 'Emp-scrap-list.html'
            : '',
    });
  } catch (err) {
    console.error('[PUT /api/emp/frn/:id/update]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', details: err.errors });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/emp/frn/:id
// Admin only — hard delete
// ─────────────────────────────────────────────────────────
router.post('/:id/sr', protect, async (req, res) => {
  try {
    const doc = await Empfrn.findById(req.params.id).populate({ path: 'serviceId', strictPopulate: false, populate: { path: 'division', strictPopulate: false } });
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    if (!(await hasQueueAccess(req.user, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (doc.srEscalationQueuedAt) {
      await mirrorFrnToTodr(doc, 'DR', [], doc.srEscalationQueuedBy || req.user?.name || '');
      return res.json({
        success: true,
        alreadyQueued: true,
        srEscalationQueuedAt: doc.srEscalationQueuedAt,
        srEscalationQueuedBy: doc.srEscalationQueuedBy || '',
      });
    }

    const escalationPartNo = String(req.body?.partNo || '').trim() || doc.partNo || '';
    const escalationDoc = { 
      ...doc.toObject(), 
      partNo: escalationPartNo,
      divisionName: doc.divisionName || (doc.serviceId && doc.serviceId.division ? doc.serviceId.division.name : '')
    };

    doc.srEscalationQueuedAt = new Date();
    doc.srEscalationQueuedBy = req.user?.name || '';
    await doc.save();

    await enqueueEscalationSnapshot(
      'sr_frn',
      doc._id,
      req.user?.name || '',
      buildFrnEscalationRow(escalationDoc)
    );
    await mirrorFrnToTodr(escalationDoc, 'DR', [], req.user?.name || '');

    res.json({
      success: true,
      message: 'Queued for SR escalation.',
      srEscalationQueuedAt: doc.srEscalationQueuedAt,
      srEscalationQueuedBy: doc.srEscalationQueuedBy,
    });
  } catch (err) {
    console.error('[POST /api/emp/frn/:id/sr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/to', protect, async (req, res) => {
  try {
    const doc = await Empfrn.findById(req.params.id).populate({ path: 'serviceId', strictPopulate: false, populate: { path: 'division', strictPopulate: false } });
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!(await hasQueueAccess(req.user, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (doc.toEscalationQueuedAt) {
      return res.json({
        success: true,
        alreadyQueued: true,
        toEscalationQueuedAt: doc.toEscalationQueuedAt,
        toEscalationQueuedBy: doc.toEscalationQueuedBy || '',
      });
    }

    const cleanItems = rawItems
      .map((item) => ({
        partNo: String(item?.partNo || '').trim(),
        description: String(item?.description || item?.itemDescription || '').trim(),
        qty: Math.max(1, parseInt(item?.qty, 10) || 1),
      }))
      .filter((item) => item.partNo);
    if (!cleanItems.length) {
      return res.status(400).json({ message: 'Add at least one TO row with Part No and Quantity.' });
    }

    doc.toEscalationQueuedAt = new Date();
    doc.toEscalationQueuedBy = req.user?.name || '';
    await doc.save();

    const escalationDoc = { 
      ...doc.toObject(),
      divisionName: doc.divisionName || (doc.serviceId && doc.serviceId.division ? doc.serviceId.division.name : '')
    };
    await enqueueEscalationSnapshot(
      'to_frn',
      doc._id,
      req.user?.name || '',
      buildToEscalationRow(escalationDoc, cleanItems)
    );
    await mirrorFrnToTodr(doc, 'TO', cleanItems, req.user?.name || '');

    res.json({
      success: true,
      message: 'Queued for TO escalation.',
      toEscalationQueuedAt: doc.toEscalationQueuedAt,
      toEscalationQueuedBy: doc.toEscalationQueuedBy,
    });
  } catch (err) {
    console.error('[POST /api/emp/frn/:id/to]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Empfrn.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/emp/frn/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
