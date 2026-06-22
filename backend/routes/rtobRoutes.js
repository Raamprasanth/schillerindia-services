// routes/rtobRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
//  Repair Team — OB Pending Routes
//
//  Endpoints:
//    GET    /api/rtob              → All records (admin)
//    GET    /api/rtob/employee     → Records submitted by logged-in user (repair/employee)
//    GET    /api/rtob/stats        → Summary stats (total, pending, critical, completed)
//    GET    /api/rtob/:id          → Single record by ID
//    POST   /api/rtob              → Create new OB record
//    PUT    /api/rtob/:id          → Update record (full or partial)
//    DELETE /api/rtob/:id          → Delete record
// ─────────────────────────────────────────────────────────────────────────────

const router            = require('express').Router();
const mongoose          = require('mongoose');
const RTOB              = require('../models/RTOB');
const RTCRL             = require('../models/rtcrlModel');
const Service           = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');
const { protect }       = require('../middleware/authMiddleware');
const EmpFRN            = require('../models/EmpFRN');

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

function hydrate(docs) {
  return docs.map(d => {
    const obj = d.toObject ? d.toObject() : { ...d };
    obj.noOfDays = RTOB.calcDays(obj.entryDate);
    return obj;
  });
}

function employeeFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (!user || role === 'admin' || role === 'repair' || role === 'repair_team') return {};
  const name = user.name || '';
  return {
    $or: [
      { submittedBy: name },
      { raEng:       name },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/rtob/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const filter = employeeFilter(req.user);

    const [total, pending, inprogress, completed, onHold] = await Promise.all([
      RTOB.countDocuments(filter),
      RTOB.countDocuments({ ...filter, status: 'pending' }),
      RTOB.countDocuments({ ...filter, status: 'inprogress' }),
      RTOB.countDocuments({ ...filter, status: 'completed' }),
      RTOB.countDocuments({ ...filter, status: 'on_hold' }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const critical = await RTOB.countDocuments({
      ...filter,
      status: { $in: ['pending', 'inprogress'] },
      entryDate: { $lte: thirtyDaysAgo },
    });

    res.json({ total, pending, inprogress, completed, onHold, critical });
  } catch (err) {
    console.error('RTOB stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/rtob/employee
// ─────────────────────────────────────────────────────────────────────────────
router.get('/employee', protect, async (req, res) => {
  try {
    const filter = employeeFilter(req.user);
    const records = await RTOB.find(filter).sort({ createdAt: -1 });
    res.json(await attachActualDivisions(hydrate(records)));
  } catch (err) {
    console.error('RTOB employee fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/rtob
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const match = {};
    if (req.query.division) match.division = req.query.division;
    if (req.query.status)   match.status   = req.query.status;
    if (req.query.obType)   match.obType   = req.query.obType;
    if (req.query.from || req.query.to) {
      match.entryDate = {};
      if (req.query.from) match.entryDate.$gte = req.query.from;
      if (req.query.to)   match.entryDate.$lte = req.query.to;
    }

    const baseFilter = req.user.role === 'admin' ? {} : employeeFilter(req.user);
    const filter = { ...baseFilter, ...match };

    const records = await RTOB.find(filter).sort({ createdAt: -1 });
    res.json(await attachActualDivisions(hydrate(records)));
  } catch (err) {
    console.error('RTOB fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/rtob/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const record = await RTOB.findById(req.params.id);
    if (!record)
      return res.status(404).json({ message: 'RT OB record not found.' });

    const hydrated = hydrate([record]);
    const attached = await attachActualDivisions(hydrated);
    res.json(attached[0]);
  } catch (err) {
    console.error('RTOB get-by-id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/rtob
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    const repairTeamEntryDate = new Date().toISOString().split('T')[0];

    body.submittedBy = req.user.name || body.submittedBy || '';
    body.submittedAt = body.submittedAt || new Date().toISOString();
    body.entryDate   = repairTeamEntryDate;
    body.category    = 'OB';
    body.rpDate      = body.rpDate || body.submittedAt || new Date().toISOString();
    body.noOfDays    = RTOB.calcDays(body.entryDate);

    if ((!body.doi || !body.fieldRemarks) && body.sourceId && mongoose.Types.ObjectId.isValid(String(body.sourceId))) {
      try {
        const SourceModel = body.sourceCollection === 'estimation' ? EstimationPending : Service;
        const source = await SourceModel.findById(body.sourceId).lean();
        let serviceDoc = source;
        if (body.sourceCollection === 'estimation' && source?.serviceId) {
          serviceDoc = await Service.findById(source.serviceId).lean();
        }
        body.doi          = body.doi          || serviceDoc?.doi          || '';
        body.fieldRemarks = body.fieldRemarks || serviceDoc?.fieldRemarks || '';
      } catch (srcErr) {
        console.error('RTOB service DOI/remarks lookup failed:', srcErr.message);
      }
    }

    const required = ['entryDate', 'division', 'scRefNo', 'defGirNo', 'model', 'defBrdModName'];
    const missing  = required.filter(f => !body[f] || String(body[f]).trim() === '');
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    const record = await RTOB.create(body);

    if (body.sourceId && mongoose.Types.ObjectId.isValid(String(body.sourceId))) {
      const SourceModel = body.sourceCollection === 'estimation' ? EstimationPending : Service;
      try {
        await SourceModel.findByIdAndUpdate(body.sourceId, {
          rtobSent:    true,
          rtobSentAt:  body.submittedAt,
        });
      } catch (srcErr) {
        console.error('RTOB → source rtobSent flag failed:', srcErr.message);
      }
    }

    res.status(201).json(hydrate([record])[0]);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    console.error('RTOB create error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/rtob/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const existing = await RTOB.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ message: 'RT OB record not found.' });

    const repairRoles = ['admin', 'repair', 'repair_team'];
    if (!repairRoles.includes(req.user.role)) {
      const name = req.user.name || '';
      if (existing.submittedBy !== name && existing.raEng !== name) {
        return res.status(403).json({ message: 'You can only update your own records.' });
      }
    }

    const body = { ...req.body };
    if (body.division !== undefined) {
      body.division = cleanDivision(body.division, existing.division);
    }

    body.updatedBy = req.user.name || '';
    body.updatedAt = new Date().toISOString();
    delete body.submittedBy;
    delete body.submittedAt;

    if (body.entryDate) {
      body.noOfDays = RTOB.calcDays(body.entryDate);
    }

    const updated = await RTOB.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: false }
    );

    // ── On completion: copy to RTCRL then delete RTOB ──
    if (body.status === 'completed') {
      try {
        await RTCRL.create({
          entryDate:        updated.entryDate ? new Date(updated.entryDate) : new Date(),
          rpDate:           updated.rpDate || '',
          closedDate:       new Date(),
          division:         cleanDivision(updated.division, existing.division),
          scRefNo:          updated.scRefNo,
          defGirNo:         updated.defGirNo,
          category:         'OB',
          model:            updated.model,
          defBrdModName:    updated.defBrdModName,
          status:           'completed',
          closedBy:         body.updatedBy || req.user?.name || '',
          repairedBy:       updated.repairedBy   || '',
          compUsedToRepair: updated.components   || '',
          techRemarks:      updated.techRemarks  || '',
          repairRemarks:    updated.repairRemarks || '',
          cost:             updated.cost         || '',
          timeTaken:        updated.timeTaken    || '',
          repairStatus:     updated.repairStatus || '',
          doi:              updated.doi          || '',
          repairedDate:     updated.repairedDate || '',
          components:       updated.components   || '',
          finalRemarks:     updated.finalRemarks || '',
          submittedBy:      updated.submittedBy  || '',
          submittedAt:      updated.submittedAt  || null,
          sourceId:         updated._id,
          sourceCollection: 'rtob',
        });
      } catch (crlErr) {
        console.error('RTOB → RTCRL copy failed:', crlErr.message);
      }

      await RTOB.findByIdAndDelete(updated._id);

      // Mark the source employee record as RC (Repair Completed)
      // Use body.sourceCollection as fallback since Mongoose may not reliably
      // return non-schema extra fields via the updated document even with strict:false
      const sourceId         = (updated.sourceId         || body.sourceId         || '').toString();
      const sourceCollection =  updated.sourceCollection || body.sourceCollection || '';

      if (sourceId && mongoose.Types.ObjectId.isValid(sourceId)) {
        const rcFields = {
          rtobSent:           true,
          rtobCompleted:      true,
          rtobCompletedAt:    new Date().toISOString(),
          components:         updated.components    || body.components    || '',
          obComponents:       updated.components    || body.components    || '',
          techRemarks:        updated.techRemarks   || '',
          repairRemarks:      updated.repairRemarks || '',
          finalRemarks:       updated.finalRemarks  || '',
          repairStatus:       updated.repairStatus  || '',
        };
        try {
          if (sourceCollection === 'estimation') {
            await EstimationPending.findByIdAndUpdate(sourceId, rcFields);
          } else if (sourceCollection === 'service') {
            await Service.findByIdAndUpdate(sourceId, rcFields);
          } else {
            // sourceCollection unknown — update both models defensively
            await EstimationPending.findByIdAndUpdate(sourceId, rcFields);
            await Service.findByIdAndUpdate(sourceId, rcFields);
          }
        } catch (srcErr) {
          console.error('RTOB → source RC flag failed:', srcErr.message);
        }
      }

      return res.json({ success: true, completed: true, message: 'Repair completed and moved to RTCRL.' });
    }

    res.json(hydrate([updated])[0]);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    console.error('RTOB update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/rtob/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const existing = await RTOB.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ message: 'RT OB record not found.' });

    if (req.user.role !== 'admin') {
      const name = req.user.name || '';
      if (existing.submittedBy !== name) {
        return res.status(403).json({ message: 'You can only delete your own records.' });
      }
    }

    await RTOB.findByIdAndDelete(req.params.id);
    res.json({ message: 'RT OB record deleted successfully.', id: req.params.id });
  } catch (err) {
    console.error('RTOB delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
