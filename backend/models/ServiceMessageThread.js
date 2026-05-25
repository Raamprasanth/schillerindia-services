const mongoose = require('mongoose');

const serviceMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, trim: true, required: true },
    senderModel: { type: String, trim: true, default: 'User' },
    senderName: { type: String, trim: true, default: '' },
    senderRole: { type: String, trim: true, default: '' },
    text: { type: String, trim: true, required: true },
    readBy: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

const serviceMessageThreadSchema = new mongoose.Schema(
  {
    division: { type: String, trim: true, default: '' },
    coordinatorId: { type: String, trim: true, required: true },
    coordinatorName: { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, required: true },
    employeeModel: { type: String, trim: true, default: 'Employee' },
    employeeName: { type: String, trim: true, default: '' },
    employeeEmail: { type: String, trim: true, default: '' },
    lastMessage: { type: String, trim: true, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    messages: [serviceMessageSchema],
  },
  { timestamps: true }
);

serviceMessageThreadSchema.index({ coordinatorId: 1, employeeId: 1, employeeModel: 1 }, { unique: true });
serviceMessageThreadSchema.index({ employeeId: 1, employeeModel: 1, lastMessageAt: -1 });
serviceMessageThreadSchema.index({ coordinatorId: 1, lastMessageAt: -1 });
serviceMessageThreadSchema.index({ division: 1 });

module.exports = mongoose.models.ServiceMessageThread ||
  mongoose.model('ServiceMessageThread', serviceMessageThreadSchema);
