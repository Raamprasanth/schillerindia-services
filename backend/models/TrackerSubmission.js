const mongoose = require('mongoose');

const trackerSubmissionSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  division: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Division',
    required: false
  },
  type: {
    type: String,
    enum: ['CRM', 'PendingActivity'],
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

// Ensure an employee can only submit once per reportDate and type
trackerSubmissionSchema.index({ employee: 1, type: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('TrackerSubmission', trackerSubmissionSchema);
