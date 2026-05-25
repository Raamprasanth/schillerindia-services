// routes/aturRoutes.js
// Admin RT UR API — same collection as /api/rtur (`rturs`).
//
//  GET    /api/atur/stats       ? summary stats (admin)
//  GET    /api/atur/export/csv ? CSV export (admin)
//  GET    /api/atur            ? list (admin)
//  GET    /api/atur/:id        ? one record (admin)
//  POST   /api/atur            ? create (admin)
//  PUT    /api/atur/:id        ? update (admin)
//  DELETE /api/atur/:id        ? delete (admin)

const express = require('express');
const router = express.Router();
const ATUR = require('../models/aturModel');
const RTCRL = require('../models/rtcrlModel');
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const fail = (res, code, message, err = null) => {
  if (err) console.error('[ATUR]', message, err.message);
  return res.status(code).json({ success: false, message, error: err?.message || null });
};

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [total, pending, critical, completed, avgDays] = await Promise.all([
      ATUR.countDocuments(),
      ATUR.getPendingCount(),
      ATUR.getCriticalCount(),
      ATUR.getCompletedCount(),
      ATUR.getAverageDays(),
    ]);
    return res.json({ success: true, data: { total, pending, critical, completed, avgDays } });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch stats', err);
  }
});

router.get('/export/csv', protect, adminOnly, async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const records = await ATUR.find(filter).sort({ entryDate: -1 }).lean();

    const cols = [
      'entryDate', 'division', 'scRefNo', 'defGirNo', 'category',
      'model', 'defBrdModName', 'noOfDays', 'status',
      'submittedBy', 'repairedBy', 'compUsedToRepair',
      'techRemarks', 'finalRemarks', 'addNotes',
      'dcNo', 'returnDate', 'returnDcNo', 'destination',
    ];
    const header = cols.join(',');
    const rows = records.map((r) => {
      const noOfDays = r.entryDate
        ? Math.max(0, Math.floor((Date.now() - new Date(r.entryDate).getTime()) / 86400000))
        : 0;
      return cols.map((c) => {
        let val = c === 'noOfDays' ? noOfDays : (r[c] ?? '');
        if (val instanceof Date) val = val.toISOString().slice(0, 10);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ATUR_Export_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    return fail(res, 500, 'CSV export failed', err);
  }
});

function buildFilter({ from, to, division, status, category } = {}) {
  const filter = {};

  if (from || to) {
    filter.entryDate = {};
    if (from) filter.entryDate.$gte = new Date(from);
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = t;
    }
  }

  if (status && status !== 'critical') filter.status = status;
  if (division) filter.division = division;
  if (category) filter.category = category;

  return filter;
}

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 500 } = req.query;
    const filter = buildFilter(req.query);

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ATUR.countDocuments(filter);

    const records = await ATUR.find(filter)
      .sort({ entryDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: records,
    });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch ATUR records', err);
  }
});

