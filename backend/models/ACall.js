const mongoose = require('mongoose');

const aCallSchema = new mongoose.Schema(
  {
    division: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    callDate: { type: String, required: true },
    entryDate: { type: String, default: '' },
    scEng: { type: String, trim: true, default: '' },
    engineer: { type: String, trim: true, default: '' },
    customer: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    callType: { type: String, trim: true, default: '' },
    commType: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: 'Open' },
    remarks: { type: String, trim: true, default: '' },
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    collection: 'admincallregisters',
  }
);

aCallSchema.index({ status: 1 });
aCallSchema.index({ division: 1 });
aCallSchema.index({ callDate: 1 });
aCallSchema.index({ engineer: 1 });

module.exports = mongoose.models.ACall || mongoose.model('ACall', aCallSchema);
