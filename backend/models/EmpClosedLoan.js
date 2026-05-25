const mongoose = require('mongoose');

const empClosedLoanSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    girNo: { type: String, trim: true, required: true },
    opt: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'emp_closed_loans',
  }
);

empClosedLoanSchema.index({ date: -1 });
empClosedLoanSchema.index({ division: 1 });
empClosedLoanSchema.index({ partNo: 1 });
empClosedLoanSchema.index({ girNo: 1 });

module.exports = mongoose.model('EmpClosedLoan', empClosedLoanSchema);
