// models/Division.js
const mongoose = require('mongoose');

const modelItemSchema = new mongoose.Schema(
  {
    supplier: { type: String, default: '' },
    model:    { type: String, required: true, trim: true },
    desc:     { type: String, default: '' },
  },
  { _id: false }
);

const divisionSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, trim: true, default: '' }, // human-friendly label, e.g. "Schiller AG" for "SAG"
    models:      { type: [modelItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Division', divisionSchema);