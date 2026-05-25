const mongoose = require('mongoose');

const ansSchema = new mongoose.Schema(
  {
    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      trim: true,
      required: true,
    },
    unitDetails: {
      type: String,
      enum: ['Demo', 'Sales Stock', 'Customer Unit', 'Loan Unit', 'Refurbished', 'Trade-in', 'Warranty Failure', 'DOE', 'Sales Return'],
      required: true,
    },

    // ── Device ────────────────────────────────────────────────
    model:      { type: String, trim: true, required: true },
    modelSn:    { type: String, trim: true, required: true },   // Model Serial No
    unitConfig: { type: String, trim: true, default: '' },      // Unit Configuration
    replacedSn: { type: String, trim: true, default: '' },      // Replaced Unit S/N

    // ── Dates ─────────────────────────────────────────────────
    entryDate:   { type: String, default: '' },
    fqcInDate:   { type: String, required: true },              // FQC Inward Date
    scInDate:    { type: String, default: '' },                 // SC Inward Date
    defRecvDate: { type: String, default: '' },                 // Defective Unit Received Date
    tentDate:    { type: String, default: '' },                 // Tentative Date
    repShipDate: { type: String, default: '' },                 // Replacement Ship Date
    shipFqcDate: { type: String, default: '' },                 // Ship Date to FQC

    // ── Location ──────────────────────────────────────────────
    region: {
      type: String,
      trim: true,
      default: '',
    },
    branch: {
      type: String,
      trim: true,
      default: '',
    },

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
      enum: ['Pending', 'Closed'],
      default: 'Pending',
      required: true,
    },

    // ── Problem / Observation / Resolution ────────────────────
    reportedProblem: { type: String, trim: true, required: true },
    scObservation:   { type: String, trim: true, default: '' },
    rootCause:       { type: String, trim: true, default: '' },
    reqParts:        { type: String, trim: true, default: '' },
    fqcObservation:  { type: String, trim: true, default: '' },
    actionPlan:      { type: String, trim: true, default: '' },
    finalRemarks:    { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ansnonsaleable',
  }
);

// Indexes
ansSchema.index({ status: 1 });
ansSchema.index({ division: 1 });
ansSchema.index({ model: 1 });
ansSchema.index({ modelSn: 1 });
ansSchema.index({ fqcInDate: 1 });
ansSchema.index({ createdBy: 1 });

module.exports = mongoose.models.Ans || mongoose.model('Ans', ansSchema);
