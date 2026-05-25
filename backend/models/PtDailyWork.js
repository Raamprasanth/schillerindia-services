const mongoose = require('mongoose');

const ptDailyWorkSchema = new mongoose.Schema({
  date: { type: String, required: true },
  activity: { type: String, required: true, trim: true },
  fromTime: { type: String, required: true },
  toTime: { type: String, required: true },
  team: { type: String, trim: true },
  dayTotal: { type: String, trim: true },
  addedBy: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('PtDailyWork', ptDailyWorkSchema);
