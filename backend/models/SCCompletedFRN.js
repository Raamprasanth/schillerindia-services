// models/SCCompletedFRN.js
const mongoose = require('mongoose');

const SCCompletedFRNSchema = new mongoose.Schema(
  {
    // ── Link back to source FRN ───────────────────────────
    serviceId: {
      type: String,
      trim: true,
      default: '',
    },
    frnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FRN',
      default: null,
    },

    // ── Core service fields (auto-populated from FRN) ─────
    entryDate:  { type: String, trim: true, default: '' },
    scRno:      { type: String, trim: true, required: [true, 'SC Ref No is required'] },
    scEng:      { type: String, trim: true, default: '' },
    frnNo:      { type: String, trim: true, default: '' },
    region: {
      type: String,
      trim: true,

      default: '',
    },
    eng:        { type: String, trim: true, default: '' },
    customer:   { type: String, trim: true, default: '' },
    model:      { type: String, trim: true, default: '' },
    unitStatus: {
      type: String,
      trim: true,

      default: '',
    },
    defMod:     { type: String, trim: true, default: '' },  // Defective Module / Board
    defGir:     { type: String, trim: true, default: '' },  // DEF GIR No
    supplier:                         { type: String, trim: true, default: '' },
    year:                             { type: String, trim: true, default: '' },
    vendorName:                       { type: String, trim: true, default: '' },
    sbrRmaBltNo:                      { type: String, trim: true, default: '' },
    frnNumber:                        { type: String, trim: true, default: '' },
    warrantyReportedDate:             { type: String, default: '' },
    warrantyApprovedStatus:           { type: String, trim: true, default: '' },
    warrantyApprovedDate:             { type: String, default: '' },
    defGirNumber:                     { type: String, trim: true, default: '' },
    unitSerialNo:                     { type: String, trim: true, default: '' },
    partNo:                           { type: String, trim: true, default: '' },
    description:                      { type: String, trim: true, default: '' },
    defPartSerialNumber:              { type: String, trim: true, default: '' },
    defPartSn:                        { type: String, trim: true, default: '' },
    problemDetails:                   { type: String, trim: true, default: '' },
    itemDescription:                  { type: String, trim: true, default: '' },
    vendorTicketNumber:               { type: String, trim: true, default: '' },
    commercialToDetails:              { type: String, trim: true, default: '' },
    docketDetails:                    { type: String, trim: true, default: '' },
    receivedDateAtEsskay:             { type: String, default: '' },
    receivedBackAtSvc:                { type: String, default: '' },
    repairStatus:                     { type: String, trim: true, default: '' },
    amountChargedForRepair:           { type: String, trim: true, default: '' },
    softwareDetails:                  { type: String, trim: true, default: '' },
    licenceVersionModelConfiguration: { type: String, trim: true, default: '' },
    customerName:                     { type: String, trim: true, default: '' },
    warrantyType:                     { type: String, trim: true, default: '' },
    supplierWarrantyStatus:           { type: String, trim: true, default: '' },
    dcInvoiceNumberSupplier:          { type: String, trim: true, default: '' },
    frnEntryDate:                     { type: String, default: '' },
    shipDateFromServiceCenter:        { type: String, default: '' },
    dcInvoiceNo:                      { type: String, trim: true, default: '' },
    dcInvoiceDate:                    { type: String, default: '' },
    awbNo:                            { type: String, trim: true, default: '' },
    awbDate:                          { type: String, default: '' },
    replacementReceivedStatus:        { type: String, trim: true, default: '' },
    replacementReceivedDate:          { type: String, default: '' },
    billed:                           { type: String, trim: true, default: 'No' },
    billedAmount:                     { type: String, trim: true, default: '0' },
    dateOfInstallation:               { type: String, default: '' },
    doi:                              { type: String, default: '' },
    dateOfFailure:                    { type: String, default: '' },
    typeOfWorkSupplier:               { type: String, trim: true, default: '' },
    receivedPartInvoiceNumber:        { type: String, trim: true, default: '' },
    receivedPartInvoiceDate:          { type: String, default: '' },
    replacementGirNo:                 { type: String, trim: true, default: '' },
    replacedSpareBySupp:              { type: String, trim: true, default: '' },
    receivedPartSerialNumber:         { type: String, trim: true, default: '' },
    serviceCentreRemarks:             { type: String, trim: true, default: '' },

    // ── Update fields (filled by employee) ────────────────
    raEng:        { type: String, trim: true, default: '' },   // RA Engineer
    repBrdDate:   { type: String, default: '' },                // Repaired BRD STK Date (YYYY-MM-DD)
    dcNo:         { type: String, trim: true, default: '' },    // DC No  ← REQUIRED on update
    defUnitGir:   { type: String, trim: true, default: 'NA' }, // DEF Unit GIR No
    repGirSno:    { type: String, trim: true, default: '' },    // REP GIR SNO / UR

    finalRemarks: { type: String, trim: true, default: '' },   // ← REQUIRED on update
    techRemarks:  { type: String, trim: true, default: '' },
    components:   { type: String, trim: true, default: '' },   // Components Used to Repair

    // ── Dispatch / Shipping ───────────────────────────────
    typeWork: {
      type: String,
      trim: true,

      default: '',
    },
    reportType:   { type: String, trim: true, default: '' },   // stocklist / service report / job card
    destination:  { type: String, trim: true, default: '' },   // ← REQUIRED on update
    shipDateSC:   { type: String, default: '' },                // Ship Date from Service Center (YYYY-MM-DD)
    shipDateComm: { type: String, default: '' },                // Ship Date from Commercial     ← REQUIRED

    // ── Record status ─────────────────────────────────────
    status: {
      type: String,
      enum: ['pending_update','updated','closed'],
      default: 'pending_update',
    },

    // ── Division (for data isolation) ────────────────────
    division:   { type: String, trim: true, default: '' }, // plain division name, e.g. "SAG"

    // ── Audit ─────────────────────────────────────────────
    updatedBy:  { type: String, trim: true, default: '' },
    pdays:      { type: Number, default: null },  // null → computed live from createdAt
  },
  {
    timestamps: true,
    collection: 'sc_completed_frns',
  }
);

// ── Indexes ───────────────────────────────────────────────
SCCompletedFRNSchema.index({ division: 1 });
SCCompletedFRNSchema.index({ eng: 1, status: 1 });
SCCompletedFRNSchema.index({ scEng: 1 });
SCCompletedFRNSchema.index({ region: 1 });
SCCompletedFRNSchema.index({ unitStatus: 1 });
SCCompletedFRNSchema.index({ scRno: 1 });
SCCompletedFRNSchema.index({ createdAt: 1 });
SCCompletedFRNSchema.index({ frnId: 1 });
SCCompletedFRNSchema.index({ serviceId: 1 });


module.exports = mongoose.model('SCCompletedFRN', SCCompletedFRNSchema);
