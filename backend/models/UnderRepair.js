// models/UnderRepair.js
const mongoose = require('mongoose');

const underRepairSchema = new mongoose.Schema(
  {
    // ── Service Reference ─────────────────────────────────
    // Links back to the Service record that triggered this entry.
    // Null = manually added directly on the Under Repair page.
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Service',
      default: null,
    },

    // ── Service Info ──────────────────────────────────────
    entryDate: { type: String,  default: '' },   // "2025-10-27"
    rcvdDate:  { type: String,  default: '' },
    scRno:     { type: String,  default: '' },   // "VENT-1815"
    scEng:     { type: String,  default: '' },   // "RANJITH"
    frnNo:     { type: String,  default: '' },   // "87353"

    // ── Location / Assignment ─────────────────────────────
    region:    { type: String,  default: '' },   // "EAST"
    eng:       { type: String,  default: '' },   // "PRASANTA KUMAR BEHERA"
    raEng:     { type: String,  default: '' },   // repair activity engineer
    repairTeam:{ type: String,  default: '' },
    custName:  { type: String,  default: '' },   // "Newborn and Pediatric Health Centre"

    // ── Device Info ───────────────────────────────────────
    model:         { type: String,  default: '' },   // "SOPHIE"
    unitStatus:    { type: String,  default: '' },   // "CAMC" | "EW" | "STOCK" | "AMC" | "OW" | "IW" | "LAMC"
    partNo:        { type: String,  default: '' },
    defModBrdName: { type: String,  default: '' },   // "PSU Sophie Bebro"
    defGirNo:      { type: String,  default: '' },   // "X-99061"
    defPartSno:    { type: String,  default: '' },
    repGirNo:      { type: String,  default: '' },   // replacement GIR number if applicable
    revalue:       { type: Number,  default: 0  },   // amount inr
    
    // ── Work & Status ─────────────────────────────────────
    typeOfWork:   { type: String, default: 'UNDER REPAIR' },
    finalRemarks: { type: String, default: '' },
    pdays: {
      type:    Number,
      default: 0,
      min:     [0, 'PDays cannot be negative'],
    },
    status: {
      type:    String,
      default: 'UNDER REPAIR',
      enum: {
        values:  ['UNDER REPAIR', 'ESCALATED', 'COMPLETED'],
        message: '{VALUE} is not a valid status',
      },
    },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    collection: 'underrepairs',
  }
);

// ── INDEXES ───────────────────────────────────────────────
// Speed up the most common queries
underRepairSchema.index({ status: 1 });
underRepairSchema.index({ region: 1 });
underRepairSchema.index({ scEng:  1 });
underRepairSchema.index({ pdays:  -1 });
underRepairSchema.index({ serviceId: 1 });   // fast lookup by linked service
underRepairSchema.index({ createdAt: -1 });  // default sort order

// ── EXPORT ────────────────────────────────────────────────
// Guard against "Cannot overwrite model once compiled" in dev hot-reload
module.exports = mongoose.models.UnderRepair
  || mongoose.model('UnderRepair', underRepairSchema);
