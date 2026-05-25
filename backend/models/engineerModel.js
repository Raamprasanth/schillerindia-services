const mongoose = require('mongoose');

const engineerSchema = new mongoose.Schema(
  {
    empId: {
      type:   String,
      trim:   true,
      default: '',
    },
    name: {
      type:     String,
      required: [true, 'Engineer name is required'],
      trim:     true,
    },
    division: {
      type:    String,
      trim:    true,
      default: '',
    },
    divisions: {
      type: [String],
      default: [],
      set: values => Array.isArray(values)
        ? [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
        : [],
    },
    location: {
      type:     String,
      required: [true, 'Location is required'],
      trim:     true,
      enum:     {
        values:  ['InHouse', 'Field', 'Remote'],
        message: '{VALUE} is not a valid location',
      },
    },
    branch: {
      type:     String,
      required: [true, 'Branch is required'],
      trim:     true,
    },
    role: {
      type:     String,
      required: [true, 'Role is required'],
      trim:     true,
      enum: {
        values:  ['Engineer', 'Admin', 'Repair Team', 'Service Coordinator', 'Product Team'],
        message: '{VALUE} is not a valid role',
      },
    },
    active: {
      type:    String,
      enum:    ['Yes', 'No'],
      default: 'Yes',
    },
  },
  { timestamps: true }
);

const Engineer = mongoose.model('Engineer', engineerSchema);

// Drop the stale unique email_1 index left over from an old schema version.
// email is no longer a field, so all docs have email:null which violates
// a unique non-sparse index. This runs once on startup and is a no-op
// after the index is gone.
Engineer.collection.dropIndex('email_1').catch(() => {});

module.exports = Engineer;
