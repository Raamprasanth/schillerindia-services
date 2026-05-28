const mongoose = require('mongoose');

const ctodrSchema = new mongoose.Schema({
  entryDate: { type: Date, required: true },
  frnNo: { type: String, required: true },
  partNo: { type: String, required: true },
  model: { type: String, trim: true, default: '' },
  description: { type: String, required: true },
  action: { type: String, required: true },
  toRaisedDate: { type: Date, default: null },
  sparesReceivedDate: { type: Date, default: null },
  fulfilledDate: { type: Date, default: null },
  fulfilledBy: { type: String, trim: true, default: '' },
  sourceId: { type: String, trim: true, default: '' },
  sourceModule: { type: String, trim: true, default: '' },
  queuedBy: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ctodr', ctodrSchema);
