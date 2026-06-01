const mongoose = require('mongoose');

/**
 * PRF/OB Register — Mongoose Model
 * Covers both active (PRF/OB Register) and closed (Closed PRF/OB Register) entries.
 * `status` field drives which list an entry appears in.
 */

const PrfObSchema = new mongoose.Schema(
  {
    // ── Core identifiers ─────────────────────────────────────────────────
    refNo: {
      type: String,
      required: [true, 'PRF/OB Ref No is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['TO', 'SO', 'PRF', 'OB'],
      required: [true, 'Type is required'],
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
    },

    // ── Dates ─────────────────────────────────────────────────────────────
    entryDate:    { type: String, trim: true },   // stored as YYYY-MM-DD string
    receivedDate: { type: String, trim: true },
    executedDate: { type: String, trim: true },

    // ── Status ───────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Open', 'Pending', 'Closed', 'Completed', 'Rejected'],
      default: 'Open',
    },

    // ── Engineer & branch ────────────────────────────────────────────────
    scEng: { type: String, trim: true },   // Service Coordinator Engineer
    eng:   { type: String, trim: true },   // Field Engineer
    branch: {
      type: String,
      trim: true,
      enum: [
        'NORTH', 'EAST', 'WEST 1', 'WEST 2',
        'SOUTH 1 TN', 'SOUTH 2 KL', 'SOUTH 3 KA', 'SOUTH 4 AP/TL',
        'PUDUCHERRY', 'CG', '',
      ],
    },

    // ── Device / product ─────────────────────────────────────────────────
    model:          { type: String, trim: true },
    serialNo:       { type: String, trim: true },
    warrantyStatus: {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'STOCK', 'IW', ''],
      default: '',
    },
    partNo:         { type: String, trim: true },
    qty:            { type: Number, default: 1, min: 1 },
    unitPrice:      { type: Number, default: 0, min: 0 },
    totalAmount:    { type: Number, default: 0, min: 0 },

    // ── References ───────────────────────────────────────────────────────
    crmRefNo: { type: String, trim: true },   // matches screenshot "CRM Ref no."

    // ── Remarks ──────────────────────────────────────────────────────────
    remarks: { type: String, trim: true },

    // ── Audit trail ──────────────────────────────────────────────────────
    createdBy:  { type: String, trim: true },
    updatedBy:  { type: String, trim: true },
    updatedAt:  { type: Date },

    // ── Soft-link to service record ───────────────────────────────────────
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
  },
  {
    timestamps: true,   // adds createdAt / updatedAt automatically
    collection: 'prfob',
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────
PrfObSchema.index({ status: 1 });
PrfObSchema.index({ type: 1, status: 1 });
PrfObSchema.index({ division: 1 });
PrfObSchema.index({ scEng: 1 });
PrfObSchema.index({ entryDate: 1 });
PrfObSchema.index({ refNo: 1 });

// ── Virtual: isClosed ─────────────────────────────────────────────────────
PrfObSchema.virtual('isClosed').get(function () {
  return ['Closed', 'Completed', 'Rejected'].includes(this.status);
});

module.exports = mongoose.model('PrfOb', PrfObSchema);