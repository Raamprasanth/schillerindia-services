const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not found in env");
    process.exit(1);
  }
  console.log("Connecting to:", uri);
  try {
    await mongoose.connect(uri);
    console.log("Connected successfully");

    const Todr = require('./backend/models/Todr');
    const Dr = require('./backend/models/Dr');
    const Ctodr = require('./backend/models/Ctodr');
    const EmpFRN = require('./backend/models/EmpFRN');

    const todrCount = await Todr.countDocuments();
    const drCount = await Dr.countDocuments();
    const ctodrCount = await Ctodr.countDocuments();
    const empFrnCount = await EmpFRN.countDocuments();

    console.log(`Todr count: ${todrCount}`);
    console.log(`Dr count: ${drCount}`);
    console.log(`Ctodr count: ${ctodrCount}`);
    console.log(`EmpFRN count: ${empFrnCount}`);

    if (todrCount > 0) {
      console.log("\n--- TODR records ---");
      const records = await Todr.find().limit(10).lean();
      console.log(JSON.stringify(records, null, 2));
    }

    if (empFrnCount > 0) {
      console.log("\n--- EmpFRN with status escalated/pending ---");
      const pendingFrn = await EmpFRN.find({ status: 'escalated' }).limit(5).lean();
      console.log("Escalated EmpFRNs:", pendingFrn.length);
      console.log(JSON.stringify(pendingFrn.map(f => ({ _id: f._id, frnNo: f.frnNo, status: f.status, toEscalationQueuedAt: f.toEscalationQueuedAt })), null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
