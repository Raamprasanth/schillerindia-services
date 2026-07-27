const mongoose = require('mongoose');

const srSchema = new mongoose.Schema(
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
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' }
  },
  {
    timestamps: true,
    collection: 'sr_items'
  }
);

srSchema.index({ date: -1 });
srSchema.index({ division: 1 });
srSchema.index({ partNo: 1 });
srSchema.index({ girNo: 1 });

module.exports = mongoose.model('Sr', srSchema);
