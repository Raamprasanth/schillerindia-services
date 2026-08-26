// routes/rtcrlRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Closed Repair List — Express REST Routes
// Mounted at: /api/rtcrr  (add this line in server.js)
//
// Endpoints called by rtcrl.html:
//   GET  /api/rtcrr              loadData()    — list with filters
//   GET  /api/rtcrr/stats        updateStats() — hero-stat cards
//   GET  /api/rtcrr/export/csv   exportCSV()   — CSV download
//   GET  /api/rtcrr/:id          openDetail()  — single record detail view
//   POST /api/rtcrr              create        — called when marking UR/OB/PFRN complete
//
// NOTE: No PUT or DELETE — closed records are read-only in rtcrl.html.
//       Deletion (if needed by admin) can be added as a separate admin-only route.
//
// NOTE: Auth middleware is applied in server.js (not here), same as rturRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const Rtcrr   = require('../models/Rtcrr');
const EmpFRN  = require('../models/EmpFRN');
const Service = require('../models/Service');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const fail = (res, code, message, err = null) => {
  if (err) console.error('[Rtcrr]', message, err.message);
  return res.status(code).json({ success: false, message, error: err?.message || null });
};

function cleanDivision(value, fallback = '') {
  const candidate = String(value || '').trim();
  const fallbackValue = String(fallback || '').trim();
  const statusWords = new Set(['closed', 'completed', 'pending', 'inprogress', 'in_progress', 'on_hold', 'hold', 'scrapped']);
  return candidate && !statusWords.has(candidate.toLowerCase()) ? candidate : fallbackValue;
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
    console.error('Rtcrr attachActualDivisions error:', err.message);
  }

  records.forEach(r => {
    let actualDiv = null;
    if (r.scRefNo) actualDiv = map['SC_' + String(r.scRefNo).toUpperCase()];
    if (!actualDiv && r.defGirNo) actualDiv = map['GIR_' + String(r.defGirNo).toUpperCase()];
    if (actualDiv) r.division = actualDiv;
  });

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FILTER BUILDER
// Converts rtcrl.html query params → Mongoose filter object
//
// Params:
//   from, to        → entryDate range  (fl-from / fl-to)
//   division        → division         (fl-div)
//   category        → category tab     (PFRN | UR | OB)
//   repairedBy      → fl-repairedby
//   closedBy        → fl-closedby (partial text match)
// ─────────────────────────────────────────────────────────────────────────────
function buildFilter({ from, to, division, category, repairedBy, closedBy } = {}) {
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

  if (division)   filter.division   = division;
  if (category)   filter.category   = category;
  if (repairedBy) filter.repairedBy = repairedBy;

  // closedBy is a partial text match (fl-closedby input field)
  if (closedBy) filter.closedBy = { $regex: closedBy, $options: 'i' };

  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrr/stats
// Returns the 4 hero-stat + stat-card numbers shown in rtcrl.html
// MUST be declared before /:id so Express doesn't treat "stats" as an ObjectId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, pfrn, ur, ob, avgDays] = await Promise.all([
      Rtcrr.getTotalCount(),
      Rtcrr.getPFRNCount(),
      Rtcrr.getURCount(),
      Rtcrr.getOBCount(),
      Rtcrr.getAvgDays(),
    ]);
    return res.json({ success: true, data: { total, pfrn, ur, ob, avgDays } });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch stats', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrr/export/csv
