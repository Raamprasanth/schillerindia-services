// routes/estimationPending.js
// Mount in server.js:
//   app.use('/api/emp/estimation', require('./routes/estimationPending'));

const express           = require('express');
const mongoose          = require('mongoose');
const router            = express.Router();
const EstimationPending = require('../models/EstimationPending');
const CompletedFRN      = require('../models/CompletedFRN');
const SCCompletedFRN    = require('../models/SCCompletedFRN');
const Scrap             = require('../models/Scrap');
const Service           = require('../models/Service');
const Division          = require('../models/Division');
const Todr              = require('../models/Todr');
const Dr                = require('../models/Dr');
const RTCRL             = require('../models/rtcrlModel');
const { protect }       = require('../middleware/authMiddleware');
const { tryCreateUnderRepair } = require('../services/queueSyncService');
const {
  buildEstimationEscalationRow,
  buildToEscalationRow,
  buildExternalRepairEscalationRow,
  buildSupplierWarrantyEscalationRow,
  enqueueEscalationSnapshot,
  enqueueLatestEscalationSnapshot,
} = require('../services/escalationService');

router.use(protect);

function normalizeObjectIdLike(value) {
  if (!value) return null;
  const candidate = typeof value === 'object'
    ? (value._id || value.id || value.serviceId || '')
    : value;
  const text = String(candidate || '').trim();
  return mongoose.Types.ObjectId.isValid(text) ? text : null;
}

function normalizeSourceIdLike(value) {
  if (!value) return '';
  const candidate = typeof value === 'object'
    ? (value._id || value.id || value.serviceId || '')
    : value;
  return String(candidate || '').trim();
}

function toDateValue(value) {
  if (!value) return new Date();
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildTodrModel(doc) {
  return String(doc.model || '').trim();
}

function buildTodrDescription(doc, item = {}) {
  return String(item.description || doc.defMod || doc.defBrdModName || '').trim() || 'TO/DR entry';
}

async function mirrorEstToTodr(doc, action, items = [], queuedBy = '') {
  try {
    const rows = action === 'TO'
      ? items.map(item => ({
          partNo: String(item.partNo || '').trim(),
          model: buildTodrModel(doc),
          description: buildTodrDescription(doc, item),
          quantity: item.qty || 1,
        })).filter(item => item.partNo)
      : [{
          partNo: String(doc.partNo || doc.defMod || doc.defGir || 'DR').trim(),
          model: buildTodrModel(doc),
          description: buildTodrDescription(doc),
          quantity: doc.qty || doc.quantity || 1,
        }];

    const TargetModel = action === 'DR' ? Dr : Todr;

    await Promise.all(rows.map(row => TargetModel.findOneAndUpdate(
      {
        sourceModule: 'estimation_pending',
        sourceId: String(doc._id),
        action,
        partNo: row.partNo,
      },
      {
        entryDate: action === 'TO'
          ? toDateValue(doc.toEscalationQueuedAt || new Date())
          : toDateValue(doc.entryDate || doc.rcvdDate || doc.createdAt),
        frnNo: doc.frnNo || doc.scReNo || String(doc._id),
        partNo: row.partNo,
        model: row.model,
        description: row.description,
        quantity: row.quantity,
        action,
        sourceModule: 'estimation_pending',
        sourceId: String(doc._id),
        queuedBy,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )));
  } catch (err) {
    console.error(`[TODR/DR mirror] Failed to mirror pending Estimation (action=${action}):`, err);
  }
}

async function markSourceServiceMovedToEstimation(serviceId, fields = {}) {
  if (!serviceId) return;
  const sourceIds = [...new Set([serviceId, fields.sourceId].filter(Boolean).map(String))]
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));
  if (!sourceIds.length) return;

  const update = {
    $set: {
      movedToEstimation: true,
      obPending: false,
      obStatus: 'Estimation',
      updatedAt: new Date().toISOString(),
      ...fields,
    },
  };
  delete update.$set.sourceId;

  try {
    await Service.updateMany(
      { _id: { $in: sourceIds } },
      update,
      { runValidators: false }
    );
  } catch(err) {
    console.error('Error updating Service movedToEstimation:', err);
  }
}

