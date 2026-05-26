const mongoose = require('mongoose');

const eBirSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────────────────────
    birRefNo: { type: String, trim: true, default: '' },         // BIR Reference No

    // ── Classification ────────────────────────────────────────
    division:      { type: String, trim: true, required: true },
    model:         { type: String, trim: true, required: true },
    configuration: { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    inwardDate:   { type: String, required: true },              // Unit Inward Date
    invoiceDate:  { type: String, default: '' },

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
    hwChanges:       { type: String, trim: true, default: '' },  // Yes / No / NA
    hwChangeRemarks: { type: String, trim: true, default: '' },

    // ── Accessories ───────────────────────────────────────────
    accessoryDetails:   { type: String, trim: true, default: '' },
    accChangeRemarks:   { type: String, trim: true, default: '' },

    // ── CNR / Technews ────────────────────────────────────────
    cnrCirculation: { type: String, trim: true, default: '' },   // Yes / No / NA
    cnrRefNo:       { type: String, trim: true, default: '' },
    cnrReleaseDate: { type: String, default: '' },

    // ── Dates (additional) ───────────────────────────────────
    fqcInwardDate: { type: String, default: '' },

    // ── Manuals & Remarks ────────────────────────────────────
    userManualUpdate:    { type: String, trim: true, default: '' },
    fqcRemarks:          { type: String, trim: true, default: '' },

    // ── SC / FQC Engineer Update Fields ───────────────────────
    scEngineer:          { type: String, trim: true, default: '' },
    serviceManualUpdate: { type: String, trim: true, default: '' },
    techRemarks:         { type: String, trim: true, default: '' },
    scInwardDate:        { type: String, default: '' },
    scObservation:       { type: String, trim: true, default: '' },
    requiredParts:       { type: String, trim: true, default: '' },
    rootCause:           { type: String, trim: true, default: '' },
    scActionPlan:        { type: String, trim: true, default: '' },
    tentativeDate:       { type: String, default: '' },
    shipDateToFqc:       { type: String, default: '' },
    defUnitReceivedDate: { type: String, default: '' },
    replacementShipDate: { type: String, default: '' },
    fqcObservation:      { type: String, trim: true, default: '' },
    fqcFinalRemarks:     { type: String, trim: true, default: '' },

    // ── Product Team Section ──────────────────────────────────
    tsVerificationDate: { type: String, default: '' },
    psEngineer:         { type: String, trim: true, default: '' },
    psVerificationDate: { type: String, default: '' },
    productTeamRemarks: { type: String, trim: true, default: '' },
    approvedDate:       { type: String, default: '' },

    // ── Status ────────────────────────────────────────────────
    finalStatus: {
      type: String,
      enum: ['Pending', 'Closed', 'Under Review', 'Rejected', 'In Progress', 'Approved', ''],
      default: 'Pending',
      required: true,
    },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ebirrecords',
  }
);

eBirSchema.index({ finalStatus: 1 });
eBirSchema.index({ division: 1 });
eBirSchema.index({ model: 1 });
eBirSchema.index({ birRefNo: 1 });
eBirSchema.index({ inwardDate: 1 });
eBirSchema.index({ createdBy: 1 });

module.exports = mongoose.models.EBir || mongoose.model('EBir', eBirSchema);
