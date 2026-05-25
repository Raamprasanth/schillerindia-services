// models/OBPending.js
const mongoose = require('mongoose');

const OBPendingSchema = new mongoose.Schema(
  {
    // ── Service reference ───────────────────────────────────
    serviceId: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Core fields (match frontend column names exactly) ───
    entryDate: {
      type: String,          // stored as "YYYY-MM-DD" string for easy filter comparison
      trim: true,
      default: '',
    },
    rcvdDate: {
      type: String,
      trim: true,
      default: '',
    },
    scRno: {                 // SC Ref No
      type: String,
      trim: true,
      required: [true, 'SC Ref No is required'],
    },
    scEng: {                 // SC Engineer
      type: String,
      trim: true,
      default: '',
    },
    frnNo: {                 // FRN Number
      type: String,
      trim: true,
      default: '',
    },
    region: {
      type: String,
      trim: true,
      default: '',
    },
    eng: {                   // Field Engineer
      type: String,
      trim: true,
      default: '',
    },
    customer: {              // Customer Name
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    unitStatus: {            // OW / LAMC / CAMC / EW / STOCK / IW
      type: String,
      trim: true,
      default: '',
    },
    defMod: {                // Defective Module / Board
      type: String,
      trim: true,
      default: '',
    },
    defGir: {                // DEF GIR No
      type: String,
      trim: true,
      default: '',
    },
    remarks: {               // Final Remarks
      type: String,
      trim: true,
      default: '',
    },
    typeWork: {              // Type of Work
      type: String,
      trim: true,
      default: 'OB Pending',
    },

    // ── OB-specific status ──────────────────────────────────
    obStatus: {
      type: String,
      enum: ['pending', 'approved', 'escalated', 'closed'],
      default: 'pending',
    },

    // ── Optional: manually override computed pdays ──────────
    pdays: {
      type: Number,
      default: null,         // null → computed live from createdAt on GET
    },
  },
  {
    timestamps: true,        // adds createdAt, updatedAt automatically
    collection: 'ob_pendings',
  }
);

// ── Indexes for fast queries ────────────────────────────────
OBPendingSchema.index({ obStatus: 1 });
OBPendingSchema.index({ region: 1 });
OBPendingSchema.index({ unitStatus: 1 });
OBPendingSchema.index({ scEng: 1 });
OBPendingSchema.index({ model: 1 });
OBPendingSchema.index({ scRno: 1 });
OBPendingSchema.index({ createdAt: 1 });

module.exports = mongoose.model('OBPending', OBPendingSchema);