const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const modelsToClear = [
  'Todr', 'Ctodr', 'Dr', 'ScPrfOb', 'sccr', 'LoanItem', 'ClosedLoan', 'EPrfOb'
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    
    for (const modelName of modelsToClear) {
      try {
        const Model = require('./models/' + modelName);
        const res = await Model.deleteMany({});
        console.log(`Cleared ${modelName}: deleted ${res.deletedCount} documents`);
      } catch (e) {
        console.error(`Failed to clear ${modelName}:`, e.message);
      }
    }
  } catch(e) {
    console.error('Connection error', e);
  } finally {
    mongoose.disconnect();
  }
}
run();
