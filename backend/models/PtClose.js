const mongoose = require('mongoose');

const ptCloseSchema = new mongoose.Schema(
  {
    entryDate: { type: String, default: '' },
    callDate: { type: String, required: true },
    closeDate: { type: String, required: true },

    division: {
      type: String,
      required: true,
    },
    typeCall: {
      type: String,
      enum: [
        'Inbound', 'Outbound', 'Service', 'Complaint', 'Follow-Up', 'Enquiry',
        'Application', 'Software', 'Technical', 'Demo', 'CRM', 'Training', ''
      ],
      default: '',
    },

    call: {
      type: String,
      enum: ['Incoming', 'Outgoing', ''],
      default: '',
    },
    commType: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    supplier: { type: String, trim: true, default: '' },

    branch: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },

    scEngg: { type: String, trim: true, default: '' },
    engineer: { type: String, trim: true, required: true },

    customer: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, required: true },
    girSno: { type: String, trim: true, default: '' },
    serialNo: { type: String, trim: true, default: '' },
    defGir: { type: String, trim: true, default: '' },

    status: {
      type: String,
      enum: ['Closed', 'Cancelled', 'Open', 'Pending'],
      default: 'Closed',
      required: true,
    },

    remarks: { type: String, trim: true, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ptcloserecords',
  }
);

ptCloseSchema.index({ status: 1 });
ptCloseSchema.index({ division: 1 });
ptCloseSchema.index({ typeCall: 1 });
ptCloseSchema.index({ scEngg: 1 });
ptCloseSchema.index({ engineer: 1 });
ptCloseSchema.index({ callDate: 1 });
ptCloseSchema.index({ closeDate: 1 });
ptCloseSchema.index({ customer: 1 });
ptCloseSchema.index({ createdBy: 1 });

module.exports = mongoose.models.PtClose || mongoose.model('PtClose', ptCloseSchema);
