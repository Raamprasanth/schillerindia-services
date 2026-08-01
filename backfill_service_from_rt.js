const mongoose = require('mongoose');
const Service = require('./backend/models/Service');
const RTCRL = require('./backend/models/rtcrlModel');
const RTCRR = require('./backend/models/Rtcrr');

mongoose.connect('mongodb://127.0.0.1:27017/schillerindia', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to DB. Starting backfill...');
    
    // Backfill from RTCRL
    const rtcrls = await RTCRL.find({ status: 'completed' }).lean();
    let rtcrlCount = 0;
    for (const record of rtcrls) {
      if (!record.scRefNo || !record.defGirNo) continue;
      
      const updateData = {};
      if (record.repairedDate) updateData.repairedDate = record.repairedDate;
      if (record.rpDate) updateData.repBrdDate = new Date(record.rpDate).toISOString().slice(0,10);
      if (record.compUsedToRepair) updateData.components = record.compUsedToRepair;
      if (record.techRemarks) updateData.techRemarks = record.techRemarks;
      
      if (Object.keys(updateData).length > 0) {
        const res = await Service.updateOne(
          { scReNo: record.scRefNo, defGir: record.defGirNo },
          { $set: updateData }
        );
        if (res.modifiedCount > 0) rtcrlCount++;
      }
    }
    console.log(`Updated ${rtcrlCount} Service records from RTCRL.`);

    // Backfill from RTCRR
    const rtcrrs = await RTCRR.find({ status: 'completed' }).lean();
    let rtcrrCount = 0;
    for (const record of rtcrrs) {
      if (!record.scRefNo || !record.defGirNo) continue;
      
      const updateData = {};
      if (record.repairedDate) updateData.repairedDate = record.repairedDate;
      if (record.rpDate) updateData.repBrdDate = new Date(record.rpDate).toISOString().slice(0,10);
      if (record.compUsedToRepair) updateData.components = record.compUsedToRepair;
      if (record.techRemarks) updateData.techRemarks = record.techRemarks;
      
      if (Object.keys(updateData).length > 0) {
        const res = await Service.updateOne(
          { scReNo: record.scRefNo, defGir: record.defGirNo },
          { $set: updateData }
        );
        if (res.modifiedCount > 0) rtcrrCount++;
      }
    }
    console.log(`Updated ${rtcrrCount} Service records from RTCRR.`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
