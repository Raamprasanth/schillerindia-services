require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Service = require('../models/Service');
const CompletedFRN = require('../models/CompletedFRN');
const Scrap = require('../models/Scrap');
const SCCompletedFRN = require('../models/SCCompletedFRN');

async function runMigration() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shcl';
  console.log('Connecting to MongoDB:', uri);
  
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully.');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  const collections = [
    { name: 'CompletedFRN', model: CompletedFRN },
    { name: 'Scrap', model: Scrap },
    { name: 'SCCompletedFRN', model: SCCompletedFRN }
  ];

  let totalUpdated = 0;

  for (const { name, model } of collections) {
    console.log(`\nChecking ${name}...`);
    // Find documents where eng, partNo, or raEng might be missing
    const docs = await model.find({
      $or: [
        { eng: { $in: [null, ''] } },
        { engineer: { $in: [null, ''] } }, // For Scrap
        { partNo: { $in: [null, ''] } },
        { raEng: { $in: [null, ''] } }
      ]
    });
    
    console.log(`Found ${docs.length} records in ${name} with potentially missing fields.`);
    
    let updatedCount = 0;
    
    for (const doc of docs) {
      if (!doc.serviceId) continue;
      
      const svc = await Service.findById(doc.serviceId).lean();
      if (!svc) continue;

      let needsUpdate = false;
      const updateData = {};

      // Handle partNo
      if (!doc.partNo && svc.partNo) {
        updateData.partNo = svc.partNo;
        needsUpdate = true;
      }

      // Handle eng/engineer
      if (name === 'Scrap') {
        if (!doc.engineer && svc.eng) {
          updateData.engineer = svc.eng;
          needsUpdate = true;
        }
      } else {
        if (!doc.eng && svc.eng) {
          updateData.eng = svc.eng;
          needsUpdate = true;
        }
      }

      // Handle raEng (might be stored in Service if strict was false, or mapped to estRaEng)
      const serviceRaEng = svc.raEng || svc.estRaEng || svc.obRaEng || '';
      if (!doc.raEng && serviceRaEng) {
        updateData.raEng = serviceRaEng;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await model.findByIdAndUpdate(doc._id, { $set: updateData }, { runValidators: false });
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} records in ${name}.`);
    totalUpdated += updatedCount;
  }

  console.log(`\nMigration completed. Total records updated: ${totalUpdated}`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
