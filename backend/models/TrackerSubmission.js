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

// Ensure submission is unique by division, type, reportDate, and employee
trackerSubmissionSchema.index({ division: 1, type: 1, reportDate: 1, employee: 1 }, { unique: true });

const TrackerSubmission = mongoose.model('TrackerSubmission', trackerSubmissionSchema);

// Safely drop obsolete single-employee division index if it exists in MongoDB
TrackerSubmission.collection.dropIndex('division_1_type_1_reportDate_1').catch(() => null);

module.exports = TrackerSubmission;
