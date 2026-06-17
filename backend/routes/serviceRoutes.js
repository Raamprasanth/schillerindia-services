// routes/serviceRoutes.js
const router  = require('express').Router();
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const { syncLinkedRecords, cleanupLinkedRecords } = require('../services/queueSyncService');

function normalizeUnitStatus(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = { IW: 'IW', EW: 'EW', CAMC: 'CAMC', STOCK: 'STOCK', DEMO: 'Demo', REPEAT: 'Repeat', 'BUY BACK': 'Buy Back', BUYBACK: 'Buy Back', OW: 'OW', LAMC: 'LAMC' };
  return map[upper] || raw;
}

function normalizeRepType(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = { NA: 'NA', 'TO/ADV SO': 'TO/ADV SO', 'BS/SO': 'BS/SO' };
  return map[upper] || raw;
}

async function resolveDivisionInput(body) {
  const mongoose = require('mongoose');
  if (body.divisionName || (body.division && !mongoose.Types.ObjectId.isValid(body.division))) {
    const Division = require('../models/Division');
    const divName = body.divisionName || body.division;
    const divDoc = await Division.findOne({ name: new RegExp('^' + String(divName).trim() + '$', 'i') });
    if (divDoc) body.division = divDoc._id;
    delete body.divisionName;
  }
}

// GET /api/services — admin sees all, employee sees own
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { engineer: req.user._id };

    const list = await Service.find(filter)
      .populate('engineer', 'name email')
      .populate('division', 'name')
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// GET /api/services/:id — single service
router.get('/:id', protect, async (req, res) => {
  try {
    const svc = await Service.findById(req.params.id)
      .populate('engineer', 'name email')
      .populate('division', 'name');

    if (!svc) return res.status(404).json({ message: 'Service not found' });

    res.json(svc);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// POST /api/services — create service
router.post('/', protect, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);
    await resolveDivisionInput(body);

    const svc = await Service.create({
      ...body,
      engineer: req.user._id,
      submittedBy: req.user.name || '',
      submittedAt: new Date().toISOString()
    });

    const svcObj = svc.toObject();
    await syncLinkedRecords(svcObj, req.user);

    res.status(201).json(svc);
  } catch (err) { 
    res.status(400).json({ message: err.message }); 
  }
});

// PUT /api/services/:id — update service
router.put('/:id', protect, async (req, res) => {
  try {
    const body = { ...req.body, updatedAt: new Date().toISOString() };
    if (body.unitSts !== undefined || body.unitStatus !== undefined) body.unitSts = normalizeUnitStatus(body.unitSts || body.unitStatus);
    if (body.repType !== undefined) body.repType = normalizeRepType(body.repType);
    await resolveDivisionInput(body);

    const svc = await Service.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: false }
    );

    if (!svc) return res.status(404).json({ message: 'Service not found' });

    const svcObj = svc.toObject();
    await syncLinkedRecords(svcObj, req.user);

    res.json(svc);
  } catch (err) { 
    res.status(400).json({ message: err.message }); 
  }
});

// DELETE /api/services/:id — delete (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    await cleanupLinkedRecords(req.params.id);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
