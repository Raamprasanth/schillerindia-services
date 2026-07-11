// routes/underRepairRoutes.js
const router      = require('express').Router();
const UnderRepair = require('../models/UnderRepair');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Service = require('../models/Service');
const Todr = require('../models/Todr');
const Dr = require('../models/Dr');
const RTUR = require('../models/rturModel');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  buildToEscalationRow,
  buildUrEscalationRow,
  buildExternalRepairEscalationRow,
  buildSupplierWarrantyEscalationRow,
  enqueueEscalationSnapshot,
  enqueueLatestEscalationSnapshot,
} = require('../services/escalationService');

// ── Compute pdays from createdAt ──────────────────────────
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

async function mirrorUrToTodr(doc, action, items = [], queuedBy = '') {
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
        sourceModule: 'under_repair',
        sourceId: String(doc._id),
        action,
        partNo: row.partNo,
      },
      {
        entryDate: action === 'TO'
          ? toDateValue(doc.toEscalationQueuedAt || new Date())
          : toDateValue(doc.entryDate || doc.rcvdDate || doc.createdAt),
        frnNo: doc.frnNo || doc.scReNo || doc.scRno || String(doc._id),
        partNo: row.partNo,
        model: row.model,
        description: row.description,
        quantity: row.quantity,
        action,
        sourceModule: 'under_repair',
        sourceId: String(doc._id),
        queuedBy,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )));
  } catch (err) {
    console.error(`[TODR/DR mirror] Failed to mirror pending Under Repair (action=${action}):`, err);
  }
}

function withPdays(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  d.pdays = Math.floor((Date.now() - new Date(d.rcvdDate || d.entryDate || d.createdAt).getTime()) / 86400000);
  return d;
}

function normalizeUnderRepairStatus(typeWork) {
  const value = String(typeWork || '').trim();
  if (!value || value === 'UNDER REPAIR') return 'UNDER REPAIR';
  if (value === 'Scrap') return 'Scrapped';
  if (value === 'External Repair') return 'External Repair';
  if (value === 'No Fault') return 'No Fault';
  if (value === 'Given to PSP') return 'Given to PSP';
  return 'Completed';
}
function normalizeTypeWorkKey(typeWork) {
  return String(typeWork || '').trim().toLowerCase();
}

function canonicalUrFollowupTypeWork(typeWork) {
  const value = normalizeTypeWorkKey(typeWork);
  if (value === 'ur stock') return 'UR Stock';
  if (value === 'ws stock') return 'WS Stock';
  if (value === 'no fault') return 'No Fault';
  if (value === 'external repair' || value === 'external rep') return 'External Repair';
  if (value === 'supplier warranty' || value === 'supplier warrenty') return 'Supplier Warranty';
  if (value === 'given to psp') return 'Given to PSP';
  return '';
}

