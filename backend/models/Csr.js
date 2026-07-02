const mongoose = require('mongoose');

const csrSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    closeDate: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    qty: { type: Number, default: 0 },
    girNo: { type: String, trim: true, required: true },
    fromLocation: { type: String, trim: true, default: '' },
    toLocation: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    toNo: { type: String, trim: true, default: '' },
    toRaisedDate: { type: Date },
    sparesReceivedDate: { type: Date },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
    closedBy: { type: String, trim: true, default: '' }
  },
  {
    timestamps: true,
    collection: 'csr_items'
  }
);

csrSchema.index({ closeDate: -1 });
csrSchema.index({ date: -1 });
csrSchema.index({ division: 1 });
csrSchema.index({ partNo: 1 });

module.exports = mongoose.model('Csr', csrSchema);
