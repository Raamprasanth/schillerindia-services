const mongoose = require('mongoose');

const drSchema = new mongoose.Schema({
  entryDate: { type: Date, required: true },
  frnNo: { type: String, required: true },
  partNo: { type: String, required: true },
  model: { type: String, trim: true, default: '' },
  description: { type: String, required: true },
  action: { type: String, required: true },
  sparesReceivedDate: { type: Date, default: null },
  sourceId: { type: String, trim: true, default: '' },
  sourceModule: { type: String, trim: true, default: '' },
  queuedBy: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

drSchema.index({ sourceModule: 1, sourceId: 1, action: 1, partNo: 1 });

module.exports = mongoose.model('Dr', drSchema);
