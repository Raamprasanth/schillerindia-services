const mongoose = require('mongoose');

const scSrSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    qty: { type: Number, default: 0 },
    girNo: { type: String, trim: true, required: true },
    srRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Sr' },
    fromLocation: { type: String, trim: true, default: '' },
    toLocation: { type: String, trim: true, default: '' },
    toNo: { type: String, trim: true, default: '' },
    toRaisedDate: { type: Date },
    sparesReceivedDate: { type: Date },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' }
  },
  {
    timestamps: true,
    collection: 'scsr_items'
  }
);

scSrSchema.index({ date: -1 });
scSrSchema.index({ division: 1 });
scSrSchema.index({ partNo: 1 });
scSrSchema.index({ girNo: 1 });

module.exports = mongoose.model('ScSr', scSrSchema);
