const mongoose = require('mongoose');

const ePrfObSchema = new mongoose.Schema(
  {
    // ── Basic ─────────────────────────────────────────────────
    entryDate:      { type: String, required: true },
    type:           { type: String, enum: ['PRF', 'OB'], required: true },
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
    eng:    { type: String, trim: true, required: true },
    scEng:  { type: String, trim: true },
    region: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, required: true },
    supplier: { type: String, trim: true, default: '' },

    // ── Reference ─────────────────────────────────────────────
    crmRefNo:            { type: String, trim: true },
    sparesReceivedAtSvc: { type: String, trim: true, default: '' },
    partType:            { type: String, trim: true, default: '' },
    partsDescription:    { type: String, trim: true, default: '' },

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
    sourceScPrfObId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScPrfOb', default: null },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'eprfobs',
  }
);

ePrfObSchema.index({ status: 1 });
ePrfObSchema.index({ type: 1 });
ePrfObSchema.index({ division: 1 });
ePrfObSchema.index({ eng: 1 });
ePrfObSchema.index({ entryDate: 1 });

module.exports = mongoose.models.EPrfOb || mongoose.model('EPrfOb', ePrfObSchema);
