const mongoose = require('mongoose');

const empDailyWorkSchema = new mongoose.Schema({
  date: { type: String, required: true },
  activity: { type: String, required: true, trim: true },
  fromTime: { type: String, required: true },
  toTime: { type: String, required: true },
  team: { type: String, trim: true },
  division: { type: String, trim: true, default: '' },
  divisionName: { type: String, trim: true, default: '' },
  divisionKey: { type: String, trim: true, default: '' },
  dayTotal: { type: String, trim: true },
  addedBy: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

empDailyWorkSchema.index({ divisionKey: 1, date: -1 });
empDailyWorkSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('EmpDailyWork', empDailyWorkSchema);
