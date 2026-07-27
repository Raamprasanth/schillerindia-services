const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const Division = require('./backend/models/Division');
const Service = require('./backend/models/Service');
const Scrap = require('./backend/models/Scrap');
const Csw = require('./backend/models/Csw');

async function run() {
  await mongoose.connect('mongodb+srv://supportqvs_db_user:fx58tCqbju9YSyB9@cluster1.qshoy0k.mongodb.net/iqc?appName=Cluster1');
  console.log('Connected to DB');

  const scraps = await Scrap.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
  console.log(`Found ${scraps.length} scrap records with missing division.`);

  let scrapUpdated = 0;
  for (const scrap of scraps) {
    let divName = '';
    if (scrap.serviceId) {
      const svc = await Service.findById(scrap.serviceId).populate('division').lean();
      if (svc && svc.division) {
        divName = typeof svc.division === 'object' ? svc.division.name : svc.divisionName || '';
      }
    }
    // If still missing, we could guess from engineer or scEng, but let's just use what we can find
    if (!divName && scrap.divisionName) divName = scrap.divisionName; 
    
    if (divName) {
      await Scrap.updateOne({ _id: scrap._id }, { $set: { division: divName } });
      scrapUpdated++;
    }
  }
  console.log(`Updated ${scrapUpdated} scrap records.`);

  const csws = await Csw.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
  console.log(`Found ${csws.length} CSW records with missing division.`);

  let cswUpdated = 0;
  for (const csw of csws) {
    let divName = '';
    if (csw.serviceId) {
      const svc = await Service.findById(csw.serviceId).populate('division').lean();
      if (svc && svc.division) {
        divName = typeof svc.division === 'object' ? svc.division.name : svc.divisionName || '';
      }
    }
    
    if (divName) {
      await Csw.updateOne({ _id: csw._id }, { $set: { division: divName } });
      cswUpdated++;
    }
  }
  console.log(`Updated ${cswUpdated} CSW records.`);

  process.exit(0);
}

run().catch(console.error);