// Triggered by rtcrl.html exportCSV() → 📤 Export button
// MUST be declared before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const filter  = buildFilter(req.query);
    const records = await attachActualDivisions(
      await Rtcrr.find(filter).sort({ reRepDate: -1, closedDate: -1 }).lean()
    );

    // Column order matches rtcrl.html exportCSV() headers array
    const cols = [
      'revertedDate', 'reRepDate', 'entryDate', 'closedDate', 'division', 'scRefNo', 'defGirNo',
      'category', 'model', 'defBrdModName', 'noOfDays',
      'repairedBy', 'closedBy', 'techRemarks', 'finalRemarks',
      'compUsedToRepair', 'dcNo', 'returnDcNo', 'destination',
    ];
    const header = cols.join(',');
    const rows   = records.map(r => {
      const end = new Date(r.reRepDate || r.closedDate || new Date());
      const start = r.revertedDate || r.entryDate;
      const noOfDays = start
        ? Math.max(0, Math.floor((end.getTime() - new Date(start).getTime()) / 86400000))
        : 0;
      return cols.map(c => {
        let val = c === 'noOfDays' ? noOfDays : (r[c] ?? '');
        if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
          val = new Date(val).toISOString().slice(0, 10);
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="Rtcrr_Export_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    return fail(res, 500, 'CSV export failed', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrr
// Called by rtcrl.html loadData() on page load and every ⟳ Refresh click.
// Returns: { success, total, page, pages, data: [...] }
// rtcrl.html reads   data.data || data
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page, limit } = req.query;
    const filter = buildFilter(req.query);

    const total = await Rtcrr.countDocuments(filter);
    let query = Rtcrr.find(filter).sort({ reRepDate: -1, closedDate: -1 });

    const hasLimit = limit && limit !== 'all' && Number(limit) > 0;
    const parsedLimit = hasLimit ? Number(limit) : 0;
    const parsedPage = Number(page || 1);

    if (hasLimit) {
      const skip = (parsedPage - 1) * parsedLimit;
      query = query.skip(skip).limit(parsedLimit);
    }

    const records = await attachActualDivisions(await query.lean());

    return res.json({
      success: true,
      total,
      page: parsedPage,
      pages: hasLimit ? Math.ceil(total / parsedLimit) : 1,
      data: records,
    });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch closed repair records', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrr/:id
// Called when rtcrl.html opens the detail modal for a record
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [record] = await attachActualDivisions(
      await Rtcrr.find({ _id: req.params.id }).lean()
    );
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rtcrr
// Create a new closed record.
//
// Called in TWO situations:
//   A. When you manually create a closed record directly.
//   B. When your RTUR / RTOB / RTFRN PUT route marks a record as 'completed'
//      and also POSTs a copy here to keep the closed list in sync.
//
// Expected body fields:
//   entryDate*, division*, scRefNo*, defGirNo*, category*, model*, defBrdModName*,
//   closedDate, closedBy, repairedBy, compUsedToRepair, repBrdDate, dcNo,
//   techRemarks, finalRemarks, addNotes, returnDate, returnDcNo, destination,
//   submittedBy, submittedAt, sourceId, sourceCollection
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      entryDate, division, scRefNo, defGirNo, category, model, defBrdModName,
      closedDate, reRepDate, closedBy,
      repairedBy, compUsedToRepair, repBrdDate, dcNo,
      techRemarks, finalRemarks, addNotes,
      returnDate, returnDcNo, destination,
      submittedBy, submittedAt,
      sourceId, sourceCollection,
    } = req.body;

    const safeDivision = cleanDivision(division);

    if (!entryDate || !safeDivision || !scRefNo || !defGirNo || !category || !model || !defBrdModName) {
      return fail(res, 400,
        'Required: entryDate, division, scRefNo, defGirNo, category, model, defBrdModName');
    }

    const doc = await Rtcrr.create({
      entryDate:        new Date(entryDate),
      closedDate:       closedDate   ? new Date(closedDate)   : new Date(),
      reRepDate:        reRepDate    ? new Date(reRepDate)    : new Date(),
      division:         safeDivision,
      scRefNo,
      defGirNo,
      category,
      model,
      defBrdModName,
      status:           'completed',
      closedBy:         closedBy     || '',
      repairedBy:       repairedBy   || '',
      compUsedToRepair: compUsedToRepair || '',
      repBrdDate:       repBrdDate   ? new Date(repBrdDate)   : null,
      dcNo:             dcNo         || '',
      techRemarks:      techRemarks  || '',
      finalRemarks:     finalRemarks || '',
      addNotes:         addNotes     || '',
      returnDate:       returnDate   ? new Date(returnDate)   : null,
      returnDcNo:       returnDcNo   || '',
      destination:      destination  || '',
      submittedBy:      submittedBy  || '',
      submittedAt:      submittedAt  ? new Date(submittedAt)  : null,
      sourceId:         sourceId     || null,
      sourceCollection: sourceCollection || '',
    });

    return res.status(201).json({ success: true, message: 'Closed repair record created', data: doc });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to create record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/rtcrr/:id  (admin only — optional)
// Not exposed in rtcrl.html UI (read-only), but available for admin cleanup.
// In server.js you can protect this with a role-check middleware if needed.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Rtcrr.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'Closed repair record deleted', data: { id: req.params.id } });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
