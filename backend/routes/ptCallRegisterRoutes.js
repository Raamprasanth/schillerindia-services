const express = require('express');
const router = express.Router();
const PtCallRegister = require('../models/PtCallRegister');
const PtClose = require('../models/PtClose');
const { protect } = require('../middleware/authMiddleware');

function getUserDivisions(user) {
  const values = Array.isArray(user?.divisions) ? [...user.divisions] : [];
  if (user?.division) values.push(user.division);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

const ALLOWED_STATUSES = ['Pending', 'Closed', 'Escalated'];
const ALLOWED_COMM_TYPES = ['Phone', 'WhatsApp', 'Email', 'In-Person', 'Video Call'];

function normalizePayload(body = {}) {
  const payload = { ...body };
  if (!ALLOWED_STATUSES.includes(payload.status)) payload.status = 'Pending';
  return payload;
}

function validateRequired(payload) {
  if (!payload.commType || !ALLOWED_COMM_TYPES.includes(payload.commType)) {
    return 'Communication Type is required.';
  }
  if (!ALLOWED_STATUSES.includes(payload.status)) {
    return 'Valid status is required.';
  }
  return '';
}

// Temporary route to backfill userId
router.get('/fix-userid', async (req, res) => {
  try {
    const User = require('../models/User');
    const calls = await PtCallRegister.find({ $or: [{ userId: { $exists: false } }, { userId: null }] });
    let updated = 0;
    for (const call of calls) {
      if (call.submittedBy) {
        const user = await User.findOne({ name: new RegExp('^' + call.submittedBy + '$', 'i') });
        if (user) {
          await PtCallRegister.updateOne(
            { _id: call._id },
            { $set: { userId: user._id, createdBy: user._id } }
          );
          updated++;
        }
      }
    }
    res.json({ message: `Backfill complete. Found ${calls.length} records, updated ${updated}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fix-scrap-division', async (req, res) => {
  try {
    const Service = require('../models/Service');
    const Csw = require('../models/Csw');
    const Scrap = require('../models/Scrap');
    
    const scraps = await Scrap.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
    let scrapUpdated = 0;
    for (const scrap of scraps) {
      let divName = scrap.divisionName || '';
      if (!divName && scrap.serviceId) {
        const svc = await Service.findById(scrap.serviceId).populate('division').lean();
        if (svc && svc.division) divName = typeof svc.division === 'object' ? svc.division.name : svc.divisionName || '';
      }
      if (divName) {
        await Scrap.updateOne({ _id: scrap._id }, { $set: { division: divName } });
        scrapUpdated++;
      }
    }

    const csws = await Csw.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
    let cswUpdated = 0;
    for (const csw of csws) {
      let divName = '';
      if (csw.serviceId) {
        const svc = await Service.findById(csw.serviceId).populate('division').lean();
        if (svc && svc.division) divName = typeof svc.division === 'object' ? svc.division.name : svc.divisionName || '';
      }
      if (divName) {
        await Csw.updateOne({ _id: csw._id }, { $set: { division: divName } });
        cswUpdated++;
      }
    }
    res.json({ message: `Scrap Backfill complete. Scraps updated: ${scrapUpdated}/${scraps.length}. CSWs updated: ${cswUpdated}/${csws.length}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pt/call-register (all open records for division)
router.get('/', protect, async (req, res) => {
  try {
    const { division, callType, status, commType, scEng, engineer, from, to } = req.query;
    const filter = {};

    // For non-admin (PT User), restrict to their division & submitted user if needed
    // or just let them see division. The user requirement isn't fully detailed on restrictions,
    // so we provide query-based filtering like ecallRoutes does for admin, but default to their division.
    const userDivisions = getUserDivisions(req.user);
    if (req.user && req.user.role !== 'admin' && userDivisions.length) {
       filter.division = { $in: userDivisions };
    } else if (division) {
       filter.division = division;
    }

    if (callType) filter.callType = callType;
    if (status) filter.status = status;
    if (commType) filter.commType = commType;
    if (scEng) filter.scEng = scEng;
    if (engineer) filter.engineer = engineer;

    if (from || to) {
      filter.callDate = {};
      if (from) filter.callDate.$gte = from;
      if (to) filter.callDate.$lte = to;
    }

    const docs = await PtCallRegister.find(filter).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/pt/call-register]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/pt/call-register/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await PtCallRegister.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[GET /api/pt/call-register/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/pt/call-register
router.post('/', protect, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationMessage = validateRequired(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });
    const doc = new PtCallRegister({
      ...payload,
      userId: req.user._id,
      createdBy: req.user._id,
    });
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /api/pt/call-register]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:id/close', protect, async (req, res) => {
  try {
    const existing = await PtCallRegister.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    const today = new Date().toISOString().split('T')[0];
    const closedDoc = await PtClose.create({
      entryDate: existing.callDate || today,
      callDate: existing.callDate || today,
      closeDate: today,
      division: existing.division || '',
      call: existing.call || '',
      commType: existing.commType || '',
      typeCall: existing.callType || '',
      branch: existing.branch || '',
      region: existing.region || '',
      scEngg: existing.scEng || '',
      engineer: existing.engineer || '',
      supplier: existing.supplier || '',
      customer: existing.supplier || '',
      model: existing.model || '',
      duration: existing.duration || '',
      status: 'Closed',
      remarks: existing.remarks || '',
      createdBy: existing.createdBy || req.user._id,
    });
    await PtCallRegister.findByIdAndDelete(req.params.id);
    res.json(closedDoc);
  } catch (err) {
    console.error('[POST /api/pt/call-register/:id/close]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/pt/call-register/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationMessage = validateRequired(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });
    const doc = await PtCallRegister.findByIdAndUpdate(
      req.params.id,
      { ...payload },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/pt/call-register/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/pt/call-register/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await PtCallRegister.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/pt/call-register/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
