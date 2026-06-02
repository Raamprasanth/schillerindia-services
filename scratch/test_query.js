const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

const mongoUri = process.env.MONGO_URI;
console.log('Connecting to:', mongoUri.split('@')[1] || mongoUri);

const Division = require('../backend/models/Division');
const Service = require('../backend/models/Service');
const EstimationPending = require('../backend/models/EstimationPending');

async function test() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully!');

    console.time('Count Services');
    const totalServices = await Service.countDocuments();
    console.timeEnd('Count Services');
    console.log('Total services in database:', totalServices);

    console.time('Count EstPending');
    const totalEstPending = await EstimationPending.countDocuments();
    console.timeEnd('Count EstPending');
    console.log('Total EstimationPending in database:', totalEstPending);

    // Let's test a sample query
    console.time('Fetch EstimationPending without populate');
    const recordsNoPop = await EstimationPending.find({}).sort({ createdAt: -1 }).lean();
    console.timeEnd('Fetch EstimationPending without populate');
    console.log('Records returned:', recordsNoPop.length);

    console.time('Fetch EstimationPending with populate');
    const records = await EstimationPending.find({}).populate('serviceId', 'dealer').sort({ createdAt: -1 }).lean();
    console.timeEnd('Fetch EstimationPending with populate');

    process.exit(0);
  } catch (err) {
    console.error('Error testing query:', err);
    process.exit(1);
  }
}

test();
