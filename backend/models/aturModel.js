// models/aturModel.js
// Admin view of Repair Team UR rows — same MongoDB collection as RTUR (`rturs`).

const mongoose = require('mongoose');
const RTUR = require('./rturModel');

const aturSchema = RTUR.schema.clone();

module.exports = mongoose.models.ATUR || mongoose.model('ATUR', aturSchema, 'rturs');
