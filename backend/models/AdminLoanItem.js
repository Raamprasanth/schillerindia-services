const mongoose = require('mongoose');

const adminLoanItemSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    girNo: { type: String, trim: true, required: true },
    revalue: { type: Number, default: 0 },
    opt: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    loanItemId: { type: String, trim: true, default: '' }, // Reference to the original LoanItem
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'admin_loan_items',
  }
);

adminLoanItemSchema.index({ date: -1 });
adminLoanItemSchema.index({ division: 1 });
adminLoanItemSchema.index({ partNo: 1 });
adminLoanItemSchema.index({ girNo: 1 });
adminLoanItemSchema.index({ loanItemId: 1 });

module.exports = mongoose.model('AdminLoanItem', adminLoanItemSchema);
