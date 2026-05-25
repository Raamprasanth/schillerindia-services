const mongoose = require('mongoose');

const fqcNonSaleableSchema = new mongoose.Schema(
  {
    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Unit Identification ────────────────────────────────────
    unitDetails:   { type: String, trim: true, default: '' },
    model:         { type: String, trim: true, default: '' },
    modelSn:       { type: String, trim: true, default: '' },
    unitConfig:    { type: String, trim: true, default: '' },
    replacedSn:    { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    entryDate:     { type: String, default: '' },
    fqcInwardDate: { type: String, default: '' },
    scInwardDate:  { type: String, default: '' },
    defRecvDate:   { type: String, default: '' },
    tentativeDate: { type: String, default: '' },
    repShipDate:   { type: String, default: '' },
    shipDateFqc:   { type: String, default: '' },

    // ── Location & People ──────────────────────────────────────
    region:        { type: String, trim: true, default: '' },
    branch:        { type: String, trim: true, default: '' },
    engineer:      { type: String, trim: true, default: '' },
    scEngineer:    { type: String, trim: true, default: '' },
    dealer:        { type: String, trim: true, default: '' },
    supplier:      { type: String, trim: true, default: '' },
    customer:      { type: String, trim: true, default: '' },

    // ── Observations / Remarks ────────────────────────────────
    reportedProblem: { type: String, trim: true, default: '' },
    fqcRemarks:      { type: String, trim: true, default: '' },
    scObservation:   { type: String, trim: true, default: '' },
    rootCause:       { type: String, trim: true, default: '' },
    reqParts:        { type: String, trim: true, default: '' },
    actionPlan:      { type: String, trim: true, default: '' },
    finalRemarks:    { type: String, trim: true, default: '' },

    // ── Status ────────────────────────────────────────────────
    finalStatus: {
      type: String,
      enum: ['pending', 'hold', 'review', 'shipped', ''],
      default: 'pending',
    },

    // ── Audit / Update Tracking ───────────────────────────────
    updatedBy:  { type: String, trim: true, default: '' },
    updatedAt:  { type: String, default: '' },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'fqcnonsaleable_fs',   // distinct from fns.html → fqcnonsaleable
  }
);

// Indexes for common query patterns
fqcNonSaleableSchema.index({ finalStatus: 1 });
fqcNonSaleableSchema.index({ division: 1 });
fqcNonSaleableSchema.index({ model: 1 });
fqcNonSaleableSchema.index({ modelSn: 1 });
fqcNonSaleableSchema.index({ entryDate: 1 });
fqcNonSaleableSchema.index({ fqcInwardDate: 1 });
fqcNonSaleableSchema.index({ createdBy: 1 });

module.exports =
  mongoose.models.FqcNonSaleableFs ||
  mongoose.model('FqcNonSaleableFs', fqcNonSaleableSchema);
