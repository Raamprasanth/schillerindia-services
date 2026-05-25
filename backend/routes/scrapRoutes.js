// routes/scrapRoutes.js
const router = require('express').Router();
const Scrap  = require('../models/Scrap');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { resolveDivision } = require('../utils/visibility');
const { buildSupplierWarrantyEscalationRow, enqueueLatestEscalationSnapshot } = require('../services/escalationService');

// ── GET all scrap records ─────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { month, year, region, unitStatus, scEng } = req.query;
    const query = {};

    // Division isolation for non-admin employees
    const role = String(req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin') {
      const divDoc = await resolveDivision(req.user);
      const empName = String(req.user.name || '').trim();
      const orConditions = [];
      if (divDoc) orConditions.push({ division: divDoc.name });
      if (empName) {
        orConditions.push({ scEng: empName });
        orConditions.push({ engineer: empName });
        orConditions.push({ addedBy: empName });
      }
      if (orConditions.length > 0) {
        query.$or = orConditions;
      } else {
        return res.json([]);
      }
    }

    if (month || year) {
      const yPart = year  ? year  : '\\d{4}';
      const mPart = month ? String(month).padStart(2, '0') : '\\d{2}';
      query.entryDate = { $regex: new RegExp(`^${yPart}-${mPart}`) };
    }
    if (region)     query.region     = region;
    if (unitStatus) query.unitStatus = unitStatus;
    if (scEng)      query.scEng      = { $regex: new RegExp(scEng, 'i') };

    const docs = await Scrap.find(query).sort({ entryDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET single scrap record ───────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Scrap.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST create scrap record (Admin only) ─────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      serviceId, entryDate, scRno, scEng, frnNo,
      region, engineer, customer, model, unitStatus,
      defMod, defGir, typeWork, rcvdDate,
      pdPfrn, pdObp, pdUrp, pdScc,
    } = req.body;

    if (!customer) return res.status(400).json({ message: 'Customer is required.' });

    // Resolve division from linked Service record
    let divisionName = '';
    try {
      const Service  = require('../models/Service');
      const Division = require('../models/Division');
      const svc = serviceId ? await Service.findOne({ serviceId }).lean() : null;
      if (svc && svc.division) {
        const divDoc = await Division.findById(svc.division).lean();
        if (divDoc) divisionName = divDoc.name;
      }
    } catch (_) { /* non-fatal */ }

    const doc = await Scrap.create({
      serviceId: serviceId || null,
      entryDate, scRno, scEng, frnNo,
      region, engineer, customer, model,
      unitStatus: unitStatus || '',
      defMod: defMod || '',
      defGir: defGir || '',
      typeWork: typeWork || 'SCRAPPED',
      rcvdDate: rcvdDate || '',
      pdPfrn: pdPfrn || 0,
      pdObp:  pdObp  || 0,
      pdUrp:  pdUrp  || 0,
      pdScc:  pdScc  || 0,
      division: divisionName,
      addedBy: req.user.name,
    });
    await enqueueLatestEscalationSnapshot(
      'supplier_warranty',
      doc._id,
      req.user.name || '',
      buildSupplierWarrantyEscalationRow(doc.toObject ? doc.toObject() : doc)
    );

    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── PUT update job sheet ──────────────────────────────────
// This is what the employee JobSheet modal calls
router.put('/:id/jobsheet', protect, async (req, res) => {
  try {
    const { jobSheetRows, jobSheetStatus, jobSheetUpdated } = req.body;

    // Validate rows array (max 5)
    if (jobSheetRows && (!Array.isArray(jobSheetRows) || jobSheetRows.length > 5)) {
      return res.status(400).json({ message: 'jobSheetRows must be an array of max 5 items.' });
    }

    const doc = await Scrap.findByIdAndUpdate(
      req.params.id,
      {
        jobSheetRows:    jobSheetRows    || [],
        jobSheetStatus:  jobSheetStatus  || 'Pending',
        jobSheetUpdated: jobSheetUpdated || true,
        updatedBy: req.user.name,
      },
      { new: true, runValidators: true }
    );

    if (!doc) return res.status(404).json({ message: 'Scrap record not found.' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── PUT update scrap record (Admin) ──────────────────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Scrap.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.name },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── DELETE scrap record (Admin only) ─────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Scrap.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, message: 'Scrap record deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
