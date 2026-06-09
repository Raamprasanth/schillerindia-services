const mongoose = require('mongoose');

const aCrSchema = new mongoose.Schema(
  {
    entryDate: { type: String, required: true },
    type: { type: String, enum: ['TO', 'SO', 'PRF', 'OB'], required: true },
    division: {
      type: String,
      required: true,
    },
    dealer: { type: String, trim: true, default: '' },
    refNo: { type: String, trim: true, required: true },
    raisedDate: { type: String, default: '' },
    receivedDate: { type: String, default: '' },
    executedDate: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Completed', 'Closed', 'Rejected'],
      default: 'Closed',
      required: true,
    },
    warrantyStatus: {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'STOCK', 'IW', 'Demo', 'NA', ''],
      default: '',
    },
    scEng: { type: String, trim: true, default: '' },
    eng: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    supplier: { type: String, trim: true, default: '' },
    crmRefNo: { type: String, trim: true, default: '' },
    sparesReceivedAtSvc: { type: String, trim: true, default: '' },
    partType: { type: String, trim: true, default: '' },
    partsDescription: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, required: true },
    serialNo: { type: String, trim: true, default: '' },
    partNo: { type: String, trim: true, default: '' },
    qty: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    collection: 'adminclosedprfobs',
  }
);

aCrSchema.index({ status: 1 });
aCrSchema.index({ type: 1 });
aCrSchema.index({ division: 1 });
aCrSchema.index({ scEng: 1 });
aCrSchema.index({ eng: 1 });
aCrSchema.index({ entryDate: 1 });
aCrSchema.index({ createdBy: 1 });

module.exports = mongoose.models.ACr || mongoose.model('ACr', aCrSchema);
