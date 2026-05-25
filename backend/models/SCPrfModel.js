// models/SCPrfModel.js
// Service Coordinator — PRF/OB Register
const mongoose = require('mongoose');

const scPrfSchema = new mongoose.Schema(
  {
    prfNo:       { type: String, trim: true, default: '' },
    scReNo:      { type: String, trim: true, default: '' },
    custName:    { type: String, trim: true, default: '' },
    customer:    { type: String, trim: true, default: '' },
    model:       { type: String, trim: true, default: '' },
    division:    { type: String, trim: true, default: '' },
    entryDate:   { type: String, default: '' },
    closedDate:  { type: String, default: '' },

    status: {
      type: String,
      enum: ['open', 'pending', 'closed'],
      default: 'open',
    },

    notes:       { type: String, trim: true, default: '' },
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: String, default: '' },
    updatedBy:   { type: String, trim: true, default: '' },
    updatedAt:   { type: String, default: '' },
  },
  { timestamps: true, collection: 'sc_prf' }
);

scPrfSchema.index({ status: 1 });
scPrfSchema.index({ entryDate: -1 });
scPrfSchema.index({ submittedBy: 1 });

module.exports = mongoose.model('SCPrf', scPrfSchema);
