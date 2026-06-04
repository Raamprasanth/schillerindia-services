// models/EstimationPending.js
// Collection: estimationpending
// Receives entries from:
//   1. empServiceRoutes (auto-push when unitSts OW/LAMC + repType NA)
//   2. empob-pending    (manual push after OB update → pushToEstimation())
//
// Mount in server.js:
//   app.use('/api/emp/estimation', require('./routes/estimationPending'));

const mongoose = require('mongoose');

const estimationPendingSchema = new mongoose.Schema(
  {
    // ── Link back to the originating Service record ──────
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },

    // ── Source tag ────────────────────────────────────────
    // 'service' = auto-created from empServiceRoutes
    // 'ob'      = pushed from OB Pending after update
    source: { type: String, trim: true, default: 'service' },

    // ── Service / Customer info (copied at creation) ──────
    entryDate: { type: String, default: '' },
    rcvdDate:  { type: String, default: '' },
    scReNo:    { type: String, trim: true, default: '' },
    scEng:     { type: String, trim: true, default: '' },
    frnNo:     { type: String, trim: true, default: '' },
    frnDate:   { type: String, trim: true, default: '' },
    reg:       { type: String, trim: true, default: '' },
    branch:    { type: String, trim: true, default: '' },
    eng:       { type: String, trim: true, default: '' },
    dealer:    { type: String, trim: true, default: '' },
    custName:  { type: String, trim: true, default: '' },
    customer:  { type: String, trim: true, default: '' },
    model:     { type: String, trim: true, default: '' },
    unitSts:   { type: String, trim: true, default: '' },
    defMod:    { type: String, trim: true, default: '' },
    defGir:    { type: String, trim: true, default: '' },
    defPartSno:{ type: String, trim: true, default: '' },
    typeWork:  { type: String, trim: true, default: '' },
    repType:   { type: String, trim: true, default: 'NA' },

    // ── OB Pending update fields ──────────────────────────
    // Populated when source === 'ob' (pushed from ob-pending.html)
    obRaEng:        { type: String, trim: true, default: '' },
    obDefUnitGir:   { type: String, trim: true, default: '' },
    obRepGirNo:     { type: String, trim: true, default: '' },
    obFinalRemarks: { type: String, trim: true, default: '' },
    obStatus:       { type: String, trim: true, default: '' },
    obUpdatedBy:    { type: String, trim: true, default: '' },
    obUpdatedAt:    { type: Date,   default: null },
    obRepBrd:       { type: String, trim: true, default: '' },
    obShipSc:       { type: String, trim: true, default: '' },
    obShipComm:     { type: String, trim: true, default: '' },
    obDcNo:         { type: String, trim: true, default: '' },
    obDestination:  { type: String, trim: true, default: '' },
    obComponents:   { type: String, trim: true, default: '' },
    obTypeReport:   { type: String, trim: true, default: '' },
    obd:            { type: String, trim: true, default: '' },
    obDetails:      { type: String, trim: true, default: '' },

    // ── Estimation Details (filled in empestpend.html) ───
    estNo:        { type: String, trim: true, default: '' },
    estDate:      { type: String, trim: true, default: '' },
    estValidDate: { type: String, trim: true, default: '' },
    estAmount:    { type: Number, default: 0 },
    estStatus:    { type: String, trim: true, default: 'Estimation Pending' },
    orderType:    { type: String, trim: true, default: '' },
    estRaEng:     { type: String, trim: true, default: '' },
    techRemarks:  { type: String, trim: true, default: '' },
    finalRemarks: { type: String, trim: true, default: '' },
    components:   { type: String, trim: true, default: '' },
    revalue:      { type: Number, default: 0 },
    partNo:       { type: String, trim: true, default: '' },
    qty:          { type: Number, default: 1 },
    pricePerUnit: { type: Number, default: 0 },
    serviceCharge:{ type: Number, default: 0 },
    itemsTotal:   { type: Number, default: 0 },
    estGroupId:   { type: String, trim: true, default: '' },
    estLineNo:    { type: Number, default: 1 },
    estGroupTotal:{ type: Number, default: 0 },

    // ── Audit ─────────────────────────────────────────────
    submittedBy:  { type: String, trim: true, default: '' },
    submittedAt:  { type: Date,   default: null },
    estUpdatedBy: { type: String, trim: true, default: '' },
    estUpdatedAt: { type: Date,   default: null },

    // ── Escalation queues ─────────────────────────────────
    escalationQueuedAt:   { type: Date,   default: null },
    escalationQueuedBy:   { type: String, trim: true, default: '' },
    srEscalationQueuedAt: { type: Date,   default: null },
    srEscalationQueuedBy: { type: String, trim: true, default: '' },
    toEscalationQueuedAt: { type: Date,   default: null },
    toEscalationQueuedBy: { type: String, trim: true, default: '' },

    // ── Repair team flags ─────────────────────────────────
    // Set to true when RTFRN/RTOB is created for this estimation
    rtfrnSent:        { type: Boolean, default: false },
    rtfrnSentAt:      { type: Date,    default: null },
    rtfrnCompleted:   { type: Boolean, default: false },  // true when RTFRN marks status=completed
    rtfrnCompletedAt: { type: Date,    default: null },

    rtobSent:         { type: Boolean, default: false },
    rtobSentAt:       { type: Date,    default: null },
    rtobCompleted:    { type: Boolean, default: false },  // true when RTOB marks status=completed → RS button becomes RC
    rtobCompletedAt:  { type: Date,    default: null },

    rturCompleted:    { type: Boolean, default: false },
    rturCompletedAt:  { type: Date,    default: null },
  },
  {
    timestamps: true,
    collection: 'estimationpending',
  }
);

// Indexes for fast lookups
estimationPendingSchema.index({ serviceId: 1 });
estimationPendingSchema.index({ source: 1 });
estimationPendingSchema.index({ estNo: 1 });
estimationPendingSchema.index({ scEng: 1 });
estimationPendingSchema.index({ eng: 1 });
estimationPendingSchema.index({ submittedBy: 1 });
estimationPendingSchema.index({ entryDate: -1 });
estimationPendingSchema.index({ obUpdatedAt: -1 });

module.exports =
  mongoose.models.EstimationPending ||
  mongoose.model('EstimationPending', estimationPendingSchema);
