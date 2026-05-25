const mongoose = require('mongoose');

const ptActivitySchema = new mongoose.Schema(
  {
    // ── Activity Info ─────────────────────────────────────────
    subject:     { type: String, trim: true, required: true },   // activity / subject / description
    description: { type: String, trim: true, default: '' },

    // ── Classification ────────────────────────────────────────
    division: { type: String, trim: true, default: '' },
    model:    { type: String, trim: true, default: '' },

    // ── Customer / Location ───────────────────────────────────
    customer: { type: String, trim: true, default: '' },
    region:   { type: String, trim: true, default: '' },
    branch:   { type: String, trim: true, default: '' },

    // ── People ────────────────────────────────────────────────
    engineer: { type: String, trim: true, default: '' },

    // ── Dates ─────────────────────────────────────────────────
    entryDate:  { type: String, required: true },
    dueDate:    { type: String, default: '' },
    closedDate: { type: String, default: '' },

    // ── Status & Remarks ──────────────────────────────────────
    status: {
      type: String,
      enum: ['Pending', 'Open', 'Closed', 'Completed', 'Cancelled'],
      default: 'Pending',
      required: true,
    },
    remarks:      { type: String, trim: true, default: '' },
    closeRemarks: { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ptactivityrecords',
  }
);

ptActivitySchema.index({ status: 1 });
ptActivitySchema.index({ division: 1 });
ptActivitySchema.index({ engineer: 1 });
ptActivitySchema.index({ entryDate: 1 });
ptActivitySchema.index({ createdBy: 1 });

module.exports = mongoose.models.PtActivity || mongoose.model('PtActivity', ptActivitySchema);
