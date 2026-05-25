// models/CompletedFRN.js
const mongoose = require('mongoose');

const CompletedFRNSchema = new mongoose.Schema(
  {
    // ── Links ─────────────────────────────────────────────
    serviceId: { type: String, trim: true, default: '' },
    frnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FRN',
      default: null,
    },
    scCompletedFrnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SCCompletedFRN',
      default: null,
    },

    // ── Core service fields ───────────────────────────────
    entryDate:  { type: String, trim: true, default: '' },
    scRno:      { type: String, trim: true, required: [true, 'SC Ref No is required'] },
    scEng:      { type: String, trim: true, default: '' },
    frnNo:      { type: String, trim: true, default: '' },

    // ✅ Removed strict enum — EmpFRN stores branch names like
    //    "Chennai HQ", "Mumbai HQ" which don't match the old enum list.
    region:     { type: String, trim: true, default: '' },

    eng:        { type: String, trim: true, default: '' },
    customer:   { type: String, trim: true, default: '' },
    model:      { type: String, trim: true, default: '' },

    // ✅ Removed strict enum — kept common values but allow any string
    //    so branch-level unit status values don't break the save.
    unitStatus: { type: String, trim: true, default: '' },

    defMod:     { type: String, trim: true, default: '' },
    defGir:     { type: String, trim: true, default: '' },

    // ── Repair / update details ───────────────────────────
    raEng:        { type: String, trim: true, default: '' },
    repBrdDate:   { type: String, default: '' },
    dcNo:         { type: String, trim: true, default: '' },
    defUnitGir:   { type: String, trim: true, default: 'NA' },
    repGirSno:    { type: String, trim: true, default: '' },
    finalRemarks: { type: String, trim: true, default: '' },
    techRemarks:  { type: String, trim: true, default: '' },
    components:   { type: String, trim: true, default: '' },
    revalue:      { type: Number, default: 0 },

    // ── Dispatch / shipping ───────────────────────────────
    // ✅ Removed strict enum — EmpFRN typeWork values like "Repaired",
    //    "Unit Returned", "No Fault" didn't match the ALL-CAPS enum list.
    typeWork:     { type: String, trim: true, default: '' },

    reportType:   { type: String, trim: true, default: '' },
    destination:  { type: String, trim: true, default: '' },
    shipDateSC:   { type: String, default: '' },
    shipDateComm: { type: String, default: '' },

    // ── Computed / stored pdays ───────────────────────────
    pdays: { type: Number, default: null },

    // ── Audit ─────────────────────────────────────────────
    closedBy:  { type: String, trim: true, default: '' },
    closedAt:  { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'completed_frns',
  }
);

// ── Indexes ───────────────────────────────────────────────
CompletedFRNSchema.index({ eng: 1 });
CompletedFRNSchema.index({ scEng: 1 });
CompletedFRNSchema.index({ region: 1 });
CompletedFRNSchema.index({ unitStatus: 1 });
CompletedFRNSchema.index({ typeWork: 1 });
CompletedFRNSchema.index({ scRno: 1 });
CompletedFRNSchema.index({ createdAt: -1 });
CompletedFRNSchema.index({ frnId: 1 });

module.exports = mongoose.model('CompletedFRN', CompletedFRNSchema);
