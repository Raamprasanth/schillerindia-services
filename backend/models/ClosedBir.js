const mongoose = require('mongoose');

const closedBirSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────────────────────
    birRef: { type: String, trim: true, default: '' },

    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      required: true,
    },
    model:         { type: String, trim: true, required: true },
    configuration: { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    unitInwardDate: { type: String, required: true },
    fqcInwardDate:  { type: String, default: '' },
    invoiceDate:    { type: String, default: '' },
    approvedDate:   { type: String, default: '' },

    // ── Supplier / Invoice ────────────────────────────────────
    supplier:  { type: String, trim: true, default: '' },
    invoiceNo: { type: String, trim: true, default: '' },

    // ── Quantity / Serial ─────────────────────────────────────
    receivedQty: { type: String, trim: true, required: true },
    serial:      { type: String, trim: true, default: '' },

    // ── Software ──────────────────────────────────────────────
    prevSwVersion:   { type: String, trim: true, default: '' },
    presSwVersion:   { type: String, trim: true, default: '' },
    swChangeRemarks: { type: String, trim: true, default: '' },

    // ── Hardware ──────────────────────────────────────────────
    hwChanges:       { type: String, trim: true, default: '' },
    hwChangeRemarks: { type: String, trim: true, default: '' },

    // ── Accessories ───────────────────────────────────────────
    accChanges:       { type: String, enum: ['No Change', 'Added', 'Removed', 'Replaced', ''], default: '' },
    accDetails:       { type: String, trim: true, default: '' },
    accChangeRemarks: { type: String, trim: true, default: '' },

    // ── Manuals ───────────────────────────────────────────────
    userManualUpdate:    { type: String, trim: true, default: '' },
    serviceManualUpdate: { type: String, trim: true, default: '' },

    // ── Engineering & Quality ─────────────────────────────────
    scEngineer:         { type: String, trim: true, default: '' },
    psEngineer:         { type: String, trim: true, default: '' },
    fqcRemarks:         { type: String, trim: true, default: '' },
    techRemarks:        { type: String, trim: true, default: '' },
    tsVerificationDate: { type: String, default: '' },
    psVerificationDate: { type: String, default: '' },
    productTeamRemarks: { type: String, trim: true, default: '' },

    // ── CNR / Technews ────────────────────────────────────────
    cnrCirculation: { type: String, trim: true, default: '' },
    cnrRefNo:       { type: String, trim: true, default: '' },
    cnrReleaseDate: { type: String, default: '' },

    // ── Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Approved', 'Closed'],
      default: 'Approved',
      required: true,
    },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'closedbirrecords',
  }
);

// Indexes
closedBirSchema.index({ status: 1 });
closedBirSchema.index({ division: 1 });
closedBirSchema.index({ model: 1 });
closedBirSchema.index({ birRef: 1 });
closedBirSchema.index({ unitInwardDate: 1 });
closedBirSchema.index({ approvedDate: 1 });
closedBirSchema.index({ createdBy: 1 });

module.exports = mongoose.models.ClosedBir || mongoose.model('ClosedBir', closedBirSchema);
