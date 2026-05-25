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

const scrapSchema = new mongoose.Schema(
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
    model:      { type: String, default: '' },
    unitStatus: {
      type: String,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'REPEAT', 'STOCK', 'IW', 'Buy Back', 'Demo', ''],
      default: '',
    },
    defMod:     { type: String, default: '' },          // Defective Module / Board
    defGir:     { type: String, default: '' },          // DEF GIR No
    typeWork:   { type: String, default: 'SCRAPPED' },  // Type of Work
    rcvdDate:   { type: String, default: '' },          // Received Date at Service Centre

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
scrapSchema.index({ division: 1 });
scrapSchema.index({ scEng: 1 });
scrapSchema.index({ region: 1 });
scrapSchema.index({ entryDate: 1 });
scrapSchema.index({ unitStatus: 1 });
scrapSchema.index({ jobSheetStatus: 1 });

module.exports = mongoose.model('Scrap', scrapSchema);