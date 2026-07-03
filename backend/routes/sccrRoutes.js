const express = require('express');
const router = express.Router();
const ScPrfOb = require('../models/ScPrfOb');
const Ecr = require('../models/Ecr');
const EPrfOb = require('../models/EPrfOb');
const { protect } = require('../middleware/authMiddleware');

function buildScPrfObNaturalMatch(row = {}) {
  const match = {
    division: row.division || 'OTHER',
    type: row.type || 'TO',
    refNo: row.refNo || '',
    branch: row.branch || '',
    model: row.model || '',
  };
  return match.refNo ? match : null;
}

async function syncEcrRowsToSccr() {
  const ecrRows = await Ecr.find({ status: { $in: ['Closed', 'Completed'] } })
    .select('sourceEPrfObId division type refNo branch model executedDate sparesReceivedAtSvc receivedDate remarks')
    .lean();
  if (!ecrRows.length) return;

  const eprfobIds = ecrRows.map(row => row.sourceEPrfObId).filter(Boolean);
  const eprfobRows = eprfobIds.length
    ? await EPrfOb.find({ _id: { $in: eprfobIds } }).select('_id sourceScPrfObId').lean()
    : [];
  const scIdByEprfobId = new Map(eprfobRows.map(row => [String(row._id), row.sourceScPrfObId]));

  await Promise.all(ecrRows.map((row) => {
    const matches = [];
    const sourceScId = row.sourceEPrfObId ? scIdByEprfobId.get(String(row.sourceEPrfObId)) : null;
    if (sourceScId) matches.push({ _id: sourceScId });
    const naturalMatch = buildScPrfObNaturalMatch(row);
    if (naturalMatch) matches.push(naturalMatch);
    if (!matches.length) return Promise.resolve();

    return ScPrfOb.updateMany(
      { $or: matches, status: { $nin: ['Closed', 'Rejected'] } },
      {
        $set: {
          status: 'Closed',
          executedDate: row.executedDate || new Date().toISOString().slice(0, 10),
          sparesReceivedAtSvc: row.sparesReceivedAtSvc || '',
          receivedDate: row.receivedDate || '',
          remarks: row.remarks || '',
          updatedAt: new Date(),
        },
      },
      { runValidators: false }
    );
  }));
}
function applyUserScope(filter, user) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'employee') {
    filter.scEng = user.name;
  }
  return filter;
}

// GET /api/sccr
router.get('/', protect, async (req, res) => {
  try {
    const { from, to, division, type, warrantyStatus, status } = req.query;
    const filter = applyUserScope({
      status: status || { $in: ['Closed', 'Rejected'] },
    }, req.user);

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = from;
      if (to) filter.entryDate.$lte = to;
    }
    if (division) filter.division = division;
    if (type) filter.type = type;
    if (warrantyStatus) filter.warrantyStatus = warrantyStatus;

    const docs = await ScPrfOb.find(filter).sort({ executedDate: -1, createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/sccr]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/sccr/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await ScPrfOb.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'employee' && doc.scEng !== req.user?.name) {
      return res.status(403).json({ message: 'Not allowed to update this record' });
    }

    const allowedFields = [
      'entryDate',
      'type',
      'division',
      'dealer',
      'refNo',
      'raisedDate',
      'receivedDate',
      'executedDate',
      'status',
      'warrantyStatus',
      'scEng',
      'eng',
      'region',
      'branch',
      'supplier',
      'crmRefNo',
      'sparesReceivedAtSvc',
      'partType',
      'partsDescription',
      'model',
      'serialNo',
      'partNo',
      'qty',
      'unitPrice',
      'totalAmount',
      'remarks',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doc[field] = req.body[field];
      }
    });

    const saved = await doc.save();
    res.json(saved);
  } catch (err) {
    console.error('[PUT /api/sccr/:id]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
