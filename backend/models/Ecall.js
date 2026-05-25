const mongoose = require('mongoose');

const ecallSchema = new mongoose.Schema(
  {
    // ── Basic ─────────────────────────────────────────────────
    entryDate: { type: String, default: '' },
    callDate:  { type: String, required: true },

    division: {
      type: String,
      required: true,
    },

    region: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },

    // ── People ────────────────────────────────────────────────
    scEng:    { type: String, trim: true, default: '' },
    engineer: { type: String, trim: true, required: true },

    // ── Device ────────────────────────────────────────────────
    model: { type: String, trim: true, required: true },

    // ── Call Details ──────────────────────────────────────────
    callType: {
      type: String,
      enum: [
        'Application', 'Software', 'Technical', 'Demo', 'CRM', 'Training', 'Others',
        'Inbound', 'Outbound', 'Service', 'Complaint', 'Follow-Up', 'Enquiry',
      ],
      required: true,
    },
    commType: {
      type: String,
      enum: ['Phone', 'WhatsApp', 'Online', 'Field Visit', 'Email', 'In-Person', 'Video Call', ''],
      default: '',
    },
    duration: { type: String, trim: true, default: '' },

    status: {
      type: String,
      enum: ['Open', 'Closed', 'Pending', 'Escalated'],
      required: true,
      default: 'Open',
    },

    remarks: { type: String, trim: true, required: true },

    // ── Submission Info ───────────────────────────────────────
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: String, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ecallrecords',
  }
);

ecallSchema.index({ status: 1 });
ecallSchema.index({ callType: 1 });
ecallSchema.index({ division: 1 });
ecallSchema.index({ scEng: 1 });
ecallSchema.index({ engineer: 1 });
ecallSchema.index({ callDate: 1 });
ecallSchema.index({ createdBy: 1 });

module.exports = mongoose.models.Ecall || mongoose.model('Ecall', ecallSchema);
