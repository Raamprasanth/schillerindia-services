const express  = require('express');
const router   = express.Router();
const RtOA     = require('../models/RtOtherActivity');
const RtCOA    = require('../models/RtClosedOtherActivity');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

const fail = (res, code, msg, err = null) => {
  if (err) console.error('[RTOA]', msg, err.message);
  return res.status(code).json({ success: false, message: msg, error: err?.message || null });
};

// GET /api/rtoa
router.get('/', async (req, res) => {
  try {
    const records = await RtOA.find().sort({ entryDate: -1 }).lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch records', err);
  }
});

// GET /api/rtoa/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await RtOA.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// POST /api/rtoa
router.post('/', async (req, res) => {
  try {
    const {
      repairedBy, entryDate, division, model, partNumber,
      description, problemObserved, componentsUsed,
      finalRemarks, repairedDate, remarks, status,
    } = req.body;

    if (!repairedBy || !entryDate || !division || !problemObserved) {
      return fail(res, 400, 'Required: repairedBy, entryDate, division, problemObserved');
    }

    const doc = await RtOA.create({
      repairedBy,
      entryDate:    new Date(entryDate),
      division,
      model:        model        || '',
      partNumber:   partNumber   || '',
      description:  description  || '',
      problemObserved,
      componentsUsed: componentsUsed || '',
      finalRemarks:   finalRemarks   || '',
      repairedDate:   repairedDate   ? new Date(repairedDate) : null,
      remarks:        remarks        || '',
      status:         status         || 'Open',
    });

    return res.status(201).json({ success: true, message: 'Activity created', data: doc });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to create record', err);
  }
});

// PUT /api/rtoa/:id
router.put('/:id', async (req, res) => {
  try {
    const record = await RtOA.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    const fields = [
      'repairedBy','division','model','partNumber','description',
      'problemObserved','componentsUsed','finalRemarks','remarks','status',
    ];
    fields.forEach(f => { if (req.body[f] !== undefined) record[f] = req.body[f]; });

    if (req.body.entryDate  !== undefined) record.entryDate   = new Date(req.body.entryDate);
    if (req.body.repairedDate !== undefined)
      record.repairedDate = req.body.repairedDate ? new Date(req.body.repairedDate) : null;

    const saved = await record.save();

    if (saved.status === 'Closed') {
      try {
        await RtCOA.create({
          repairedBy: saved.repairedBy,
          entryDate: saved.entryDate,
          division: saved.division,
          model: saved.model,
          partNumber: saved.partNumber,
          description: saved.description,
          problemObserved: saved.problemObserved,
          componentsUsed: saved.componentsUsed,
          finalRemarks: saved.finalRemarks,
          repairedDate: saved.repairedDate,
          remarks: saved.remarks,
          status: 'Closed',
          closedBy: req.user?.name || '',
          closedDate: new Date(),
          sourceId: saved._id
        });
        await RtOA.findByIdAndDelete(saved._id);
        return res.json({ success: true, message: 'Activity closed and moved to archive' });
      } catch(e) {
        return fail(res, 500, 'Failed to move to archive', e);
      }
    }

    return res.json({ success: true, message: 'Activity updated', data: saved });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to update record', err);
  }
});

// PUT /api/rtoa/:id/close
router.put('/:id/close', async (req, res) => {
  try {
    const record = await RtOA.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    record.status     = 'Closed';
    record.closedBy   = req.body.closedBy   || req.user?.name || '';
    record.closedDate = req.body.closedDate  ? new Date(req.body.closedDate) : new Date();

    const saved = await record.save();
    try {
      await RtCOA.create({
        repairedBy: saved.repairedBy,
        entryDate: saved.entryDate,
        division: saved.division,
        model: saved.model,
        partNumber: saved.partNumber,
        description: saved.description,
        problemObserved: saved.problemObserved,
        componentsUsed: saved.componentsUsed,
        finalRemarks: saved.finalRemarks,
        repairedDate: saved.repairedDate,
        remarks: saved.remarks,
        status: 'Closed',
        closedBy: saved.closedBy,
        closedDate: saved.closedDate,
        sourceId: saved._id
      });
      await RtOA.findByIdAndDelete(saved._id);
      return res.json({ success: true, message: 'Activity closed and moved to archive' });
    } catch(e) {
      return fail(res, 500, 'Failed to move to archive', e);
    }
  } catch (err) {
    return fail(res, 500, 'Failed to close record', err);
  }
});

// DELETE /api/rtoa/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await RtOA.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
