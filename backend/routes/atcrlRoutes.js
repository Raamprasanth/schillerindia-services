// routes/atcrlRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin Closed Repair List — Express REST Routes
// Mounted at: /api/atcrl  (in server.js)
//
// Reads from the SAME 'rtcrls' collection as rtcrlRoutes.js.
// All entries made in RTCRL (Repair Team) are visible here in ATCRL (Admin).
//
// Endpoints called by Atcrl.html:
//   GET  /api/atcrl              loadData()    — list with filters
//   GET  /api/atcrl/stats        updateStats() — hero-stat cards
//   GET  /api/atcrl/export/csv   exportCSV()   — CSV download
//   GET  /api/atcrl/:id          openDetail()  — single record detail view
//
// NOTE: Admin view is READ-ONLY (no POST/PUT/DELETE here).
//       Repair Team creates records via /api/rtcrl.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const ATCRL   = require('../models/atcrlModel');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const fail = (res, code, message, err = null) => {
  if (err) console.error('[ATCRL]', message, err.message);
  return res.status(code).json({ success: false, message, error: err?.message || null });
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FILTER BUILDER
// Converts atcrl.html query params → Mongoose filter object
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

  if (closedBy) filter.closedBy = { $regex: closedBy, $options: 'i' };

  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/atcrl/stats
// MUST be declared before /:id so Express doesn't treat "stats" as an ObjectId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, pfrn, ur, ob, avgDays] = await Promise.all([
      ATCRL.getTotalCount(),
      ATCRL.getPFRNCount(),
      ATCRL.getURCount(),
      ATCRL.getOBCount(),
      ATCRL.getAvgDays(),
    ]);
    return res.json({ success: true, data: { total, pfrn, ur, ob, avgDays } });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch stats', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/atcrl/export/csv
// MUST be declared before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const filter  = buildFilter(req.query);
    const records = await ATCRL.find(filter).sort({ closedDate: -1 }).lean();

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
      `attachment; filename="ATCRL_Export_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    return fail(res, 500, 'CSV export failed', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/atcrl
// Returns: { success, total, page, pages, data: [...] }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 500 } = req.query;
    const filter = buildFilter(req.query);

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await ATCRL.countDocuments(filter);

    const records = await ATCRL
      .find(filter)
      .sort({ closedDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data:  records,
    });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch admin closed repair records', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/atcrl/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await ATCRL.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/atcrl/:id
// Admin delete route for Closed Repair Lists
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const record = await ATCRL.findByIdAndDelete(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
