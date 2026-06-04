// routes/completedFrnRoutes.js
const router       = require('express').Router();
const CompletedFRN = require('../models/CompletedFRN');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── Helper: compute pdays ─────────────────────────────────
function livePdays(doc) {
  if (doc.pdays !== null && doc.pdays !== undefined) return doc.pdays;
  return Math.floor(
    (Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000
  );
}

// ── Serialise to frontend shape ───────────────────────────
function toDTO(d) {
  return {
    _id:              d._id,
    serviceId:        d.serviceId        || '',
    frnId:            d.frnId            || null,
    scCompletedFrnId: d.scCompletedFrnId || null,
    entryDate:        d.entryDate        || '',
    scRno:            d.scRno            || '',
    scEng:            d.scEng            || '',
    frnNo:            d.frnNo            || '',
    region:           d.region           || '',
    eng:              d.eng              || '',
    customer:         d.customer         || '',
    model:            d.model            || '',
    unitStatus:       d.unitStatus       || '',
    defMod:           d.defMod           || '',
    defGir:           d.defGir           || '',
    raEng:            d.raEng            || '',
    repBrdDate:       d.repBrdDate       || '',
    dcNo:             d.dcNo             || '',
    defUnitGir:       d.defUnitGir       || '',
    repGirSno:        d.repGirSno        || '',
    finalRemarks:     d.finalRemarks     || '',
    techRemarks:      d.techRemarks      || '',
    components:       d.components       || '',
    typeWork:         d.typeWork         || '',
    reportType:       d.reportType       || '',
    destination:      d.destination      || '',
    shipDateSC:       d.shipDateSC       || '',
    shipDateComm:     d.shipDateComm     || '',
    pdays:            livePdays(d),
    closedBy:         d.closedBy         || '',
    closedAt:         d.closedAt         || null,
    createdAt:        d.createdAt,
  };
}

// ══════════════════════════════════════════════════════════
// EMPLOYEE ROUTES  →  mounted at /api/emp/completed-frn
// ══════════════════════════════════════════════════════════

// ── GET — records for the logged-in employee (read-only) ──
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { getServiceIdsFilter } = require('../utils/visibility');
      filter = await getServiceIdsFilter(req.user);
    }

    const docs = await CompletedFRN.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs.map(toDTO));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET single record ─────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await CompletedFRN.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const { hasDivisionAccessToService } = require('../utils/visibility');
      const allowed = await hasDivisionAccessToService(req.user, doc.serviceId);
      if (!allowed) return res.status(403).json({ message: 'Access denied.' });
    }
    res.json(toDTO(doc));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// ADMIN ROUTES  →  mounted at /api/completed-frn
// ══════════════════════════════════════════════════════════

// ── GET all (Admin) ───────────────────────────────────────
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { region, unitStatus, typeWork, from, to, eng } = req.query;
    const query = {};
    if (region)     query.region     = region;
    if (unitStatus) query.unitStatus = unitStatus;
    if (typeWork)   query.typeWork   = new RegExp(typeWork, 'i');
    if (eng)        query.eng        = new RegExp(eng, 'i');
    if (from || to) {
      query.entryDate = {};
      if (from) query.entryDate.$gte = from;
      if (to)   query.entryDate.$lte = to;
    }
    const docs = await CompletedFRN.find(query).sort({ createdAt: -1 }).lean();
    res.json(docs.map(toDTO));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST — create a completed FRN record ──────────────────
// Called automatically when SCCompletedFRN is marked closed/shipped.
router.post('/', protect, async (req, res) => {
  try {
    const {
      serviceId, frnId, scCompletedFrnId,
      entryDate, scRno, scEng, frnNo,
      region, eng, customer, model, unitStatus,
      defMod, defGir, raEng, repBrdDate, dcNo,
      defUnitGir, repGirSno, finalRemarks, techRemarks, components,
      typeWork, reportType, destination, shipDateSC, shipDateComm, pdays,
    } = req.body;

    if (!scRno) return res.status(400).json({ message: 'scRno is required.' });

    const doc = await CompletedFRN.create({
      serviceId, frnId, scCompletedFrnId,
      entryDate, scRno, scEng, frnNo,
      region, eng, customer, model, unitStatus,
      defMod, defGir, raEng, repBrdDate, dcNo,
      defUnitGir: defUnitGir || 'NA',
      repGirSno, finalRemarks, techRemarks, components,
      typeWork, reportType, destination, shipDateSC, shipDateComm,
      pdays: pdays ?? null,
      closedBy:  req.user?.name || '',
      closedAt:  new Date(),
    });

    res.status(201).json(toDTO(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── DELETE (Admin only) ───────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await CompletedFRN.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
