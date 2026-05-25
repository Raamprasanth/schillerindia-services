// models/RTOB.js
// ─────────────────────────────────────────────────────────────────────────────
//  Repair Team — OB Pending (Outward Bound) Tracking Model
//
//  Stores records for boards/modules sent out for external repair or dispatch.
//  Category is always "OB". OB Type distinguishes OW vs LAMC vs Other.
//
//  Connected to MongoDB Atlas collection: "rtob"
//
//  Register routes in server.js:
//    const rtobjRoutes = require('./routes/rtobRoutes');
//    app.use('/api/rtob', rtobjRoutes);
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const rtobSchema = new mongoose.Schema(
  {
    // ── Entry Metadata ────────────────────────────────────────────────────────
    entryDate:    { type: String, default: '' },       // ISO date string e.g. "2025-04-22"
    submittedBy:  { type: String, default: '' },       // Employee name who created the record
    submittedAt:  { type: String, default: '' },       // ISO timestamp of creation
    updatedBy:    { type: String, default: '' },       // Last updated by (employee name)
    updatedAt:    { type: String, default: '' },       // ISO timestamp of last update

    // ── Service Classification ────────────────────────────────────────────────
    division:     { type: String, default: '' },       // e.g. "PATIENT MONITORS", "SAG", "VENTILATOR"
    category:     { type: String, default: 'OB' },    // Always "OB" for this module
    obType:       {
      type: String,
      default: 'OW',
      enum: ['OW', 'LAMC', 'Other', ''],              // OW = Out-of-Warranty, LAMC = LAMC unit
    },

    // ── Reference Numbers ─────────────────────────────────────────────────────
    scRefNo:      { type: String, default: '' },       // SC Reference Number
    defGirNo:     { type: String, default: '' },       // Defective unit GIR number (inward)
    repGirNo:     { type: String, default: '' },       // Repaired unit GIR number (outward)
    defUnitGir:   { type: String, default: '' },       // DEF Unit GIR (alternate/confirmation)
    prfObNo:      { type: String, default: '' },       // PRF / OB Register number
    dcNo:         { type: String, default: '' },       // Delivery Challan number

    // ── Device Details ────────────────────────────────────────────────────────
    model:        { type: String, default: '' },       // Device model name
    defBrdModName:{ type: String, default: '' },       // Defective board / module name

    // ── Repair & Assignment ───────────────────────────────────────────────────
    raEng:        { type: String, default: '' },       // RA (Repair Activity) Engineer assigned
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'inprogress', 'completed', 'on_hold', 'scrapped'],
    },

    // ── Dates ────────────────────────────────────────────────────────────────
    repBrd:       { type: String, default: '' },       // Repaired board stock date
    outwardDate:  { type: String, default: '' },       // Date item was sent outward
    shipSc:       { type: String, default: '' },       // Ship date from Service Centre
    shipComm:     { type: String, default: '' },       // Ship date from Commercial

    // ── Report & Work ─────────────────────────────────────────────────────────
    typeReport:   { type: String, default: '' },       // "Service Center" | "Field" | "Workshop"
    typeWork: {
      type: String,
      default: 'OB Pending',
      // What happened to this unit
      // e.g. "OB Pending", "PFRN", "UNDER REPAIR", "Repaired", "Unit Returned", etc.
    },

    // ── Repair assignment ─────────────────────────────────────────────────────
    repairedBy:   { type: String, default: '' },       // Technician who repaired the unit

    // ── Remarks ───────────────────────────────────────────────────────────────
    doi: { type: String, trim: true, default: '' },
    fieldRemarks:  { type: String, default: '' },      // Original field remarks from employee service entry
    repairedDate:  { type: String, default: '' },      // Date repair was completed by technician
    finalRemarks: { type: String, default: '' },       // Resolution or current status description
    repairRemarks:{ type: String, default: '' },       // Repair team remarks
    techRemarks:  { type: String, default: '' },       // Root cause / technical diagnosis
    components:   { type: String, default: '' },       // Components replaced or used
    cost:         { type: String, default: '' },
    timeTaken:    { type: String, default: '' },
    repairStatus: { type: String, default: '' },

    // ── Destination ───────────────────────────────────────────────────────────
    destination:  { type: String, default: '' },       // e.g. "Chennai", "Delhi HQ"

    // ── Computed (stored for convenience) ────────────────────────────────────
    noOfDays:     { type: Number, default: 0 },        // Days since entry (recalculated on read)
  },
  {
    timestamps:  true,           // Adds createdAt + updatedAt (Mongoose managed)
    collection:  'rtob',        // MongoDB Atlas collection name
    strict:      false,          // Accept extra fields without error
  }
);

// ── INDEXES ──────────────────────────────────────────────────────────────────
rtobSchema.index({ status:       1 });
rtobSchema.index({ division:     1 });
rtobSchema.index({ obType:       1 });
rtobSchema.index({ scRefNo:      1 });
rtobSchema.index({ defGirNo:     1 });
rtobSchema.index({ submittedBy:  1 });
rtobSchema.index({ entryDate:   -1 });
rtobSchema.index({ createdAt:   -1 });

// ── VIRTUAL: noOfDays (recalculated at query time via transform) ──────────────
// Use the static helper below rather than the stored value for accuracy.
rtobSchema.statics.calcDays = function (entryDate) {
  if (!entryDate) return 0;
  const diff = Math.floor((Date.now() - new Date(entryDate).getTime()) / 86400000);
  return isNaN(diff) ? 0 : Math.max(0, diff);
};

module.exports = mongoose.models.RTOB || mongoose.model('RTOB', rtobSchema);
