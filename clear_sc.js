const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

const modelsToClear = [
  'Todr', 'Ctodr', 'Dr', 'Cdr', 'ScPrfOb', 'sccr', 'LoanItem', 'ClosedLoan'
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const modelName of modelsToClear) {
    try {
      const Model = require('./backend/models/' + modelName);
      const res = await Model.deleteMany({});
      console.log(`Cleared ${modelName}: deleted ${res.deletedCount} documents`);
    } catch (e) {
      console.error(`Failed to clear ${modelName}:`, e.message);
    }
  }
  mongoose.disconnect();
}
run().catch(console.error);
