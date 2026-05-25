const mongoose = require('mongoose');

const rtClosedOtherActivitySchema = new mongoose.Schema(
  {
    repairedBy: { type: String, trim: true },
    entryDate: { type: Date, index: true },
    division: { type: String, trim: true, index: true },
    model: { type: String, trim: true, default: '' },
    partNumber: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    problemObserved: { type: String, trim: true },
    componentsUsed: { type: String, trim: true, default: '' },
    finalRemarks: { type: String, trim: true, default: '' },
    repairedDate: { type: Date, default: null },
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, default: 'Closed', index: true },
    closedBy: { type: String, trim: true, default: '' },
    closedDate: { type: Date, default: null },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'RtOtherActivity' }
  },
  { timestamps: true, collection: 'rtclosedotheractivity' }
);

module.exports = mongoose.model('RtClosedOtherActivity', rtClosedOtherActivitySchema);
