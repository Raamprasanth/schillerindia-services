// models/Company.js
const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    region:   { type: String, trim: true, default: '' },
  }
);

const companySchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, unique: true, trim: true },
    address: { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true },
    mobile:  { type: String, required: true, trim: true },
    website: { type: String, trim: true, default: '' },
    gst:     { type: String, trim: true, default: '' },
    status:  { type: String, enum: ['active', 'inactive'], default: 'active' },
    branches: { type: [branchSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);