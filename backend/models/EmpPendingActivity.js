const mongoose = require('mongoose');

const empPendingActivitySchema = new mongoose.Schema({
  division: { type: String, required: true },
  scEngineer: { type: String, required: true },
  initiatedDate: { type: String, required: true },
  activity: { type: String, required: true },
  description: { type: String, default: '' },
  responsible: { type: String, default: '' },
  pendingFrom: { type: String, default: '' },
  targetDate: { type: String, default: '' },
  remarks: { type: String, default: '' },
  scInchargeRemarks: { type: String, default: '' },
  status: { type: String, required: true, default: 'Pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { 
  timestamps: true,
  collection: 'emp_pending_activities'
});

module.exports = mongoose.model('EmpPendingActivity', empPendingActivitySchema);
