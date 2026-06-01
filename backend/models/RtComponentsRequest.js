const mongoose = require('mongoose');

const rtComponentsRequestSchema = new mongoose.Schema(
  {
    requestedDate: { type: Date, required: [true, 'Requested Date is required'], index: true },
    requested:     { type: String, trim: true, default: '' },
    division:      { type: String, required: [true, 'Division is required'], trim: true, index: true },
    model:         { type: String, trim: true, default: '' },
    description:   { type: String, required: [true, 'Board Name is required'], trim: true },
    componentName: { type: String, trim: true, default: '' },
    partNumber:    { type: String, trim: true, default: '' },
    requiredQty:   { type: Number, required: [true, 'Required Qty is required'], min: [1, 'Qty must be at least 1'], default: 1 },
    price:         { type: Number, default: 0 },
    piRaisedDate:          { type: Date, default: null },
    piApprovedDate:        { type: Date, default: null },
    componentsReceivedDate:{ type: Date, default: null },
    remarks:       { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Fulfilled', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    fulfilledBy:   { type: String, trim: true, default: '' },
    fulfilledDate: { type: Date, default: null },
  },
  { timestamps: true, collection: 'rtcomponentsrequest' }
);

rtComponentsRequestSchema.index({ requestedDate: -1, status: 1 });
rtComponentsRequestSchema.index({ division: 1, status: 1 });

const RtComponentsRequest = mongoose.model('RtComponentsRequest', rtComponentsRequestSchema);
module.exports = RtComponentsRequest;
