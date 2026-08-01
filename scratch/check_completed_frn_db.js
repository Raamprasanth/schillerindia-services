require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const mongoose = require('mongoose');
const CompletedFRN = require('../backend/models/CompletedFRN');
const Service = require('../backend/models/Service');
const EmpFRN = require('../backend/models/EmpFRN');

async function checkCompletedFRN() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const total = await CompletedFRN.countDocuments();
    const missingEng = await CompletedFRN.countDocuments({ $or: [{ eng: '' }, { eng: null }, { eng: { $exists: false } }] });
    const missingPart = await CompletedFRN.countDocuments({ $or: [{ partNo: '' }, { partNo: null }, { partNo: { $exists: false } }] });

    console.log('CompletedFRN Total Count:', total);
    console.log('Missing eng count:', missingEng);
    console.log('Missing partNo count:', missingPart);

    const sample = await CompletedFRN.find().limit(10).lean();
    console.log('\nSample records:');
    sample.forEach((s, idx) => {
      console.log(`[${idx+1}] scRno: "${s.scRno}", frnNo: "${s.frnNo}", eng: "${s.eng}", partNo: "${s.partNo}", customer: "${s.customer}", serviceId: "${s.serviceId}", frnId: "${s.frnId}"`);
    });

  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkCompletedFRN();
