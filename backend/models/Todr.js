const mongoose = require('mongoose');

const todrSchema = new mongoose.Schema({
  entryDate: { type: Date, required: true },
  frnNo: { type: String, required: true },
  partNo: { type: String, required: true },
  model: { type: String, trim: true, default: '' },
  description: { type: String, required: true },
  defGirNo: { type: String, trim: true, default: '' },
  action: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  toNo: { type: String, trim: true, default: '' },
  toRaisedDate: { type: Date, default: null },
  sparesReceivedDate: { type: Date, default: null },
  sourceId: { type: String, trim: true, default: '' },
  sourceModule: { type: String, trim: true, default: '' },
  queuedBy: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

todrSchema.index({ sourceModule: 1, sourceId: 1, action: 1, partNo: 1 });

module.exports = mongoose.model('Todr', todrSchema);
