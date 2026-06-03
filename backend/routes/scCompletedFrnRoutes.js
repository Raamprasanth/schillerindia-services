// routes/scCompletedFrnRoutes.js
const router        = require('express').Router();
const SCCompletedFRN = require('../models/SCCompletedFRN');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { resolveDivision } = require('../utils/visibility');
const { buildExternalRepairEscalationRow, enqueueLatestEscalationSnapshot } = require('../services/escalationService');

const REGISTER_FIELDS = [
  'supplier', 'year', 'vendorName', 'sbrRmaBltNo', 'frnNumber', 'warrantyReportedDate',
  'warrantyApprovedStatus', 'warrantyApprovedDate', 'defGirNumber',
  'unitSerialNo', 'partNo', 'description', 'defPartSerialNumber',
  'defPartSn', 'problemDetails', 'itemDescription', 'vendorTicketNumber',
  'commercialToDetails', 'docketDetails', 'receivedDateAtEsskay',
  'receivedBackAtSvc', 'repairStatus', 'amountChargedForRepair',
  'softwareDetails', 'licenceVersionModelConfiguration', 'customerName',
  'warrantyType', 'supplierWarrantyStatus', 'dcInvoiceNumberSupplier',
  'frnEntryDate', 'shipDateFromServiceCenter', 'dcInvoiceNo',
  'dcInvoiceDate', 'awbNo', 'awbDate', 'replacementReceivedStatus',
  'replacementReceivedDate', 'typeOfWorkSupplier', 'receivedPartInvoiceNumber',
  'receivedPartInvoiceDate', 'replacementGirNo', 'receivedPartSerialNumber',
  'serviceCentreRemarks',
];

function pickRegisterFields(body = {}) {
  return REGISTER_FIELDS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) acc[key] = body[key] || '';
    return acc;
  }, {});
}

// ── Helper: compute live pdays ────────────────────────────
function livePdays(doc) {
  if (doc.pdays !== null && doc.pdays !== undefined) return doc.pdays;
  return Math.floor(
    (Date.now() - new Date(doc.createdAt).getTime()) / 86400000
  );
}

// ── Serialise to frontend shape ───────────────────────────
function toDTO(d) {
  return {
    _id:          d._id,
    serviceId:    d.serviceId    || '',
    frnId:        d.frnId        || null,
    entryDate:    d.entryDate    || '',
    scRno:        d.scRno        || '',
    scEng:        d.scEng        || '',
    frnNo:        d.frnNo        || '',
    region:       d.region       || '',
    eng:          d.eng          || '',
    customer:     d.customer     || '',
    model:        d.model        || '',
    unitStatus:   d.unitStatus   || '',
    defMod:       d.defMod       || '',
    defGir:       d.defGir       || '',
    ...pickRegisterFields(d),
    raEng:        d.raEng        || '',
    repBrdDate:   d.repBrdDate   || '',
    dcNo:         d.dcNo         || '',
    defUnitGir:   d.defUnitGir   || '',
    repGirSno:    d.repGirSno    || '',
    finalRemarks: d.finalRemarks || '',
    techRemarks:  d.techRemarks  || '',
    components:   d.components   || '',
    typeWork:     d.typeWork     || '',
    reportType:   d.reportType   || '',
    destination:  d.destination  || '',
    shipDateSC:   d.shipDateSC   || '',
    shipDateComm: d.shipDateComm || '',
    status:       d.status       || 'pending_update',
    updatedBy:    d.updatedBy    || '',
    pdays:        livePdays(d),
    createdAt:    d.createdAt,
    updatedAt:    d.updatedAt,
  };
}

// ══════════════════════════════════════════════════════════
// EMPLOYEE ROUTES  →  mounted at /api/emp/sc-completed-frn
// ══════════════════════════════════════════════════════════

