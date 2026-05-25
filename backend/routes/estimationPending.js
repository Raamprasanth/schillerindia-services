// routes/estimationPending.js
// Mount in server.js:
//   app.use('/api/emp/estimation', require('./routes/estimationPending'));

const express           = require('express');
const router            = express.Router();
const EstimationPending = require('../models/EstimationPending');
const CompletedFRN      = require('../models/CompletedFRN');
const SCCompletedFRN    = require('../models/SCCompletedFRN');
const Scrap             = require('../models/Scrap');
const Service           = require('../models/Service');
const Division          = require('../models/Division');
const { protect }       = require('../middleware/authMiddleware');
const {
  buildEstimationEscalationRow,
  buildToEscalationRow,
  buildExternalRepairEscalationRow,
  buildSupplierWarrantyEscalationRow,
  enqueueEscalationSnapshot,
  enqueueLatestEscalationSnapshot,
} = require('../services/escalationService');

router.use(protect);

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
    const records = await EstimationPending.find(query).populate('serviceId', 'dealer').sort({ createdAt: -1 }).lean();
    res.json(records.map(record => ({
      ...record,
      dealer: record.dealer || (record.serviceId ? record.serviceId.dealer : '') || '',
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
    const records = await EstimationPending.find(query).populate('serviceId', 'dealer').sort({ createdAt: -1 }).lean();
    res.json(records.map(record => ({
      ...record,
      dealer: record.dealer || (record.serviceId ? record.serviceId.dealer : '') || '',
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
    const record = await EstimationPending.findById(req.params.id).populate('serviceId', 'dealer').lean();
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, record.serviceId && (record.serviceId._id || record.serviceId));
      if (!allowed) return res.status(403).json({ message: 'Access denied' });
    }
    res.json({
      ...record,
      dealer: record.dealer || (record.serviceId ? record.serviceId.dealer : '') || '',
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

    const docData = {
      ...body,
      source:      body.source      || 'service',
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
    if (body.serviceId) {
      record = await EstimationPending.findOneAndUpdate(
        { serviceId: body.serviceId },
        { $set: docData },
        { new: true, upsert: true, runValidators: false }
      );
      console.log('[EstPending] upserted for serviceId:', body.serviceId);
    } else {
      record = await EstimationPending.create(docData);
      console.log('[EstPending] created (no serviceId)');
    }

    res.status(201).json(record);
  } catch (err) {
    console.error('[POST /api/emp/estimation]', err);
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

    if (!body.serviceId) {
      return res.status(400).json({ message: 'serviceId is required for from-ob push' });
    }

    const docData = {
      // ── source tag ──────────────────────────────────────
      source: 'ob',

      // ── core service info ────────────────────────────────
      serviceId:   body.serviceId,
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
      obComponents:   body.components     || '',
      revalue:        Number(body.revalue || 0),
      obTypeReport:   body.typeReport     || '',

      // ── carry common remark fields ───────────────────────
      techRemarks:  body.techRemarks  || '',
      finalRemarks: body.obFinalRemarks || body.finalRemarks || '',
      components:   body.components   || '',

      // ── default estimation status ────────────────────────
      estStatus: 'Estimation Pending',

      // ── audit ────────────────────────────────────────────
      submittedBy: body.submittedBy || req.user.name,
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : now,
    };

    const record = await EstimationPending.findOneAndUpdate(
      { serviceId: body.serviceId },
      { $set: docData },
      { new: true, upsert: true, runValidators: false }
    );

    console.log('[EstPending/from-ob] upserted serviceId:', body.serviceId, '→', record._id);
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
    const record = await EstimationPending.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const { role, name } = req.user;
    if (!(await hasQueueAccess(req.user, record))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { _id, id, createdAt, ...updateData } = req.body;
    const sameGir = String(updateData.sameGir || '').toLowerCase();
    const updated = await EstimationPending.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...updateData,
          estUpdatedBy: name,
          estUpdatedAt: new Date(),
          escalationQueuedAt: new Date(),
          escalationQueuedBy: name || '',
        }
      },
      { new: true, runValidators: false }
    );

    await enqueueEscalationSnapshot(
      'est',
      updated._id,
      name || '',
      buildEstimationEscalationRow(updated.toObject ? updated.toObject() : updated)
    );

    const normalizedTypeWork = String(updated.typeWork || '').trim().toLowerCase();

    if (normalizedTypeWork === 'external repair') {
      const pdays = (record.rcvdDate || record.entryDate)
        ? Math.max(0, Math.floor((Date.now() - new Date(record.rcvdDate || record.entryDate).getTime()) / 86400000))
        : 0;

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

    if (normalizedTypeWork === 'upgrade' || sameGir === 'yes') {
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
        raEng:        updated.obRaEng || '',
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
      await Service.findByIdAndUpdate(
        updated.serviceId,
        {
          $set: {
            repType:      'TO/ADV SO',
            type:         'Under Repair',
            typeWork:     'UNDER REPAIR',
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
        { runValidators: false }
      );

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
    const record = await EstimationPending.findById(req.params.id);
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

    record.srEscalationQueuedAt = new Date();
    record.srEscalationQueuedBy = name || '';
    await record.save();

    await enqueueEscalationSnapshot(
      'sr_est',
      record._id,
      name || '',
      buildEstimationEscalationRow(record.toObject())
    );

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
    const record = await EstimationPending.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    const { role, name } = req.user;
    if (role !== 'admin' && role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, record.serviceId);
      if (!allowed) return res.status(403).json({ message: 'Access denied' });
    }

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
      buildToEscalationRow(record.toObject(), cleanItems)
    );

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
    const record = await EstimationPending.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const { role } = req.user;
    if (role !== 'admin' && role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, record.serviceId);
      if (!allowed) return res.status(403).json({ message: 'Access denied' });
    }

    await EstimationPending.findByIdAndDelete(req.params.id);
    res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/emp/estimation/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
