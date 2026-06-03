const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    const Todr = require('./backend/models/Todr');
    const records = await Todr.find().lean();
    console.log("Number of Todr documents:", records.length);
    for (const r of records) {
      console.log("Document _id:", r._id, "type of _id:", typeof r._id);
      console.log("sourceId:", r.sourceId, "type of sourceId:", typeof r.sourceId);
      console.log("frnNo:", r.frnNo, "type of frnNo:", typeof r.frnNo);
      console.log("action:", r.action, "type of action:", typeof r.action);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
