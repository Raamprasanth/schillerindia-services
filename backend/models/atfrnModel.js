// models/atfrnModel.js
// Admin-side model for Repair Team FRN rows. Uses the same MongoDB collection as RTFRN
// (`rtfrns`) so Rtfrn and Atfrn always show the same data.

const mongoose = require('mongoose');
const RTFRN = require('./RTFRN');

const atfrnSchema = RTFRN.schema.clone();

module.exports = mongoose.models.ATFRN || mongoose.model('ATFRN', atfrnSchema, 'rtfrns');
