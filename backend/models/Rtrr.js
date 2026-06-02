// models/Rtrr.js
const mongoose = require('mongoose');

const RtrrSchema = new mongoose.Schema(
  {
    // ── Core identity ────────────────────────────────────
    revertedDate: {
      type:     Date,
      default:  Date.now,
    },
    entryDate: {
      type:     String,     // ISO date string  "YYYY-MM-DD"
      required: [true, 'Entry date is required'],
      trim:     true,
    },
    division: {
      type:     String,
      required: [true, 'Division is required'],
      trim:     true,
    },
    scRefNo: {
      type:     String,
      required: [true, 'SC Ref No is required'],
      trim:     true,
      uppercase: true,
    },
    defGirNo: {
      type:     String,
      required: [true, 'DEF GIR No is required'],
      trim:     true,
      uppercase: true,
    },
    category: {
      type:    String,
      trim:    true,
      default: 'PFRN',
      enum:    ['PFRN', 'OB', 'UR'],
    },
    model: {
      type:     String,
      required: [true, 'Model is required'],
      trim:     true,
    },
    defBrdModName: {
      type:     String,
      required: [true, 'Def Brd/Mod Name is required'],
      trim:     true,
    },

    // ── Status & tracking ────────────────────────────────
    status: {
      type:    String,
      default: 'pending',
      enum:    ['pending', 'completed'],
    },

    // ── Repair update fields (filled via Update modal) ───
    repairedBy:   { type: String, trim: true, default: '' },
    raEng:        { type: String, trim: true, default: '' },
    defUnitGir:   { type: String, trim: true, default: '' },
    repGirNo:     { type: String, trim: true, default: '' },
    repBrd:       { type: String, trim: true, default: '' },    // date string
    typeReport:   { type: String, trim: true, default: '' },
    typeWork:     { type: String, trim: true, default: 'PFRN' },
    dcNo:         { type: String, trim: true, default: '' },
    doi: { type: String, trim: true, default: '' },
    fieldRemarks:  { type: String, trim: true, default: '' },
    repairedDate:  { type: String, trim: true, default: '' },
    finalRemarks: { type: String, trim: true, default: '' },
    repairRemarks:{ type: String, trim: true, default: '' },
    techRemarks:  { type: String, trim: true, default: '' },
    components:   { type: String, trim: true, default: '' },
    compUsedToRepair: { type: String, trim: true, default: '' },
    cost:         { type: String, trim: true, default: '' },
    timeTaken:    { type: String, trim: true, default: '' },
    repairStatus: { type: String, trim: true, default: '' },
    shipSc:       { type: String, trim: true, default: '' },    // date string
    shipComm:     { type: String, trim: true, default: '' },    // date string
    destination:  { type: String, trim: true, default: '' },
    problemObserved: { type: String, trim: true, default: '' },

    // ── Source link ──────────────────────────────────────────
    sourceEmpFrnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empfrn', default: null },
    sourceServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sourceCollection: { type: String, trim: true, default: '' },

    // ── Audit ────────────────────────────────────────────
    submittedBy: { type: String, trim: true, default: '' },
    submittedAt: { type: Date,   default: Date.now },
    updatedBy:   { type: String, trim: true, default: '' },
    updatedAt:   { type: Date },
  },
  {
    timestamps: true,
    collection:  'rtrrs',
  }
);

RtrrSchema.index({ scRefNo:   1 });
RtrrSchema.index({ defGirNo:  1 });
RtrrSchema.index({ division:  1 });
RtrrSchema.index({ status:    1 });
RtrrSchema.index({ entryDate: -1 });
RtrrSchema.index({ revertedDate: -1 });
RtrrSchema.index({ submittedBy: 1 });

module.exports = mongoose.model('Rtrr', RtrrSchema);
