// models/ATCRRModel.js
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Closed Repair List â€” Mongoose Schema
// Stores ALL closed/completed repair records from PFRN Â· UR Â· OB
//
// A record lands here in ONE of two ways:
//   1. Directly created here (status = 'completed' on creation)
//   2. Copied here when a RTUR/RTOB/RTFRN record is marked completed
//      (your route logic handles the copy â€” see ATCRRRoutes.js)
//
// Fields map 1-to-1 with ATCRR.html:
//   Table columns   â†’ entryDate, closedDate, division, scRefNo, defGirNo,
//                      category, model, defBrdModName, noOfDays(virtual),
//                      repairedBy, closedBy
//   Detail modal    â†’ all repair + dispatch + remarks fields
//   Filters         â†’ division, category, repairedBy, closedBy, date range
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mongoose = require('mongoose');

const atcrrSchema = new mongoose.Schema(
  {
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // CORE IDENTIFICATION  (same across PFRN Â· UR Â· OB)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    
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

    // Category tab filter in ATCRR.html: All | PFRN | UR | OB
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

    // Always 'completed' for closed records â€” kept for consistency
    status: {
      type: String,
      default: 'completed',
      enum: ['completed'],
    },

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // REPAIR DETAILS  (from Update Modal of RTUR / RTOB / RTFRN)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // "Repaired By" â€” fl-repairedby filter in ATCRR.html
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DISPATCH & RETURN  (detail modal â€” Dispatch & Return section)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // AUDIT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    // Used by fl-closedby filter in ATCRR.html
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VIRTUAL â€” noOfDays
// Days spent in re-repair, from revert to re-repair completion.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
atcrrSchema.virtual('noOfDays').get(function () {
  const start = this.revertedDate || this.entryDate;
  if (!start) return 0;
  const end  = this.reRepDate || this.closedDate || new Date();
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return Math.max(0, isNaN(diff) ? 0 : diff);
});

atcrrSchema.set('toJSON',   { virtuals: true });
atcrrSchema.set('toObject', { virtuals: true });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INDEXES â€” match the filter combos used in ATCRR.html applyFilters()
//   fl-from / fl-to     â†’ entryDate range
//   fl-div              â†’ division
//   category tab        â†’ category
//   fl-repairedby       â†’ repairedBy
//   fl-closedby         â†’ closedBy (text search)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
atcrrSchema.index({ reRepDate: -1,   category: 1 });
atcrrSchema.index({ entryDate:  -1,  division: 1 });
atcrrSchema.index({ category:   1,   division: 1 });
atcrrSchema.index({ scRefNo:    1,   defGirNo: 1 });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STATIC METHODS â€” consumed by GET /api/ATCRR/stats
// Maps to the 4 stat cards in ATCRR.html:
//   Total | PFRN | UR | OB
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
atcrrSchema.statics.getTotalCount = function () {
  return this.countDocuments();
};
atcrrSchema.statics.getPFRNCount = function () {
  return this.countDocuments({ category: 'PFRN' });
};
atcrrSchema.statics.getURCount = function () {
  return this.countDocuments({ category: 'UR' });
};
atcrrSchema.statics.getOBCount = function () {
  return this.countDocuments({ category: 'OB' });
};
atcrrSchema.statics.getAvgDays = async function () {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ATCRR = mongoose.models.Atcrr || mongoose.model('Atcrr', atcrrSchema);
module.exports = ATCRR;

