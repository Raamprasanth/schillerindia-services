const mongoose = require('mongoose');

const ctodrSchema = new mongoose.Schema({
  entryDate: { type: Date, required: true },
  frnNo: { type: String, required: true },
  partNo: { type: String, required: true },
  description: { type: String, required: true },
  action: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ctodr', ctodrSchema);
