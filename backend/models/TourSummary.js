const mongoose = require('mongoose');

const tourSummarySchema = new mongoose.Schema({
  tourName: { type: String, default: '', trim: true },
  dayNo: { type: Number, default: 1, min: 1 },
  startDate: { type: String, required: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  branch: { type: String, default: '', trim: true },
  model: { type: String, default: '', trim: true },
  unitStatus: { type: String, default: '', trim: true },
  unitSlNo: { type: String, default: '', trim: true },
  problemReported: { type: String, default: '', trim: true },
  problemObserved: { type: String, default: '', trim: true },
  actionTaken: { type: String, default: '', trim: true },
  images: [{ type: String }],
  createdBy: { type: String, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

tourSummarySchema.index({ createdById: 1, tourName: 1, dayNo: 1, startDate: -1, createdAt: -1 });

module.exports = mongoose.model('TourSummary', tourSummarySchema);
