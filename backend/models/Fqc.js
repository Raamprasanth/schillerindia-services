const mongoose = require('mongoose');

const fqcSchema = new mongoose.Schema(
  {
    fqcNo:    { type: String, trim: true },

    // ── Device ────────────────────────────────────────────────
    device:   { type: String, trim: true, required: true },
    serial:   { type: String, trim: true, required: true },
    division: {
      type: String,
      enum: ['SHIPL', 'VENTILATOR', 'INJECTOR', 'RADIOLOGY', 'GANSHORN', 'HOLTER', 'MONITORS', 'MONITORS CON', 'VENT CON'],
      required: true,
    },
    customer: { type: String, trim: true, default: '—' },

    // ── QC Details ────────────────────────────────────────────
    type: {
      type: String,
      enum: ['Installation QC', 'AMC QC', 'Post-Repair QC', 'Periodic QC', 'Pre-Dispatch QC'],
      required: true,
    },
    engineer: { type: String, trim: true, required: true },
    date:     { type: String },
    score:    { type: Number, default: 0, min: 0, max: 100 },
    result: {
      type: String,
      enum: ['Pass', 'Fail', 'Conditional Pass', 'Pending Review'],
      required: true,
      default: 'Pending Review',
    },
    remarks:  { type: String, trim: true },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'fqcentries',
  }
);

fqcSchema.index({ result: 1 });
fqcSchema.index({ division: 1 });
fqcSchema.index({ engineer: 1 });
fqcSchema.index({ type: 1 });
fqcSchema.index({ date: 1 });

module.exports = mongoose.models.Fqc || mongoose.model('Fqc', fqcSchema);
