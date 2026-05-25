// models/FRN.js
const mongoose = require('mongoose');

const frnSchema = new mongoose.Schema(
  {
    serviceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    entryDate:  { type: String, required: true },
    scRno:      { type: String, required: true, trim: true },
    scEng:      { type: String, required: true, trim: true },
    frnNo:      { type: String, required: true, trim: true },
    region:     { type: String, required: true, trim: true },
    eng:        { type: String, required: true, trim: true },
    customer:   { type: String, required: true, trim: true },
    model:      { type: String, required: true, trim: true },
    unitStatus: {
      type: String,
      required: true,
      enum: ['OW', 'LAMC', 'CAMC', 'EW', 'STOCK'],
    },
    defMod:     { type: String, default: '' },
    defGir:     { type: String, default: '' },
    remarks:    { type: String, default: '' },
    typeWork:   { type: String, default: 'UNDER REPAIR' },
    pdays:      { type: Number, default: 0 },
    status:     { type: String, enum: ['pending', 'approved', 'escalated'], default: 'pending' },
  },
  { timestamps: true }
);

// Auto-compute pdays before every save/update
frnSchema.pre('save', function (next) {
  const created = this.createdAt || new Date();
  this.pdays = Math.floor((Date.now() - new Date(created).getTime()) / 86400000);
  next();
});

module.exports = mongoose.model('FRN', frnSchema);