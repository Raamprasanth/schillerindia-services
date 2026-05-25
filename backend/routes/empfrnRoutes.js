// routes/empfrnRoutes.js
const express      = require('express');
const router       = express.Router();
const Empfrn       = require('../models/EmpFRN');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Service      = require('../models/Service');
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
const { tryCreateFRNPending } = require('../services/queueSyncService');

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

  const { hasDivisionAccessToService } = require('../utils/visibility');
  if (doc.serviceId) {
    const allowed = await hasDivisionAccessToService(user, doc.serviceId);
    if (allowed) return true;
  }

  const userName = String(user.name || '').trim().toLowerCase();
  return [
    doc.eng,
    doc.scEng,
    doc.raEng,
    doc.submittedBy,
    doc.estRaEng,
  ].some((value) => String(value || '').trim().toLowerCase() === userName);
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
        select: 'branch dealer division partNo doi unitSl',
        populate: { path: 'division', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();
    const result = docs.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : ''),
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      doi: d.doi || (d.serviceId ? d.serviceId.doi : '') || '',
      unitSl: d.unitSl || (d.serviceId ? d.serviceId.unitSl : '') || '',
      division: d.division || (d.serviceId && d.serviceId.division ? d.serviceId.division._id : null),
      divisionName: d.divisionName || (d.serviceId && d.serviceId.division ? d.serviceId.division.name : ''),
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
router.get('/employee', protect, async (req, res) => {
  try {
    syncMissingPendingFrn(req.user).catch(err => console.error('[EmpFRN employee sync]', err.message));
    const { getServiceIdsFilter } = require('../utils/visibility');
    const visibilityFilter = await getServiceIdsFilter(req.user, [
      { eng: req.user.name },
      { scEng: req.user.name }
    ]);
    const filter = {
      status: 'pending',
      ...visibilityFilter
    };
    const docs = await Empfrn.find(filter)
      .populate({
        path: 'serviceId',
        select: 'branch dealer division partNo',
        populate: { path: 'division', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();
    const result = docs.map(d => ({
      ...d,
      branch: d.branch || (d.serviceId ? d.serviceId.branch : ''),
      dealer: d.dealer || (d.serviceId ? d.serviceId.dealer : '') || '',
      partNo: d.partNo || (d.serviceId ? d.serviceId.partNo : '') || '',
      doi: d.doi || (d.serviceId ? d.serviceId.doi : '') || '',
      division: d.division || (d.serviceId && d.serviceId.division ? d.serviceId.division._id : null),
      divisionName: d.divisionName || (d.serviceId && d.serviceId.division ? d.serviceId.division.name : ''),
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

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, doc.serviceId && (doc.serviceId._id || doc.serviceId));
      if (!allowed) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
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

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, doc.serviceId);
      if (!allowed) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // ── Whitelisted fields ────────────────────────────────
    const allowed = [
      'raEng', 'defUnitGir', 'repBrd',
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
    if (bodyStatus !== 'estimation') {
      doc.escalationQueuedAt = new Date();
      doc.escalationQueuedBy = req.user?.name || '';
    }

    // ── Status transition ─────────────────────────────────
    const tw         = typeWorkValue;

    if (tw === 'external repair') {
      doc.status = 'external_repair';
    } else if (tw === 'supplier warranty' || tw === 'supplier warrenty') {
      doc.status = 'supplier_warranty';
    } else if (
      ['completed', 'unit returned', 'no fault', 'upgrade'].includes(tw) ||
      bodyStatus === 'completed'
    ) {
      doc.status = 'completed';
    } else if (tw === 'scrapped') {
      doc.status = 'scrapped';
    } else if (bodyStatus === 'estimation') {
      doc.status = 'estimation';
    } else if (bodyStatus === 'under_repair') {
      // ✅ FIXED: was missing — Same GIR = No routes here, used to fall through to 'pending'
      doc.status = 'under_repair';
    }
    // else: leave as 'pending'

    await doc.save();

    if (bodyStatus !== 'estimation') {
      await enqueueEscalationSnapshot(
        'frn',
        doc._id,
        req.user?.name || '',
        buildFrnEscalationRow(doc.toObject())
      );
    }

    if (doc.status === 'under_repair' && doc.serviceId) {
      try {
        await Service.findByIdAndUpdate(
          doc.serviceId,
          {
            $set: {
              repType:      'TO/ADV SO',
              type:         'Under Repair',
              typeWork:     'UNDER REPAIR',
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
          },
          { runValidators: false }
        );
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
        let divisionName = '';
        if (doc.serviceId) {
          const svc = await Service.findById(doc.serviceId).populate('division').lean();
          if (svc && svc.division) {
            divisionName = typeof svc.division === 'object' ? svc.division.name : '';
          }
        }

        const scrapDoc = await Scrap.create({
          serviceId: doc.serviceId || null,
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
        if (doc.serviceId) {
          await Service.findByIdAndUpdate(
            doc.serviceId,
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
        if (doc.status === 'completed' && doc.serviceId) {
          await Service.findByIdAndUpdate(
            doc.serviceId,
            {
              $set: {
                type: doc.typeWork || 'Completed',
                typeWork: doc.typeWork || 'Completed',
                status: 'completed',
                updatedAt: new Date().toISOString(),
              },
            },
            { runValidators: false }
          );
        }
        const already = await CompletedFRN.findOne({ frnId: doc._id });
        if (!already) {
          const pdays = Math.floor(
            (Date.now() - new Date(doc.createdAt).getTime()) / 86400000
          );
          await CompletedFRN.create({
            frnId:        doc._id,
            serviceId:    doc.serviceId    || null,
            entryDate:    doc.entryDate    || '',
            scRno:        doc.scRno        || '',
            scEng:        doc.scEng        || '',
            frnNo:        doc.frnNo        || '',
            region:       doc.region       || '',
            eng:          doc.eng          || '',
            customer:     doc.customer     || '',
            model:        doc.model        || '',
            unitStatus:   doc.unitStatus   || '',
            defMod:       doc.defMod       || '',
            defGir:       doc.defGir       || '',
            raEng:        doc.raEng        || '',
            defUnitGir:   doc.defUnitGir   || 'NA',
            repGirSno:    doc.repGirNo     || '',
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
    const doc = await Empfrn.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    if (!(await hasQueueAccess(req.user, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (doc.srEscalationQueuedAt) {
      return res.json({
        success: true,
        alreadyQueued: true,
        srEscalationQueuedAt: doc.srEscalationQueuedAt,
        srEscalationQueuedBy: doc.srEscalationQueuedBy || '',
      });
    }

    doc.srEscalationQueuedAt = new Date();
    doc.srEscalationQueuedBy = req.user?.name || '';
    await doc.save();

    await enqueueEscalationSnapshot(
      'sr_frn',
      doc._id,
      req.user?.name || '',
      buildFrnEscalationRow(doc.toObject())
    );

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
    const doc = await Empfrn.findById(req.params.id);
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
        qty: Math.max(1, parseInt(item?.qty, 10) || 1),
      }))
      .filter((item) => item.partNo);
    if (!cleanItems.length) {
      return res.status(400).json({ message: 'Add at least one TO row with Part No and Quantity.' });
    }

    doc.toEscalationQueuedAt = new Date();
    doc.toEscalationQueuedBy = req.user?.name || '';
    await doc.save();

    await enqueueEscalationSnapshot(
      'to_frn',
      doc._id,
      req.user?.name || '',
      buildToEscalationRow(doc.toObject(), cleanItems)
    );

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