async function markObSourceFromEstimationPayload(payload = {}) {
  if (String(payload.source || '').toLowerCase() !== 'ob') return;
  const sourceId = payload.serviceId || payload.sourceId || '';
  if (!sourceId) return;
  const now = new Date();
  await markSourceServiceMovedToEstimation(sourceId, {
    sourceId: payload.sourceId || '',
    estNo: payload.estNo || '',
    estDate: payload.estDate || '',
    estValidDate: payload.estValidDate || '',
    estAmount: Number(payload.estGroupTotal || payload.estAmount || 0),
    estStatus: payload.estStatus || '',
    orderType: payload.orderType || payload.estStatus || '',
    estRaEng: payload.estRaEng || '',
    defUnitGir: payload.defUnitGir || '',
    serviceCharge: Number(payload.serviceCharge || 0),
    itemsTotal: Number(payload.itemsTotal || 0),
    estGroupTotal: Number(payload.estGroupTotal || payload.estAmount || 0),
    estUpdatedBy: payload.estUpdatedBy || payload.submittedBy || '',
    estUpdatedAt: payload.estUpdatedAt ? new Date(payload.estUpdatedAt) : now,
  });
}

async function markExistingObSourcesMoved(serviceIds = []) {
  const ids = [...new Set(serviceIds.filter(Boolean).map(String))]
    .filter(id => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return;
  await Service.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        movedToEstimation: true,
        obPending: false,
        obStatus: 'Estimation',
        updatedAt: new Date().toISOString(),
      },
    },
    { runValidators: false }
  );
}

async function hasQueueAccess(user, record) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superadmin') return true;

  const { hasDivisionAccessToService } = require('../utils/visibility');
  if (record.serviceId) {
    const allowed = await hasDivisionAccessToService(user, record.serviceId);
    if (allowed) return true;
  }

  const userName = String(user.name || '').trim().toLowerCase();
  return [
    record.eng,
    record.scEng,
    record.estRaEng,
    record.submittedBy,
    record.obRaEng,
  ].some((value) => String(value || '').trim().toLowerCase() === userName);
}

function estimationOwnerFallback(user) {
  const name = String(user?.name || '').trim();
  if (!name) return [];
  return [
    { eng: name },
    { scEng: name },
    { estRaEng: name },
    { submittedBy: name },
    { obRaEng: name },
    { estUpdatedBy: name },
    { obUpdatedBy: name },
    { createdBy: name },
  ];
}

function pickRepairComponents(doc) {
  return String(doc?.components || doc?.obComponents || doc?.compUsedToRepair || doc?.componentsUsed || doc?.partsUsed || '').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceIdText(value) {
  const raw = value && typeof value === 'object' ? (value._id || value.id || '') : value;
  return String(raw || '').trim();
}

function buildRepairLookup(record) {
  const values = [record.scReNo, record.scRno, record.scRefNo, record.defGir, record.defGirNo, record.obDefUnitGir, record.defUnitGir]
    .map(value => String(value || '').trim())
    .filter(value => value && value !== '-');
  const ors = [];
  [...new Set(values)].forEach(value => {
    const regex = new RegExp('^' + escapeRegex(value) + '$', 'i');
    ors.push({ scReNo: regex }, { scRno: regex }, { scRefNo: regex }, { defGir: regex }, { defGirNo: regex });
  });
  return ors.length ? { $or: ors } : null;
}

async function enrichEstimationComponents(record) {
  const out = { ...record };
  if (pickRepairComponents(out)) return out;

  const serviceId = sourceIdText(out.serviceId) || sourceIdText(out.sourceId);
  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    const service = await Service.findById(serviceId).select('components obComponents compUsedToRepair componentsUsed partsUsed scReNo scRno scRefNo defGir defGirNo defUnitGir').lean();
    const serviceComponents = pickRepairComponents(service);
    if (serviceComponents) {
      out.components = serviceComponents;
      out.obComponents = serviceComponents;
      return out;
    }
    if (service) {
      out.scReNo = out.scReNo || service.scReNo || service.scRno || service.scRefNo || '';
      out.defGir = out.defGir || service.defGir || service.defGirNo || service.defUnitGir || '';
    }
  }

  const lookup = buildRepairLookup(out);
  if (!lookup) return out;
  const componentTextQuery = {
    $or: [
      { components: { $exists: true, $nin: ['', null] } },
      { compUsedToRepair: { $exists: true, $nin: ['', null] } },
      { partsUsed: { $exists: true, $nin: ['', null] } },
    ],
  };
  const rtcrl =
    await RTCRL.findOne({ $and: [lookup, { category: 'OB' }, componentTextQuery] }).sort({ closedDate: -1, createdAt: -1 }).lean() ||
    await RTCRL.findOne({ $and: [lookup, componentTextQuery] }).sort({ closedDate: -1, createdAt: -1 }).lean();
  const rtcrlComponents = pickRepairComponents(rtcrl);
  if (rtcrlComponents) {
    out.components = rtcrlComponents;
    out.obComponents = rtcrlComponents;
  }
  return out;
}

