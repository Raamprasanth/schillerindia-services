// models/EmpFRN.js
const mongoose = require('mongoose');

const empfrnSchema = new mongoose.Schema(
  {
    // ── Core identifiers ──────────────────────────────────
    serviceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null }, // ✅ added — was missing, caused undefined in CompletedFRN copy
    scRno:       { type: String, trim: true },
    frnNo:       { type: String, trim: true },
    entryDate:   { type: String },
    rcvdDate:    { type: String, default: '' },

    // ── People ────────────────────────────────────────────
    scEng:       { type: String, trim: true },
    eng:         { type: String, trim: true },
    raEng:       { type: String, trim: true },

    // ── Customer & Location ───────────────────────────────
    customer:    { type: String, trim: true },
    region:      { type: String, trim: true },
    branch:      { type: String, trim: true },
    dealer:      { type: String, trim: true, default: '' },
    destination: { type: String, trim: true },
    division:    { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },
    divisionName:{ type: String, trim: true, default: '' },

    // ── Unit / Product ────────────────────────────────────
    model:       { type: String, trim: true },
    unitSl:      { type: String, trim: true, default: '' },
    unitStatus:  {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'STOCK', 'IW', 'Demo', 'Repeat', 'Buy Back', ''],
      default: '',
    },
    defMod:      { type: String, trim: true },
    defGir:      { type: String, trim: true },
    defUnitGir:  { type: String, trim: true },
    defPartSno:  { type: String, trim: true, default: '' },

    // ── Work Details ──────────────────────────────────────
    typeWork:    { type: String, trim: true },
    bscon:       { type: String, trim: true, default: '' },
    finalRemarks:{ type: String, trim: true },
    techRemarks: { type: String, trim: true },
    components:  { type: String, trim: true },
    revalue:     { type: Number, default: 0 },

    // ── Dates ─────────────────────────────────────────────
    repBrd:      { type: String },
    shipSc:      { type: String },
    shipComm:    { type: String },

    // ── OB / Dispatch ─────────────────────────────────────
    repGirNo:    { type: String, trim: true },
    typeReport:  { type: String, trim: true },
    dcNo:        { type: String, trim: true },

    // ── Estimation Fields ─────────────────────────────────
    estNo:       { type: String, trim: true },
    estDate:     { type: String },
    estAmount:   { type: Number, default: 0 },
    estStatus:   { type: String, trim: true },
    estRaEng:    { type: String, trim: true },
    estRemark:   { type: String, trim: true },
    partNo:      { type: String, trim: true },
    qty:         { type: Number, default: 1 },
    pricePerUnit:{ type: Number, default: 0 },
    serviceCharge:{ type: Number, default: 0 },
    itemsTotal:   { type: Number, default: 0 },
    estGroupTotal:{ type: Number, default: 0 },
    approvalDate:{ type: String },

    // ── Computed / Cached ─────────────────────────────────
    pdays:       { type: Number, default: 0 },

    // ── Status ────────────────────────────────────────────
    status: {
      type: String,
      // ✅ under_repair added — was missing, caused ValidationError when Same GIR = No
      enum: ['pending', 'completed', 'scrapped', 'estimation', 'under_repair', 'external_repair', 'supplier_warranty'],
      default: 'pending',
    },

    rtfrnSent:        { type: Boolean, default: false },
    rtfrnSentAt:      { type: Date, default: null },
    rtfrnCompleted:   { type: Boolean, default: false },
    rtfrnCompletedAt: { type: Date, default: null },

    // ── Audit ─────────────────────────────────────────────
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: null },
    updatedAt:   { type: Date },
    escalationQueuedAt: { type: Date, default: null },
    escalationQueuedBy: { type: String, trim: true, default: '' },
    srEscalationQueuedAt: { type: Date, default: null },
    srEscalationQueuedBy: { type: String, trim: true, default: '' },
    toEscalationQueuedAt: { type: Date, default: null },
    toEscalationQueuedBy: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'empfrns',
  }
);

// ── Indexes ───────────────────────────────────────────────
empfrnSchema.index({ status: 1 });
empfrnSchema.index({ region: 1 });
empfrnSchema.index({ eng: 1 });
empfrnSchema.index({ scEng: 1 });
empfrnSchema.index({ entryDate: 1 });
empfrnSchema.index({ unitStatus: 1 });
empfrnSchema.index({ division: 1 });
empfrnSchema.index({ divisionName: 1 });
empfrnSchema.index({ serviceId: 1 });


// ── Virtual: recalculate pending days on read ─────────────
empfrnSchema.virtual('pendingDays').get(function () {
  if (!this.createdAt) return 0;
  return Math.floor((Date.now() - new Date(this.createdAt).getTime()) / 86400000);
});

// ── Pre-save: auto-fill pdays before saving ───────────────
empfrnSchema.pre('save', function (next) {
  if (this.createdAt) {
    this.pdays = Math.floor((Date.now() - new Date(this.createdAt).getTime()) / 86400000);
  }
  next();
});

module.exports = mongoose.models.Empfrn || mongoose.model('Empfrn', empfrnSchema);
