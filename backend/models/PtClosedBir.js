const mongoose = require('mongoose');

const ptClosedBirSchema = new mongoose.Schema(
  {
    birRef: { type: String, trim: true, default: '' },

    division: {
      type: String,
      required: true,
    },
    model: { type: String, trim: true, required: true },
    configuration: { type: String, trim: true, default: '' },

    unitInwardDate: { type: String, required: true },
    fqcInwardDate: { type: String, default: '' },
    invoiceDate: { type: String, default: '' },
    approvedDate: { type: String, default: '' },

    supplier: { type: String, trim: true, default: '' },
    invoiceNo: { type: String, trim: true, default: '' },

    receivedQty: { type: String, trim: true, required: true },
    serial: { type: String, trim: true, default: '' },

    prevSwVersion: { type: String, trim: true, default: '' },
    presSwVersion: { type: String, trim: true, default: '' },
    swChangeRemarks: { type: String, trim: true, default: '' },

    hwChanges: { type: String, trim: true, default: '' },
    hwChangeRemarks: { type: String, trim: true, default: '' },

    accChanges: { type: String, enum: ['No Change', 'Added', 'Removed', 'Replaced', ''], default: '' },
    accDetails: { type: String, trim: true, default: '' },
    accChangeRemarks: { type: String, trim: true, default: '' },

    userManualUpdate: { type: String, trim: true, default: '' },
    serviceManualUpdate: { type: String, trim: true, default: '' },

    scEngineer: { type: String, trim: true, default: '' },
    psEngineer: { type: String, trim: true, default: '' },
    fqcRemarks: { type: String, trim: true, default: '' },
    techRemarks: { type: String, trim: true, default: '' },
    scInwardDate: { type: String, default: '' },
    scObservation: { type: String, trim: true, default: '' },
    requiredParts: { type: String, trim: true, default: '' },
    rootCause: { type: String, trim: true, default: '' },
    scActionPlan: { type: String, trim: true, default: '' },
    tentativeDate: { type: String, default: '' },
    shipDateToFqc: { type: String, default: '' },
    defUnitReceivedDate: { type: String, default: '' },
    replacementShipDate: { type: String, default: '' },
    fqcObservation: { type: String, trim: true, default: '' },
    fqcFinalRemarks: { type: String, trim: true, default: '' },
    tsVerificationDate: { type: String, default: '' },
    psVerificationDate: { type: String, default: '' },
    productTeamRemarks: { type: String, trim: true, default: '' },
    attachment: { type: String, default: '' },
    attachmentName: { type: String, default: '' },

    cnrCirculation: { type: String, trim: true, default: '' },
    cnrRefNo: { type: String, trim: true, default: '' },
    cnrReleaseDate: { type: String, default: '' },

    status: {
      type: String,
      enum: ['Approved', 'Closed'],
      default: 'Approved',
      required: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'ptclosedbirrecords',
  }
);

ptClosedBirSchema.index({ status: 1 });
ptClosedBirSchema.index({ division: 1 });
ptClosedBirSchema.index({ model: 1 });
ptClosedBirSchema.index({ birRef: 1 });
ptClosedBirSchema.index({ unitInwardDate: 1 });
ptClosedBirSchema.index({ approvedDate: 1 });
ptClosedBirSchema.index({ createdBy: 1 });

module.exports = mongoose.models.PtClosedBir || mongoose.model('PtClosedBir', ptClosedBirSchema);
