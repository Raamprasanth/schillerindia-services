const mongoose = require('mongoose');

const ptCallRegisterSchema = new mongoose.Schema(
  {
    division:   { type: String, trim: true, default: '' },
    region:     { type: String, trim: true, default: '' },
    branch:     { type: String, trim: true, default: '' },
    callDate:   { type: String, required: true },
    entryDate:  { type: String, default: '' },
    scEng:      { type: String, trim: true, default: '' },
    engineer:   { type: String, trim: true, default: '' },
    model:      { type: String, trim: true, default: '' },
    callType:   {
      type: String,
      enum: ['Inbound', 'Outbound', 'Service', 'Complaint', 'Follow-Up', 'Enquiry', ''],
      default: '',
    },
    commType:   {
      type: String,
      enum: ['Phone', 'WhatsApp', 'Email', 'In-Person', 'Video Call', ''],
      default: '',
    },
    duration:   { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Pending', 'Escalated'],
      default: 'Open',
      required: true,
    },
    remarks:     { type: String, trim: true, default: '' },
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: Date },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ptcallregisters',
  }
);

ptCallRegisterSchema.index({ status: 1 });
ptCallRegisterSchema.index({ division: 1 });
ptCallRegisterSchema.index({ callDate: 1 });
ptCallRegisterSchema.index({ engineer: 1 });

module.exports = mongoose.models.PtCallRegister || mongoose.model('PtCallRegister', ptCallRegisterSchema);
