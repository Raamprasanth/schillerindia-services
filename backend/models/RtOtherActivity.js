const mongoose = require('mongoose');

const rtOtherActivitySchema = new mongoose.Schema(
  {
    repairedBy: {
      type: String,
      required: [true, 'Repaired By is required'],
      trim: true,
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry Date is required'],
      index: true,
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
      index: true,
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    partNumber: {
      type: String,
      trim: true,
      default: '',
    },
    girNo: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    problemObserved: {
      type: String,
      required: [true, 'Problem Observed is required'],
      trim: true,
    },
    componentsUsed: {
      type: String,
      trim: true,
      default: '',
    },
    finalRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    repairedDate: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Closed'],
      default: 'Open',
      index: true,
    },
    closedBy: {
      type: String,
      trim: true,
      default: '',
    },
    closedDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: 'rtotheractivity' }
);

rtOtherActivitySchema.index({ entryDate: -1, status: 1 });
rtOtherActivitySchema.index({ division: 1, status: 1 });

const RtOtherActivity = mongoose.model('RtOtherActivity', rtOtherActivitySchema);
module.exports = RtOtherActivity;
