// models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    // ── Auto-generated ID ──────────────────────────────────────
    serviceId: { type: String, unique: true },

    // ── Group 1: Service Entry Details ────────────────────────
    division:   { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },
    scReNo:     { type: String, default: '' },
    scEng:      { type: String, default: '' },
    frnNo:      { type: String, default: '' },
    frnDate:    { type: String, default: '' },
    serComm:    { type: String, default: '' },
    rcvdDate:   { type: String, default: '' },

    // ── Group 2: Account & Assignment ─────────────────────────
    stkCust:    { type: String, default: '' },
    reg:        { type: String, default: '' },
    branch:     { type: String, default: '' },
    eng:        { type: String, default: '' },
    dealer:     { type: String, default: '' },
    custName:   { type: String, default: '' },
    customer:   { type: String, required: true, trim: true },
    supplier:   { type: String, default: '' },

    // ── Group 3: Device Details ───────────────────────────────
    model:       { type: String, default: '' },
    modelConfig: { type: String, default: '' },
    unitSl:      { type: String, default: '' },
    unitSts:     { type: String, default: '' },
    doi:         { type: String, default: '' },
    defMod:      { type: String, default: '' },
    partNo:      { type: String, default: '' },
    defPartSno:  { type: String, default: '' },
    defType:     { type: String, default: '' },
    typeAcc:     { type: String, default: '' },
    defGir:      { type: String, default: '' },
    cost:        { type: Number, default: 0 },

    // ── Group 4: Report & Dispatch ────────────────────────────
    repType:     { type: String, default: '' },
    repGirNo:    { type: String, default: '' },
    revalue:     { type: Number, default: 0 },

    type: {
      type: String,
      enum: [
        'Repaired','Unit Returned','External Repair','Scrapped',
        'Upgrade','Under Repair','Completed','Given to PSP',
        'RE-Export','Returned as it is','No Fault','OB Pending'
      ],
      required: true,
    },

    typeWork:    { type: String, default: '' },
    bscon:       { type: String, default: '' },
    shipSc:      { type: String, default: '' },
    repBrd:      { type: String, default: '' },
    shipComm:    { type: String, default: '' },
    dcNo:        { type: String, default: '' },
    typeReport:  { type: String, default: '' },
    destination: { type: String, default: '' },
    repairedDate:{ type: String, default: '' },
    repBrdDate:  { type: String, default: '' },
    repairRemarks:{ type: String, default: '' },
    cost:        { type: String, default: '' },
    timeTaken:   { type: String, default: '' },
    repairStatus:{ type: String, default: '' },

    // ── Group 5: Remarks ──────────────────────────────────────
    fieldRemarks: { type: String, default: '' },
    commWarrDetails: { type: String, default: '' },
    techRemarks:  { type: String, default: '' },
    components:   { type: String, default: '' },
    finalRemarks: { type: String, default: '' },
    commRemarks:  { type: String, default: '' },

    // ── Status & Dates ────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'escalated'],
      default: 'pending',
    },

    entryDate: { type: String, default: '' },

    // ── Pending Day counters ───────────────────────────────────
    pdPfrn: { type: Number, default: 0 },
    pdObp:  { type: Number, default: 0 },
    pdUrp:  { type: Number, default: 0 },
    pdScc:  { type: Number, default: 0 },

    // ── Engineer reference ────────────────────────────────────
    engineer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    location:    { type: String, default: '' },
    notes:       { type: String, default: '' },
    scheduledAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },

    // ── OB / Estimation workflow flags ────────────────────────
    // ✅ movedToEstimation: set to true when the employee saves an
    //    estimation from the OB Pending page.  The /ob-pending endpoint
    //    filters { movedToEstimation: { $ne: true } } so the record
    //    disappears from OB Pending permanently after this is set.
    movedToEstimation: { type: Boolean, default: false },
    obDeleted:         { type: Boolean, default: false },
    obStatus:          { type: String, default: 'pending' },   // e.g. 'Estimation', 'OB Pending'
    obPending:         { type: Boolean, default: false },

    // ── Estimation details (stored on Service for reference) ──
    estNo:         { type: String, default: '' },
    estDate:       { type: String, default: '' },
    estValidDate:  { type: String, default: '' },
    estAmount:     { type: Number, default: 0 },
    estStatus:     { type: String, default: '' },
    orderType:     { type: String, default: '' },  // New / Repair / Exchange
    estRaEng:      { type: String, default: '' },
    defUnitGir:    { type: String, default: '' },
    qty:           { type: Number, default: 1 },
    serviceCharge: { type: Number, default: 0 },
    itemsTotal:    { type: Number, default: 0 },
    estGroupTotal: { type: Number, default: 0 },
    estUpdatedBy:  { type: String, default: '' },
    estUpdatedAt:  { type: Date,   default: null },
    rtfrnSent:          { type: Boolean, default: false },
    rtfrnSentAt:        { type: Date,    default: null },
    rtobSent:           { type: Boolean, default: false },
    rtobSentAt:         { type: Date,    default: null },
    rtobCompleted:      { type: Boolean, default: false },
    rtobCompletedAt:    { type: String,  default: null },
    rturSent:           { type: Boolean, default: false },
    rturSentAt:         { type: Date,    default: null },
    rturCompleted:      { type: Boolean, default: false },
    rturCompletedAt:    { type: String,  default: null },
    rtfrnCompleted:     { type: Boolean, default: false },
    rtfrnCompletedAt:   { type: String,  default: null },
    toEscalationQueuedAt: { type: Date, default: null },
    toEscalationQueuedBy: { type: String, trim: true, default: '' },

    // ── Audit ─────────────────────────────────────────────────
    submittedBy:  { type: String, default: '' },
    submittedAt:  { type: String, default: '' },
    updatedAt:    { type: String, default: '' },
  },
  { timestamps: true }
);

serviceSchema.index({ division: 1 });
serviceSchema.index({ type: 1 });
serviceSchema.index({ status: 1 });


// Auto-generate serviceId
serviceSchema.pre('save', async function (next) {
  if (!this.serviceId) {
    const count = await mongoose.model('Service').countDocuments();
    this.serviceId = `SVC-${String(1001 + count).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