// ── GET — all records visible to the logged-in employee (division-scoped) ──
router.get('/', protect, async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    let filter = {};

    if (role !== 'admin' && role !== 'superadmin') {
      const divDoc = await resolveDivision(req.user);
      const empName = String(req.user.name || '').trim();
      const orConditions = [];
      if (divDoc) orConditions.push({ division: divDoc.name });
      if (empName) {
        orConditions.push({ scEng:      { $regex: new RegExp(empName, 'i') } });
        orConditions.push({ eng:        { $regex: new RegExp(empName, 'i') } });
        orConditions.push({ updatedBy:  empName });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      } else {
        return res.json([]);
      }
    }

    const docs = await SCCompletedFRN.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs.map(toDTO));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET single record ─────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await SCCompletedFRN.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(toDTO(doc));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT — employee updates a record ──────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const registerPatch = pickRegisterFields(req.body);
    const hasRegisterPatch = Object.keys(registerPatch).length > 0;
    const hasModalPatch = [
      'raEng', 'repBrdDate', 'dcNo', 'defUnitGir', 'repGirSno',
      'finalRemarks', 'techRemarks', 'components', 'typeWork',
      'reportType', 'destination', 'shipDateSC', 'shipDateComm',
    ].some((key) => Object.prototype.hasOwnProperty.call(req.body, key));

    if (hasRegisterPatch && !hasModalPatch) {
      const patch = {
        ...registerPatch,
        entryDate: req.body.frnEntryDate || req.body.receivedDateAtEsskay || req.body.entryDate || undefined,
        frnNo: req.body.frnNumber || undefined,
        customer: req.body.customerName || undefined,
        defGir: req.body.defGirNumber || undefined,
        defMod: req.body.description || req.body.problemDetails || req.body.itemDescription || undefined,
        shipDateSC: req.body.shipDateFromServiceCenter || undefined,
        typeWork: req.body.typeOfWorkSupplier || req.body.repairStatus || undefined,
        updatedBy: req.user.name,
      };
      Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
      const doc = await SCCompletedFRN.findByIdAndUpdate(
        req.params.id,
        patch,
        { new: true, runValidators: true }
      ).lean();
      if (!doc) return res.status(404).json({ message: 'Record not found.' });
      return res.json(toDTO(doc));
    }

    const {
      raEng, repBrdDate, dcNo, defUnitGir, repGirSno,
      finalRemarks, techRemarks, components,
      typeWork, reportType, destination,
      shipDateSC, shipDateComm,
    } = req.body;

    // Server-side validation mirrors frontend
    if (!raEng)        return res.status(400).json({ message: 'RA Engineer is required.' });
    if (!finalRemarks) return res.status(400).json({ message: 'Final Remarks is required.' });
    if (!typeWork)     return res.status(400).json({ message: 'Type of Work is required.' });
    if (!dcNo)         return res.status(400).json({ message: 'DC No is required.' });
    if (!destination)  return res.status(400).json({ message: 'Destination is required.' });
    if (!shipDateComm) return res.status(400).json({ message: 'Ship Date from Commercial is required.' });

    const doc = await SCCompletedFRN.findByIdAndUpdate(
      req.params.id,
      {
        raEng, repBrdDate, dcNo,
        defUnitGir: defUnitGir || 'NA',
        repGirSno, finalRemarks, techRemarks, components,
        typeWork, reportType, destination,
        shipDateSC, shipDateComm,
        status:    'updated',
        updatedBy: req.user.name,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(toDTO(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// ADMIN ROUTES  →  mounted at /api/sc-completed-frn
// ══════════════════════════════════════════════════════════

// ── GET all records (Admin) ───────────────────────────────
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const docs = await SCCompletedFRN.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map(toDTO));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST — create a new SC Completed FRN record ───────────
// Typically called automatically when an FRN is marked complete.
router.post('/', protect, async (req, res) => {
  try {
    const {
      serviceId, frnId,
      entryDate, scRno, scEng, frnNo,
      region, eng, customer, model, unitStatus,
      defMod, defGir, typeWork, pdays,
    } = req.body;
    const registerFields = pickRegisterFields(req.body);
    const finalScRno = scRno || registerFields.sbrRmaBltNo || registerFields.frnNumber || registerFields.dcInvoiceNo || `EXT-${Date.now()}`;

    if (!finalScRno) return res.status(400).json({ message: 'Reference number is required.' });

    // Resolve division from the linked Service record
    let divisionName = '';
    try {
      const Service  = require('../models/Service');
      const Division = require('../models/Division');
      const svc = serviceId
        ? await Service.findOne({ serviceId }).lean()
        : null;
      if (svc && svc.division) {
        const divDoc = await Division.findById(svc.division).lean();
        if (divDoc) divisionName = divDoc.name;
      }
    } catch (_) { /* non-fatal */ }
    if (!divisionName) {
      const divDoc = await resolveDivision(req.user);
      divisionName = divDoc ? divDoc.name : '';
    }

    const doc = await SCCompletedFRN.create({
      serviceId, frnId,
      entryDate: entryDate || registerFields.frnEntryDate || registerFields.receivedDateAtEsskay || '',
      scRno: finalScRno,
      scEng: scEng || req.user.name || '',
      frnNo: frnNo || registerFields.frnNumber || '',
      region,
      eng,
      customer: customer || registerFields.customerName || '',
      model: model || registerFields.model || '',
      unitStatus,
      defMod: defMod || registerFields.description || registerFields.problemDetails || registerFields.itemDescription || '',
      defGir: defGir || registerFields.defGirNumber || '',
      ...registerFields,
      shipDateSC: registerFields.shipDateFromServiceCenter || '',
      typeWork:  typeWork || registerFields.typeOfWorkSupplier || registerFields.repairStatus || '',
      pdays:     pdays ?? null,
      status:    'pending_update',
      division:  divisionName,
      updatedBy: req.user.name || '',
    });
    await enqueueLatestEscalationSnapshot(
      'external_repair',
      doc._id,
      req.user.name || '',
      buildExternalRepairEscalationRow(doc.toObject ? doc.toObject() : doc)
    );

    res.status(201).json(toDTO(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── DELETE (Admin only) ───────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await SCCompletedFRN.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
