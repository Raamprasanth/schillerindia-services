const mongoose = require('mongoose');

const loanItemSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    girNo: { type: String, trim: true, required: true },
    revalue: { type: Number, default: 0 },
    opt: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'loan_items',
  }
);

loanItemSchema.index({ date: -1 });
loanItemSchema.index({ division: 1 });
loanItemSchema.index({ partNo: 1 });
loanItemSchema.index({ girNo: 1 });

module.exports = mongoose.model('LoanItem', loanItemSchema);
