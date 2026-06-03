const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    const EmpFRN = require('./backend/models/EmpFRN');
    const Ctodr = require('./backend/models/Ctodr');

    const escalatedFrns = await EmpFRN.find({ toEscalationQueuedAt: { $ne: null } }).lean();
    console.log(`EmpFRNs with toEscalationQueuedAt: ${escalatedFrns.length}`);

    for (const frn of escalatedFrns) {
      const matchCount = await Ctodr.countDocuments({ sourceId: String(frn._id) });
      console.log(`FRN ID: ${frn._id}, FRN No: ${frn.frnNo}, matches in Ctodr: ${matchCount}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
