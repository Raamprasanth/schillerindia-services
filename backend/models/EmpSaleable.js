const mongoose = require('mongoose');

const empSaleableSchema = new mongoose.Schema(
  {
    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      trim: true,
      required: true,
    },
    unitDetails: {
      type: String,
      trim: true,
      required: true,
    },

    // ── Device ────────────────────────────────────────────────
    model:      { type: String, trim: true, required: true },
    modelSn:    { type: String, trim: true, required: true },
    unitConfig: { type: String, trim: true, default: '' },
    replacedSn: { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    entryDate:   { type: String, default: '' },
    fqcInDate:   { type: String, required: true },
    scInDate:    { type: String, default: '' },
    defRecvDate: { type: String, default: '' },
    tentDate:    { type: String, default: '' },
    repShipDate: { type: String, default: '' },
    shipFqcDate: { type: String, default: '' },

    // ── Location ──────────────────────────────────────────────
    region: { type: String, default: '' },
    branch: { type: String, trim: true, default: '' },

    // ── People ────────────────────────────────────────────────
    engineer:   { type: String, trim: true, default: '' },
    scEngineer: { type: String, trim: true, default: '' },
    dealer:     { type: String, trim: true, default: '' },
    supplier:   { type: String, trim: true, default: '' },

    // ── Customer ──────────────────────────────────────────────
    customer: { type: String, trim: true, default: '' },

    // ── Status ────────────────────────────────────────────────
    status: {
      type: String,
      trim: true,
      default: 'Ready',
      required: true,
    },

    // ── Remarks / Observation ─────────────────────────────────
    fqcRemarks:    { type: String, trim: true, default: '' },
    scObservation: { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'empsaleables',
  }
);

// Indexes for common query patterns
empSaleableSchema.index({ status: 1 });
empSaleableSchema.index({ division: 1 });
empSaleableSchema.index({ model: 1 });
empSaleableSchema.index({ modelSn: 1 });
empSaleableSchema.index({ engineer: 1 });
empSaleableSchema.index({ fqcInDate: 1 });
empSaleableSchema.index({ createdBy: 1 });

module.exports =
  mongoose.models.EmpSaleable ||
  mongoose.model('EmpSaleable', empSaleableSchema);
