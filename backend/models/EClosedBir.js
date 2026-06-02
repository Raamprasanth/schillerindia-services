const mongoose = require('mongoose');

const eClosedBirSchema = new mongoose.Schema(
  {
    birRefNo: { type: String, trim: true, default: '' },

    division:      { type: String, trim: true, required: true },
    model:         { type: String, trim: true, required: true },
    configuration: { type: String, trim: true, default: '' },

    inwardDate:     { type: String, required: true },
    fqcInwardDate:  { type: String, default: '' },
    invoiceDate:    { type: String, default: '' },
    approvedDate:   { type: String, default: '' },

    supplier:  { type: String, trim: true, default: '' },
    invoiceNo: { type: String, trim: true, default: '' },

    receivedQty: { type: String, trim: true, required: true },
    serial:      { type: String, trim: true, default: '' },

    prevSwVersion:   { type: String, trim: true, default: '' },
    presSwVersion:   { type: String, trim: true, default: '' },
    swChangeRemarks: { type: String, trim: true, default: '' },

    hwChanges:       { type: String, trim: true, default: '' },
    hwChangeRemarks: { type: String, trim: true, default: '' },

    accChanges:       { type: String, enum: ['No Change', 'Added', 'Removed', 'Replaced', ''], default: '' },
    accessoryDetails: { type: String, trim: true, default: '' },
    accChangeRemarks: { type: String, trim: true, default: '' },

    userManualUpdate:    { type: String, trim: true, default: '' },
    serviceManualUpdate: { type: String, trim: true, default: '' },
    scEngineer:          { type: String, trim: true, default: '' },
    psEngineer:          { type: String, trim: true, default: '' },
    fqcRemarks:          { type: String, trim: true, default: '' },
    techRemarks:         { type: String, trim: true, default: '' },

    cnrCirculation: { type: String, trim: true, default: '' },
    cnrRefNo:       { type: String, trim: true, default: '' },
    cnrReleaseDate: { type: String, default: '' },

    scInwardDate:        { type: String, default: '' },
    scObservation:       { type: String, trim: true, default: '' },
    requiredParts:       { type: String, trim: true, default: '' },
    rootCause:           { type: String, trim: true, default: '' },
    scActionPlan:        { type: String, trim: true, default: '' },
    tentativeDate:       { type: String, default: '' },
    shipDateToFqc:       { type: String, default: '' },
    defUnitReceivedDate: { type: String, default: '' },
    replacementShipDate: { type: String, default: '' },
    fqcObservation:      { type: String, trim: true, default: '' },
    fqcFinalRemarks:     { type: String, trim: true, default: '' },
    tsVerificationDate:  { type: String, default: '' },
    psVerificationDate:  { type: String, default: '' },
    productTeamRemarks:  { type: String, trim: true, default: '' },

    finalStatus: {
      type: String,
      enum: ['Closed', 'Approved', ''],
      default: 'Closed',
      required: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'eclosedbirrecords',
  }
);

eClosedBirSchema.index({ finalStatus: 1 });
eClosedBirSchema.index({ division: 1 });
eClosedBirSchema.index({ model: 1 });
eClosedBirSchema.index({ birRefNo: 1 });
eClosedBirSchema.index({ inwardDate: 1 });
eClosedBirSchema.index({ createdBy: 1 });

module.exports = mongoose.models.EClosedBir || mongoose.model('EClosedBir', eClosedBirSchema);
