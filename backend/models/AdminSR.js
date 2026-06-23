const mongoose = require('mongoose');

const adminSrSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, required: true },
    division: { type: String, trim: true, required: true },
    partNo: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    qty: { type: Number, default: 0 },
    girNo: { type: String, trim: true, required: true },
    fromLocation: { type: String, trim: true, default: '' },
    toLocation: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    srId: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
    updatedBy: { type: String, trim: true, default: '' }
  },
  {
    timestamps: true,
    collection: 'admin_sr_items'
  }
);

adminSrSchema.index({ date: -1 });
adminSrSchema.index({ division: 1 });
adminSrSchema.index({ partNo: 1 });
adminSrSchema.index({ girNo: 1 });
adminSrSchema.index({ srId: 1 });

module.exports = mongoose.model('AdminSR', adminSrSchema);
