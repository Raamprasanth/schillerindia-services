const mongoose = require('mongoose');

const cdrSchema = new mongoose.Schema({
  entryDate: { type: Date, required: true },
  frnNo: { type: String, required: true },
  partNo: { type: String, required: true },
  model: { type: String, trim: true, default: '' },
  quantity: { type: Number, default: 1 },
  description: { type: String, required: true },
  action: { type: String, required: true },
  sparesReceivedDate: { type: Date, default: null },
  closedDate: { type: Date, default: null },
  sourceId: { type: String, trim: true, default: '' },
  sourceModule: { type: String, trim: true, default: '' },
  queuedBy: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cdr', cdrSchema);
