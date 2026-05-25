const mongoose = require('mongoose');

const VALID_REGIONS = [
  'North',
  'East',
  'West 1',
  'West 2',
  'South 1 TN',
  'South 1 KL',
  'South 2 KA',
  'South 2 AP/TL',
  'Puducherry',
  'CG',
];

const dealerSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Dealer name is required.'],
      trim:     true,
    },
    region: {
      type:     String,
      required: [true, 'Region is required.'],
      trim:     true,
      enum: {
        values:  VALID_REGIONS,
        message: '{VALUE} is not a valid region.',
      },
    },
  },
  { timestamps: true }
);

// Compound index: speeds up the duplicate-check query in the route
// (findOne by name + region) and enforces uniqueness at the DB level.
dealerSchema.index({ name: 1, region: 1 }, { unique: true });

// Export the region list so routes can import it from one place
// instead of maintaining a second copy.
dealerSchema.statics.VALID_REGIONS = VALID_REGIONS;

module.exports = mongoose.model('Dealer', dealerSchema);