const mongoose = require('mongoose');

const ptCallSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────────────────────
    scRefNo: { type: String, trim: true, default: '' },          // SC / Call Reference No

    // ── Customer ──────────────────────────────────────────────
    customer: { type: String, trim: true, required: true },
    region:   { type: String, trim: true, default: '' },
    branch:   { type: String, trim: true, default: '' },

    // ── Classification ────────────────────────────────────────
    division: { type: String, trim: true, required: true },
    model:    { type: String, trim: true, default: '' },

    // ── Call Details ──────────────────────────────────────────
    typeWork: {
      type: String,
      enum: ['AMC', 'Installation', 'Repair', 'PM', 'Warranty', 'Demo', 'Others', 'Other', ''],
      default: '',
    },
    callDate:  { type: String, required: true },
    entryDate: { type: String, default: '' },

    // ── People ────────────────────────────────────────────────
    engineer: { type: String, trim: true, default: '' },

    // ── Status & Remarks ──────────────────────────────────────
    status: {
      type: String,
      enum: ['Open', 'Active', 'Closed', 'Completed', 'Pending', 'Escalated'],
      default: 'Open',
      required: true,
    },
    remarks:     { type: String, trim: true, default: '' },
    closedDate:  { type: String, default: '' },
    closeRemarks:{ type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ptcallrecords',
  }
);

ptCallSchema.index({ status: 1 });
ptCallSchema.index({ division: 1 });
ptCallSchema.index({ customer: 1 });
ptCallSchema.index({ callDate: 1 });
ptCallSchema.index({ engineer: 1 });
ptCallSchema.index({ createdBy: 1 });

module.exports = mongoose.models.PtCall || mongoose.model('PtCall', ptCallSchema);
