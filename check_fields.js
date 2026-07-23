const mongoose = require('mongoose');
const Service = require('./backend/models/Service');
const CompletedFRN = require('./backend/models/CompletedFRN');
const Scrap = require('./backend/models/Scrap');
const SCCompletedFRN = require('./backend/models/SCCompletedFRN');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/shcl', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const svc = await Service.findOne({ raEng: { $exists: true, $ne: '' } }).lean();
  console.log("Found Service with raEng:", svc ? svc.raEng : "NONE");
  
  const comp = await CompletedFRN.findOne({ typeWork: { $in: ['Scrap', 'WS Stock'] }, eng: '' }).lean();
  console.log("CompletedFRN missing eng:", comp ? comp._id : "NONE");

  process.exit(0);
}

check().catch(console.error);
