const mongoose = require('mongoose');

const rtClosedComponentsRequestSchema = new mongoose.Schema(
  {
    requestedDate: { type: Date, index: true },
    requested: { type: String, trim: true, default: '' },
    division: { type: String, trim: true, index: true },
    model: { type: String, trim: true, default: '' },
    description: { type: String, trim: true },
    componentName: { type: String, trim: true, default: '' },
    partNumber: { type: String, trim: true, default: '' },
    requiredQty: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    piRaisedDate: { type: Date, default: null },
    piApprovedDate: { type: Date, default: null },
    componentsReceivedDate: { type: Date, default: null },
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, default: 'Fulfilled', index: true },
    fulfilledBy: { type: String, trim: true, default: '' },
    fulfilledDate: { type: Date, default: null },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'RtComponentsRequest' }
  },
  { timestamps: true, collection: 'rtclosedcomponentsrequest' }
);

module.exports = mongoose.model('RtClosedComponentsRequest', rtClosedComponentsRequestSchema);
