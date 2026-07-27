const mongoose = require('mongoose');

const trackerSubmissionSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  division: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: [
      'CRM',
      'PendingActivity',
      'NonSaleable',
      'SupplierWarranty',
      'CriticalPendingReport',
      'PIRequest',
      'OpenCallReview',
      'BuyBack'
    ],
    required: true
  },
  reportDate: {
    type: String, // Stored as 'YYYY-MM-DD'
    required: true
  },
  month: {
    type: String, // Stored as 'YYYY-MM'
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a division can only submit once per reportDate and type
// Note: Changed from employee to division based on new requirement
trackerSubmissionSchema.index({ division: 1, type: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('TrackerSubmission', trackerSubmissionSchema);
