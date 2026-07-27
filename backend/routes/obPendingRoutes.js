// routes/obPendingRoutes.js
const router    = require('express').Router();
const OBPending = require('../models/OBPending');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── Helper: compute live pdays from createdAt ─────────────
function livePdays(doc) {
  if (doc.pdays !== null && doc.pdays !== undefined) return doc.pdays;
  return Math.floor(
    (Date.now() - new Date(doc.rcvdDate || doc.entryDate || doc.createdAt).getTime()) / 86400000
  );
}

// ── Serialise a document to the shape the frontend expects ─
function toDTO(d) {
  return {
    _id:        d._id,
    entryDate:  d.entryDate  || '',
    scRno:      d.scRno      || '',
    scEng:      d.scEng      || '',
    frnNo:      d.frnNo      || '',
    region:     d.region     || '',
    eng:        d.eng        || '',
    customer:   d.customer   || '',
    model:      d.model      || '',
    unitStatus: d.unitStatus || '',
    defMod:     d.defMod     || '',
    defGir:     d.defGir     || '',
    remarks:    d.remarks    || '',
    typeWork:   d.typeWork   || 'OB Pending',
    status:     d.obStatus   || 'pending',
    pdays:      livePdays(d),
    createdAt:  d.createdAt,
    serviceId:  d.serviceId  || '',
  };
}

// ── GET /api/ob-pending — list all records ─────────────────
router.get('/', protect, async (req, res) => {
  try {
    const docs = await OBPending.find()
      .sort({ createdAt: 1 })
      .lean();
    res.json(docs.map(toDTO));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/ob-pending/:id — single record ────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await OBPending.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(toDTO(doc));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/ob-pending — create new record ───────────────
router.post('/', protect, async (req, res) => {
  try {
    const {
      entryDate, rcvdDate, scRno, scEng, frnNo, region, eng,
      customer, model, unitStatus, defMod, defGir,
      remarks, typeWork, serviceId, pdays,
    } = req.body;

    const doc = await OBPending.create({
      entryDate, rcvdDate: rcvdDate || '', scRno, scEng, frnNo, region, eng,
      customer, model, unitStatus, defMod, defGir,
      remarks, typeWork, serviceId,
      pdays: pdays ?? null,
      obStatus: 'pending',
    });

    res.status(201).json(toDTO(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── PUT /api/ob-pending/:id — update record ────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const allowed = [
      'entryDate','rcvdDate','scRno','scEng','frnNo','region','eng',
      'customer','model','unitStatus','defMod','defGir',
      'remarks','typeWork','serviceId','pdays',
    ];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const doc = await OBPending.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(toDTO(doc));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── PUT /api/ob-pending/:id/approve — mark OB done ─────────
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const doc = await OBPending.findByIdAndUpdate(
      req.params.id,
      { obStatus: 'approved' },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, message: 'OB marked as done.', record: toDTO(doc) });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── PUT /api/ob-pending/:id/escalate ──────────────────────
router.put('/:id/escalate', protect, adminOnly, async (req, res) => {
  try {
    const doc = await OBPending.findByIdAndUpdate(
      req.params.id,
      { obStatus: 'escalated' },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, message: 'Record escalated.', record: toDTO(doc) });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── DELETE /api/ob-pending/:id ────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await OBPending.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    
    await OBPending.findByIdAndDelete(req.params.id);
    
    if (doc.serviceId) {
      const EmpOBPending = require('../models/EmpOBPending');
      await EmpOBPending.deleteMany({ serviceId: doc.serviceId });
    }
    
    res.json({ success: true, message: 'Record deleted.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;