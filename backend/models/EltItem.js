const mongoose = require('mongoose');

const eltItemSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    revalue: { type: Number, default: 0 },
    girNo: { type: String, trim: true, required: true },
    opt: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    loanItemId: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'elt_items',
  }
);

eltItemSchema.index({ date: -1 });
eltItemSchema.index({ division: 1 });
eltItemSchema.index({ partNo: 1 });
eltItemSchema.index({ girNo: 1 });

module.exports = mongoose.model('EltItem', eltItemSchema);
