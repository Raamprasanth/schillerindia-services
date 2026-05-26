const express  = require('express');
const router   = express.Router();
const RtCOMR   = require('../models/RtComponentsRequest');
const RtCCR    = require('../models/RtClosedComponentsRequest');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

const fail = (res, code, msg, err = null) => {
  if (err) console.error('[RTCOMR]', msg, err.message);
  return res.status(code).json({ success: false, message: msg, error: err?.message || null });
};

// GET /api/rtcomr
router.get('/', async (req, res) => {
  try {
    const { from, to, division, status } = req.query;
    const filter = {};
    if (division) filter.division = division;
    if (status)   filter.status   = status;
    if (from || to) {
      filter.requestedDate = {};
      if (from) filter.requestedDate.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23,59,59,999); filter.requestedDate.$lte = t; }
    }
    const records = await RtCOMR.find(filter).sort({ requestedDate: -1 }).lean();
    return res.json({ success: true, data: records });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch records', err);
  }
});

// GET /api/rtcomr/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await RtCOMR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');
    return res.json({ success: true, data: record });
  } catch (err) {
    return fail(res, 500, 'Failed to fetch record', err);
  }
});

// POST /api/rtcomr
router.post('/', async (req, res) => {
  try {
    const {
      requestedDate, requested, requestedBy, division, model, description, partNumber, mpnNumber,
      requiredQty, price, piRaisedDate, piApprovedDate, componentsReceivedDate, remarks,
    } = req.body;

    if (!requestedDate || !requested && !requestedBy || !division || !description || !requiredQty) {
      return fail(res, 400, 'Required: requestedDate, requested, division, description, requiredQty');
    }

    const doc = await RtCOMR.create({
      requestedDate:          new Date(requestedDate),
      requested:              requested || requestedBy || '',
      division,
      model:                  model || '',
      description,
      partNumber:             partNumber || mpnNumber || '',
      requiredQty:            parseInt(requiredQty)  || 1,
      price:                  parseFloat(price)      || 0,
      piRaisedDate:           piRaisedDate           ? new Date(piRaisedDate)           : null,
      piApprovedDate:         piApprovedDate         ? new Date(piApprovedDate)         : null,
      componentsReceivedDate: componentsReceivedDate ? new Date(componentsReceivedDate) : null,
      remarks:                remarks                || '',
    });

    return res.status(201).json({ success: true, message: 'Request created', data: doc });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to create record', err);
  }
});

// PUT /api/rtcomr/:id
router.put('/:id', async (req, res) => {
  try {
    const record = await RtCOMR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    const b = req.body;
    if (b.requestedDate          !== undefined) record.requestedDate          = new Date(b.requestedDate);
    if (b.requested              !== undefined) record.requested              = b.requested;
    if (b.requestedBy            !== undefined && b.requested === undefined) record.requested = b.requestedBy;
    if (b.division               !== undefined) record.division               = b.division;
    if (b.model                  !== undefined) record.model                  = b.model;
    if (b.description            !== undefined) record.description            = b.description;
    if (b.partNumber             !== undefined) record.partNumber             = b.partNumber;
    if (b.mpnNumber              !== undefined && b.partNumber === undefined) record.partNumber = b.mpnNumber;
    if (b.requiredQty            !== undefined) record.requiredQty            = parseInt(b.requiredQty) || 1;
    if (b.price                  !== undefined) record.price                  = parseFloat(b.price) || 0;
    if (b.piRaisedDate           !== undefined) record.piRaisedDate           = b.piRaisedDate ? new Date(b.piRaisedDate) : null;
    if (b.piApprovedDate         !== undefined) record.piApprovedDate         = b.piApprovedDate ? new Date(b.piApprovedDate) : null;
    if (b.componentsReceivedDate !== undefined) record.componentsReceivedDate = b.componentsReceivedDate ? new Date(b.componentsReceivedDate) : null;
    if (b.remarks                !== undefined) record.remarks                = b.remarks;
    if (b.status                 !== undefined) record.status                 = b.status;
    if (b.fulfilledBy            !== undefined) record.fulfilledBy            = b.fulfilledBy;
    if (b.fulfilledDate          !== undefined) record.fulfilledDate          = b.fulfilledDate ? new Date(b.fulfilledDate) : null;

    const saved = await record.save();

    if (saved.status === 'Fulfilled' || saved.status === 'Rejected') {
      try {
        await RtCCR.create({
          requestedDate: saved.requestedDate,
          requested: saved.requested,
          division: saved.division,
          model: saved.model,
          description: saved.description,
          partNumber: saved.partNumber,
          requiredQty: saved.requiredQty,
          price: saved.price,
          piRaisedDate: saved.piRaisedDate,
          piApprovedDate: saved.piApprovedDate,
          componentsReceivedDate: saved.componentsReceivedDate,
          remarks: saved.remarks,
          status: saved.status,
          fulfilledBy: saved.fulfilledBy || req.user?.name || '',
          fulfilledDate: saved.fulfilledDate || new Date(),
          sourceId: saved._id
        });
        await RtCOMR.findByIdAndDelete(saved._id);
        return res.json({ success: true, message: `Request ${saved.status} and moved to archive` });
      } catch(e) {
        return fail(res, 500, 'Failed to move to archive', e);
      }
    }

    return res.json({ success: true, message: 'Request updated', data: saved });
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message, err);
    return fail(res, 500, 'Failed to update record', err);
  }
});

// PUT /api/rtcomr/:id/fulfill  (Fulfill action from Rtcomr.html)
router.put('/:id/fulfill', async (req, res) => {
  try {
    const record = await RtCOMR.findById(req.params.id);
    if (!record) return fail(res, 404, 'Record not found');

    record.status        = 'Fulfilled';
    record.fulfilledBy   = req.body.fulfilledBy   || req.user?.name || '';
    record.fulfilledDate = req.body.fulfilledDate  ? new Date(req.body.fulfilledDate) : new Date();

    const saved = await record.save();
    try {
      await RtCCR.create({
        requestedDate: saved.requestedDate,
        requested: saved.requested,
        division: saved.division,
        model: saved.model,
        description: saved.description,
        partNumber: saved.partNumber,
        requiredQty: saved.requiredQty,
        price: saved.price,
        piRaisedDate: saved.piRaisedDate,
        piApprovedDate: saved.piApprovedDate,
        componentsReceivedDate: saved.componentsReceivedDate,
        remarks: saved.remarks,
        status: saved.status,
        fulfilledBy: saved.fulfilledBy,
        fulfilledDate: saved.fulfilledDate,
        sourceId: saved._id
      });
      await RtCOMR.findByIdAndDelete(saved._id);
      return res.json({ success: true, message: 'Request fulfilled and moved to archive' });
    } catch(e) {
      return fail(res, 500, 'Failed to move to archive', e);
    }
  } catch (err) {
    return fail(res, 500, 'Failed to fulfill request', err);
  }
});

// DELETE /api/rtcomr/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await RtCOMR.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Record not found');
    return res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    return fail(res, 500, 'Failed to delete record', err);
  }
});

module.exports = router;
