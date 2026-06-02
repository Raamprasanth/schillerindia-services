const mongoose = require('mongoose');

const ecloseSchema = new mongoose.Schema(
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
      enum: [
        'Application', 'Software', 'Technical', 'Demo', 'CRM', 'Training', 'Others',
        'Inbound', 'Outbound', 'Service', 'Complaint', 'Follow-Up', 'Enquiry', ''
      ],
      default: '',
    },

    // ── Location ──────────────────────────────────────────────
    call: {
      type: String,
      enum: ['Incoming', 'Outgoing', ''],
      default: '',
    },
    commType: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    supplier: { type: String, trim: true, default: '' },

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ecloserecords',
  }
);

// Indexes for common query patterns
ecloseSchema.index({ status: 1 });
ecloseSchema.index({ division: 1 });
ecloseSchema.index({ typeCall: 1 });
ecloseSchema.index({ scEngg: 1 });
ecloseSchema.index({ engineer: 1 });
ecloseSchema.index({ callDate: 1 });
ecloseSchema.index({ closeDate: 1 });
ecloseSchema.index({ customer: 1 });
ecloseSchema.index({ createdBy: 1 });

module.exports = mongoose.models.Eclose || mongoose.model('Eclose', ecloseSchema);
