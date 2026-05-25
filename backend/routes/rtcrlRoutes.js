// routes/rtcrlRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Closed Repair List — Express REST Routes
// Mounted at: /api/rtcrl  (add this line in server.js)
//
// Endpoints called by rtcrl.html:
//   GET  /api/rtcrl              loadData()    — list with filters
//   GET  /api/rtcrl/stats        updateStats() — hero-stat cards
//   GET  /api/rtcrl/export/csv   exportCSV()   — CSV download
//   GET  /api/rtcrl/:id          openDetail()  — single record detail view
//   POST /api/rtcrl              create        — called when marking UR/OB/PFRN complete
//
// NOTE: No PUT or DELETE — closed records are read-only in rtcrl.html.
//       Deletion (if needed by admin) can be added as a separate admin-only route.
//
// NOTE: Auth middleware is applied in server.js (not here), same as rturRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const RTCRL   = require('../models/rtcrlModel');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const fail = (res, code, message, err = null) => {
  if (err) console.error('[RTCRL]', message, err.message);
  return res.status(code).json({ success: false, message, error: err?.message || null });
};

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
// GET /api/rtcrl/stats
// Returns the 4 hero-stat + stat-card numbers shown in rtcrl.html
// MUST be declared before /:id so Express doesn't treat "stats" as an ObjectId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, pfrn, ur, ob, avgDays] = await Promise.all([
      RTCRL.getTotalCount(),
      RTCRL.getPFRNCount(),
      RTCRL.getURCount(),
      RTCRL.getOBCount(),
      RTCRL.getAvgDays(),
    ]);
    return res.json({ success: true, data: { total, pfrn, ur, ob, avgDays } });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch stats', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrl/export/csv
// Triggered by rtcrl.html exportCSV() → 📤 Export button
// MUST be declared before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const filter  = buildFilter(req.query);
    const records = await RTCRL.find(filter).sort({ closedDate: -1 }).lean();

    // Column order matches rtcrl.html exportCSV() headers array
    const cols = [
      'entryDate', 'closedDate', 'division', 'scRefNo', 'defGirNo',
      'category', 'model', 'defBrdModName', 'noOfDays',
      'repairedBy', 'closedBy', 'techRemarks', 'finalRemarks',
      'compUsedToRepair', 'dcNo', 'returnDcNo', 'destination',
    ];
    const header = cols.join(',');
    const rows   = records.map(r => {
      const end     = r.closedDate ? new Date(r.closedDate) : new Date();
      const noOfDays = r.entryDate
        ? Math.max(0, Math.floor((end.getTime() - new Date(r.entryDate).getTime()) / 86400000))
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
      `attachment; filename="RTCRL_Export_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    return fail(res, 500, 'CSV export failed', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrl
// Called by rtcrl.html loadData() on page load and every ⟳ Refresh click.
// Returns: { success, total, page, pages, data: [...] }
// rtcrl.html reads   data.data || data
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 500 } = req.query;
    const filter = buildFilter(req.query);

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await RTCRL.countDocuments(filter);

    const records = await RTCRL
      .find(filter)
      .sort({ closedDate: -1 })
      .skip(skip)
      .limit(Number(limit));         // noOfDays virtual included via toJSON

    return res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data:  records,
    });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch closed repair records', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtcrl/:id
// Called when rtcrl.html opens the detail modal for a record
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await RTCRL.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rtcrl
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
      closedDate, closedBy,
      repairedBy, compUsedToRepair, repBrdDate, dcNo,
      techRemarks, finalRemarks, addNotes,
      returnDate, returnDcNo, destination,
      submittedBy, submittedAt,
      sourceId, sourceCollection,
    } = req.body;

    if (!entryDate || !division || !scRefNo || !defGirNo || !category || !model || !defBrdModName) {
      return fail(res, 400,
        'Required: entryDate, division, scRefNo, defGirNo, category, model, defBrdModName');
    }

    const doc = await RTCRL.create({
      entryDate:        new Date(entryDate),
      closedDate:       closedDate   ? new Date(closedDate)   : new Date(),
      division,
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
// DELETE /api/rtcrl/:id  (admin only — optional)
// Not exposed in rtcrl.html UI (read-only), but available for admin cleanup.
// In server.js you can protect this with a role-check middleware if needed.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await RTCRL.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'Closed repair record deleted', data: { id: req.params.id } });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;