// routes/scrapRoutes.js
const router = require('express').Router();
const mongoose = require('mongoose');
const Scrap  = require('../models/Scrap');
const Service = require('../models/Service');
const Division = require('../models/Division');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { resolveDivision } = require('../utils/visibility');
const { buildSupplierWarrantyEscalationRow, enqueueLatestEscalationSnapshot } = require('../services/escalationService');

function isAdminUser(user = {}) {
  const role = String(user.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}

async function canAccessScrapDoc(doc, user = {}) {
  if (isAdminUser(user)) return true;
  const divDoc = await resolveDivision(user);
  const empName = String(user.name || '').trim();
  const allowedDiv = divDoc && doc.division && String(doc.division) === String(divDoc.name);
  const allowedName = empName && [doc.scEng, doc.engineer, doc.addedBy]
    .some((name) => String(name || '').trim() === empName);
  return Boolean(allowedDiv || allowedName);
}

function serviceReferenceValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return value._id || value.id || value.serviceId || '';
  }
  return String(value).trim();
}

async function resolveServiceReference(value) {
  const ref = serviceReferenceValue(value);
  if (!ref) return { serviceObjectId: null, serviceDoc: null };

  let serviceDoc = null;
  if (mongoose.Types.ObjectId.isValid(ref) && String(ref).length === 24) {
    serviceDoc = await Service.findById(ref).lean();
  }
  if (!serviceDoc) {
    serviceDoc = await Service.findOne({ serviceId: ref }).lean();
  }

  return {
    serviceObjectId: serviceDoc ? serviceDoc._id : null,
    serviceDoc,
  };
}

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
      
      const ownerOr = [];
      if (empName) {
        ownerOr.push({ scEng: empName });
        ownerOr.push({ engineer: empName });
        ownerOr.push({ addedBy: empName });
      }

      if (divDoc) {
        const divisionRegex = new RegExp('^' + String(divDoc.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '$', 'i');
        const divClause = {
          $or: [
            { division: divisionRegex },
            { division: { $exists: false } },
            { division: '' }
          ]
        };
        
        query.$and = [
          divClause,
          ownerOr.length ? { $or: [ { division: divisionRegex }, ...ownerOr ] } : {}
        ];
      } else if (ownerOr.length > 0) {
        query.$or = ownerOr;
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
    for (const doc of docs) {
      if (!doc.division || doc.division.trim() === '') {
        let divName = '';
        if (doc.serviceId) {
          const svc = await Service.findById(doc.serviceId).populate('division').lean();
          if (svc) {
            if (svc.division) {
              divName = typeof svc.division === 'object' ? (svc.division.name || svc.division.displayName) : svc.division;
            }
            if (!divName) divName = svc.divisionName || '';
          }
        }
        if (divName) {
          doc.division = divName;
          await Scrap.updateOne({ _id: doc._id }, { $set: { division: divName } }).catch(() => {});
        }
      }
    }
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
router.post('/', protect, async (req, res) => {
  try {
    const {
      serviceId, entryDate, scRno, scEng, frnNo,
      region, engineer, customer, customerName, year, vendorName, model, unitSerialNo, unitStatus,
      problemDetails, partNo, itemDescription,
      defMod, defGir, typeWork, rcvdDate,
      defPartSn, vendorTicketNumber, commercialToDetails, docketDetails,
      receivedDateAtEsskay, receivedBackAtSvc, repairStatus,
      amountChargedForRepair, softwareDetails, serviceCentreComments,
      pdPfrn, pdObp, pdUrp, pdScc,
    } = req.body;

    const finalCustomer = String(customerName || customer || '').trim();
    if (!finalCustomer) return res.status(400).json({ message: 'Customer name is required.' });

    const { serviceObjectId, serviceDoc } = await resolveServiceReference(serviceId);

    // Resolve division from request body, linked Service, or user division
    let divisionName = req.body.division || '';
    if (!divisionName && serviceDoc) {
      if (serviceDoc.division) {
        if (typeof serviceDoc.division === 'object' && (serviceDoc.division.name || serviceDoc.division.displayName)) {
          divisionName = serviceDoc.division.name || serviceDoc.division.displayName;
        } else if (typeof serviceDoc.division === 'string' && serviceDoc.division.trim()) {
          if (mongoose.Types.ObjectId.isValid(serviceDoc.division) && String(serviceDoc.division).length === 24) {
            const divObj = await Division.findById(serviceDoc.division).lean();
            if (divObj) divisionName = divObj.name;
          } else {
            divisionName = serviceDoc.division;
          }
        }
      }
      if (!divisionName) divisionName = serviceDoc.divisionName || '';
    }
    if (!divisionName) {
      const divDoc = await resolveDivision(req.user);
      divisionName = divDoc ? divDoc.name : (req.user?.division || '');
    }

    const finalReceivedDate = receivedDateAtEsskay || rcvdDate || entryDate || '';

    const doc = await Scrap.create({
      serviceId: serviceObjectId,
      entryDate: entryDate || finalReceivedDate,
      scRno,
      scEng: scEng || req.user.name || '',
      frnNo,
      region,
      engineer,
      customer: finalCustomer,
      year: year || '',
      vendorName: vendorName || '',
      model,
      unitSerialNo: unitSerialNo || '',
      unitStatus: unitStatus || '',
      problemDetails: problemDetails || '',
      partNo: partNo || '',
      itemDescription: itemDescription || '',
      defMod: defMod || '',
      defGir: defGir || '',
      defPartSn: defPartSn || '',
      vendorTicketNumber: vendorTicketNumber || '',
      commercialToDetails: commercialToDetails || '',
      docketDetails: docketDetails || '',
      receivedDateAtEsskay: finalReceivedDate,
      receivedBackAtSvc: receivedBackAtSvc || '',
      repairStatus: repairStatus || '',
      amountChargedForRepair: amountChargedForRepair || '',
      softwareDetails: softwareDetails || '',
      serviceCentreComments: serviceCentreComments || '',
      typeWork: typeWork || repairStatus || 'SCRAPPED',
      rcvdDate: finalReceivedDate,
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
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await Scrap.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found.' });
    if (!(await canAccessScrapDoc(existing, req.user))) {
      return res.status(403).json({ message: 'Not authorized to update this record.' });
    }

    const customerName = req.body.customerName || req.body.customer;
    const receivedDate = req.body.receivedDateAtEsskay || req.body.rcvdDate || req.body.entryDate;
    const patch = {
      ...req.body,
      updatedBy: req.user.name,
    };
    if (customerName) patch.customer = customerName;
    if (receivedDate) {
      patch.receivedDateAtEsskay = receivedDate;
      patch.rcvdDate = receivedDate;
      patch.entryDate = req.body.entryDate || receivedDate;
    }
    if (!patch.typeWork && patch.repairStatus) patch.typeWork = patch.repairStatus;
    delete patch.customerName;

    const doc = await Scrap.findByIdAndUpdate(
      req.params.id,
      patch,
      { new: true, runValidators: true }
    );
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
