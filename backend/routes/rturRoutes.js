// routes/rturRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Repair Activity UR — Express REST Routes
// Mounted at: /api/rtur  (add this in server.js)
//
// Endpoints called by rtur.html:
//   GET    /api/rtur              loadData()      — list with filters
//   GET    /api/rtur/stats        updateStats()   — hero-stat cards
//   GET    /api/rtur/export/csv   exportCSV()     — CSV download
//   GET    /api/rtur/:id          openUpdate()    — single record
//   POST   /api/rtur              submitAdd()     — create
//   PUT    /api/rtur/:id          submitUpdate()  — update
//   DELETE /api/rtur/:id          deleteRecord()  — delete
// ─────────────────────────────────────────────────────────────────────────────

const express    = require('express');
const router     = express.Router();
const RTUR       = require('../models/rturModel');
const RTCRL      = require('../models/rtcrlModel');
const Service    = require('../models/Service');

// ── Import your existing auth middleware (adjust path if needed) ────────────
// This should be the same middleware used by rtob.html / rtfrn.html routes.
const { protect, repairTeamOrAdmin } = require('../middleware/authMiddleware');

// Apply JWT auth to all RTUR routes
router.use(protect, repairTeamOrAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const fail = (res, code, message, err = null) => {
  if (err) console.error('[RTUR]', message, err.message);
  return res.status(code).json({ success: false, message, error: err?.message || null });
};

function isMongoId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

function cleanDivisionName(value) {
  if (value && typeof value === 'object') {
    return cleanDivisionName(value.name || value.displayName || '');
  }
  const text = String(value || '').trim();
  if (!text || isMongoId(text)) return '';
  if (/^others?$/i.test(text)) return '';
  return text.toUpperCase();
}

async function serviceDivisionMap(records = []) {
  const ids = [...new Set(records
    .map((record) => String(record.sourceServiceId || '').trim())
    .filter((id) => isMongoId(id)))];
  if (!ids.length) return new Map();

  const services = await Service.find({ _id: { $in: ids } })
    .select('division divisionName divisionDisplayName branch reg')
    .populate('division', 'name displayName')
    .lean();

  return new Map(services.map((svc) => [
    String(svc._id),
    cleanDivisionName(svc.division?.name)
      || cleanDivisionName(svc.division?.displayName)
      || cleanDivisionName(svc.divisionName)
      || cleanDivisionName(svc.divisionDisplayName)
      || cleanDivisionName(svc.branch)
      || cleanDivisionName(svc.reg),
  ]));
}

async function normalizeRecordDivisions(records = []) {
  const plain = records.map((record) => (record.toObject ? record.toObject() : record));
  const sourceMap = await serviceDivisionMap(plain);
  return plain.map((record) => {
    const current = cleanDivisionName(record.division);
    const fromService = sourceMap.get(String(record.sourceServiceId || '')) || '';
    return {
      ...record,
      division: current || fromService || record.division || 'OTHER',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtur/stats
// Returns the four numbers shown in the hero banner + stat cards:
//   total, pending, critical (>30 days), completed
// NOTE: this route must be declared BEFORE /:id so Express doesn't treat
// "stats" as an ObjectId.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, critical, completed, avgDays] = await Promise.all([
      RTUR.countDocuments(),
      RTUR.getPendingCount(),
      RTUR.getCriticalCount(),
      RTUR.getCompletedCount(),
      RTUR.getAverageDays(),
    ]);
    return res.json({ success: true, data: { total, pending, critical, completed, avgDays } });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch stats', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtur/export/csv
// Streams all (optionally filtered) records as a CSV file download.
// rtur.html exportCSV() calls this when the user clicks 📤 Export.
// NOTE: also declared before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    // Reuse the same filter logic as GET /api/rtur
    const filter = buildFilter(req.query);
    const records = await RTUR.find(filter).sort({ entryDate: -1 }).lean();

    // Column order matches rtur.html exportCSV() headers array
    const cols = [
      'entryDate', 'division', 'scRefNo', 'defGirNo', 'category',
      'model', 'defBrdModName', 'noOfDays', 'status',
      'submittedBy', 'repairedBy', 'compUsedToRepair',
      'techRemarks', 'finalRemarks', 'addNotes',
      'dcNo', 'returnDate', 'returnDcNo', 'destination',
    ];
    const header = cols.join(',');
    const rows   = records.map(r => {
      // Attach calculated noOfDays for CSV
      const noOfDays = r.entryDate
        ? Math.max(0, Math.floor((Date.now() - new Date(r.entryDate).getTime()) / 86400000))
        : 0;
      return cols.map(c => {
        let val = c === 'noOfDays' ? noOfDays : (r[c] ?? '');
        if (val instanceof Date) val = val.toISOString().slice(0, 10);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="RTUR_Export_${new Date().toISOString().slice(0,10)}.csv"`);
    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    return fail(res, 500, 'CSV export failed', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FILTER BUILDER
// Converts rtur.html query params → Mongoose filter object
//
// Params sent by loadData() fetch URL:
//   from, to      → entryDate range  (fl-from / fl-to)
//   division      → division         (fl-div)
//   status        → status           (fl-status; "critical" is handled client-side)
//   category      → category         (fl-category)
//   page, limit   → pagination
// ─────────────────────────────────────────────────────────────────────────────
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

  // "critical" is a client-side derived state (noOfDays > 30 && not completed)
  // so we skip it here and let the frontend handle it
  if (status && status !== 'critical') filter.status   = status;
  if (division)                         filter.division = division;
  if (category)                         filter.category = category;

  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtur
// Called by rtur.html loadData() on page load and every Refresh click.
// Returns array directly (rtur.html reads data.data || data).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 500 } = req.query;         // default 500 — frontend paginates itself
    const filter = buildFilter(req.query);

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await RTUR.countDocuments(filter);

    const records = await RTUR
      .find(filter)
      .sort({ entryDate: -1 })
      .skip(skip)
      .limit(Number(limit));                              // toJSON virtuals include noOfDays
    const normalizedRecords = await normalizeRecordDivisions(records);

    return res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data:  normalizedRecords,
    });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch RTUR records', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rtur/:id
// Used if you want to fetch a single record by ObjectId (openUpdate detail view)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await RTUR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    const [normalizedRecord] = await normalizeRecordDivisions([record]);
    return res.json({ success: true, data: normalizedRecord });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rtur
// Called by rtur.html submitAdd() — Add Panel "💾 Save UR Record"
//
// Expected body (from submitAdd payload):
//   entryDate, division, scRefNo, defGirNo, category,
//   model, defBrdModName, status, submittedBy, submittedAt
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      entryDate, division, scRefNo, defGirNo, category,
      model, defBrdModName, status,
      submittedBy, submittedAt, sourceServiceId,
      doi, fieldRemarks, techRemarks,
    } = req.body;

    // Validate required fields (mirrors the if-check in rtur.html submitAdd)
    if (!entryDate || !division || !scRefNo || !defGirNo || !model || !defBrdModName) {
      return fail(res, 400, 'Required fields missing: entryDate, division, scRefNo, defGirNo, model, defBrdModName');
    }

    let serviceDoi = '';
    let serviceFieldRemarks = '';
    let serviceDivision = '';
    if (((!doi || !fieldRemarks) || !cleanDivisionName(division)) && sourceServiceId) {
      try {
        const svc = await Service.findById(sourceServiceId)
          .select('doi fieldRemarks division divisionName divisionDisplayName branch reg')
          .populate('division', 'name displayName')
          .lean();
        serviceDoi = svc?.doi || '';
        serviceFieldRemarks = svc?.fieldRemarks || '';
        serviceDivision = cleanDivisionName(svc?.division?.name)
          || cleanDivisionName(svc?.division?.displayName)
          || cleanDivisionName(svc?.divisionName)
          || cleanDivisionName(svc?.divisionDisplayName)
          || cleanDivisionName(svc?.branch)
          || cleanDivisionName(svc?.reg);
      } catch (_) {}
    }

    const doc = await RTUR.create({
      entryDate:    new Date(entryDate),
      rpDate:       req.body.rpDate || req.body.submittedAt || new Date().toISOString(),
      division: cleanDivisionName(division) || serviceDivision || 'OTHER',
      scRefNo,
      defGirNo,
      category:     category  || 'UR',
      model,
      defBrdModName,
      status:       status    || 'pending',
      submittedBy:  submittedBy || '',
      submittedAt:  submittedAt ? new Date(submittedAt) : new Date(),
      sourceServiceId: sourceServiceId || '',
      doi: doi || serviceDoi || '',
      fieldRemarks: fieldRemarks || serviceFieldRemarks || '',
      techRemarks:  techRemarks  || '',
    });

    return res.status(201).json({ success: true, message: 'RTUR record created', data: doc });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to create record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rtur/:id
// Called by rtur.html submitUpdate() — Update Modal "💾 Save Update"
//
// Expected body (from submitUpdate payload):
//   repairedBy, status, category, entryDate (initiateddate),
//   compUsedToRepair, repBrdDate, dcNo,
//   techRemarks, finalRemarks, addNotes,
//   returnDate, returnDcNo, destination,
//   updatedBy, updatedAt
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const record = await RTUR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    const {
      repairedBy, status, category, entryDate,
      compUsedToRepair, repBrdDate, dcNo,
      techRemarks, finalRemarks, repairRemarks, cost, timeTaken, repairStatus, addNotes,
      returnDate, returnDcNo, destination,
      doi, fieldRemarks, repairedDate,
      updatedBy, updatedAt,
    } = req.body;

    // Only overwrite fields that were actually sent
    if (repairedBy   !== undefined) record.repairedBy        = repairedBy;
    if (status       !== undefined) record.status            = status;
    if (category     !== undefined) record.category          = category;
    if (entryDate    !== undefined) record.entryDate         = new Date(entryDate);
    if (compUsedToRepair !== undefined) record.compUsedToRepair = compUsedToRepair;
    if (repBrdDate   !== undefined) record.repBrdDate        = repBrdDate ? new Date(repBrdDate) : null;
    if (repairedDate !== undefined) record.repairedDate      = repairedDate || '';
    if (dcNo         !== undefined) record.dcNo              = dcNo;
    if (doi          !== undefined) record.doi               = doi;
    if (fieldRemarks !== undefined) record.fieldRemarks      = fieldRemarks;
    if (techRemarks  !== undefined) record.techRemarks       = techRemarks;
    if (finalRemarks !== undefined) record.finalRemarks      = finalRemarks;
    if (repairRemarks !== undefined) {
      record.repairRemarks = repairRemarks;
    }
    if (cost         !== undefined) record.cost              = cost;
    if (timeTaken    !== undefined) record.timeTaken         = timeTaken;
    if (repairStatus !== undefined) record.repairStatus      = repairStatus;
    if (addNotes     !== undefined) record.addNotes          = addNotes;
    if (returnDate   !== undefined) record.returnDate        = returnDate  ? new Date(returnDate)  : null;
    if (returnDcNo   !== undefined) record.returnDcNo        = returnDcNo;
    if (destination  !== undefined) record.destination       = destination;
    if (updatedBy    !== undefined) record.updatedBy         = updatedBy;
    if (updatedAt    !== undefined) record.updatedAt         = updatedAt ? new Date(updatedAt) : new Date();

    const saved = await record.save();   // triggers pre-save hook

    // ── On completion: copy to RTCRL then delete RTUR ──
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
          repairRemarks:    saved.repairRemarks || '',
          cost:             saved.cost || '',
          timeTaken:        saved.timeTaken || '',
          repairStatus:     saved.repairStatus || '',
          doi:              saved.doi || '',
          repairedDate:     saved.repairedDate || '',
          components:       saved.components || saved.compUsedToRepair || '',

            },
          }
        );
      } catch (svcErr) {
        console.error('RTUR → Service sync failed:', svcErr.message);
      }

      try {
        await RTCRL.create({
          entryDate:        saved.entryDate ? new Date(saved.entryDate) : new Date(),
          rpDate:           saved.rpDate || '',
          closedDate:       new Date(),
          division:         saved.division,
          scRefNo:          saved.scRefNo,
          defGirNo:         saved.defGirNo,
          category:         saved.category || 'UR',
          model:            saved.model,
          defBrdModName:    saved.defBrdModName,
          status:           'completed',
          closedBy:         saved.updatedBy || req.user?.name || '',
          repairedBy:       saved.repairedBy       || '',
          compUsedToRepair: saved.compUsedToRepair  || '',
          techRemarks:      saved.techRemarks       || '',
          repairRemarks:    saved.repairRemarks || '',
          cost:             saved.cost || '',
          timeTaken:        saved.timeTaken || '',
          repairStatus:     saved.repairStatus || '',
          doi:              saved.doi || '',
          repairedDate:     saved.repairedDate || '',
          components:       saved.components || saved.compUsedToRepair || '',

          finalRemarks:     saved.finalRemarks      || '',
          submittedBy:      saved.submittedBy       || '',
          submittedAt:      saved.submittedAt       || null,
          sourceId:         saved._id,
          sourceCollection: 'rtur',
        });
      } catch (crlErr) {
        console.error('RTUR → RTCRL copy failed:', crlErr.message);
      }

      await RTUR.findByIdAndDelete(saved._id);
      return res.json({ success: true, completed: true, message: 'Repair completed and moved to RTCRL.' });
    }

    return res.json({ success: true, message: 'RTUR record updated', data: saved });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to update record', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/rtur/:id
// Called by rtur.html deleteRecord()
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await RTUR.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'RTUR record deleted', data: { id: req.params.id } });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
