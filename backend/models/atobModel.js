// models/atobModel.js
// Admin view of Repair Team OB rows — same MongoDB collection as RTOB (`rtob`).

const mongoose = require('mongoose');
const RTOB = require('./RTOB');

const atobSchema = RTOB.schema.clone();

module.exports = mongoose.models.ATOB || mongoose.model('ATOB', atobSchema, 'rtob');
