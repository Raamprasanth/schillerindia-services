// models/EmpOBPending.js
const mongoose = require('mongoose');

const empObPendingSchema = new mongoose.Schema(
  {
    // ── Link to Service ─────────────────────────────
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      unique: true,
    },

    // ── Employee Ownership (IMPORTANT) ─────────────
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
    },

    // ── Auto-copied from Service ───────────────────
    entryDate:  { type: String, default: '' },
    scReNo:     { type: String, default: '' },
    scEng:      { type: String, default: '' },
    frnNo:      { type: String, default: '' },
    reg:        { type: String, default: '' },
    eng:        { type: String, default: '' },
    custName:   { type: String, default: '' },
    model:      { type: String, default: '' },
    unitSl:     { type: String, default: '' },
    unitSts:    { type: String, default: '' },
    defMod:     { type: String, default: '' },
    defGir:     { type: String, default: '' },
    typeWork:   { type: String, default: '' },
    repType:    { type: String, default: 'NA' },
    finalRemarks:{ type: String, default: '' },

    // ── Pending Days ───────────────────────────────
    pdOb: { type: Number, default: 0 },

    // ── OB Status Update ───────────────────────────
    obStatus: {
      type: String,
      enum: [
        'OB Pending',
        'UNDER REPAIR',
        'Repaired',
        'Unit Returned',
        'External Repair',
        'Scrapped',
        'Given to PSP',
        'No Fault',
        'Returned as it is',
      ],
      default: 'OB Pending',
    },

    // ── Employee Editable Fields ───────────────────
    obRaEng:        { type: String, default: '' },
    obDefUnitGir:   { type: String, default: '' },
    obTechRemarks:  { type: String, default: '' },
    obFinalRemarks: { type: String, default: '' },
    obComponents:   { type: String, default: '' },
    obRepGirNo:     { type: String, default: '' },
    obTypeReport:   { type: String, default: '' },
    obRepBrd:       { type: String, default: '' },
    obShipSc:       { type: String, default: '' },
    obShipComm:     { type: String, default: '' },
    obDcNo:         { type: String, default: '' },
    obDestination:  { type: String, default: '' },

    // ── Audit ──────────────────────────────────────
    submittedBy: { type: String, default: '' },

    obUpdatedBy: { type: String, default: '' },
    obUpdatedAt: { type: Date, default: null },

    lastModifiedByRole: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
    },
  },
  { timestamps: true }
);

// ── INDEXES (NO CLASH + FAST FILTERING) ───────────
empObPendingSchema.index({ employeeId: 1, obStatus: 1 });
empObPendingSchema.index({ scEng: 1, obStatus: 1 });
empObPendingSchema.index({ reg: 1 });
empObPendingSchema.index({ entryDate: -1 });

// ── EXPORT ────────────────────────────────────────
module.exports = mongoose.model('EmpOBPending', empObPendingSchema, 'emp_ob_pending');