// ══════════════════════════════════════════════════════════
//  GET /api/under-repair
//  Admin → all records
//  Employee → records where engineer or scEng matches their name
// ══════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { getServiceIdsFilter } = require('../utils/visibility');
      filter = await getServiceIdsFilter(req.user, [
        { engineer: { $regex: new RegExp(req.user.name, 'i') } },
        { scEng:    { $regex: new RegExp(req.user.name, 'i') } },
        { raEng:    { $regex: new RegExp(req.user.name, 'i') } },
      ]);
    }

    const docs = await UnderRepair.find(filter).populate({ path: 'serviceId', select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm', populate: { path: 'division', select: 'name' } }).sort({ createdAt: -1 }).lean();
    res.json(docs.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : '') || '',
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      scReNo: d.scReNo || d.scRno || (d.serviceId ? d.serviceId.scReNo : '') || '',
      frnDate: d.frnDate || (d.serviceId ? d.serviceId.frnDate : '') || '',
      serComm: d.serComm || (d.serviceId ? d.serviceId.serComm : '') || '',
      rcvdDate: d.rcvdDate || (d.serviceId ? d.serviceId.rcvdDate : '') || '',
      stkCust: d.stkCust || (d.serviceId ? d.serviceId.stkCust : '') || '',
      reg: d.reg || d.region || (d.serviceId ? d.serviceId.reg : '') || '',
      eng: d.eng || d.engineer || (d.serviceId ? d.serviceId.eng : '') || '',
      custName: d.custName || d.customer || (d.serviceId ? (d.serviceId.custName || d.serviceId.customer) : '') || '',
      customer: d.customer || d.custName || (d.serviceId ? (d.serviceId.customer || d.serviceId.custName) : '') || '',
      supplier: d.supplier || (d.serviceId ? d.serviceId.supplier : '') || '',
      model: d.model || (d.serviceId ? d.serviceId.model : '') || '',
      unitSts: d.unitSts || d.unitStatus || (d.serviceId ? d.serviceId.unitSts : '') || '',
      unitStatus: d.unitStatus || d.unitSts || (d.serviceId ? d.serviceId.unitSts : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      defMod: d.defMod || d.defModBrdName || (d.serviceId ? d.serviceId.defMod : '') || '',
      defType: d.defType || (d.serviceId ? d.serviceId.defType : '') || '',
      typeAcc: d.typeAcc || (d.serviceId ? d.serviceId.typeAcc : '') || '',
      defGir: d.defGir || d.defGirNo || (d.serviceId ? d.serviceId.defGir : '') || '',
      defPartSno: d.defPartSno || (d.serviceId ? d.serviceId.defPartSno : '') || '',
      repType: d.repType || (d.serviceId ? d.serviceId.repType : '') || '',
      repGirNo: d.repGirNo || (d.serviceId ? d.serviceId.repGirNo : '') || '',
      fieldRemarks: d.fieldRemarks || (d.serviceId ? d.serviceId.fieldRemarks : '') || '',
      commWarrDetails: d.commWarrDetails || (d.serviceId ? d.serviceId.commWarrDetails : '') || '',
      bscon: d.bscon || (d.serviceId ? d.serviceId.bscon : '') || '',
      doi: d.doi || (d.serviceId ? d.serviceId.doi : '') || '',
      unitSl: d.unitSl || (d.serviceId ? d.serviceId.unitSl : '') || '',
      division: d.division || (d.serviceId && d.serviceId.division ? d.serviceId.division._id : null),
      divisionName: d.divisionName || (d.serviceId && d.serviceId.division ? d.serviceId.division.name : '') || (d.serviceId ? d.serviceId.divisionName : ''),
      pdays: Math.floor((Date.now() - new Date(d.rcvdDate || d.entryDate || d.createdAt).getTime()) / 86400000),
    })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  GET /api/under-repair/:id  — single record
// ══════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await UnderRepair.findById(req.params.id).populate({ path: 'serviceId', select: 'branch dealer division divisionName partNo doi unitSl defPartSno bscon scReNo scEng frnNo frnDate serComm rcvdDate stkCust reg eng custName customer supplier model unitSts defMod defType typeAcc defGir repType repGirNo fieldRemarks commWarrDetails techRemarks components finalRemarks shipSc repBrd shipComm', populate: { path: 'division', select: 'name' } }).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, doc.serviceId);
      if (!allowed) return res.status(403).json({ message: 'Access denied.' });
    }
    const d = withPdays(doc);
    d.partNo = doc.partNo || (doc.serviceId ? doc.serviceId.partNo : '') || '';
    d.defPartSno = doc.defPartSno || (doc.serviceId ? doc.serviceId.defPartSno : '') || '';
    d.bscon = doc.bscon || (doc.serviceId ? doc.serviceId.bscon : '') || '';
    res.json(d);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  POST /api/under-repair  — create (called automatically
//  when service is saved with repType = TO/ADV SO)
// ══════════════════════════════════════════════════════════
router.post('/', protect, async (req, res) => {
  try {
    const { serviceId, scRno, scEng, frnNo, region, engineer,
            custName, customer, model, unitStatus,
            partNo, defMod, defModBrdName, defGir, defGirNo,
            defPartSno, finalRemarks, typeWork, typeOfWork,
            repGirNo, entryDate } = req.body;

    if (!scRno) {
      return res.status(400).json({ message: 'scRno (SC Ref No) is required.' });
    }

    // Prevent duplicates if serviceId provided
    if (serviceId) {
      const exists = await UnderRepair.findOne({ serviceId });
      if (exists) return res.status(409).json({ message: 'Under Repair record already exists for this service.', doc: exists });
    }

    const doc = await UnderRepair.create({
      serviceId,
      entryDate: entryDate || new Date().toISOString().split('T')[0],
      scRno, scEng, frnNo, region, engineer,
      custName:     custName || customer || '',
      customer:     customer || custName || '',
      model,
      unitStatus,
      partNo:       partNo || '',
      defMod:       defMod || defModBrdName || '',
      defModBrdName:defModBrdName || defMod || '',
      defGir:       defGir || defGirNo || '',
      defGirNo:     defGirNo || defGir || '',
      defPartSno:   defPartSno || '',
      finalRemarks: finalRemarks || '',
      typeWork:     typeWork || typeOfWork || 'UNDER REPAIR',
      typeOfWork:   typeOfWork || typeWork || 'UNDER REPAIR',
      repGirNo:     repGirNo || '',
      status:       'UNDER REPAIR',
    });

    res.status(201).json(withPdays(doc));
  } catch (e) {
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map(v => v.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(400).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  PUT /api/under-repair/:id/update
//  Employee update — repair activity fields only
// ══════════════════════════════════════════════════════════
router.put('/:id/update', protect, async (req, res) => {
  try {
    const {
      defPartSno,
      raEng, defUnitGir, repBrd,
      finalRemarks, techRemarks, components,
      typeWork, typeOfWork,
      revalue,
      shipSc, shipComm, repGirNo, dcNo,
      typeReport, destination, repairTeam,
    } = req.body;

    if (!finalRemarks || !typeWork) {
      return res.status(400).json({ message: 'finalRemarks and typeWork are required.' });
    }

    const submittedTypeWork = canonicalUrFollowupTypeWork(typeWork || typeOfWork) || typeWork || typeOfWork;
    const normalizedStatus = normalizeUnderRepairStatus(submittedTypeWork);

    const update = {
      raEng:        raEng       || '',
      repairTeam:   repairTeam  || raEng || '',
      defUnitGir:   defUnitGir  || '',
      repBrd:       repBrd      || '',
      finalRemarks,
      techRemarks:  techRemarks || '',
      components:   components  || '',
      revalue:      Number(revalue) || 0,
      typeWork:     submittedTypeWork,
      typeOfWork:   submittedTypeWork,
      status:       normalizedStatus,
      shipSc:       shipSc      || '',
      shipComm:     shipComm    || '',
      repGirNo:     repGirNo    || '',
      dcNo:         dcNo        || '',
      typeReport:   typeReport  || '',
      destination:  destination || '',
      defPartSno:   defPartSno || '',
      updatedBy:    req.user.name,
      updatedAt:    new Date(),
    };

    let existing = await UnderRepair.findById(req.params.id);
    if (!existing && req.params.id) {
      existing = await UnderRepair.findOne({ serviceId: req.params.id });
    }
    if (!existing && req.params.id) {
      const svc = await Service.findById(req.params.id).lean();
      const isUnderRepair = svc && (String(svc.typeWork || svc.type || '').toUpperCase() === 'UNDER REPAIR' || svc.repType === 'TO/ADV SO');
      if (isUnderRepair) {
        existing = await UnderRepair.create({
          serviceId:     svc._id,
          entryDate:     svc.entryDate || new Date().toISOString().split('T')[0],
          rcvdDate:      svc.rcvdDate  || '',
          scRno:         svc.scReNo || svc.scRno || '',
          scEng:         svc.scEng || '',
          frnNo:         svc.frnNo || '',
          region:        svc.reg || svc.region || '',
          engineer:      svc.eng || '',
          raEng:         svc.raEng || '',
          custName:      svc.custName || svc.customer || '',
          customer:      svc.custName || svc.customer || '',
          model:         svc.model || '',
          unitStatus:    svc.unitSts || svc.unitStatus || '',
          partNo:        svc.partNo || '',
          defMod:        svc.defMod || '',
          defModBrdName: svc.defMod || '',
          defGir:        svc.defGir || '',
          defGirNo:      svc.defGir || '',
          defPartSno:    svc.defPartSno || '',
          defUnitGir:    svc.defUnitGir || '',
          finalRemarks:  svc.finalRemarks || '',
          techRemarks:   svc.techRemarks || '',
          components:    svc.components || '',
          typeWork:      svc.typeWork || svc.type || 'UNDER REPAIR',
          typeOfWork:    svc.typeWork || svc.type || 'UNDER REPAIR',
          repBrd:        svc.repBrd || '',
          shipSc:        svc.shipSc || '',
          shipComm:      svc.shipComm || '',
          repGirNo:      svc.repGirNo || '',
          dcNo:          svc.dcNo || '',
          typeReport:    svc.typeReport || '',
          destination:   svc.destination || '',
          repairTeam:    svc.raEng || '',
          status:        'UNDER REPAIR',
          updatedBy:     req.user.name,
          updatedAt:     new Date(),
        });
      }
    }
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    let __is_allowed = false;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      __is_allowed = true;
    } else {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      if (existing && existing.serviceId && await hasDivisionAccessToService(req.user, existing.serviceId)) {
        __is_allowed = true;
      } else {
        const _uName = String(req.user.name || '').trim().toLowerCase();
        if (_uName && [existing.eng, existing.scEng, existing.estRaEng, existing.obRaEng, existing.submittedBy, existing.createdBy].some(v => String(v || '').trim().toLowerCase() === _uName)) {
          __is_allowed = true;
        }
      }
    }
    if (!__is_allowed) return res.status(403).json({ message: 'Access denied.' });

    const doc = await UnderRepair.findByIdAndUpdate(existing._id, update, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found.' });

    const pdays = Math.floor((Date.now() - new Date(doc.createdAt || doc.entryDate).getTime()) / 86400000);
    const normalizedTypeWork = normalizeTypeWorkKey(doc.typeWork || doc.typeOfWork);
    const urFollowupTypeWork = canonicalUrFollowupTypeWork(doc.typeWork || doc.typeOfWork);

    if (urFollowupTypeWork) {
      const rowDoc = {
        ...(doc.toObject ? doc.toObject() : doc),
        typeWork: urFollowupTypeWork,
        typeOfWork: urFollowupTypeWork,
        urTypeWork: urFollowupTypeWork,
      };
      await enqueueLatestEscalationSnapshot(
        'ur_followup',
        doc.serviceId || doc._id,
        req.user.name || '',
        buildUrEscalationRow(rowDoc)
      );
    }

    if (normalizedTypeWork === 'external repair') {
      let alreadyExternal = false;
      if (doc.frnNo) alreadyExternal = await SCCompletedFRN.findOne({ frnNo: doc.frnNo, typeWork: 'EXTERNAL REPAIR' });
      if (!alreadyExternal && doc.serviceId) alreadyExternal = await SCCompletedFRN.findOne({ serviceId: doc.serviceId, typeWork: 'EXTERNAL REPAIR' });

      if (!alreadyExternal) {
        const externalDoc = await SCCompletedFRN.create({
          serviceId:    doc.serviceId ? String(doc.serviceId) : '',
          entryDate:    doc.entryDate || '',
          scRno:        doc.scRno || '',
          scEng:        doc.scEng || '',
          frnNo:        doc.frnNo || '',
          region:       doc.region || '',
          eng:          doc.eng || doc.engineer || '',
          customer:     doc.customer || doc.custName || '',
          model:        doc.model || '',
          unitStatus:   doc.unitStatus || '',
          partNo:       doc.partNo || '',
          defMod:       doc.defMod || doc.defModBrdName || '',
          defGir:       doc.defGir || doc.defGirNo || '',
          raEng:        doc.raEng || '',
          repBrdDate:   doc.repBrd || '',
          dcNo:         doc.dcNo || '',
          defUnitGir:   doc.defUnitGir || 'NA',
          repGirSno:    doc.repGirNo || '',
          finalRemarks: doc.finalRemarks || '',
          techRemarks:  doc.techRemarks || '',
          components:   doc.components || '',
          typeWork:     'EXTERNAL REPAIR',
          reportType:   doc.typeReport || '',
          destination:  doc.destination || '',
          shipDateSC:   doc.shipSc || '',
          shipDateComm: doc.shipComm || '',
          pdays,
          updatedBy:    req.user.name || '',
          status:       'pending_update',
        });
        await enqueueLatestEscalationSnapshot(
          'external_repair',
          externalDoc._id,
          req.user.name || '',
          buildExternalRepairEscalationRow(externalDoc.toObject ? externalDoc.toObject() : externalDoc)
        );
      }

      if (doc.serviceId) {
        await Service.findByIdAndUpdate(
          doc.serviceId,
          {
            $set: {
              raEng:        doc.raEng || '',
              defGir:       doc.defGir || doc.defGirNo || '',
              repGirNo:     doc.repGirNo || '',
              repBrd:       doc.repBrd || '',
              finalRemarks: doc.finalRemarks || '',
              techRemarks:  doc.techRemarks || '',
              components:   doc.components || '',
              typeWork:     'External Repair',
              shipSc:       doc.shipSc || '',
              shipComm:     doc.shipComm || '',
              dcNo:         doc.dcNo || '',
              typeReport:   doc.typeReport || '',
              destination:  doc.destination || '',
              type:         'External Repair',
              status:       'completed',
              updatedAt:    new Date().toISOString(),
            },
          },
          { runValidators: false }
        );
      }

      await UnderRepair.findByIdAndDelete(existing._id);
      return res.json({
        success: true,
        externalRepair: true,
        removedId: String(existing._id),
        redirect: 'sc-completed-frn.html',
        message: 'Moved to SC Completed FRN.'
      });
    }

    if (normalizedTypeWork === 'supplier warranty' || normalizedTypeWork === 'supplier warrenty') {
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
      if (doc.frnNo) alreadyScrap = await Scrap.findOne({ frnNo: doc.frnNo, typeWork: 'Supplier Warranty' });
      if (!alreadyScrap && validServiceId) alreadyScrap = await Scrap.findOne({ serviceId: validServiceId, typeWork: 'Supplier Warranty' });

      if (!alreadyScrap) {
        const scrapDoc = await Scrap.create({
          serviceId: validServiceId || null,
          entryDate: doc.entryDate || '',
          scRno: doc.scRno || '',
          scEng: doc.scEng || '',
          frnNo: doc.frnNo || '',
          region: doc.region || '',
          engineer: doc.eng || doc.engineer || '',
          raEng: doc.raEng || '',
          customer: doc.customer || doc.custName || '',
          model: doc.model || '',
          unitStatus: doc.unitStatus || '',
          partNo: doc.partNo || '',
          defMod: doc.defMod || doc.defModBrdName || '',
          defGir: doc.defGir || doc.defGirNo || '',
          typeWork: 'Supplier Warranty',
          rcvdDate: doc.entryDate || '',
          pdPfrn: pdays,
          pdObp: 0,
          pdUrp: 0,
          pdScc: 0,
          addedBy: req.user.name || '',
        });
        await enqueueLatestEscalationSnapshot(
          'supplier_warranty',
          scrapDoc._id,
          req.user.name || '',
          buildSupplierWarrantyEscalationRow(scrapDoc.toObject ? scrapDoc.toObject() : scrapDoc)
        );
      }

      if (validServiceId) {
        await Service.findByIdAndUpdate(
          validServiceId,
          {
            $set: {
              raEng:        doc.raEng || '',
              defGir:       doc.defGir || doc.defGirNo || '',
              repGirNo:     doc.repGirNo || '',
              repBrd:       doc.repBrd || '',
              finalRemarks: doc.finalRemarks || '',
              techRemarks:  doc.techRemarks || '',
              components:   doc.components || '',
              typeWork:     'Supplier Warranty',
              shipSc:       doc.shipSc || '',
              shipComm:     doc.shipComm || '',
              dcNo:         doc.dcNo || '',
              typeReport:   doc.typeReport || '',
              destination:  doc.destination || '',
              type:         'Supplier Warranty',
              status:       'completed',
              updatedAt:    new Date().toISOString(),
            },
          },
          { runValidators: false }
        );
      }

      await UnderRepair.findByIdAndDelete(existing._id);
      return res.json({
        success: true,
        supplierWarranty: true,
        removedId: String(existing._id),
        redirect: 'Emp-scrap-list.html',
        message: 'Moved to Supplier Warranty list.'
      });
    }

    const completedDoc = await CompletedFRN.create({
      serviceId:    doc.serviceId ? String(doc.serviceId) : '',
      entryDate:    doc.entryDate || '',
      scRno:        doc.scRno || '',
      scEng:        doc.scEng || '',
      frnNo:        doc.frnNo || '',
      region:       doc.region || '',
      eng:          doc.eng || doc.engineer || '',
      customer:     doc.customer || doc.custName || '',
      model:        doc.model || '',
      unitStatus:   doc.unitStatus || '',
      partNo:       doc.partNo || '',
      defMod:       doc.defMod || doc.defModBrdName || '',
      defGir:       doc.defGir || doc.defGirNo || '',
      raEng:        doc.raEng || '',
      repBrdDate:   doc.repBrd || '',
      dcNo:         doc.dcNo || '',
      defUnitGir:   doc.defUnitGir || 'NA',
      repGirSno:    doc.repGirNo || '',
      finalRemarks: doc.finalRemarks || '',
      techRemarks:  doc.techRemarks || '',
      components:   doc.components || '',
      typeWork:     doc.typeWork || doc.typeOfWork || '',
      reportType:   doc.typeReport || '',
      destination:  doc.destination || '',
      shipDateSC:   doc.shipSc || '',
      shipDateComm: doc.shipComm || '',
      pdays,
      closedBy:     req.user.name || '',
      closedAt:     new Date(),
    });

    if (normalizedTypeWork === 'scrap') {
      const rowDoc = {
        ...(doc.toObject ? doc.toObject() : doc),
        typeWork: 'Scrap',
        urTypeWork: 'Scrap',
      };
      await enqueueLatestEscalationSnapshot(
        'ur_scrap',
        doc.serviceId || completedDoc._id,
        req.user.name || '',
        buildUrEscalationRow(rowDoc)
      );
    }

    if (doc.serviceId) {
      const completedServiceType =
        typeWork === 'Scrap' ? 'Scrapped' :
        typeWork === 'External Repair' ? 'External Repair' :
        typeWork === 'No Fault' ? 'No Fault' :
        typeWork === 'Given to PSP' ? 'Given to PSP' :
        'Completed';

      await Service.findByIdAndUpdate(
        doc.serviceId,
        {
          $set: {
            raEng:        doc.raEng || '',
            defGir:       doc.defGir || doc.defGirNo || '',
            repGirNo:     doc.repGirNo || '',
            repBrd:       doc.repBrd || '',
            finalRemarks: doc.finalRemarks || '',
            techRemarks:  doc.techRemarks || '',
            components:   doc.components || '',
            typeWork:     doc.typeWork || doc.typeOfWork || '',
            shipSc:       doc.shipSc || '',
            shipComm:     doc.shipComm || '',
            dcNo:         doc.dcNo || '',
            typeReport:   doc.typeReport || '',
            destination:  doc.destination || '',
            type:         completedServiceType,
            status:       'completed',
            completedAt:   new Date(),
            updatedAt:    new Date().toISOString(),
          },
        },
        { runValidators: false }
      );
    }

    await UnderRepair.findByIdAndDelete(existing._id);
    res.json({
      success: true,
      completed: true,
      removedId: String(existing._id),
      redirect: 'completed-frn.html',
      message: 'Moved to Completed FRN.'
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  PUT /api/under-repair/:id  — full admin update
// ══════════════════════════════════════════════════════════
// Employee action from empunderep.html: send an under-repair service to RT UR.
router.post('/:id/send-rtur', protect, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).lean();
    if (!service) return res.status(404).json({ message: 'Service record not found.' });
    const isUnderRepair = String(service.typeWork || service.type || '').toUpperCase() === 'UNDER REPAIR' || service.repType === 'TO/ADV SO';
    if (!isUnderRepair) {
      return res.status(400).json({ message: 'Only Under Repair records can be sent to RT UR.' });
    }
    if (service.rturSent || service.rtfrnSent) {
      return res.status(409).json({ message: 'This record is already sent to repair team.' });
    }

    const { hasDivisionAccessToService } = require('../utils/visibility');
    const role = String(req.user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    const hasDivisionAccess = await hasDivisionAccessToService(req.user, service._id);
    const userName = String(req.user.name || '').trim().toLowerCase();
    const ownsRecord = userName && [service.eng, service.scEng, service.raEng, service.submittedBy, service.createdBy]
      .some(v => String(v || '').trim().toLowerCase() === userName);
    if (!isAdmin && !hasDivisionAccess && !ownsRecord) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const techRemarks = String(req.body.techRemarks || '').trim();
    const sentAt = new Date();
    const existing = await RTUR.findOne({ sourceServiceId: String(service._id) }).lean();
    const rtur = existing || await RTUR.create({
      entryDate: sentAt,
      rpDate: sentAt.toISOString(),
      division: req.body.division || service.divisionName || service.branch || service.reg || 'OTHER',
      scRefNo: String(service.scReNo || service.scRno || req.body.scRefNo || '').trim() || 'NA',
      defGirNo: String(service.defGir || req.body.defGirNo || '').trim() || 'NA',
      category: 'UR',
      model: String(service.model || req.body.model || '').trim() || 'NA',
      defBrdModName: String(service.defMod || req.body.defBrdModName || '').trim() || 'NA',
      status: 'pending',
      submittedBy: req.user.name || req.body.submittedBy || '',
      submittedAt: sentAt,
      sourceServiceId: String(service._id),
      doi: service.doi || '',
      fieldRemarks: service.fieldRemarks || '',
      techRemarks,
    });

    const updatedService = await Service.findByIdAndUpdate(
      service._id,
      { $set: { rturSent: true, rturSentAt: sentAt, techRemarks } },
      { new: true }
    ).lean();

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? 'Record was already available in RT UR.' : 'Sent to RT UR successfully.',
      data: rtur,
      service: updatedService,
    });
  } catch (e) {
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map(v => v.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    return res.status(500).json({ message: e.message });
  }
});

router.post('/:id/to', protect, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('division');
    if (!service) return res.status(404).json({ message: 'Service record not found.' });
    if (service.repType !== 'TO/ADV SO') {
      return res.status(400).json({ message: 'Only TO/ADV SO under-repair records can be queued to TO escalation.' });
    }

    const { hasDivisionAccessToService } = require('../utils/visibility');
    const role = String(req.user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    const hasDivisionAccess = await hasDivisionAccessToService(req.user, service._id);
    const userName = String(req.user.name || '').trim().toLowerCase();
    const ownsRecord = userName && [service.eng, service.scEng, service.raEng, service.submittedBy, service.createdBy]
      .some(v => String(v || '').trim().toLowerCase() === userName);
    if (!isAdmin && !hasDivisionAccess && !ownsRecord) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (service.toEscalationQueuedAt) {
      return res.json({
        success: true,
        alreadyQueued: true,
        toEscalationQueuedAt: service.toEscalationQueuedAt,
        toEscalationQueuedBy: service.toEscalationQueuedBy || '',
      });
    }

    const cleanItems = (Array.isArray(req.body?.items) ? req.body.items : [])
      .map((item) => ({
        partNo: String(item?.partNo || '').trim(),
        description: String(item?.description || item?.itemDescription || '').trim(),
        qty: Math.max(1, parseInt(item?.qty, 10) || 1),
      }))
      .filter((item) => item.partNo);
    if (!cleanItems.length) {
      return res.status(400).json({ message: 'Add at least one TO row with Part No and Quantity.' });
    }

    service.toEscalationQueuedAt = new Date();
    service.toEscalationQueuedBy = req.user?.name || '';
    await service.save({ validateBeforeSave: false });

    await enqueueEscalationSnapshot(
      'to_ur',
      service._id,
      req.user?.name || '',
      buildToEscalationRow({ ...service.toObject(), divisionName: service.divisionName || (service.division ? service.division.name : '') }, cleanItems)
    );
    await mirrorUrToTodr(service, 'TO', cleanItems, req.user?.name || '');

    return res.json({
      success: true,
      message: 'Queued for TO escalation.',
      toEscalationQueuedAt: service.toEscalationQueuedAt,
      toEscalationQueuedBy: service.toEscalationQueuedBy,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await UnderRepair.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(withPdays(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  DELETE /api/under-repair/:id  — admin only
// ══════════════════════════════════════════════════════════
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await UnderRepair.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ message: 'Under Repair record deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
