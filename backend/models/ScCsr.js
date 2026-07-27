const mongoose = require('mongoose');

const scCsrSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true },
    description: { type: String, trim: true },
    qty: { type: Number, default: 0 },
    girNo: { type: String, trim: true },
    items: [{
      partNo: { type: String, trim: true },
      description: { type: String, trim: true },
      qty: { type: Number, default: 0 },
      girNo: { type: String, trim: true }
    }],
    fromLocation: { type: String, trim: true, default: '' },
    toLocation: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    toNo: { type: String, trim: true, default: '' },
    toRaisedDate: { type: Date },
    sparesReceivedDate: { type: Date },
    srRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Sr' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
    closedBy: { type: String, trim: true, default: '' },
    closeDate: { type: String, trim: true }
  },
  {
    timestamps: true,
    collection: 'sccsr_items'
  }
);

scCsrSchema.index({ date: -1 });
scCsrSchema.index({ division: 1 });
scCsrSchema.index({ partNo: 1 });
scCsrSchema.index({ girNo: 1 });

module.exports = mongoose.model('ScCsr', scCsrSchema);
