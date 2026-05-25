// models/atcrlModel.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin Closed Repair List — Mongoose Model
//
// This model reads from the SAME 'rtcrls' collection as rtcrlModel.js.
// ATCRL (Admin view) and RTCRL (Repair Team view) share the same data.
// Entries created in RTCRL by the Repair Team are visible here in ATCRL.
//
// No separate collection is used — both point to 'rtcrls'.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const atcrlSchema = new mongoose.Schema(
  {
    // ════════════════════════════════════════════════════════════════════════
    // CORE IDENTIFICATION  (same across PFRN · UR · OB)
    // ════════════════════════════════════════════════════════════════════════

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

    // Category tab filter: All | PFRN | UR | OB
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

    // Always 'completed' for closed records
    status: {
      type: String,
      default: 'completed',
      enum: ['completed'],
    },

    // ════════════════════════════════════════════════════════════════════════
    // REPAIR DETAILS
    // ════════════════════════════════════════════════════════════════════════

    repairedBy: {
      type: String,
      trim: true,
      default: '',
    },

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
    // DISPATCH & RETURN
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

    submittedBy: {
      type: String,
      trim: true,
      default: '',
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    closedBy: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    sourceCollection: {
      type: String,
      enum: ['rtur', 'rtob', 'rtfrn', ''],
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'rtcrls', // ← SAME collection as RTCRL — shared data
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL — noOfDays
// ─────────────────────────────────────────────────────────────────────────────
atcrlSchema.virtual('noOfDays').get(function () {
  if (!this.entryDate) return 0;
  const end  = this.closedDate ? new Date(this.closedDate) : new Date();
  const diff = Math.floor((end.getTime() - new Date(this.entryDate).getTime()) / 86400000);
  return Math.max(0, isNaN(diff) ? 0 : diff);
});

atcrlSchema.set('toJSON',   { virtuals: true });
atcrlSchema.set('toObject', { virtuals: true });

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
atcrlSchema.index({ closedDate: -1, category: 1 });
atcrlSchema.index({ entryDate:  -1, division: 1 });
atcrlSchema.index({ category:   1,  division: 1 });
atcrlSchema.index({ scRefNo:    1,  defGirNo: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS — stat cards in atcrl.html
// ─────────────────────────────────────────────────────────────────────────────
atcrlSchema.statics.getTotalCount = function () {
  return this.countDocuments();
};
atcrlSchema.statics.getPFRNCount = function () {
  return this.countDocuments({ category: 'PFRN' });
};
atcrlSchema.statics.getURCount = function () {
  return this.countDocuments({ category: 'UR' });
};
atcrlSchema.statics.getOBCount = function () {
  return this.countDocuments({ category: 'OB' });
};
atcrlSchema.statics.getAvgDays = async function () {
  const result = await this.aggregate([
    {
      $project: {
        days: {
          $divide: [
            { $subtract: [{ $ifNull: ['$closedDate', new Date()] }, '$entryDate'] },
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
// Use a discriminator key or simply register as a separate model name
// pointing to the SAME collection — this is the cleanest approach in Mongoose.
// ─────────────────────────────────────────────────────────────────────────────
const ATCRL = mongoose.model('ATCRL', atcrlSchema);
module.exports = ATCRL;
