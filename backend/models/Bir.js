const mongoose = require('mongoose');

const birSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────────────────────
    birRef: { type: String, trim: true, default: '' },           // BIR Reference No (auto-generated on frontend if blank)

    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      trim: true,
      required: true,
    },
    model:         { type: String, trim: true, required: true },
    configuration: { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    unitInwardDate: { type: String, required: true },            // Unit Inward Date
    fqcInwardDate:  { type: String, default: '' },               // FQC Inward Date
    invoiceDate:    { type: String, default: '' },
    approvedDate:   { type: String, default: '' },

    // ── Supplier / Invoice ────────────────────────────────────
    supplier:  { type: String, trim: true, default: '' },
    invoiceNo: { type: String, trim: true, default: '' },

    // ── Quantity / Serial ─────────────────────────────────────
    receivedQty: { type: String, trim: true, required: true },   // e.g. "5", "1no", "27"
    serial:      { type: String, trim: true, default: '' },      // Unit Serial No

    // ── Software ──────────────────────────────────────────────
    prevSwVersion:  { type: String, trim: true, default: '' },   // Previous SW version
    presSwVersion:  { type: String, trim: true, default: '' },   // Present SW version
    swChangeRemarks:{ type: String, trim: true, default: '' },

    // ── Hardware ──────────────────────────────────────────────
    hwChanges:       { type: String, trim: true, default: '' },  // e.g. "NA", description
    hwChangeRemarks: { type: String, trim: true, default: '' },

    // ── Accessories ───────────────────────────────────────────
    accChanges:       { type: String, enum: ['No Change', 'Added', 'Removed', 'Replaced', ''], default: '' },
    accDetails:       { type: String, trim: true, default: '' },
    accChangeRemarks: { type: String, trim: true, default: '' },

    // ── Manuals ───────────────────────────────────────────────
    userManualUpdate:    { type: String, trim: true, default: '' },   // Yes / No / NA
    serviceManualUpdate: { type: String, trim: true, default: '' },

    // ── Engineering & Quality ─────────────────────────────────
    scEngineer:         { type: String, trim: true, default: '' },
    psEngineer:         { type: String, trim: true, default: '' },
    fqcRemarks:         { type: String, trim: true, default: '' },
    techRemarks:        { type: String, trim: true, default: '' },
    scInwardDate:       { type: String, default: '' },
    scObservation:      { type: String, trim: true, default: '' },
    requiredParts:      { type: String, trim: true, default: '' },
    rootCause:          { type: String, trim: true, default: '' },
    scActionPlan:       { type: String, trim: true, default: '' },
    tentativeDate:      { type: String, default: '' },
    shipDateToFqc:      { type: String, default: '' },
    defUnitReceivedDate:{ type: String, default: '' },
    replacementShipDate:{ type: String, default: '' },
    fqcObservation:     { type: String, trim: true, default: '' },
    fqcFinalRemarks:    { type: String, trim: true, default: '' },
    tsVerificationDate: { type: String, default: '' },
    psVerificationDate: { type: String, default: '' },

    // ── CNR / Technews ────────────────────────────────────────
    cnrCirculation: { type: String, trim: true, default: '' },   // Yes / No / NA
    cnrRefNo:       { type: String, trim: true, default: '' },
    cnrReleaseDate: { type: String, default: '' },

    // ── Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Approved', 'Rejected', 'Closed'],
      default: 'Pending',
      required: true,
    },
    finalStatus: { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'birrecords',
  }
);

// Indexes for common query patterns
birSchema.index({ status: 1 });
birSchema.index({ division: 1 });
birSchema.index({ model: 1 });
birSchema.index({ birRef: 1 });
birSchema.index({ unitInwardDate: 1 });
birSchema.index({ createdBy: 1 });

module.exports = mongoose.models.Bir || mongoose.model('Bir', birSchema);
