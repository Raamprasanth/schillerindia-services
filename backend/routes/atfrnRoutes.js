// routes/atfrnRoutes.js
// Admin Repair Team FRN API — same MongoDB collection as /api/rtfrn (`rtfrns`).
//
//  GET    /api/atfrn           ? list (admin)
//  GET    /api/atfrn/:id       ? one record (admin)
//  POST   /api/atfrn           ? create (admin)
//  PUT    /api/atfrn/:id       ? update (admin)
//  DELETE /api/atfrn/:id       ? delete (admin)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ATFRN = require('../models/atfrnModel');
const RTCRL = require('../models/rtcrlModel');
const EmpFRN = require('../models/EmpFRN');
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/authMiddleware');

async function attachActualDivisions(records) {
  if (!records || !records.length) return records;
  const scRefNos = records.map((r) => r.scRefNo).filter(Boolean);
  const defGirNos = records.map((r) => r.defGirNo).filter(Boolean);
  if (!scRefNos.length && !defGirNos.length) return records;

  const map = {};
  try {
    const empFrns = await EmpFRN.find({
      $or: [{ scRno: { $in: scRefNos } }, { defGir: { $in: defGirNos } }],
    })
      .populate({
        path: 'serviceId',
        populate: { path: 'division', select: 'name' },
      })
      .lean();

    empFrns.forEach((e) => {
      const divName = e.serviceId?.division?.name || e.divisionName;
      if (divName) {
        if (e.scRno) map['SC_' + String(e.scRno).toUpperCase()] = divName;
        if (e.defGir) map['GIR_' + String(e.defGir).toUpperCase()] = divName;
      }
    });

    const svcs = await Service.find({
      $or: [{ scReNo: { $in: scRefNos } }, { defGir: { $in: defGirNos } }],
    })
      .populate('division', 'name')
      .lean();

    svcs.forEach((s) => {
      const divName = s.division?.name;
      if (divName) {
        if (s.scReNo) map['SC_' + String(s.scReNo).toUpperCase()] = divName;
        if (s.defGir) map['GIR_' + String(s.defGir).toUpperCase()] = divName;
      }
    });
  } catch (err) {
    console.error('ATFRN attachActualDivisions error:', err.message);
  }

  for (const r of records) {
    let actualDiv = null;
    if (r.scRefNo) actualDiv = map['SC_' + String(r.scRefNo).toUpperCase()];
    if (!actualDiv && r.defGirNo) actualDiv = map['GIR_' + String(r.defGirNo).toUpperCase()];
    if (actualDiv) r.division = actualDiv;
  }
  return records;
}

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, division, status, category, limit = 500 } = req.query;
    const filter = {};
    if (division) filter.division = division;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to) filter.entryDate.$lte = to;
    }
    const records = await ATFRN.find(filter)
      .sort({ entryDate: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    return res.json(await attachActualDivisions(records));
  } catch (err) {
    console.error('ATFRN GET error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const record = await ATFRN.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    const attached = await attachActualDivisions([record]);
    return res.json(attached[0]);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      entryDate,
      division,
      scRefNo,
      defGirNo,
      category,
      model,
      defBrdModName,
      status,
      submittedBy,
      submittedAt,
      sourceEmpFrnId,
      doi,
      fieldRemarks,
      techRemarks,
    } = req.body;

    if (!entryDate || !division || !scRefNo || !defGirNo || !model || !defBrdModName) {
      return res.status(400).json({
        success: false,
        message: 'entryDate, division, scRefNo, defGirNo, model and defBrdModName are required.',
      });
    }

    let serviceDoi = '';
    let serviceFieldRemarks = '';
    if ((!doi || !fieldRemarks) && sourceEmpFrnId && mongoose.Types.ObjectId.isValid(sourceEmpFrnId)) {
      try {
        const emp = await EmpFRN.findById(sourceEmpFrnId).select('serviceId').lean();
        if (emp?.serviceId) {
          const svc = await Service.findById(emp.serviceId).select('doi fieldRemarks').lean();
          serviceDoi = svc?.doi || '';
          serviceFieldRemarks = svc?.fieldRemarks || '';
        }
      } catch (_) {}
    }

    const record = await ATFRN.create({
      entryDate,
      division,
      scRefNo: scRefNo.toUpperCase().trim(),
      defGirNo: defGirNo.toUpperCase().trim(),
      category: category || 'PFRN',
      model,
      defBrdModName,
      status: status || 'pending',
      submittedBy: submittedBy || req.user?.name || '',
      submittedAt: submittedAt || new Date(),
      sourceEmpFrnId:
        sourceEmpFrnId && mongoose.Types.ObjectId.isValid(sourceEmpFrnId) ? sourceEmpFrnId : null,
      doi: doi || serviceDoi || '',
      fieldRemarks: fieldRemarks || serviceFieldRemarks || '',
      techRemarks: techRemarks || '',
    });

    return res.status(201).json(record);
  } catch (err) {
    console.error('ATFRN POST error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const allowed = [
      'repairedBy',
      'status',
      'finalRemarks',
      'techRemarks',
      'components',
      'doi',
      'fieldRemarks',
      'updatedBy',
      'updatedAt',
      'entryDate',
      'division',
      'scRefNo',
      'defGirNo',
      'category',
      'model',
      'defBrdModName',
    ];

    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    updates.updatedAt = new Date();
    if (!updates.updatedBy) updates.updatedBy = req.user?.name || '';

    const updated = await ATFRN.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: false,
    }).lean();

    if (!updated) return res.status(404).json({ success: false, message: 'Record not found.' });

    if (updated.sourceEmpFrnId) {
      try {
        await EmpFRN.findByIdAndUpdate(
          updated.sourceEmpFrnId,
          {
            raEng: updated.raEng || '',
            repGirNo: updated.repGirNo || '',
            repBrd: updated.repBrd || '',
            typeReport: updated.typeReport || '',
            techRemarks: updated.techRemarks || '',
          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost || '',
          timeTaken:        updated.timeTaken || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components || updated.compUsedToRepair || '',

            finalRemarks: updated.finalRemarks || '',
            components: updated.components || '',
            shipSc: updated.shipSc || '',
            shipComm: updated.shipComm || '',
            destination: updated.destination || '',
            rtfrnSent: true,
            rtfrnCompleted: updated.status === 'completed',
            rtfrnCompletedAt: updated.status === 'completed' ? new Date() : null,
          },
          { runValidators: false }
        );
      } catch (empSyncErr) {
        console.error('ATFRN ? EmpFRN sync failed:', empSyncErr.message);
      }
    }

    if (updates.status === 'completed') {
      try {
        await RTCRL.create({
          entryDate: updated.entryDate ? new Date(updated.entryDate) : new Date(),
          closedDate: new Date(),
          division: updated.division,
          scRefNo: updated.scRefNo,
          defGirNo: updated.defGirNo,
          category: updated.category || 'PFRN',
          model: updated.model,
          defBrdModName: updated.defBrdModName,
          status: 'completed',
          closedBy: updates.updatedBy || req.user?.name || '',
          repairedBy: updated.repairedBy || '',
          compUsedToRepair: updated.components || '',
          techRemarks: updated.techRemarks || '',
          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost || '',
          timeTaken:        updated.timeTaken || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components || updated.compUsedToRepair || '',

          finalRemarks: updated.finalRemarks || '',
          submittedBy: updated.submittedBy || '',
          submittedAt: updated.submittedAt || null,
          sourceId: updated._id,
          sourceCollection: 'rtfrn',
        });
      } catch (crlErr) {
        console.error('ATFRN ? RTCRL copy failed:', crlErr.message);
      }

      await ATFRN.findByIdAndDelete(updated._id);
      return res.json({
        success: true,
        completed: true,
        message: 'Repair completed and moved to RTCRL.',
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error('ATFRN PUT error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const existing = await ATFRN.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Record not found.' });

    const deleted = await ATFRN.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: `Record "${deleted.scRefNo}" deleted.` });
  } catch (err) {
    console.error('ATFRN DELETE error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
