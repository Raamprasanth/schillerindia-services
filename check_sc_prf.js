const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    const SCPrf = require('./backend/models/SCPrfModel');
    const count = await SCPrf.countDocuments();
    console.log(`SCPrf (sc_prf collection) count: ${count}`);
    if (count > 0) {
      const records = await SCPrf.find().limit(5).lean();
      console.log(JSON.stringify(records, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
