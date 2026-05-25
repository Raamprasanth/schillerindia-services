// routes/underRepairRoutes.js
const router      = require('express').Router();
const UnderRepair = require('../models/UnderRepair');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  buildUrEscalationRow,
  buildExternalRepairEscalationRow,
  buildSupplierWarrantyEscalationRow,
  enqueueLatestEscalationSnapshot,
} = require('../services/escalationService');

// ── Compute pdays from createdAt ──────────────────────────
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

    const docs = await UnderRepair.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs.map(d => ({
      ...d,
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
    const doc = await UnderRepair.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, doc.serviceId);
      if (!allowed) return res.status(403).json({ message: 'Access denied.' });
    }
    res.json(withPdays(doc));
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
            defMod, defModBrdName, defGir, defGirNo,
            finalRemarks, typeWork, typeOfWork,
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
      defMod:       defMod || defModBrdName || '',
      defModBrdName:defModBrdName || defMod || '',
      defGir:       defGir || defGirNo || '',
      defGirNo:     defGirNo || defGir || '',
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
      raEng, defUnitGir, repBrd,
      finalRemarks, techRemarks, components,
      typeWork, typeOfWork,
      shipSc, shipComm, repGirNo, dcNo,
      typeReport, destination, repairTeam,
    } = req.body;

    if (!finalRemarks || !typeWork) {
      return res.status(400).json({ message: 'finalRemarks and typeWork are required.' });
    }

    const normalizedStatus = normalizeUnderRepairStatus(typeWork || typeOfWork);

    const update = {
      raEng:        raEng       || '',
      repairTeam:   repairTeam  || raEng || '',
      defUnitGir:   defUnitGir  || '',
      repBrd:       repBrd      || '',
      finalRemarks,
      techRemarks:  techRemarks || '',
      components:   components  || '',
      typeWork,
      typeOfWork:   typeOfWork  || typeWork,
      status:       normalizedStatus,
      shipSc:       shipSc      || '',
      shipComm:     shipComm    || '',
      repGirNo:     repGirNo    || '',
      dcNo:         dcNo        || '',
      typeReport:   typeReport  || '',
      destination:  destination || '',
      updatedBy:    req.user.name,
      updatedAt:    new Date(),
    };

    let existing = await UnderRepair.findById(req.params.id);
    if (!existing && req.params.id) {
      existing = await UnderRepair.findOne({ serviceId: req.params.id });
    }
    if (!existing && req.params.id) {
      const svc = await Service.findById(req.params.id).lean();
      if (svc && svc.repType === 'TO/ADV SO') {
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
          defMod:        svc.defMod || '',
          defModBrdName: svc.defMod || '',
          defGir:        svc.defGir || '',
          defGirNo:      svc.defGir || '',
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
    const normalizedTypeWork = String(doc.typeWork || doc.typeOfWork || '').trim().toLowerCase();

    if (normalizedTypeWork === 'external repair') {
      const externalDoc = await SCCompletedFRN.create({
        serviceId:    doc.serviceId ? String(doc.serviceId) : '',
        entryDate:    doc.entryDate || '',
        scRno:        doc.scRno || '',
        scEng:        doc.scEng || '',
        frnNo:        doc.frnNo || '',
        region:       doc.region || '',
        eng:          doc.engineer || '',
        customer:     doc.customer || doc.custName || '',
        model:        doc.model || '',
        unitStatus:   doc.unitStatus || '',
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
      const scrapDoc = await Scrap.create({
        serviceId: doc.serviceId || null,
        entryDate: doc.entryDate || '',
        scRno: doc.scRno || '',
        scEng: doc.scEng || '',
        frnNo: doc.frnNo || '',
        region: doc.region || '',
        engineer: doc.engineer || '',
        customer: doc.customer || doc.custName || '',
        model: doc.model || '',
        unitStatus: doc.unitStatus || '',
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
      eng:          doc.engineer || '',
      customer:     doc.customer || doc.custName || '',
      model:        doc.model || '',
      unitStatus:   doc.unitStatus || '',
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
