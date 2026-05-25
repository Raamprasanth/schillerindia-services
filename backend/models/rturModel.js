// models/rturModel.js
// ─────────────────────────────────────────────────────────────────────────────
// Repair Activity UR — Mongoose Schema
// Every field maps 1-to-1 with rtur.html:
//   • submitAdd()    payload  → Add Panel fields
//   • submitUpdate() payload  → Update Modal fields
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const rturSchema = new mongoose.Schema(
  {
    // ════════════════════════════════════════════════════════════════════════
    // ADD PANEL  ─  POST /api/rtur
    // ════════════════════════════════════════════════════════════════════════

    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      index: true,
    },

    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
      index: true,
    },

    scRefNo: {
      type: String,
      required: [true, 'SC Ref No is required'],
      trim: true,
      uppercase: true,
      index: true,
    },

    defGirNo: {
      type: String,
      required: [true, 'DEF GIR No is required'],
      trim: true,
      uppercase: true,
      index: true,
    },

    // category filter in rtur.html: UR / PFRN / OB
    category: {
      type: String,
      enum: ['UR', 'PFRN', 'OB'],
      default: 'UR',
      index: true,
    },

    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },

    defBrdModName: {
      type: String,
      required: [true, 'Def Brd/Mod Name is required'],
      trim: true,
    },

    // status values must match rtur.html status-pill logic:
    // pending | inprogress | completed | on_hold | scrapped
    status: {
      type: String,
      enum: ['pending', 'inprogress', 'completed', 'on_hold', 'scrapped'],
      default: 'pending',
      index: true,
    },

    // EMP_NAME from localStorage — set by frontend on POST
    submittedBy: {
      type: String,
      trim: true,
      default: '',
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    sourceServiceId: {
      type: String,
      default: '',
      index: true,
    },

    // ════════════════════════════════════════════════════════════════════════
    // UPDATE MODAL  ─  PUT /api/rtur/:id
    // ════════════════════════════════════════════════════════════════════════

    // "Repaired By" stores the selected repair engineer / assignee name from the UI
    repairedBy: {
      type: String,
      trim: true,
      default: '',
    },

    // "Component Used to Repair"
    compUsedToRepair: {
      type: String,
      trim: true,
      default: '',
    },

    // "Repaired BRD Stk Date"
    repBrdDate: {
      type: Date,
      default: null,
    },

    // "DC No"
    dcNo: {
      type: String,
      trim: true,
      default: '',
    },

    // "Tech Remarks" — required on update
    techRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    // "Final Remarks" — required on update
    finalRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    repairRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    cost: {
      type: String,
      trim: true,
      default: '',
    },

    timeTaken: {
      type: String,
      trim: true,
      default: '',
    },

    repairStatus: {
      type: String,
      trim: true,
      default: '',
    },

    // "Additional Notes"
    addNotes: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Dispatch & Return section ──────────────────────────────────────────

    // "Return Date to Field"
    returnDate: {
      type: Date,
      default: null,
    },

    // "Return DC No"
    returnDcNo: {
      type: String,
      trim: true,
      default: '',
    },

    // "Destination / Location"
    destination: {
      type: String,
      trim: true,
      default: '',
    },

    doi: { type: String, trim: true, default: '' },
    fieldRemarks: { type: String, trim: true, default: '' },
    repairedDate: { type: String, trim: true, default: '' },

    // ── Audit ──────────────────────────────────────────────────────────────

    // EMP_NAME from localStorage — set by frontend on PUT
    updatedBy: {
      type: String,
      trim: true,
      default: '',
    },

    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,        // auto createdAt & updatedAt from Mongoose
    collection: 'rturs',
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL — noOfDays
// rtur.html calcDays() does this on the client; this virtual mirrors it so
// every API response already has noOfDays ready (via toJSON virtuals).
// ─────────────────────────────────────────────────────────────────────────────
rturSchema.virtual('noOfDays').get(function () {
  if (!this.entryDate) return 0;
  const diff = Math.floor((Date.now() - new Date(this.entryDate).getTime()) / 86400000);
  return Math.max(0, isNaN(diff) ? 0 : diff);
});

// Include virtuals in every res.json() call
rturSchema.set('toJSON',   { virtuals: true });
rturSchema.set('toObject', { virtuals: true });

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE HOOK
// Auto-set returnDate when status changes to 'completed' and no date exists
// ─────────────────────────────────────────────────────────────────────────────
rturSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'completed' && !this.returnDate) {
    this.returnDate = new Date();
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOUND INDEXES — match the filter params used by rtur.html applyFilters()
//   fl-from / fl-to  → entryDate range
//   fl-div           → division
//   fl-status        → status  (incl. critical = noOfDays > 30)
//   fl-category      → category
// ─────────────────────────────────────────────────────────────────────────────
rturSchema.index({ entryDate: -1, status: 1 });
rturSchema.index({ division: 1,   status: 1 });
rturSchema.index({ category: 1,   status: 1 });
rturSchema.index({ scRefNo: 1,    defGirNo: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS — consumed by GET /api/rtur/stats
// Matches the four hero-stat / stat-card values in rtur.html
// ─────────────────────────────────────────────────────────────────────────────
rturSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: 'pending' });
};

rturSchema.statics.getCompletedCount = function () {
  return this.countDocuments({ status: 'completed' });
};

// Critical = not completed and entryDate > 30 days ago
rturSchema.statics.getCriticalCount = function () {
  const cutoff = new Date(Date.now() - 30 * 86400000);
  return this.countDocuments({
    entryDate: { $lte: cutoff },
    status:    { $ne: 'completed' },
  });
};

rturSchema.statics.getAverageDays = async function () {
  const docs = await this.find({ entryDate: { $exists: true } }, 'entryDate').lean();
  if (!docs.length) return '0';
  const sum = docs.reduce((acc, d) => {
    const diff = Math.floor((Date.now() - new Date(d.entryDate).getTime()) / 86400000);
    return acc + Math.max(0, isNaN(diff) ? 0 : diff);
  }, 0);
  return (sum / docs.length).toFixed(1);
};

// ─────────────────────────────────────────────────────────────────────────────
const RTUR = mongoose.model('RTUR', rturSchema);
module.exports = RTUR;

