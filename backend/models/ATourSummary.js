const mongoose = require('mongoose');

const atourSummarySchema = new mongoose.Schema({
  tourName: { type: String, default: '', trim: true },
  dayNo: { type: Number, default: 1, min: 1 },
  startDate: { type: String, required: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  region: { type: String, default: '', trim: true },
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
  createdByDivision: { type: String, default: '', trim: true },
  createdByDivisionKey: { type: String, default: '', trim: true },
  updatedBy: { type: String, default: '' },
  sourceType: { type: String, default: '', trim: true }, // 'Employee' or 'Product Team'
  sourceId: { type: mongoose.Schema.Types.ObjectId } // Reference to the original TourSummary or PTourSummary
}, { timestamps: true });

atourSummarySchema.index({ createdById: 1, tourName: 1, dayNo: 1, startDate: -1, createdAt: -1 });
atourSummarySchema.index({ createdByDivisionKey: 1, startDate: -1, createdAt: -1 });
atourSummarySchema.index({ sourceId: 1 }); // Helpful for deleting the cloned entry

module.exports = mongoose.model('ATourSummary', atourSummarySchema);
