// models/UnderRepair.js
const mongoose = require('mongoose');

const UnderRepairSchema = new mongoose.Schema(
  {
    // ── Link to Service record ─────────────────────────────
    serviceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },

    // ── Entry Details ──────────────────────────────────────
    entryDate:    { type: String, default: () => new Date().toISOString().split('T')[0] },
    scRno:        { type: String, required: [true, 'SC Ref No is required'], trim: true },
    scEng:        { type: String, trim: true, default: '' },
    frnNo:        { type: String, trim: true, default: '' },

    // ── Location & Assignment ──────────────────────────────
    region:       { type: String, trim: true, default: '' },
    engineer:     { type: String, trim: true, default: '' },   // field engineer
    raEng:        { type: String, trim: true, default: '' },   // repair activity engineer

    // ── Customer & Device ─────────────────────────────────
    custName:     { type: String, trim: true, default: '' },
    customer:     { type: String, trim: true, default: '' },
    model:        { type: String, trim: true, default: '' },
    unitStatus:   { type: String, trim: true, default: '' },   // OW, LAMC, CAMC, EW, IW, STOCK …
    partNo:       { type: String, trim: true, default: '' },

    // ── Defective Part Details ─────────────────────────────
    defMod:       { type: String, trim: true, default: '' },   // Def Mod / Brd Name
    defModBrdName:{ type: String, trim: true, default: '' },   // alias
    defGir:       { type: String, trim: true, default: '' },   // Def GIR No
    defGirNo:     { type: String, trim: true, default: '' },   // alias
    defUnitGir:   { type: String, trim: true, default: '' },   // DEF Unit GIR No (updated)

    // ── Repair Activity ────────────────────────────────────
    finalRemarks: { type: String, trim: true, default: '' },
    techRemarks:  { type: String, trim: true, default: '' },
    components:   { type: String, trim: true, default: '' },

    // ── Work Status ────────────────────────────────────────
    typeWork:     { type: String, trim: true, default: 'UNDER REPAIR' },
    typeOfWork:   { type: String, trim: true, default: 'UNDER REPAIR' },  // alias
    status:       {
      type: String,
      enum: ['UNDER REPAIR', 'Repaired', 'Completed', 'Scrapped', 'External Repair',
             'Unit Returned', 'No Fault', 'Given to PSP', 'OB Pending'],
      default: 'UNDER REPAIR',
    },

    // ── Dispatch Details ──────────────────────────────────
    repBrd:       { type: String, default: '' },   // Repaired BRD STK Date
    shipSc:       { type: String, default: '' },   // Ship Date from SC
    shipComm:     { type: String, default: '' },   // Ship Date from Commercial
    repGirNo:     { type: String, trim: true, default: '' },
    dcNo:         { type: String, trim: true, default: '' },
    typeReport:   { type: String, trim: true, default: '' },
    destination:  { type: String, trim: true, default: '' },

    // ── Metadata ──────────────────────────────────────────
    repairTeam:   { type: String, trim: true, default: '' },  // SR / RC etc.
    pdays:        { type: Number, default: 0 },
    updatedBy:    { type: String, trim: true, default: '' },
    updatedAt:    { type: Date,   default: null },
  },
  { timestamps: true }
);

// Prevent duplicate records for the same serviceId
UnderRepairSchema.index({ serviceId: 1 }, { unique: true, sparse: true });
// Fast queries by engineer name
UnderRepairSchema.index({ engineer: 1 });
UnderRepairSchema.index({ scEng: 1 });
UnderRepairSchema.index({ region: 1 });

module.exports = mongoose.model('UnderRepair', UnderRepairSchema);
