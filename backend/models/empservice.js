// models/Service.js
// ─────────────────────────────────────────────────────────────────
//  WHAT CHANGED:
//  • division   — now Mixed type (accepts ObjectId ref OR plain string)
//  • divisionName — new fallback string field for when division is a name
//  • engineer   — same treatment (ObjectId ref OR plain string name)
//  This prevents "Cast to ObjectId failed" when the frontend sends
//  a plain division/engineer name instead of a MongoDB _id.
// ─────────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    // ── Status & Date ─────────────────────────────────────────
    status:    { type: String, default: 'pending',
                 enum: ['pending','in_progress','completed','escalated'] },
    entryDate: { type: String, default: '' },

    // ── Division ──────────────────────────────────────────────
    // Accepts EITHER a MongoDB ObjectId (from the Divisions collection)
    // OR a plain string name (e.g. "VENTILATOR") sent by the frontend.
    // Using Mixed prevents the "Cast to ObjectId failed" error.
    division:     { type: mongoose.Schema.Types.Mixed, default: null },
    divisionName: { type: String, default: '' }, // plain-string fallback

    // ── Service Entry ─────────────────────────────────────────
    scReNo:   { type: String, default: '' },
    scEng:    { type: String, default: '' },
    frnNo:    { type: String, default: '' },
    frnDate:  { type: String, default: '' },
    serComm:  { type: String, default: '' },
    rcvdDate: { type: String, default: '' },

    // ── Assignment ────────────────────────────────────────────
    stkCust:  { type: String, default: '' },
    reg:      { type: String, default: '' },
    branch:   { type: String, default: '' },

    // Engineer — same Mixed treatment as division
    engineer:     { type: mongoose.Schema.Types.Mixed, default: null },
    eng:          { type: String, default: '' }, // plain name string

    dealer:   { type: String, default: '' },
    custName: { type: String, default: '' },
    customer: { type: String, default: '' }, // alias kept for compatibility
    supplier: { type: String, default: '' },

    // ── Device ────────────────────────────────────────────────
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
    cost:        { type: String, default: '' },

    // ── Report & Dispatch ─────────────────────────────────────
    repType:     { type: String, default: '' },
    repGirNo:    { type: String, default: '' },
    typeWork:    { type: String, default: '' },
    type:        { type: String, default: '' }, // alias for typeWork
    shipSc:      { type: String, default: '' },
    repBrd:      { type: String, default: '' },
    shipComm:    { type: String, default: '' },
    dcNo:        { type: String, default: '' },
    typeReport:  { type: String, default: '' },
    destination: { type: String, default: '' },

    // ── Remarks ───────────────────────────────────────────────
    fieldRemarks: { type: String, default: '' },
    commWarrDetails: { type: String, default: '' },
    techRemarks:  { type: String, default: '' },
    components:   { type: String, default: '' },
    finalRemarks: { type: String, default: '' },
    commRemarks:  { type: String, default: '' },

    // ── PD Counters ───────────────────────────────────────────
    pdPfrn: { type: Number, default: 0 },
    pdObp:  { type: Number, default: 0 },
    pdUrp:  { type: Number, default: 0 },
    pdScc:  { type: Number, default: 0 },

    // ── Employee tracking ─────────────────────────────────────
    submittedBy: { type: String, default: '' }, // employee name who created it
    submittedAt: { type: String, default: '' },
  },
  {
    timestamps:  true,
    collection:  'services',
    // Allow any extra fields the frontend might send without schema errors
    strict: false,
  }
);

// ── INDEXES ───────────────────────────────────────────────────────
serviceSchema.index({ status:    1 });
serviceSchema.index({ reg:       1 });
serviceSchema.index({ scEng:     1 });
serviceSchema.index({ eng:       1 });
serviceSchema.index({ entryDate: -1 });
serviceSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Service
  || mongoose.model('Service', serviceSchema);
