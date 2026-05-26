const mongoose = require('mongoose');

const scPrfObSchema = new mongoose.Schema(
  {
    // ── Basic ─────────────────────────────────────────────────
    entryDate:      { type: String, required: true },
    type:           { type: String, enum: ['TO', 'SO', 'PRF', 'OB'], required: true },
    division: {
      type: String,
      required: true,
    },
    dealer:         { type: String, trim: true, default: '' },
    refNo:          { type: String, trim: true, required: true },
    raisedDate:     { type: String, default: '' },
    receivedDate:   { type: String },
    executedDate:   { type: String },
    status: {
      type: String,
      enum: ['Open', 'Pending', 'Closed', 'Rejected'],
      required: true,
      default: 'Open',
    },
    warrantyStatus: {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'STOCK', 'IW', ''],
      default: '',
    },

    // ── People ────────────────────────────────────────────────
    scEng:  { type: String, trim: true, default: '' },
    eng:    { type: String, trim: true },
    region: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, required: true },
    supplier: { type: String, trim: true, default: '' },

    // ── Reference ─────────────────────────────────────────────
    crmRefNo: { type: String, trim: true },
    sparesReceivedAtSvc: { type: String, trim: true, default: '' },
    partType: { type: String, trim: true, default: '' },
    partsDescription: { type: String, trim: true, default: '' },

    // ── Device ────────────────────────────────────────────────
    model:    { type: String, trim: true, required: true },
    serialNo: { type: String, trim: true },
    partNo:   { type: String, trim: true },

    // ── Financials ────────────────────────────────────────────
    qty:         { type: Number, default: 1, min: 1 },
    unitPrice:   { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    // ── Notes ─────────────────────────────────────────────────
    remarks: { type: String, trim: true },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'scprfobs',
  }
);

scPrfObSchema.index({ status: 1 });
scPrfObSchema.index({ type: 1 });
scPrfObSchema.index({ division: 1 });
scPrfObSchema.index({ scEng: 1 });
scPrfObSchema.index({ entryDate: 1 });

module.exports = mongoose.models.ScPrfOb || mongoose.model('ScPrfOb', scPrfObSchema);
