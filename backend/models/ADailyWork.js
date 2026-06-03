const mongoose = require('mongoose');

const aDailyWorkSchema = new mongoose.Schema({
  date: { type: String, required: true },
  activity: { type: String, required: true, trim: true },
  fromTime: { type: String, required: true },
  toTime: { type: String, required: true },
  team: { type: String, trim: true },
  dayTotal: { type: String, trim: true },
  addedBy: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sourceType: { type: String, enum: ['Employee', 'Product Team'], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ADailyWork', aDailyWorkSchema);
