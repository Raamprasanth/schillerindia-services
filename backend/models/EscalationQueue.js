const mongoose = require('mongoose');

const escalationQueueSchema = new mongoose.Schema(
  {
    module: { type: String, enum: ['frn', 'est', 'sr_frn', 'sr_est', 'to_frn', 'to_est', 'ur_scrap', 'ur_followup', 'prf_ob', 'supplier_warranty', 'external_repair'], required: true },
    queuedAt: { type: Date, required: true, default: Date.now },
    queuedBy: { type: String, trim: true, default: '' },
    sourceId: { type: String, trim: true, default: '' },
    row: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'escalation_queue',
  }
);

escalationQueueSchema.index({ module: 1, queuedAt: 1 });
escalationQueueSchema.index({ sourceId: 1 });

module.exports =
  mongoose.models.EscalationQueue ||
  mongoose.model('EscalationQueue', escalationQueueSchema);
