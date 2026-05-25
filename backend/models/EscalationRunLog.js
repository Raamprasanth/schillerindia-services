const mongoose = require('mongoose');

const escalationRunLogSchema = new mongoose.Schema(
  {
    jobKey:      { type: String, required: true, unique: true, trim: true },
    slot:        { type: String, required: true },
    category:    { type: String, enum: ['main', 'sr', 'to', 'ur_scrap', 'ur_followup', 'prf_ob', 'supplier_warranty', 'external_repair'], default: 'main' },
    trigger:     { type: String, default: 'scheduler' },
    windowStart: { type: Date, required: true },
    windowEnd:   { type: Date, required: true },
    frnCount:    { type: Number, default: 0 },
    estCount:    { type: Number, default: 0 },
    urCount:     { type: Number, default: 0 },
    totalCount:  { type: Number, default: 0 },
    reportPath:  { type: String, default: '' },
    status:      { type: String, default: 'running' },
    error:       { type: String, default: '' },
    sentAt:      { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'escalationrunlogs',
  }
);

module.exports =
  mongoose.models.EscalationRunLog ||
  mongoose.model('EscalationRunLog', escalationRunLogSchema);
