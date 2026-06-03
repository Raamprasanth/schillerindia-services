const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not found");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    const ScPrfOb = require('./backend/models/ScPrfOb');
    const toCount = await ScPrfOb.countDocuments({ type: 'TO' });
    const soCount = await ScPrfOb.countDocuments({ type: 'SO' });
    const prfCount = await ScPrfOb.countDocuments({ type: 'PRF' });
    const obCount = await ScPrfOb.countDocuments({ type: 'OB' });
    const totalCount = await ScPrfOb.countDocuments();

    console.log(`ScPrfOb total: ${totalCount}`);
    console.log(`  type TO: ${toCount}`);
    console.log(`  type SO: ${soCount}`);
    console.log(`  type PRF: ${prfCount}`);
    console.log(`  type OB: ${obCount}`);

    if (toCount > 0) {
      console.log("\n--- First 5 ScPrfOb TO records ---");
      const records = await ScPrfOb.find({ type: 'TO' }).limit(5).lean();
      console.log(JSON.stringify(records, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