router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const record = await ATUR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      entryDate, division, scRefNo, defGirNo, category,
      model, defBrdModName, status,
      submittedBy, submittedAt, sourceServiceId,
      doi, fieldRemarks, techRemarks,
    } = req.body;

    if (!entryDate || !division || !scRefNo || !defGirNo || !model || !defBrdModName) {
      return fail(res, 400, 'Required fields missing: entryDate, division, scRefNo, defGirNo, model, defBrdModName');
    }

    let serviceDoi = '';
    let serviceFieldRemarks = '';
    if ((!doi || !fieldRemarks) && sourceServiceId) {
      try {
        const svc = await Service.findById(sourceServiceId).select('doi fieldRemarks').lean();
        serviceDoi = svc?.doi || '';
        serviceFieldRemarks = svc?.fieldRemarks || '';
      } catch (_) {}
    }

    const doc = await ATUR.create({
      entryDate: new Date(entryDate),
      division,
      scRefNo,
      defGirNo,
      category: category || 'UR',
      model,
      defBrdModName,
      status: status || 'pending',
      submittedBy: submittedBy || '',
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      sourceServiceId: sourceServiceId || '',
      doi: doi || serviceDoi || '',
      fieldRemarks: fieldRemarks || serviceFieldRemarks || '',
      techRemarks: techRemarks || '',
    });

    return res.status(201).json({ success: true, message: 'ATUR record created', data: doc });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to create record', err);
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const record = await ATUR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    const {
      repairedBy, status, category, entryDate,
      compUsedToRepair, repBrdDate, dcNo,
      techRemarks, finalRemarks, addNotes,
      returnDate, returnDcNo, destination,
      doi, fieldRemarks,
      updatedBy, updatedAt,
    } = req.body;

    if (repairedBy !== undefined) record.repairedBy = repairedBy;
    if (status !== undefined) record.status = status;
    if (category !== undefined) record.category = category;
    if (entryDate !== undefined) record.entryDate = new Date(entryDate);
    if (compUsedToRepair !== undefined) record.compUsedToRepair = compUsedToRepair;
    if (repBrdDate !== undefined) record.repBrdDate = repBrdDate ? new Date(repBrdDate) : null;
    if (dcNo !== undefined) record.dcNo = dcNo;
    if (doi !== undefined) record.doi = doi;
    if (fieldRemarks !== undefined) record.fieldRemarks = fieldRemarks;
    if (techRemarks !== undefined) record.techRemarks = techRemarks;
    if (finalRemarks !== undefined) record.finalRemarks = finalRemarks;
    if (addNotes !== undefined) record.addNotes = addNotes;
    if (returnDate !== undefined) record.returnDate = returnDate ? new Date(returnDate) : null;
    if (returnDcNo !== undefined) record.returnDcNo = returnDcNo;
    if (destination !== undefined) record.destination = destination;
    if (updatedBy !== undefined) record.updatedBy = updatedBy;
    if (updatedAt !== undefined) record.updatedAt = updatedAt ? new Date(updatedAt) : new Date();

    const saved = await record.save();

    if (saved.status === 'completed') {
      const completionStamp = new Date().toISOString();
      try {
        const serviceFilter = saved.sourceServiceId
          ? { _id: saved.sourceServiceId }
          : { scReNo: saved.scRefNo, defGir: saved.defGirNo };
        await Service.findOneAndUpdate(
          serviceFilter,
          {
            $set: {
              rturSent: true,
              rturCompleted: true,
              rturCompletedAt: completionStamp,
              components: saved.compUsedToRepair || '',
              techRemarks: saved.techRemarks || '',
              finalRemarks: saved.finalRemarks || '',
            },
          }
        );
      } catch (svcErr) {
        console.error('ATUR ? Service sync failed:', svcErr.message);
      }

      try {
        await RTCRL.create({
          entryDate: saved.entryDate ? new Date(saved.entryDate) : new Date(),
          closedDate: new Date(),
          division: saved.division,
          scRefNo: saved.scRefNo,
          defGirNo: saved.defGirNo,
          category: saved.category || 'UR',
          model: saved.model,
          defBrdModName: saved.defBrdModName,
          status: 'completed',
          closedBy: saved.updatedBy || req.user?.name || '',
          repairedBy: saved.repairedBy || '',
          compUsedToRepair: saved.compUsedToRepair || '',
          techRemarks: saved.techRemarks || '',
          finalRemarks: saved.finalRemarks || '',
          submittedBy: saved.submittedBy || '',
          submittedAt: saved.submittedAt || null,
          sourceId: saved._id,
          sourceCollection: 'rtur',
        });
      } catch (crlErr) {
        console.error('ATUR ? RTCRL copy failed:', crlErr.message);
      }

      await ATUR.findByIdAndDelete(saved._id);
      return res.json({ success: true, completed: true, message: 'Repair completed and moved to RTCRL.' });
    }

    return res.json({ success: true, message: 'ATUR record updated', data: saved });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to update record', err);
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await ATUR.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'ATUR record deleted', data: { id: req.params.id } });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