async function enrichEstimationComponentList(records) {
  return Promise.all(records.map(record => enrichEstimationComponents(record)));
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET  /api/emp/estimation
//  Admin → all records  |  Employee → own division records
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { role } = req.user;
    let query = {};
    if (role !== 'admin' && role !== 'superadmin') {
      const { getServiceIdsFilter } = require('../utils/visibility');
      query = await getServiceIdsFilter(req.user);
    }
    const records = await enrichEstimationComponentList(await EstimationPending.find(query).populate({ path: 'serviceId', select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm', populate: { path: 'division', select: 'name' } }).sort({ createdAt: -1 }).lean());
    res.json(records.map(record => ({
      ...record,
      dealer: record.dealer || (record.serviceId ? record.serviceId.dealer : '') || '',
      branch: record.branch || (record.serviceId ? record.serviceId.branch : '') || '',
      scReNo: record.scReNo || record.scRno || (record.serviceId ? record.serviceId.scReNo : '') || '',
      frnDate: record.frnDate || (record.serviceId ? record.serviceId.frnDate : '') || '',
      serComm: record.serComm || (record.serviceId ? record.serviceId.serComm : '') || '',
      rcvdDate: record.rcvdDate || (record.serviceId ? record.serviceId.rcvdDate : '') || '',
      stkCust: record.stkCust || (record.serviceId ? record.serviceId.stkCust : '') || '',
      reg: record.reg || record.region || (record.serviceId ? record.serviceId.reg : '') || '',
      eng: record.eng || (record.serviceId ? record.serviceId.eng : '') || '',
      custName: record.custName || record.customer || (record.serviceId ? (record.serviceId.custName || record.serviceId.customer) : '') || '',
      customer: record.customer || record.custName || (record.serviceId ? (record.serviceId.customer || record.serviceId.custName) : '') || '',
      supplier: record.supplier || (record.serviceId ? record.serviceId.supplier : '') || '',
      model: record.model || (record.serviceId ? record.serviceId.model : '') || '',
      unitSts: record.unitSts || record.unitStatus || (record.serviceId ? record.serviceId.unitSts : '') || '',
      unitStatus: record.unitStatus || record.unitSts || (record.serviceId ? record.serviceId.unitSts : '') || '',
      partNo: record.partNo || (record.serviceId ? record.serviceId.partNo : '') || '',
      defMod: record.defMod || (record.serviceId ? record.serviceId.defMod : '') || '',
      defType: record.defType || (record.serviceId ? record.serviceId.defType : '') || '',
      typeAcc: record.typeAcc || (record.serviceId ? record.serviceId.typeAcc : '') || '',
      defGir: record.defGir || (record.serviceId ? record.serviceId.defGir : '') || '',
      defPartSno: record.defPartSno || (record.serviceId ? record.serviceId.defPartSno : '') || '',
      repType: record.repType || (record.serviceId ? record.serviceId.repType : '') || '',
      repGirNo: record.repGirNo || record.obRepGirNo || (record.serviceId ? record.serviceId.repGirNo : '') || '',
      fieldRemarks: record.fieldRemarks || (record.serviceId ? record.serviceId.fieldRemarks : '') || '',
      commWarrDetails: record.commWarrDetails || (record.serviceId ? record.serviceId.commWarrDetails : '') || '',
      bscon: record.bscon || (record.serviceId ? record.serviceId.bscon : '') || '',
      doi: record.doi || (record.serviceId ? record.serviceId.doi : '') || '',
      unitSl: record.unitSl || (record.serviceId ? record.serviceId.unitSl : '') || '',
      division: record.division || (record.serviceId && record.serviceId.division ? record.serviceId.division._id : null),
      divisionName: record.divisionName || (record.serviceId && record.serviceId.division ? record.serviceId.division.name : '') || (record.serviceId ? record.serviceId.divisionName : ''),
    })));
  } catch (err) {
    console.error('[GET /api/emp/estimation]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET  /api/emp/estimation/employee  (explicit employee-only endpoint)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/employee', async (req, res) => {
  try {
    const { getServiceIdsFilter } = require('../utils/visibility');
    const query = await getServiceIdsFilter(req.user);
    const records = await enrichEstimationComponentList(await EstimationPending.find(query).populate({ path: 'serviceId', select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm', populate: { path: 'division', select: 'name' } }).sort({ createdAt: -1 }).lean());
    res.json(records.map(record => ({
      ...record,
      dealer: record.dealer || (record.serviceId ? record.serviceId.dealer : '') || '',
      branch: record.branch || (record.serviceId ? record.serviceId.branch : '') || '',
      scReNo: record.scReNo || record.scRno || (record.serviceId ? record.serviceId.scReNo : '') || '',
      frnDate: record.frnDate || (record.serviceId ? record.serviceId.frnDate : '') || '',
      serComm: record.serComm || (record.serviceId ? record.serviceId.serComm : '') || '',
      rcvdDate: record.rcvdDate || (record.serviceId ? record.serviceId.rcvdDate : '') || '',
      stkCust: record.stkCust || (record.serviceId ? record.serviceId.stkCust : '') || '',
      reg: record.reg || record.region || (record.serviceId ? record.serviceId.reg : '') || '',
      eng: record.eng || (record.serviceId ? record.serviceId.eng : '') || '',
      custName: record.custName || record.customer || (record.serviceId ? (record.serviceId.custName || record.serviceId.customer) : '') || '',
      customer: record.customer || record.custName || (record.serviceId ? (record.serviceId.customer || record.serviceId.custName) : '') || '',
      supplier: record.supplier || (record.serviceId ? record.serviceId.supplier : '') || '',
      model: record.model || (record.serviceId ? record.serviceId.model : '') || '',
      unitSts: record.unitSts || record.unitStatus || (record.serviceId ? record.serviceId.unitSts : '') || '',
      unitStatus: record.unitStatus || record.unitSts || (record.serviceId ? record.serviceId.unitSts : '') || '',
      partNo: record.partNo || (record.serviceId ? record.serviceId.partNo : '') || '',
      defMod: record.defMod || (record.serviceId ? record.serviceId.defMod : '') || '',
      defType: record.defType || (record.serviceId ? record.serviceId.defType : '') || '',
      typeAcc: record.typeAcc || (record.serviceId ? record.serviceId.typeAcc : '') || '',
      defGir: record.defGir || (record.serviceId ? record.serviceId.defGir : '') || '',
      defPartSno: record.defPartSno || (record.serviceId ? record.serviceId.defPartSno : '') || '',
      repType: record.repType || (record.serviceId ? record.serviceId.repType : '') || '',
      repGirNo: record.repGirNo || record.obRepGirNo || (record.serviceId ? record.serviceId.repGirNo : '') || '',
      fieldRemarks: record.fieldRemarks || (record.serviceId ? record.serviceId.fieldRemarks : '') || '',
      commWarrDetails: record.commWarrDetails || (record.serviceId ? record.serviceId.commWarrDetails : '') || '',
      bscon: record.bscon || (record.serviceId ? record.serviceId.bscon : '') || '',
      doi: record.doi || (record.serviceId ? record.serviceId.doi : '') || '',
      unitSl: record.unitSl || (record.serviceId ? record.serviceId.unitSl : '') || '',
      division: record.division || (record.serviceId && record.serviceId.division ? record.serviceId.division._id : null),
      divisionName: record.divisionName || (record.serviceId && record.serviceId.division ? record.serviceId.division.name : '') || (record.serviceId ? record.serviceId.divisionName : ''),
    })));
  } catch (err) {
    console.error('[GET /api/emp/estimation/employee]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET  /api/emp/estimation/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await EstimationPending.findById(req.params.id).populate({ path: 'serviceId', select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm', populate: { path: 'division', select: 'name' } }).lean();
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, record.serviceId && (record.serviceId._id || record.serviceId));
      if (!allowed) return res.status(403).json({ message: 'Access denied' });
    }
    const enrichedRecord = await enrichEstimationComponents(record);
    res.json({
      ...enrichedRecord,
      dealer: enrichedRecord.dealer || (enrichedRecord.serviceId ? enrichedRecord.serviceId.dealer : '') || '',
      defPartSno: enrichedRecord.defPartSno || (enrichedRecord.serviceId ? enrichedRecord.serviceId.defPartSno : '') || '',
    });
  } catch (err) {
    console.error('[GET /api/emp/estimation/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST  /api/emp/estimation
//  Standard upsert — auto-created from empServiceRoutes (source: 'service')
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const now  = new Date();
    const normalizedServiceId = normalizeObjectIdLike(body.serviceId);
    const normalizedSourceId = normalizeSourceIdLike(body.sourceId || normalizedServiceId || '');

    const docData = {
      ...body,
      source:      body.source      || 'service',
      sourceId:    normalizedSourceId,
      serviceId:   normalizedServiceId,
      submittedBy: body.submittedBy || req.user.name,
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : now,
      entryDate:   body.entryDate   || now.toISOString().split('T')[0],
    };

    // Strip Mongoose internal fields
    delete docData._id;
    delete docData.id;
    delete docData.__v;
    delete docData.createdAt;
    delete docData.updatedAt;

    let record;
    if (normalizedServiceId) {
      record = await EstimationPending.findOneAndUpdate(
        { serviceId: normalizedServiceId, estLineNo: docData.estLineNo || 1 },
        { $set: docData },
        { new: true, upsert: true, runValidators: false }
      );
      await markObSourceFromEstimationPayload({ ...docData, estUpdatedBy: docData.estUpdatedBy || req.user.name || '' });
      console.log('[EstPending] upserted for serviceId:', normalizedServiceId);
    } else if (docData.sourceId) {
      record = await EstimationPending.findOneAndUpdate(
        { source: docData.source, sourceId: docData.sourceId, estLineNo: docData.estLineNo || 1 },
        { $set: docData },
        { new: true, upsert: true, runValidators: false }
      );
      await markObSourceFromEstimationPayload({ ...docData, estUpdatedBy: docData.estUpdatedBy || req.user.name || '' });
      console.log('[EstPending] upserted for sourceId:', docData.sourceId);
    } else {
      record = await EstimationPending.create(docData);
      await markObSourceFromEstimationPayload({ ...docData, estUpdatedBy: docData.estUpdatedBy || req.user.name || '' });
      console.log('[EstPending] created (no serviceId)');
    }

    res.status(201).json(record);
  } catch (err) {
    console.error('[POST /api/emp/estimation]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Repair old records that were created in Estimation Pending but still visible
// in Employee OB Pending because the source Service was not marked.
router.post('/repair-ob-sources', async (req, res) => {
  try {
    const records = await EstimationPending.find({
      source: 'ob',
      serviceId: { $exists: true, $ne: null },
    }).select('serviceId').lean();
    const ids = records.map(record => record.serviceId);
    await markExistingObSourcesMoved(ids);
    res.json({ success: true, updated: [...new Set(ids.map(String))].length });
  } catch (err) {
    console.error('[POST /api/emp/estimation/repair-ob-sources]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST  /api/emp/estimation/from-ob
//
//  Called by ob-pending.html AFTER a successful OB update (submitUpdate).
//  Performs an upsert keyed on serviceId so repeated OB saves just update
//  the same EstimationPending document — never create duplicates.
//
//  Body shape (sent by ob-pending.html):
//  {
//    serviceId,                     ← _id of the Service document
//    source: 'ob',
//    entryDate, scReNo, scEng, frnNo, frnDate, reg, branch, eng,
//    custName, model, unitSts, defMod, defGir, typeWork, repType,
//    obRaEng, obDefUnitGir, obRepGirNo, obFinalRemarks, obStatus,
//    obUpdatedBy, obUpdatedAt, obRepBrd, obShipSc, obShipComm,
//    obDcNo, obDestination, obComponents, obTypeReport,
//    techRemarks, finalRemarks, components,
//    submittedBy, submittedAt
//  }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/from-ob', async (req, res) => {
  try {
    const body = req.body;
    const now  = new Date();
    const normalizedServiceId = normalizeObjectIdLike(body.serviceId);
    const normalizedSourceId = normalizeSourceIdLike(body.sourceId || normalizedServiceId || '');

    if (!normalizedServiceId) {
      return res.status(400).json({ message: 'serviceId is required for from-ob push' });
    }

    const docData = {
      // ── source tag ──────────────────────────────────────
      source: 'ob',
      sourceId: normalizedSourceId,

      // ── core service info ────────────────────────────────
      serviceId:   normalizedServiceId,
      entryDate:   body.entryDate   || now.toISOString().split('T')[0],
      rcvdDate:    body.rcvdDate    || '',
      scReNo:      body.scReNo      || body.scRno  || '',
      scEng:       body.scEng       || '',
      frnNo:       body.frnNo       || '',
      frnDate:     body.frnDate     || '',
      reg:         body.reg         || body.region || '',
      branch:      body.branch      || '',
      eng:         body.eng         || body.engineer || '',
      dealer:      body.dealer      || '',
      custName:    body.custName    || body.customer || '',
      customer:    body.customer    || body.custName || '',
      model:       body.model       || '',
      unitSts:     body.unitSts     || body.unitStatus || '',
      defMod:      body.defMod      || body.defMod || '',
      defGir:      body.defGir      || body.defGirNo || '',
      defPartSno:  body.defPartSno  || '',
      typeWork:    body.typeWork    || '',
      repType:     body.repType     || 'NA',

      // ── OB update payload ────────────────────────────────
      obRaEng:        body.obRaEng        || body.raEng || '',
      obDefUnitGir:   body.obDefUnitGir   || body.defUnitGir || '',
      obRepGirNo:     body.obRepGirNo     || body.repGirNo || '',
      obFinalRemarks: body.obFinalRemarks || body.finalRemarks || '',
      obStatus:       body.obStatus       || body.typeWork || '',
      obUpdatedBy:    body.obUpdatedBy    || req.user.name,
      obUpdatedAt:    body.obUpdatedAt    ? new Date(body.obUpdatedAt) : now,
      obRepBrd:       body.repBrd         || '',
      obShipSc:       body.shipSc         || '',
      obShipComm:     body.shipComm       || '',
      obDcNo:         body.dcNo           || '',
      obDestination:  body.destination    || '',
      obComponents:   body.components     || body.obComponents || '',
      revalue:        Number(body.revalue || 0),
      obTypeReport:   body.typeReport     || '',

      // ── carry common remark fields ───────────────────────
      techRemarks:  body.techRemarks  || '',
      finalRemarks: body.obFinalRemarks || body.finalRemarks || '',
      components:   body.components   || body.obComponents || '',

      // ── default estimation status ────────────────────────
      estStatus: 'Estimation Pending',

      // ── audit ────────────────────────────────────────────
      submittedBy: body.submittedBy || req.user.name,
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : now,
    };

    const record = await EstimationPending.findOneAndUpdate(
      { serviceId: normalizedServiceId },
      { $set: docData },
      { new: true, upsert: true, runValidators: false }
    );

    await markSourceServiceMovedToEstimation(normalizedServiceId);

    console.log('[EstPending/from-ob] upserted serviceId:', normalizedServiceId, '→', record._id);
    res.status(201).json(record);
  } catch (err) {
    console.error('[POST /api/emp/estimation/from-ob]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT  /api/emp/estimation/:id   (Update modal in empestpend.html)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const record = await EstimationPending.findById(req.params.id).populate({ path: 'serviceId', populate: { path: 'division' } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const { role, name } = req.user;
    if (!(await hasQueueAccess(req.user, record))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { _id, id, createdAt, dispatchQueue, ...updateData } = req.body;
    const sameGir = String(updateData.sameGir || '').toLowerCase();
    const shouldQueueDispatchEscalation = dispatchQueue === true;
    const updated = await EstimationPending.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...updateData,
          estUpdatedBy: name,
          estUpdatedAt: new Date(),
          ...(shouldQueueDispatchEscalation ? {
            escalationQueuedAt: new Date(),
            escalationQueuedBy: name || '',
          } : {}),
        }
      },
      { new: true, runValidators: false }
    );

    if (shouldQueueDispatchEscalation) {
      await enqueueEscalationSnapshot(
        'est',
        updated._id,
        name || '',
        buildEstimationEscalationRow(updated.toObject ? updated.toObject() : updated)
      );
    }

    const normalizedTypeWork = String(updated.typeWork || '').trim().toLowerCase();

    if (normalizedTypeWork === 'external repair') {
      const pdays = (record.rcvdDate || record.entryDate)
        ? Math.max(0, Math.floor((Date.now() - new Date(record.rcvdDate || record.entryDate).getTime()) / 86400000))
        : 0;

      let alreadyExternal = false;
      if (updated.frnNo) alreadyExternal = await SCCompletedFRN.findOne({ frnNo: updated.frnNo, typeWork: 'EXTERNAL REPAIR' });
      if (!alreadyExternal && updated.serviceId) alreadyExternal = await SCCompletedFRN.findOne({ serviceId: updated.serviceId, typeWork: 'EXTERNAL REPAIR' });

      if (!alreadyExternal) {
        let externalDivisionName = '';
        if (updated.serviceId) {
          try {
            const svc = await Service.findById(updated.serviceId).populate('division').lean();
            if (svc && svc.division) {
              externalDivisionName = typeof svc.division === 'object' ? svc.division.name : '';
            }
          } catch (_) {}
        }

        const externalDoc = await SCCompletedFRN.create({
          serviceId:    updated.serviceId ? String(updated.serviceId) : '',
          entryDate:    updated.entryDate || '',
          scRno:        updated.scReNo || '',
          scEng:        updated.scEng || '',
          frnNo:        updated.frnNo || '',
          region:       updated.reg || updated.branch || '',
          eng:          updated.eng || '',
          customer:     updated.custName || updated.customer || '',
          model:        updated.model || '',
          unitStatus:   updated.unitSts || '',
          partNo:       updated.partNo || '',
          defMod:       updated.defMod || '',
          defGir:       updated.defGir || '',
          raEng:        updated.obRaEng || '',
          defUnitGir:   updated.obDefUnitGir || updated.defGir || 'NA',
          repGirSno:    updated.obRepGirNo || updated.obDefUnitGir || '',
          finalRemarks: updated.finalRemarks || updated.obFinalRemarks || '',
          techRemarks:  updated.techRemarks || '',
          components:   updated.components || updated.obComponents || '',
          revalue:      Number(updated.revalue || 0),
          typeWork:     'EXTERNAL REPAIR',
          reportType:   updated.obTypeReport || '',
          destination:  updated.obDestination || '',
          shipDateSC:   updated.obShipSc || '',
          shipDateComm: updated.obShipComm || '',
          pdays,
          division:     externalDivisionName,
          updatedBy:    name || '',
          status:       'pending_update',
        });
        await enqueueLatestEscalationSnapshot(
          'external_repair',
          externalDoc._id,
          name || '',
          buildExternalRepairEscalationRow(externalDoc.toObject ? externalDoc.toObject() : externalDoc)
        );
      }

      if (updated.serviceId) {
        await Service.findByIdAndUpdate(
          updated.serviceId,
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

      await EstimationPending.findByIdAndDelete(req.params.id);
      return res.json({
        success: true,
        externalRepair: true,
        redirect: 'sc-completed-frn.html',
        message: 'Moved to SC Completed FRN.',
      });
    }

    if (normalizedTypeWork === 'supplier warranty' || normalizedTypeWork === 'supplier warrenty') {
      const pdPfrn = record.entryDate
        ? Math.max(0, Math.floor((Date.now() - new Date(record.entryDate).getTime()) / 86400000))
        : 0;

      let alreadyScrap = false;
      if (updated.frnNo) alreadyScrap = await Scrap.findOne({ frnNo: updated.frnNo, typeWork: 'Supplier Warranty' });
      if (!alreadyScrap && updated.serviceId) alreadyScrap = await Scrap.findOne({ serviceId: updated.serviceId, typeWork: 'Supplier Warranty' });

      if (!alreadyScrap) {
        let divisionName = '';
        if (updated.serviceId) {
          const svc = await Service.findById(updated.serviceId).populate('division').lean();
          if (svc && svc.division) {
            divisionName = typeof svc.division === 'object' ? svc.division.name : '';
          }
        }

        const scrapDoc = await Scrap.create({
          serviceId: updated.serviceId || null,
          entryDate: updated.entryDate || '',
          scRno: updated.scReNo || '',
          scEng: updated.scEng || '',
          frnNo: updated.frnNo || '',
          region: updated.reg || updated.branch || '',
          engineer: updated.eng || '',
          customer: updated.custName || updated.customer || '',
          model: updated.model || '',
          unitStatus: updated.unitSts || '',
          defMod: updated.defMod || '',
          defGir: updated.defGir || '',
          typeWork: 'Supplier Warranty',
          rcvdDate: updated.entryDate || '',
          pdPfrn,
          pdObp: 0,
          pdUrp: 0,
          pdScc: 0,
          division: divisionName,
          addedBy: name || '',
        });
        await enqueueLatestEscalationSnapshot(
          'supplier_warranty',
          scrapDoc._id,
          name || '',
          buildSupplierWarrantyEscalationRow(scrapDoc.toObject ? scrapDoc.toObject() : scrapDoc)
        );
      }

      if (updated.serviceId) {
        await Service.findByIdAndUpdate(
          updated.serviceId,
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

      await EstimationPending.findByIdAndDelete(req.params.id);
      return res.json({
        success: true,
        supplierWarranty: true,
        redirect: 'Emp-scrap-list.html',
        message: 'Moved to Supplier Warranty list.',
      });
    }

    if (normalizedTypeWork === 'upgrade' || normalizedTypeWork === 'rep not required' || sameGir === 'yes') {
      const pdays = (record.rcvdDate || record.entryDate)
        ? Math.max(0, Math.floor((Date.now() - new Date(record.rcvdDate || record.entryDate).getTime()) / 86400000))
        : 0;

      if (updated.serviceId) {
        await Service.findByIdAndUpdate(
          updated.serviceId,
          {
            $set: {
              type: updated.typeWork || 'Completed',
              typeWork: updated.typeWork || 'Completed',
              status: 'completed',
              updatedAt: new Date().toISOString(),
            },
          },
          { runValidators: false }
        );
      }

      await CompletedFRN.create({
        serviceId:    updated.serviceId ? String(updated.serviceId) : '',
        entryDate:    updated.entryDate || '',
        scRno:        updated.scReNo || '',
        scEng:        updated.scEng || '',
        frnNo:        updated.frnNo || '',
        region:       updated.reg || updated.branch || '',
        eng:          updated.eng || '',
        customer:     updated.custName || updated.customer || '',
        model:        updated.model || '',
        unitStatus:   updated.unitSts || '',
        defMod:       updated.defMod || '',
        defGir:       updated.defGir || '',
        raEng:        updated.obRaEng || updated.estRaEng || updated.raEng || '',
        defUnitGir:   updated.obDefUnitGir || updated.defGir || 'NA',
        repGirSno:    updated.obRepGirNo || updated.obDefUnitGir || '',
        finalRemarks: updated.finalRemarks || updated.obFinalRemarks || '',
        techRemarks:  updated.techRemarks || '',
        components:   updated.components || updated.obComponents || '',
        revalue:      Number(updated.revalue || 0),
        typeWork:     updated.typeWork || '',
        reportType:   updated.obTypeReport || '',
        destination:  updated.obDestination || '',
        shipDateSC:   updated.obShipSc || '',
        shipDateComm: updated.obShipComm || '',
        pdays,
        closedBy:     name || '',
        closedAt:     new Date(),
      });

      await EstimationPending.findByIdAndDelete(req.params.id);
      return res.json({ success: true, completed: true, message: 'Moved to Completed FRN.' });
    }

    if (sameGir === 'no' && updated.serviceId) {
      const underRepairService = await Service.findByIdAndUpdate(
        updated.serviceId,
        {
          $set: {
            type:         'Under Repair',
            typeWork:     'UNDER REPAIR',
            repType:      'NA',
            repGirNo:     updateData.obDefUnitGir || '',
            raEng:        updateData.obRaEng || '',
            shipSc:       updateData.obShipSc || '',
            destination:  updateData.obDestination || '',
            techRemarks:  updateData.techRemarks || '',
            components:   updateData.components || '',
            revalue:      Number(updateData.revalue || 0),
            finalRemarks: updateData.finalRemarks || '',
            updatedAt:    new Date().toISOString(),
          },
        },
        { new: true, runValidators: false }
      ).lean();
      if (underRepairService) {
        await tryCreateUnderRepair(underRepairService, req.user);
      }

      await EstimationPending.findByIdAndDelete(req.params.id);
      return res.json({ success: true, underRepair: true, message: 'Moved to Under Repair.' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/emp/estimation/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE  /api/emp/estimation/:id
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/sr', async (req, res) => {
  try {
    const record = await EstimationPending.findById(req.params.id).populate({ path: 'serviceId', populate: { path: 'division' } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const { role, name } = req.user;
    if (!(await hasQueueAccess(req.user, record))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (record.srEscalationQueuedAt) {
      return res.json({
        success: true,
        alreadyQueued: true,
        srEscalationQueuedAt: record.srEscalationQueuedAt,
        srEscalationQueuedBy: record.srEscalationQueuedBy || '',
      });
    }

    const escalationPartNo = String(req.body?.partNo || '').trim() || record.partNo || '';
    const escalationRecord = { ...record.toObject(), partNo: escalationPartNo, divisionName: record.divisionName || (record.serviceId && record.serviceId.division ? record.serviceId.division.name : '') };

    record.srEscalationQueuedAt = new Date();
    record.srEscalationQueuedBy = name || '';
    await record.save();

    await enqueueEscalationSnapshot(
      'sr_est',
      record._id,
      name || '',
      buildEstimationEscalationRow(escalationRecord)
    );
    await mirrorEstToTodr(escalationRecord, 'DR', [], name || '');

    res.json({
      success: true,
      message: 'Queued for SR escalation.',
      srEscalationQueuedAt: record.srEscalationQueuedAt,
      srEscalationQueuedBy: record.srEscalationQueuedBy,
    });
  } catch (err) {
    console.error('[POST /api/emp/estimation/:id/sr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/to', async (req, res) => {
  try {
    const record = await EstimationPending.findById(req.params.id).populate({ path: 'serviceId', populate: { path: 'division' } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    const { role, name } = req.user;
    let __is_allowed = false;
    if (role === 'admin' || role === 'superadmin') {
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
    if (!__is_allowed) return res.status(403).json({ message: 'Access denied' });

    if (record.toEscalationQueuedAt) {
      return res.json({
        success: true,
        alreadyQueued: true,
        toEscalationQueuedAt: record.toEscalationQueuedAt,
        toEscalationQueuedBy: record.toEscalationQueuedBy || '',
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

    record.toEscalationQueuedAt = new Date();
    record.toEscalationQueuedBy = name || '';
    await record.save();

    await enqueueEscalationSnapshot(
      'to_est',
      record._id,
      name || '',
      buildToEscalationRow({ ...record.toObject(), divisionName: record.divisionName || (record.serviceId && record.serviceId.division ? record.serviceId.division.name : '') }, cleanItems)
    );
    await mirrorEstToTodr(record, 'TO', cleanItems, name || '');

    res.json({
      success: true,
      message: 'Queued for TO escalation.',
      toEscalationQueuedAt: record.toEscalationQueuedAt,
      toEscalationQueuedBy: record.toEscalationQueuedBy,
    });
  } catch (err) {
    console.error('[POST /api/emp/estimation/:id/to]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const record = await EstimationPending.findById(req.params.id).populate({ path: 'serviceId', populate: { path: 'division' } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const { role } = req.user;
    let __is_allowed = false;
    if (role === 'admin' || role === 'superadmin') {
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
    if (!__is_allowed) return res.status(403).json({ message: 'Access denied' });

    await EstimationPending.findByIdAndDelete(req.params.id);
    res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/emp/estimation/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
