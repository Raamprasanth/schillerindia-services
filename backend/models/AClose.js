const mongoose = require('mongoose');

const aCloseSchema = new mongoose.Schema(
  {
    // ── Dates ─────────────────────────────────────────────────
    entryDate: { type: String, default: '' },
    callDate:  { type: String, required: true },
    closeDate: { type: String, required: true },

    // ── Classification ────────────────────────────────────────
    division: {
      type: String,
      required: true,
    },
    typeCall: {
      type: String,
      enum: ['Inbound', 'Outbound', 'Service', 'Complaint', 'Follow-Up', 'Enquiry', 'Application', 'Software', 'Technical', 'Demo', 'CRM', 'Training', 'Others', 'Other', ''],
      default: '',
    },

    // ── Location ──────────────────────────────────────────────
    branch: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },

    // ── People ────────────────────────────────────────────────
    scEngg:   { type: String, trim: true, default: '' },
    engineer: { type: String, trim: true, required: true },

    // ── Device / Customer ─────────────────────────────────────
    customer: { type: String, trim: true, default: '' },
    model:    { type: String, trim: true, required: true },
    girSno:   { type: String, trim: true, default: '' },   // Serial / GIR No
    serialNo: { type: String, trim: true, default: '' },   // alias
    defGir:   { type: String, trim: true, default: '' },   // alias

    // ── Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Closed', 'Cancelled', 'Open', 'Pending'],
      default: 'Closed',
      required: true,
    },

    // ── Notes ─────────────────────────────────────────────────
    remarks: { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    collection: 'adminclosedrecords',
  }
);

// Indexes for common query patterns
aCloseSchema.index({ status: 1 });
aCloseSchema.index({ division: 1 });
aCloseSchema.index({ typeCall: 1 });
aCloseSchema.index({ scEngg: 1 });
aCloseSchema.index({ engineer: 1 });
aCloseSchema.index({ callDate: 1 });
aCloseSchema.index({ closeDate: 1 });
aCloseSchema.index({ customer: 1 });
aCloseSchema.index({ createdBy: 1 });

module.exports = mongoose.models.AClose || mongoose.model('AClose', aCloseSchema);
