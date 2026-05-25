// models/SCSparesModel.js
// Service Coordinator — Spares Request
const mongoose = require('mongoose');

const scSparesSchema = new mongoose.Schema(
  {
    scReNo:        { type: String, trim: true, default: '' },
    itemName:      { type: String, trim: true, default: '' },
    partName:      { type: String, trim: true, default: '' },
    partNo:        { type: String, trim: true, default: '' },
    qty:           { type: Number, default: 1 },
    model:         { type: String, trim: true, default: '' },
    division:      { type: String, trim: true, default: '' },
    requestedDate: { type: String, default: '' },
    completedDate: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'open', 'completed', 'closed'],
      default: 'pending',
    },

    notes:       { type: String, trim: true, default: '' },
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: String, default: '' },
    updatedBy:   { type: String, trim: true, default: '' },
    updatedAt:   { type: String, default: '' },
  },
  { timestamps: true, collection: 'sc_spares' }
);

scSparesSchema.index({ status: 1 });
scSparesSchema.index({ requestedDate: -1 });
scSparesSchema.index({ submittedBy: 1 });

module.exports = mongoose.model('SCSpares', scSparesSchema);
