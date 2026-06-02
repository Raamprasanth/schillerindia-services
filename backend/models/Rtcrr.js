// models/rtcrlModel.js
// ─────────────────────────────────────────────────────────────────────────────
// Closed Repair List — Mongoose Schema
// Stores ALL closed/completed repair records from PFRN · UR · OB
//
// A record lands here in ONE of two ways:
//   1. Directly created here (status = 'completed' on creation)
//   2. Copied here when a RTUR/RTOB/RTFRN record is marked completed
//      (your route logic handles the copy — see rtcrlRoutes.js)
//
// Fields map 1-to-1 with rtcrl.html:
//   Table columns   → entryDate, closedDate, division, scRefNo, defGirNo,
//                      category, model, defBrdModName, noOfDays(virtual),
//                      repairedBy, closedBy
//   Detail modal    → all repair + dispatch + remarks fields
//   Filters         → division, category, repairedBy, closedBy, date range
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const rtcrrSchema = new mongoose.Schema(
  {
    // ════════════════════════════════════════════════════════════════════════
    // CORE IDENTIFICATION  (same across PFRN · UR · OB)
    // ════════════════════════════════════════════════════════════════════════

    
    revertedDate: {
      type: Date,
      index: true,
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      index: true,
    },

    closedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reRepDate: {
      type: Date,
      default: null,
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

    // Category tab filter in rtcrl.html: All | PFRN | UR | OB
    category: {
      type: String,
      enum: ['UR', 'PFRN', 'OB'],
      required: [true, 'Category is required'],
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

    // Always 'completed' for closed records — kept for consistency
    status: {
      type: String,
      default: 'completed',
      enum: ['completed'],
    },

    // ════════════════════════════════════════════════════════════════════════
    // REPAIR DETAILS  (from Update Modal of RTUR / RTOB / RTFRN)
    // ════════════════════════════════════════════════════════════════════════

    // "Repaired By" — fl-repairedby filter in rtcrl.html
    repairedBy: {
      type: String,
      trim: true,
      default: '',
    },
    
    repairRemarks: { type: String, trim: true, default: '' },
    cost: { type: String, trim: true, default: '' },
    timeTaken: { type: String, trim: true, default: '' },
    repairStatus: { type: String, trim: true, default: '' },
    doi: { type: String, trim: true, default: '' },
    repairedDate: { type: String, trim: true, default: '' },
    components: { type: String, trim: true, default: '' },

    compUsedToRepair: {
      type: String,
      trim: true,
      default: '',
    },

    repBrdDate: {
      type: Date,
      default: null,
    },

    dcNo: {
      type: String,
      trim: true,
      default: '',
    },

    techRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    finalRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    addNotes: {
      type: String,
      trim: true,
      default: '',
    },

    // ════════════════════════════════════════════════════════════════════════
    // DISPATCH & RETURN  (detail modal — Dispatch & Return section)
    // ════════════════════════════════════════════════════════════════════════

    returnDate: {
      type: Date,
      default: null,
    },

    returnDcNo: {
      type: String,
      trim: true,
      default: '',
    },

    destination: {
      type: String,
      trim: true,
      default: '',
    },

    // ════════════════════════════════════════════════════════════════════════
    // AUDIT
    // ════════════════════════════════════════════════════════════════════════

    // Who originally submitted the repair record
    submittedBy: {
      type: String,
      trim: true,
      default: '',
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    // Who closed / marked the record as completed
    // Used by fl-closedby filter in rtcrl.html
    closedBy: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    // Optional: reference back to the original RTUR / RTOB / RTFRN document
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Which collection the record came from: 'rtur' | 'rtob' | 'rtfrn' | 'rtrr'
    sourceCollection: {
      type: String,
      enum: ['rtur', 'rtob', 'rtfrn', 'rtrr', ''],
      default: '',
    },
  },
  {
    timestamps: true,       // createdAt + updatedAt from Mongoose
    collection: 'rtcrrs',
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL — noOfDays
// Days spent in re-repair, from revert to re-repair completion.
// ─────────────────────────────────────────────────────────────────────────────
rtcrrSchema.virtual('noOfDays').get(function () {
  const start = this.revertedDate || this.entryDate;
  if (!start) return 0;
  const end  = this.reRepDate || this.closedDate || new Date();
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return Math.max(0, isNaN(diff) ? 0 : diff);
});

rtcrrSchema.set('toJSON',   { virtuals: true });
rtcrrSchema.set('toObject', { virtuals: true });

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES — match the filter combos used in rtcrl.html applyFilters()
//   fl-from / fl-to     → entryDate range
//   fl-div              → division
//   category tab        → category
//   fl-repairedby       → repairedBy
//   fl-closedby         → closedBy (text search)
// ─────────────────────────────────────────────────────────────────────────────
rtcrrSchema.index({ reRepDate: -1,   category: 1 });
rtcrrSchema.index({ entryDate:  -1,  division: 1 });
rtcrrSchema.index({ category:   1,   division: 1 });
rtcrrSchema.index({ scRefNo:    1,   defGirNo: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS — consumed by GET /api/rtcrl/stats
// Maps to the 4 stat cards in rtcrl.html:
//   Total | PFRN | UR | OB
// ─────────────────────────────────────────────────────────────────────────────
rtcrrSchema.statics.getTotalCount = function () {
  return this.countDocuments();
};
rtcrrSchema.statics.getPFRNCount = function () {
  return this.countDocuments({ category: 'PFRN' });
};
rtcrrSchema.statics.getURCount = function () {
  return this.countDocuments({ category: 'UR' });
};
rtcrrSchema.statics.getOBCount = function () {
  return this.countDocuments({ category: 'OB' });
};
rtcrrSchema.statics.getAvgDays = async function () {
  const result = await this.aggregate([
    {
      $project: {
        days: {
          $divide: [
            {
              $subtract: [
                { $ifNull: ['$reRepDate', { $ifNull: ['$closedDate', new Date()] }] },
                { $ifNull: ['$revertedDate', '$entryDate'] },
              ],
            },
            86400000,
          ],
        },
      },
    },
    { $group: { _id: null, avg: { $avg: '$days' } } },
  ]);
  return result.length ? Math.round(result[0].avg) : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
const RTCRL = mongoose.model('Rtcrr', rtcrrSchema);
module.exports = RTCRL;
