// routes/atobRoutes.js
// Admin RT OB API — same collection as /api/rtob (`rtob`).
//
//  GET    /api/atob/stats   ? summary counts (admin)
//  GET    /api/atob         ? all records (admin)
//  GET    /api/atob/:id     ? one record (admin)
//  POST   /api/atob         ? create (admin)
//  PUT    /api/atob/:id     ? update (admin)
//  DELETE /api/atob/:id     ? delete (admin)

const router = require('express').Router();
const mongoose = require('mongoose');
const ATOB = require('../models/atobModel');
const RTCRL = require('../models/rtcrlModel');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');
const EmpFRN = require('../models/EmpFRN');
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
    console.error('ATOB attachActualDivisions error:', err.message);
  }

  for (const r of records) {
    let actualDiv = null;
    if (r.scRefNo) actualDiv = map['SC_' + String(r.scRefNo).toUpperCase()];
    if (!actualDiv && r.defGirNo) actualDiv = map['GIR_' + String(r.defGirNo).toUpperCase()];
    if (actualDiv) r.division = actualDiv;
  }
  return records;
}

function hydrate(docs) {
  return docs.map((d) => {
    const obj = d.toObject ? d.toObject() : { ...d };
    obj.noOfDays = ATOB.calcDays(obj.entryDate);
    return obj;
  });
}

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    const [total, pending, inprogress, completed, onHold] = await Promise.all([
      ATOB.countDocuments(filter),
      ATOB.countDocuments({ ...filter, status: 'pending' }),
      ATOB.countDocuments({ ...filter, status: 'inprogress' }),
      ATOB.countDocuments({ ...filter, status: 'completed' }),
      ATOB.countDocuments({ ...filter, status: 'on_hold' }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const critical = await ATOB.countDocuments({
      ...filter,
      status: { $in: ['pending', 'inprogress'] },
      entryDate: { $lte: thirtyDaysAgo },
    });

    res.json({ total, pending, inprogress, completed, onHold, critical });
  } catch (err) {
    console.error('ATOB stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const match = {};
    if (req.query.division) match.division = req.query.division;
    if (req.query.status) match.status = req.query.status;
    if (req.query.obType) match.obType = req.query.obType;
    if (req.query.from || req.query.to) {
      match.entryDate = {};
      if (req.query.from) match.entryDate.$gte = req.query.from;
      if (req.query.to) match.entryDate.$lte = req.query.to;
    }

    const records = await ATOB.find(match).sort({ createdAt: -1 });
    res.json(await attachActualDivisions(hydrate(records)));
  } catch (err) {
    console.error('ATOB fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const record = await ATOB.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'AT OB record not found.' });

    const hydrated = hydrate([record]);
    const attached = await attachActualDivisions(hydrated);
    res.json(attached[0]);
  } catch (err) {
    console.error('ATOB get-by-id error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const body = { ...req.body };

    body.submittedBy = req.user.name || body.submittedBy || '';
    body.submittedAt = body.submittedAt || new Date().toISOString();
    body.category = 'OB';
    body.noOfDays = ATOB.calcDays(body.entryDate);

    if ((!body.doi || !body.fieldRemarks) && body.sourceId && mongoose.Types.ObjectId.isValid(String(body.sourceId))) {
      try {
        const SourceModel = body.sourceCollection === 'estimation' ? EstimationPending : Service;
        const source = await SourceModel.findById(body.sourceId).lean();
        let serviceDoc = source;
        if (body.sourceCollection === 'estimation' && source?.serviceId) {
          serviceDoc = await Service.findById(source.serviceId).lean();
        }
        body.doi = body.doi || serviceDoc?.doi || '';
        body.fieldRemarks = body.fieldRemarks || serviceDoc?.fieldRemarks || '';
      } catch (srcErr) {
        console.error('ATOB service DOI/remarks lookup failed:', srcErr.message);
      }
    }

    const required = ['entryDate', 'division', 'scRefNo', 'defGirNo', 'model', 'defBrdModName'];
    const missing = required.filter((f) => !body[f] || String(body[f]).trim() === '');
    if (missing.length) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const record = await ATOB.create(body);

    if (body.sourceId && mongoose.Types.ObjectId.isValid(String(body.sourceId))) {
      const SourceModel = body.sourceCollection === 'estimation' ? EstimationPending : Service;
      try {
        await SourceModel.findByIdAndUpdate(body.sourceId, {
          rtobSent: true,
          rtobSentAt: body.submittedAt,
        });
      } catch (srcErr) {
        console.error('ATOB ? source rtobSent flag failed:', srcErr.message);
      }
    }

    res.status(201).json(hydrate([record])[0]);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ message: messages });
    }
    console.error('ATOB create error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const existing = await ATOB.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'AT OB record not found.' });

    const body = { ...req.body };
    body.updatedBy = req.user.name || '';
    body.updatedAt = new Date().toISOString();
    delete body.submittedBy;
    delete body.submittedAt;

    if (body.entryDate) {
      body.noOfDays = ATOB.calcDays(body.entryDate);
    }

    const updated = await ATOB.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: false,
    });

    if (body.status === 'completed') {
      try {
        await RTCRL.create({
          entryDate: updated.entryDate ? new Date(updated.entryDate) : new Date(),
          closedDate: new Date(),
          division: updated.division,
          scRefNo: updated.scRefNo,
          defGirNo: updated.defGirNo,
          category: 'OB',
          model: updated.model,
          defBrdModName: updated.defBrdModName,
          status: 'completed',
          closedBy: body.updatedBy || req.user?.name || '',
          repairedBy: updated.repairedBy || '',
          compUsedToRepair: updated.components || '',
          techRemarks: updated.techRemarks || '',
          finalRemarks: updated.finalRemarks || '',
          submittedBy: updated.submittedBy || '',
          submittedAt: updated.submittedAt || null,
          sourceId: updated._id,
          sourceCollection: 'rtob',
        });
      } catch (crlErr) {
        console.error('ATOB ? RTCRL copy failed:', crlErr.message);
      }

      await ATOB.findByIdAndDelete(updated._id);

      if (updated.sourceId && mongoose.Types.ObjectId.isValid(updated.sourceId)) {
        const SourceModel = updated.sourceCollection === 'estimation' ? EstimationPending : Service;
        try {
          await SourceModel.findByIdAndUpdate(updated.sourceId, {
            rtobSent: true,
            rtobCompleted: true,
            rtobCompletedAt: new Date().toISOString(),
          });
        } catch (srcErr) {
          console.error('ATOB ? source RC flag failed:', srcErr.message);
        }
      }

      return res.json({
        success: true,
        completed: true,
        message: 'Repair completed and moved to RTCRL.',
      });
    }

    res.json(hydrate([updated])[0]);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ message: messages });
    }
    console.error('ATOB update error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid record ID.' });

    const existing = await ATOB.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'AT OB record not found.' });

    await ATOB.findByIdAndDelete(req.params.id);
    res.json({ message: 'AT OB record deleted successfully.', id: req.params.id });
  } catch (err) {
    console.error('ATOB delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
