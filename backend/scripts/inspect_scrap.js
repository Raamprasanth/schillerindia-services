require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Scrap = require('../models/Scrap');
const Csw = require('../models/Csw');

async function inspectScrap() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/schillerindia';
    await mongoose.connect(mongoUri);
    const scrapCount = await Scrap.countDocuments();
    const cswCount = await Csw.countDocuments();
    console.log(`Total Scrap records: ${scrapCount}`);
    console.log(`Total CSW records: ${cswCount}`);

    const scrapSample = await Scrap.find().limit(10).lean();
    console.log('Sample Scrap records:', JSON.stringify(scrapSample.map(d => ({
      _id: d._id,
      frnNo: d.frnNo,
      customer: d.customer,
      model: d.model,
      division: d.division,
      typeWork: d.typeWork,
      addedBy: d.addedBy,
      scEng: d.scEng,
      engineer: d.engineer
    })), null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectScrap();
