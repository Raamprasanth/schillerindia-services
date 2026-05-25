const mongoose = require('mongoose');

const ptClosedActivitySchema = new mongoose.Schema({
  scEngineer: { type: String, required: true },
  initiatedDate: { type: String, required: true },
  activity: { type: String, required: true },
  description: { type: String, default: '' },
  responsible: { type: String, default: '' },
  pendingFrom: { type: String, default: '' },
  targetDate: { type: String, default: '' },
  remarks: { type: String, default: '' },
  scInchargeRemarks: { type: String, default: '' },
  status: { type: String, required: true, default: 'Closed' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PtClosedActivity', ptClosedActivitySchema);
