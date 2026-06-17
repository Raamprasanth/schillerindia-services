// routes/rtfrn.js
// ─────────────────────────────────────────────────────────
//  Re-repair List API Routes
//
//  GET    /api/Atrr                → all records (admin)
//  GET    /api/Atrr/employee       → records for logged-in employee
//  POST   /api/Atrr                → create new record
//  PUT    /api/Atrr/:id            → update record
//  DELETE /api/Atrr/:id            → delete record
// ─────────────────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Atrr    = require('../models/Atrr');
const Rtcrr    = require('../models/Rtcrr');
const EmpFRN   = require('../models/EmpFRN');
const Service  = require('../models/Service');
const { protect } = require('../middleware/authMiddleware');
const { deleteMirroredRepairRows } = require('../utils/repairDeleteCleanup');

function canViewAll(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'repair' || role === 'repair_team';
}

function canManageDelete(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'repair' || role === 'repair_team';
}

function formatDateOnly(d) {
  if (!d) return new Date().toISOString().split('T')[0];
  const str = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  try {
    const dateObj = new Date(d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  } catch (_) {}
  const splitT = str.split('T')[0];
  return splitT || new Date().toISOString().split('T')[0];
}

function cleanDivision(value, fallback = '') {
  const candidate = String(value || '').trim();
  const fallbackValue = String(fallback || '').trim();
  const statusWords = new Set(['closed', 'completed', 'pending', 'inprogress', 'in_progress', 'on_hold', 'hold', 'scrapped']);
  return candidate && !statusWords.has(candidate.toLowerCase()) ? candidate : fallbackValue;
}

function adminOnly(req, res, next) {
  if ((req.user?.role||'').toLowerCase() !== 'admin')
    return res.status(403).json({ success:false, message:'Admin access required.' });
  next();
}

async function attachActualDivisions(records) {
  if (!records || !records.length) return records;
  const scRefNos = records.map(r => r.scRefNo).filter(Boolean);
  const defGirNos = records.map(r => r.defGirNo).filter(Boolean);
  if (!scRefNos.length && !defGirNos.length) return records;

  const map = {};
  try {
    const empFrns = await EmpFRN.find({
      $or: [{ scRno: { $in: scRefNos } }, { defGir: { $in: defGirNos } }]
    }).populate({
      path: 'serviceId', populate: { path: 'division', select: 'name' }
    }).lean();

    empFrns.forEach(e => {
      const divName = e.serviceId?.division?.name || e.divisionName;
      if (divName) {
        if (e.scRno) map['SC_' + String(e.scRno).toUpperCase()] = divName;
        if (e.defGir) map['GIR_' + String(e.defGir).toUpperCase()] = divName;
      }
    });

    const svcs = await Service.find({
      $or: [{ scReNo: { $in: scRefNos } }, { defGir: { $in: defGirNos } }]
    }).populate('division', 'name').lean();

    svcs.forEach(s => {
      const divName = s.division?.name;
      if (divName) {
        if (s.scReNo) map['SC_' + String(s.scReNo).toUpperCase()] = divName;
        if (s.defGir) map['GIR_' + String(s.defGir).toUpperCase()] = divName;
      }
    });
  } catch (err) {
    console.error('attachActualDivisions error:', err.message);
  }

  for (let r of records) {
    let actualDiv = null;
    if (r.scRefNo) actualDiv = map['SC_' + String(r.scRefNo).toUpperCase()];
    if (!actualDiv && r.defGirNo) actualDiv = map['GIR_' + String(r.defGirNo).toUpperCase()];
    if (actualDiv) r.division = actualDiv;
  }
  return records;
}

// ══════════════════════════════════════════════════════════
//  GET /api/Atrr  — all records (admin only)
// ══════════════════════════════════════════════════════════
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, division, status, category, limit = 500 } = req.query;
    const filter = {};
    if (division) filter.division = division;
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }
    const records = await Atrr.find(filter)
      .sort({ entryDate: -1 })
      .limit(parseInt(limit))
      .lean();
    return res.json(await attachActualDivisions(records));
  } catch (err) {
    console.error('Atrr GET all error:', err.message);
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  GET /api/Atrr/employee  — records for logged-in user
//  (employees see only their own records; admins see all)
// ══════════════════════════════════════════════════════════
router.get('/employee', protect, async (req, res) => {
  try {
    const filter  = canViewAll(req.user) ? {} : { submittedBy: req.user.name || req.user.id };

    const { from, to, division, status, category } = req.query;
    if (division) filter.division = division;
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to)   filter.entryDate.$lte = to;
    }

    const records = await Atrr.find(filter)
      .sort({ entryDate: -1 })
      .limit(500)
      .lean();
    return res.json(await attachActualDivisions(records));
  } catch (err) {
    console.error('Atrr GET employee error:', err.message);
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  GET /api/Atrr/:id  — single record
// ══════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
  try {
    const record = await Atrr.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success:false, message:'Record not found.' });
    const attached = await attachActualDivisions([record]);
    return res.json(attached[0]);
  } catch (err) {
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  POST /api/Atrr  — create new Re-repair List record
// ══════════════════════════════════════════════════════════
router.post('/', protect, async (req, res) => {
  try {
    const {
      entryDate, closedDate, division, scRefNo, defGirNo,
      category, model, defBrdModName, status,
      submittedBy, submittedAt, sourceEmpFrnId,
      doi, fieldRemarks, techRemarks,
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

    const record = await Atrr.create({
      entryDate:      formatDateOnly(entryDate),
      closedDate:     closedDate ? new Date(closedDate) : null,
      division,
      scRefNo:        scRefNo.toUpperCase().trim(),
      defGirNo:       defGirNo.toUpperCase().trim(),
      category:       category    || 'PFRN',
      model,
      defBrdModName,
      status:         status      || 'pending',
      submittedBy:    submittedBy || req.user?.name || '',
      submittedAt:    submittedAt || new Date(),
      sourceEmpFrnId: sourceEmpFrnId && mongoose.Types.ObjectId.isValid(sourceEmpFrnId)
                        ? sourceEmpFrnId : null,
      doi:            doi || serviceDoi || '',
      fieldRemarks:   fieldRemarks || serviceFieldRemarks || '',
      techRemarks:    techRemarks  || '',
    });

    return res.status(201).json(record);
  } catch (err) {
    console.error('Atrr POST error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success:false, message: messages });
    }
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  PUT /api/Atrr/:id  — update Re-repair List record
// ══════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await Atrr.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success:false, message:'Record not found.' });

    const allowed = [
      'repairedBy','status',
      'finalRemarks','repairRemarks','techRemarks','components',
      'repairedDate','cost','timeTaken','repairStatus',
      'doi','fieldRemarks',
      'updatedBy','updatedAt',
      // allow admins to edit core fields too
      'entryDate','closedDate','division','scRefNo','defGirNo','category','model','defBrdModName',
    ];

    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.entryDate !== undefined) {
      updates.entryDate = formatDateOnly(updates.entryDate);
    }
    if (updates.division !== undefined) {
      updates.division = cleanDivision(updates.division, existing.division);
    }
    updates.updatedAt = new Date();
    if (!updates.updatedBy) updates.updatedBy = req.user?.name || '';

    const updated = await Atrr.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: false }
    ).lean();

    let targetEmpFrnId = updated.sourceEmpFrnId;
    if (!targetEmpFrnId) {
      const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      let filter = { $or: [] };
      if (updated.scRefNo && updated.scRefNo !== '-') {
        const scRegex = { $regex: new RegExp('^' + escapeRegex(updated.scRefNo.trim()) + '$', 'i') };
        filter.$or.push({ scRno: scRegex }, { scReNo: scRegex }, { frnNo: scRegex });
      }
      if (updated.defGirNo && updated.defGirNo !== '-') {
        const girRegex = { $regex: new RegExp('^' + escapeRegex(updated.defGirNo.trim()) + '$', 'i') };
        filter.$or.push({ defGir: girRegex }, { defGirNo: girRegex });
      }
      if (filter.$or.length > 0) {
        const empFrnDoc = await EmpFRN.findOne(filter).select('_id');
        if (empFrnDoc) targetEmpFrnId = empFrnDoc._id;
      }
    }

    if (targetEmpFrnId) {
      try {
        const empUpdate = await EmpFRN.findByIdAndUpdate(
          targetEmpFrnId,
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
          components:       updated.components || '',

            components: updated.components || '',
            shipSc: updated.shipSc || '',
            shipComm: updated.shipComm || '',
            destination: updated.destination || '',
            rtrrSent: true,
            rtrrCompleted: updated.status === 'completed',
            rtrrCompletedAt: updated.status === 'completed' ? new Date() : null,
            rtfrnSent: true,
            rtfrnCompleted: updated.status === 'completed',
            rtfrnCompletedAt: updated.status === 'completed' ? new Date() : null,
          },
          { new: true, runValidators: false }
        );
        if (empUpdate?.serviceId) {
          await Service.findByIdAndUpdate(
            empUpdate.serviceId,
            {
              $set: {
                techRemarks: updated.techRemarks || '',
          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost || '',
          timeTaken:        updated.timeTaken || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components || '',

                components: updated.components || '',
                rtrrSent: true,
                rtrrSentAt: empUpdate.rtrrSentAt || updated.submittedAt || new Date(),
                rtrrCompleted: updated.status === 'completed',
                rtrrCompletedAt: updated.status === 'completed' ? new Date().toISOString() : null,
                rtfrnSent: true,
                rtfrnSentAt: empUpdate.rtfrnSentAt || updated.submittedAt || new Date(),
                rtfrnCompleted: updated.status === 'completed',
                rtfrnCompletedAt: updated.status === 'completed' ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              },
            },
            { runValidators: false }
          );
        }
      } catch (empSyncErr) {
        console.error('Atrr → EmpFRN sync failed:', empSyncErr.message);
      }
    }

    // ── On completion: copy to RTCRL, update source EmpFRN, delete Atrr ──
    if (updated.sourceServiceId) {
      try {
        await Service.findByIdAndUpdate(
          updated.sourceServiceId,
          {
            $set: {
              rtfrnSent: true,
              rtfrnSentAt: updated.submittedAt || new Date(),
              rtfrnCompleted: updated.status === 'completed',
              rtfrnCompletedAt: updated.status === 'completed' ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            },
          },
          { runValidators: false }
        );
      } catch (serviceSyncErr) {
        console.error('Atrr -> Service sync failed:', serviceSyncErr.message);
      }
    }

    if (updates.status === 'completed') {
      try {
        await Rtcrr.create({
          revertedDate:     updated.revertedDate || null,
          entryDate:        updated.entryDate ? new Date(updated.entryDate) : new Date(),
          closedDate:       updated.closedDate || null,
          reRepDate:        new Date(),
          division:         cleanDivision(updated.division, existing.division),
          scRefNo:          updated.scRefNo,
          defGirNo:         updated.defGirNo,
          category:         updated.category || 'PFRN',
          model:            updated.model,
          defBrdModName:    updated.defBrdModName,
          status:           'completed',
          closedBy:         updates.updatedBy || req.user?.name || '',
          repairedBy:       updated.repairedBy   || '',
          compUsedToRepair: updated.components   || '',
          techRemarks:      updated.techRemarks  || '',
          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost || '',
          timeTaken:        updated.timeTaken || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components || '',

          finalRemarks:     updated.finalRemarks || '',
          submittedBy:      updated.submittedBy  || '',
          submittedAt:      updated.submittedAt  || null,
          sourceId:         updated._id,
          sourceCollection: 'Atrr',
        });
      } catch (crlErr) {
        console.error('Atrr → Rtcrr copy failed:', crlErr.message);
        throw crlErr;
      }

      await Atrr.findByIdAndDelete(updated._id);
      return res.json({ success: true, completed: true, message: 'Re-repair completed and moved to Closed Re-repair List.' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Atrr PUT error:', err.message);
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  DELETE /api/Atrr/:id  — delete record (admin only)
// ══════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await Atrr.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success:false, message:'Record not found.' });

    if (!canManageDelete(req.user)) {
      const name = req.user?.name || req.user?.id || '';
      const canDeleteOwn = existing.submittedBy === name || existing.raEng === name;
      if (!canDeleteOwn) {
        return res.status(403).json({ success:false, message:'You can only delete your own records.' });
      }
    }

    const result = await deleteMirroredRepairRows(Atrr, req.params.id, existing);
    return res.json({ success:true, message:`Record "${existing.scRefNo}" deleted.`, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Atrr DELETE error:', err.message);
    return res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
