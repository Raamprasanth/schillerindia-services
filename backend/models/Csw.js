// models/Scrap.js
const mongoose = require('mongoose');

// Sub-schema for each job sheet row (5 rows per record)
const jobSheetRowSchema = new mongoose.Schema({
  repairDate:     { type: String, default: '' },
  engineerName:   { type: String, default: '' },
  observation:    { type: String, default: '' },
  repairActivity: { type: String, default: '' },
  timeSpent:      { type: String, default: '' },
  remark:         { type: String, default: '' },
}, { _id: false });

const cswSchema = new mongoose.Schema(
  {
    // ── Linked service (optional — for auto-created scrap records) ──
    serviceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },

    // ── Core record fields (mirror from Service) ──────────────────
    entryDate:  { type: String, default: '' },          // YYYY-MM-DD
    scRno:      { type: String, default: '' },          // SC Ref No
    scEng:      { type: String, default: '' },          // SC Engineer
    frnNo:      { type: String, default: '' },          // FRN No
    region:     { type: String, default: '' },          // Region
    engineer:   { type: String, default: '' },          // Field Engineer
    customer:   { type: String, required: true, trim: true },
    year:       { type: String, default: '' },
    vendorName: { type: String, default: '' },
    model:      { type: String, default: '' },
    unitSerialNo: { type: String, default: '' },
    unitStatus: {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'REPEAT', 'STOCK', 'IW', 'Buy Back', 'Demo', ''],
      default: '',
    },
    problemDetails: { type: String, default: '' },
    partNo:     { type: String, default: '' },
    itemDescription: { type: String, default: '' },
    defMod:     { type: String, default: '' },          // Defective Module / Board
    defGir:     { type: String, default: '' },          // DEF GIR No
    defPartSn:  { type: String, default: '' },
    vendorTicketNumber: { type: String, default: '' },
    commercialToDetails: { type: String, default: '' },
    docketDetails: { type: String, default: '' },
    receivedDateAtEsskay: { type: String, default: '' },
    receivedBackAtSvc: { type: String, default: '' },
    repairStatus: { type: String, default: '' },
    amountChargedForRepair: { type: String, default: '' },
    softwareDetails: { type: String, default: '' },
    serviceCentreComments: { type: String, default: '' },
    typeWork:   { type: String, default: 'SCRAPPED' },  // Type of Work
    rcvdDate:   { type: String, default: '' },          // Received Date at Service Centre

    // ── Supplier Warranty Fields ──────────────────────────────────
    supplier:   { type: String, default: '' },
    srrRmaBltNo: { type: String, default: '' },
    warrReportedDate: { type: String, default: '' },
    warrApprovedStatus: { type: String, default: '' },
    warrApprovedDate: { type: String, default: '' },
    warrType:   { type: String, default: '' },
    supplierWarrStatus: { type: String, default: '' },
    defInvoiceNoSupplier: { type: String, default: '' },
    shipDateFromSc: { type: String, default: '' },
    dcInvoiceNo: { type: String, default: '' },
    dcInvoiceDate: { type: String, default: '' },
    awbNo:      { type: String, default: '' },
    awbDate:    { type: String, default: '' },
    repRepaired: { type: String, default: '' },
    replacementReceivedStatus: { type: String, default: '' },
    replacementReceivedDate: { type: String, default: '' },
    billed:     { type: String, trim: true, default: 'No' },
    billedAmount: { type: String, trim: true, default: '0' },
    dateOfInstallation: { type: String, default: '' },
    doi:        { type: String, default: '' },
    dateOfFailure: { type: String, default: '' },
    typeWorkSupplier: { type: String, default: '' },
    rcdPartInvoiceNo: { type: String, default: '' },
    rcdPartInvoiceDate: { type: String, default: '' },
    repGirNo:   { type: String, default: '' },
    replacedSpareBySupp: { type: String, trim: true, default: '' },
    rcdPartSerialNo: { type: String, default: '' },
    // ── Pending day counters (computed or stored) ─────────────────
    pdPfrn:     { type: Number, default: 0 },           // Pending Days (PFRN)
    pdObp:      { type: Number, default: 0 },           // Pending Days (OBP)
    pdUrp:      { type: Number, default: 0 },           // Pending Days (URP)
    pdScc:      { type: Number, default: 0 },           // Pending Days (SCC)

    // ── Job Sheet fields ──────────────────────────────────────────
    jobSheetRows: {
      type: [jobSheetRowSchema],
      default: () => Array.from({ length: 5 }, () => ({
        repairDate: '', engineerName: '', observation: '',
        repairActivity: '', timeSpent: '', remark: '',
      })),
    },
    jobSheetStatus: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Scrapped'],
      default: 'Pending',
    },
    jobSheetUpdated: { type: Boolean, default: false },

    // ── Division (for data isolation) ────────────────────────────
    division:   { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────────
    addedBy:    { type: String, default: '' },
    updatedBy:  { type: String, default: '' },
  },
  { timestamps: true }
);

// Indexes for faster queries
cswSchema.index({ division: 1 });
cswSchema.index({ scEng: 1 });
cswSchema.index({ region: 1 });
cswSchema.index({ entryDate: 1 });
cswSchema.index({ unitStatus: 1 });
cswSchema.index({ jobSheetStatus: 1 });
cswSchema.index({ serviceId: 1 });


module.exports = mongoose.model('Csw', cswSchema);
